// SSE (Server-Sent Events) consumer.
// Backend /api/v1/*/stream endpoint'leri "event: X\ndata: Y\n\n" formatinda gonderir.
// Bu helper her event'i parse edip callback'i tetikler.

import { tokenStorage, BASE_URL } from '../api/client';

function resolveStreamUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiPrefix = '/api/v1';
  if (url.startsWith(apiPrefix)) {
    const basePart = BASE_URL.replace(/\/api\/v1\/?$/, '');
    return basePart + url;
  }
  return url;
}

export interface SSEHandlers {
  onChunk?: (text: string) => void;
  onMeta?: (data: Record<string, unknown>) => void;
  onDone?: (data: Record<string, unknown>) => void;
  onError?: (data: Record<string, unknown> | Error) => void;
}

export interface StreamOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
}

/** SSE bloğunu parse edip handlers'ı çağırır. true → done/error işlendi */
function processSSEBlock(block: string, handlers: SSEHandlers): boolean {
  if (!block.trim()) return false;
  const lines = block.split('\n');
  let eventType = 'message';
  let dataStr = '';
  for (const line of lines) {
    if (line.startsWith('event:')) eventType = line.slice(6).trim();
    else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
  }
  if (!dataStr) return false;
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(dataStr);
  } catch {
    return false;
  }
  if (eventType === 'chunk') {
    const txt = typeof payload.text === 'string' ? payload.text : '';
    if (txt) handlers.onChunk?.(txt);
  } else if (eventType === 'meta') {
    handlers.onMeta?.(payload);
  } else if (eventType === 'done') {
    handlers.onDone?.(payload);
    return true;
  } else if (eventType === 'error') {
    handlers.onError?.(payload);
    return true;
  }
  return false;
}

/**
 * Verilen URL'e fetch ile bağlanır, SSE chunk'ları parse edip callback'lere iletir.
 * JWT Authorization header otomatik eklenir.
 * Stream kapandığında done/error işlenmemişse güvenlik onDone çağrısı yapılır.
 */
export async function streamSSE(
  url: string,
  handlers: SSEHandlers,
  opts: StreamOptions = {},
): Promise<void> {
  const access = tokenStorage.getAccess();
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
  };
  if (access) headers.Authorization = `Bearer ${access}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  const resolvedUrl = resolveStreamUrl(url);

  const response = await fetch(resolvedUrl, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      detail = errBody.detail || detail;
    } catch { /* ignore */ }
    handlers.onError?.(new Error(detail));
    return;
  }

  if (!response.body) {
    handlers.onError?.(new Error('Response body yok'));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let doneHandled = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE: bloklar "\n\n" ile ayrilir
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (processSSEBlock(block, handlers)) {
          doneHandled = true;
        }
      }
    }

    // Stream kapandı – kalan buffer'ı işle (son \n\n olmadan biten frameler için)
    if (buffer.trim()) {
      if (processSSEBlock(buffer, handlers)) {
        doneHandled = true;
      }
    }

    // Backend done/error göndermeden kapandıysa güvenlik çağrısı (sonsuz spinner'ı önler)
    if (!doneHandled) {
      handlers.onDone?.({});
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    handlers.onError?.(e as Error);
  }
}

