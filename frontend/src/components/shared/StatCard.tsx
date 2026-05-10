import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: number;
  subtitle?: string;
  accentColor?: string;
}

export default function StatCard({ title, value, icon, trend, subtitle, accentColor = 'indigo' }: StatCardProps) {
  const colorMap: Record<string, string> = {
    indigo: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20',
    violet: 'from-violet-500/20 to-violet-600/10 border-violet-500/20',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20',
    rose: 'from-rose-500/20 to-rose-600/10 border-rose-500/20',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/20',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/20',
  };

  const iconColorMap: Record<string, string> = {
    indigo: 'bg-indigo-500/20 text-indigo-400',
    violet: 'bg-violet-500/20 text-violet-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    rose: 'bg-rose-500/20 text-rose-400',
    amber: 'bg-amber-500/20 text-amber-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
  };

  return (
    <div className={`glass-card p-5 bg-gradient-to-br ${colorMap[accentColor] || colorMap.indigo} animate-fade-in`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-slate-400 text-xs mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${iconColorMap[accentColor] || iconColorMap.indigo}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
