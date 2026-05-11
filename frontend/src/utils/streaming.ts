// SSE (Server-Sent Events) consumer.
// Backend /api/v1/*/stream endpoint'leri "event: X\ndata: Y\n\n" formatinda gonderir.
// Bu helper her event'i parse edip callback'i tetikler.

import { tokenStorage } from '../api/client';

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

/**
 * Verilen URL'e fetch ile baglanir, SSE chunk'larini parse edip callback'lere bolusturur.
 * JWT Authorization header otomatik eklenir.
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

  const response = await fetch(url, {
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
    } catch {
      /* ignore */
    }
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

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE: bloklar "\n\n" ile ayrilir
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block.trim()) continue;
        const lines = block.split('\n');
        let eventType = 'message';
        let dataStr = '';
        for (const line of lines) {
          if (line.startsWith('event:')) eventType = line.slice(6).trim();
          else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
        }
        if (!dataStr) continue;
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(dataStr);
        } catch {
          continue;
        }
        if (eventType === 'chunk') {
          const txt = typeof payload.text === 'string' ? payload.text : '';
          if (txt) handlers.onChunk?.(txt);
        } else if (eventType === 'meta') {
          handlers.onMeta?.(payload);
        } else if (eventType === 'done') {
          handlers.onDone?.(payload);
        } else if (eventType === 'error') {
          handlers.onError?.(payload);
        }
      }
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    handlers.onError?.(e as Error);
  }
}
