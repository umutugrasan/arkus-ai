import { createContext, useCallback, useContext, useState, type ReactNode, type ReactElement } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

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

const kindConfig: Record<ToastKind, { border: string; icon: ReactElement }> = {
  success: {
    border: 'border-l-emerald-500',
    icon: <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />,
  },
  error: {
    border: 'border-l-rose-500',
    icon: <AlertCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />,
  },
  info: {
    border: 'border-l-[var(--accent-solid)]',
    icon: <Info size={16} className="text-[var(--accent)] flex-shrink-0 mt-0.5" />,
  },
  warning: {
    border: 'border-l-amber-500',
    icon: <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />,
  },
};

function ToastViewport() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)]">
      {toasts.map((t) => {
        const cfg = kindConfig[t.kind];
        return (
          <div
            key={t.id}
            className={`bg-[var(--bg-card)] border border-[var(--border-strong)] border-l-4 ${cfg.border} rounded-xl shadow-xl flex items-start gap-3 px-4 py-3 animate-fade-in`}
            role="alert"
          >
            {cfg.icon}
            <div className="flex-1 text-sm text-[var(--text-primary)] whitespace-pre-wrap">{t.message}</div>
            <button
              onClick={() => dismiss(t.id)}
              className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mt-0.5"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
