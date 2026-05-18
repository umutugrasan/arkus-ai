import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`}
    >
      {icon && (
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.08 }}
          className="w-14 h-14 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] mb-3"
        >
          {icon}
        </motion.div>
      )}
      <h3 className="text-[var(--text-primary)] font-semibold">{title}</h3>
      {description && <p className="text-[var(--text-muted)] text-sm mt-1 max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}
