/**
 * AnalysisContext - Generic Background Analysis System
 * -------------------------------------------------------
 * Tüm sayfalardaki AI analizlerini arka planda çalıştırır.
 * Sayfa değişince analiz durmaz, sonuçlar korunur.
 * Metin module-level Map'te tutulur → React re-render fırtınası olmaz.
 */

import {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import type { ReactNode } from 'react';
import { streamSSE } from '../utils/streaming';
import type { StreamOptions } from '../utils/streaming';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AnalysisStatus = 'running' | 'done' | 'error';

export interface AnalysisJobMeta {
  /** Unique key: "type::id" */
  key: string;
  type: string;       // e.g. 'reviews', 'competitors', 'financials' …
  id: string;         // productId or any unique identifier
  label: string;      // display name in badge
  status: AnalysisStatus;
  navigateTo?: string; // URL to navigate when badge is clicked
  startedAt: number;
}

export interface StartAnalysisOpts {
  type: string;
  id: string;
  label: string;
  navigateTo?: string;
  /** SSE streaming endpoint URL */
  streamUrl: string;
  streamOpts?: Omit<StreamOptions, 'signal'>;
  /** Called each time a chunk arrives (text accumulates automatically) */
  onChunk?: (chunk: string, accumulated: string) => void;
  /** Called when both streams finish (or single stream) */
  onDone?: (fullText: string) => void;
  onError?: (err: unknown) => void;
}

// ─── Module-level stores (survive component unmount & page reload) ───────────

const TEXT_STORE_KEY = 'arkus_bg_text_store';
const JOBS_STORE_KEY = 'arkus_bg_jobs_store';

const abortMap = new Map<string, AbortController>();
/** Text store: key → accumulated text */
const textStore = new Map<string, string>();
/** Subscriber store: key → Set of listeners */
type TextListener = (text: string) => void;
const textListeners = new Map<string, Set<TextListener>>();

// Init text store from localStorage
try {
  const raw = localStorage.getItem(TEXT_STORE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    Object.entries(parsed).forEach(([k, v]) => textStore.set(k, v as string));
  }
} catch { /* ignore */ }

function saveTextStore() {
  try {
    const obj = Object.fromEntries(textStore.entries());
    localStorage.setItem(TEXT_STORE_KEY, JSON.stringify(obj));
  } catch { /* ignore */ }
}

function notifyText(key: string) {
  const text = textStore.get(key) ?? '';
  textListeners.get(key)?.forEach((fn) => fn(text));
}

function mkKey(type: string, id: string) {
  return `${type}::${id}`;
}

export interface StartFetchAnalysisOpts {
  type: string;
  id: string;
  label: string;
  navigateTo?: string;
  /** Async function that returns the full analysis text */
  fetchFn: () => Promise<string>;
  onDone?: (text: string) => void;
  onError?: (err: unknown) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface AnalysisContextValue {
  jobs: AnalysisJobMeta[];
  startAnalysis: (opts: StartAnalysisOpts) => string;
  startFetchAnalysis: (opts: StartFetchAnalysisOpts) => void;
  getJobMeta: (type: string, id: string) => AnalysisJobMeta | undefined;
  getJobText: (type: string, id: string) => string;
  subscribeText: (type: string, id: string, listener: TextListener) => () => void;
  dismissJob: (type: string, id: string) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AnalysisProvider({ children }: { children: ReactNode }) {
  // Only status/meta in React state — text is in module-level Map
  const [jobs, setJobs] = useState<AnalysisJobMeta[]>(() => {
    try {
      const raw = localStorage.getItem(JOBS_STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // If a job was running when the page reloaded, mark it as error since the stream/fetch died
        return parsed.map((j: AnalysisJobMeta) => j.status === 'running' ? { ...j, status: 'error' } : j);
      }
    } catch { /* ignore */ }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(JOBS_STORE_KEY, JSON.stringify(jobs));
    } catch { /* ignore */ }
  }, [jobs]);

  const upsertMeta = useCallback((meta: AnalysisJobMeta) => {
    setJobs((prev) => {
      const idx = prev.findIndex((j) => j.key === meta.key);
      if (idx === -1) return [...prev, meta];
      const next = [...prev];
      next[idx] = meta;
      return next;
    });
  }, []);

  const patchMeta = useCallback((key: string, patch: Partial<AnalysisJobMeta>) => {
    setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, ...patch } : j)));
  }, []);

  const startAnalysis = useCallback((opts: StartAnalysisOpts): string => {
    const key = mkKey(opts.type, opts.id);

    // Cancel existing stream for this key
    abortMap.get(key)?.abort();
    const ctrl = new AbortController();
    abortMap.set(key, ctrl);

    // Reset text
    textStore.set(key, '');
    notifyText(key);

    // Register job as running
    upsertMeta({
      key,
      type: opts.type,
      id: opts.id,
      label: opts.label,
      navigateTo: opts.navigateTo,
      status: 'running',
      startedAt: Date.now(),
    });

    // Start SSE stream
    streamSSE(
      opts.streamUrl,
      {
        onChunk: (chunk) => {
          const prev = textStore.get(key) ?? '';
          const next = prev + chunk;
          textStore.set(key, next);
          notifyText(key);        // pub-sub, NO React setState
          opts.onChunk?.(chunk, next);
        },
        onDone: () => {
          patchMeta(key, { status: 'done' });  // ONE React setState
          const fullText = textStore.get(key) ?? '';
          saveTextStore();
          opts.onDone?.(fullText);
          abortMap.delete(key);
        },
        onError: (err) => {
          patchMeta(key, { status: 'error' });
          opts.onError?.(err);
          abortMap.delete(key);
        },
      },
      { ...(opts.streamOpts ?? {}), signal: ctrl.signal },
    );

    return key;
  }, [upsertMeta, patchMeta]);

  const startFetchAnalysis = useCallback((opts: StartFetchAnalysisOpts): void => {
    const key = mkKey(opts.type, opts.id);

    // Reset & register
    textStore.set(key, '');
    notifyText(key);
    upsertMeta({
      key,
      type: opts.type,
      id: opts.id,
      label: opts.label,
      navigateTo: opts.navigateTo,
      status: 'running',
      startedAt: Date.now(),
    });

    // Run async fetch in the background (not awaited here)
    opts.fetchFn()
      .then((text) => {
        textStore.set(key, text);
        notifyText(key);
        saveTextStore();
        patchMeta(key, { status: 'done' });
        opts.onDone?.(text);
      })
      .catch((err) => {
        patchMeta(key, { status: 'error' });
        opts.onError?.(err);
      });
  }, [upsertMeta, patchMeta]);

  const getJobMeta = useCallback(
    (type: string, id: string) => jobs.find((j) => j.key === mkKey(type, id)),
    [jobs],
  );

  const getJobText = useCallback(
    (type: string, id: string) => textStore.get(mkKey(type, id)) ?? '',
    [],
  );

  const subscribeText = useCallback(
    (type: string, id: string, listener: TextListener) => {
      const key = mkKey(type, id);
      if (!textListeners.has(key)) textListeners.set(key, new Set());
      textListeners.get(key)!.add(listener);
      listener(textStore.get(key) ?? '');
      return () => { textListeners.get(key)?.delete(listener); };
    },
    [],
  );

  const dismissJob = useCallback((type: string, id: string) => {
    const key = mkKey(type, id);
    abortMap.get(key)?.abort();
    abortMap.delete(key);
    // DO NOT delete from textStore or textListeners so analysis survives badge dismissal
    setJobs((prev) => prev.filter((j) => j.key !== key));
  }, []);

  return (
    <AnalysisContext.Provider
      value={{ jobs, startAnalysis, startFetchAnalysis, getJobMeta, getJobText, subscribeText, dismissJob }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be used inside <AnalysisProvider>');
  return ctx;
}

/**
 * useAnalysisText — subscribes to streaming text for a specific job.
 * Re-renders ONLY this component on text updates, not the whole tree.
 */
export function useAnalysisText(type: string, id: string): string {
  const { subscribeText } = useAnalysis();
  const [text, setText] = useState('');

  useEffect(() => {
    if (!id) return;
    return subscribeText(type, id, setText);
  }, [type, id, subscribeText]);

  return text;
}

/**
 * useBackgroundAnalysis — drop-in replacement for local AI analysis state.
 *
 * Usage:
 *   const { text, isStreaming, isDone, start } = useBackgroundAnalysis({
 *     type: 'competitors',
 *     id: selectedProductId,
 *     label: 'Rakip Analizi',
 *     navigateTo: '/competitors',
 *   });
 */
export interface UseBackgroundAnalysisOpts {
  type: string;
  id: string;
  label: string;
  navigateTo?: string;
}

export function useBackgroundAnalysis(opts: UseBackgroundAnalysisOpts) {
  const { startAnalysis, startFetchAnalysis, getJobMeta } = useAnalysis();
  const text = useAnalysisText(opts.type, opts.id);

  const jobMeta = getJobMeta(opts.type, opts.id);
  const isRunning = jobMeta?.status === 'running';
  const isDone = jobMeta?.status === 'done';

  /** Start as SSE stream */
  const startStream = useCallback(
    (streamUrl: string, streamOpts?: Omit<StreamOptions, 'signal'>) => {
      startAnalysis({ ...opts, streamUrl, streamOpts });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opts.type, opts.id, opts.label, opts.navigateTo, startAnalysis],
  );

  /** Start as regular fetch (non-SSE) */
  const startFetch = useCallback(
    (fetchFn: () => Promise<string>, callbacks?: { onDone?: (t: string) => void; onError?: (e: unknown) => void }) => {
      startFetchAnalysis({ ...opts, fetchFn, ...callbacks });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opts.type, opts.id, opts.label, opts.navigateTo, startFetchAnalysis],
  );

  return { text, isRunning, isDone, startStream, startFetch, jobMeta };
}

// ─── Backwards compat ────────────────────────────────────────────────────────
export type AnalysisType = 'reviews';
