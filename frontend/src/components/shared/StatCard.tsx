import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: number;
  subtitle?: string;
  accentColor?: string; // Kept for API compatibility, but not used in light theme
}

export default function StatCard({ title, value, icon, trend, subtitle }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] border border-gray-100 p-4 flex flex-col justify-between transition-all hover:shadow-sm min-h-[120px] animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{title}</p>
          <h3 className="text-2xl font-bold mt-1 text-slate-800">{value}</h3>
        </div>
        <div className="p-2 bg-[#f9f8f4] rounded-full text-gray-400">
          {icon}
        </div>
      </div>
      
      {subtitle && <p className="text-[10px] text-gray-400 mt-2">{subtitle}</p>}
      
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-[10px] font-bold ${trend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}%</span>
        </div>
      )}
      {!subtitle && trend === undefined && <div className="h-4"></div>}
    </div>
  );
}
