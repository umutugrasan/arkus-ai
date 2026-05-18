import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: number;
  subtitle?: string;
  /** Stagger sırası için; container'da delay = index * 0.05 işe yarar */
  index?: number;
  accentColor?: string; // API uyumluluğu için tutuluyor, light theme'de kullanılmıyor
}

export default function StatCard({ title, value, icon, trend, subtitle, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: index * 0.04 }}
      whileHover={{
        y: -3,
        boxShadow: '0 12px 28px rgba(74, 63, 68, 0.08), 0 4px 10px rgba(74, 63, 68, 0.04)',
        transition: { duration: 0.18 },
      }}
      className="bg-[var(--bg-card)] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.012)] border border-[var(--border-color)] p-5 flex flex-col justify-between min-h-[120px] group"
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wide">{title}</p>
          <h3 className="text-2xl font-bold mt-1 text-[var(--text-primary)]">{value}</h3>
        </div>
        <motion.div
          whileHover={{ rotate: 8, scale: 1.08 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="p-2 bg-[var(--bg-primary)] rounded-full text-[var(--text-faint)] group-hover:text-[var(--accent)] group-hover:bg-[var(--bg-muted)] transition-colors"
        >
          {icon}
        </motion.div>
      </div>

      {subtitle && <p className="text-[10px] text-[var(--text-faint)] mt-2">{subtitle}</p>}

      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-[10px] font-bold ${trend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}%</span>
        </div>
      )}
      {!subtitle && trend === undefined && <div className="h-4"></div>}
    </motion.div>
  );
}
