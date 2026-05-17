import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  /** Stagger sırası için */
  index?: number;
  /** Entrance animasyonunu kapat */
  noAnimate?: boolean;
}

export default function GlassCard({
  children,
  className = '',
  onClick,
  hover = false,
  index = 0,
  noAnimate = false,
}: GlassCardProps) {
  const base =
    'bg-[var(--bg-card)] rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] border border-[var(--border-color)] p-4 sm:p-6 transition-shadow duration-200';
  const hoverCls = hover ? 'hover:shadow-md cursor-pointer' : '';

  if (noAnimate) {
    return (
      <div onClick={onClick} className={`${base} ${hoverCls} ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: 'easeOut', delay: index * 0.05 }}
      whileHover={hover ? { y: -2, transition: { duration: 0.15 } } : undefined}
      onClick={onClick}
      className={`${base} ${hoverCls} ${className}`}
    >
      {children}
    </motion.div>
  );
}
