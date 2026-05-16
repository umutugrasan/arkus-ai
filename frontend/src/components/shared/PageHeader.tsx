import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export default function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-wrap items-start justify-between gap-3 mb-6"
    >
      <div className="flex items-center gap-3">
        {icon && (
          <motion.div
            initial={{ scale: 0.85, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 20, delay: 0.05 }}
            className="w-12 h-12 rounded-xl bg-[#4a3f44] text-white flex items-center justify-center shadow-sm shadow-[#4a3f44]/20"
          >
            {icon}
          </motion.div>
        )}
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-slate-800 tracking-tight">{title}</h1>
          {subtitle && <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut', delay: 0.1 }}
          className="flex items-center gap-2 flex-wrap"
        >
          {actions}
        </motion.div>
      )}
    </motion.div>
  );
}
