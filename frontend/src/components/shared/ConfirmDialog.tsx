import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '../../context/I18nContext';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  const handleConfirm = async () => {
    if (busy) return;
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  const confirmClasses =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-[0_4px_16px_rgba(225,29,72,0.3)]'
      : 'bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] shadow-[0_4px_16px_rgba(74,63,68,0.2)]';

  const iconWrapClasses =
    variant === 'danger'
      ? 'bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/20'
      : 'bg-[var(--accent)]/10 text-[var(--accent)] ring-1 ring-[var(--accent)]/20';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !busy && onCancel()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-2xl w-full max-w-md overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${iconWrapClasses}`}>
                  <AlertTriangle size={18} />
                </div>
                <h3 id="confirm-dialog-title" className="text-[var(--text-primary)] font-semibold text-base">
                  {title}
                </h3>
              </div>
              <button
                onClick={onCancel}
                disabled={busy}
                className="p-1.5 hover:bg-[var(--bg-muted)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
                aria-label="Kapat"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{message}</p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <button
                onClick={onCancel}
                disabled={busy}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--bg-elevated)] hover:bg-[var(--bg-muted)] border border-[var(--border-strong)] text-[var(--text-secondary)] transition-all disabled:opacity-40"
              >
                {cancelLabel ?? t('common.cancel')}
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${confirmClasses}`}
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {confirmLabel ?? t('common.confirm')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
