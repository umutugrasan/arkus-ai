import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (kind: ToastKind, message: string, duration?: number) => void;
  success: (msg: string, duration?: number) => void;
  error: (msg: string, duration?: number) => void;
  info: (msg: string, duration?: number) => void;
  warning: (msg: string, duration?: number) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string, duration = 4000) => {
    const id = ++counter;
    setToasts((t) => [...t, { id, kind, message, duration }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        push,
        success: (m, d) => push('success', m, d),
        error: (m, d) => push('error', m, d ?? 6000),
        info: (m, d) => push('info', m, d),
        warning: (m, d) => push('warning', m, d),
        dismiss,
      }}
    >
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

function ToastViewport() {
  const { toasts, dismiss } = useToast();
  const kindClass: Record<ToastKind, string> = {
    success: 'bg-emerald-600 border-emerald-400',
    error: 'bg-rose-600 border-rose-400',
    info: 'bg-[#4a3f44] border-[#6b6266]',
    warning: 'bg-amber-500 border-amber-300',
  };
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-md">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${kindClass[t.kind]} text-white px-4 py-3 rounded-lg border shadow-2xl flex items-start gap-3 animate-fade-in`}
          role="alert"
        >
          <div className="flex-1 text-sm whitespace-pre-wrap">{t.message}</div>
          <button onClick={() => dismiss(t.id)} className="text-white/80 hover:text-white text-xs">✕</button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
