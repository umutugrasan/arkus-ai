import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, ShoppingCart, RotateCcw, Zap, DollarSign, Store, Bot, FileText, Bell, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { dashboardService } from '../services';
import StatCard from '../components/shared/StatCard';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import { formatCurrency, formatPercent, formatNumber } from '../utils/formatters';
import { MP_CHART_COLORS } from '../utils/constants';

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs border-indigo-500/20">
      <p className="text-slate-300 font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-medium">{p.name === 'Gelir' ? formatCurrency(p.value) : formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [marketplaces, setMarketplaces] = useState<Record<string, unknown>[]>([]);
  const [trends, setTrends] = useState<{ date?: string; week?: string; revenue: number; sales: number; returns: number }[]>([]);
  const [period, setPeriod] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, mp, tr] = await Promise.all([
        dashboardService.getOverview(),
        dashboardService.getMarketplaceSummary(),
        dashboardService.getTrends(period),
      ]);
      setOverview(ov.overall);
      setMarketplaces(mp.marketplaces || []);
      setTrends(tr.daily || tr.weekly || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <LoadingSpinner message="Veriler yükleniyor..." size="lg" />;

  const trendData = trends.map(t => ({
    name: t.date ? t.date.slice(5) : t.week,
    Gelir: t.revenue,
    Satış: t.sales,
    İade: t.returns,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Toplam Gelir" value={formatCurrency(overview?.total_revenue || 0)} icon={<DollarSign size={18} />} accentColor="indigo" />
        <StatCard title="Net Kâr" value={formatCurrency(overview?.total_net_after_ads || 0)} icon={<TrendingUp size={18} />} accentColor="emerald" />
        <StatCard title="Toplam Satış" value={formatNumber(overview?.total_sales || 0)} icon={<ShoppingCart size={18} />} accentColor="violet" subtitle="30 günlük" />
        <StatCard title="İade Oranı" value={formatPercent(overview?.overall_return_rate || 0)} icon={<RotateCcw size={18} />} accentColor="rose" />
        <StatCard title="ROAS" value={`${(overview?.overall_roas || 0).toFixed(2)}x`} icon={<Zap size={18} />} accentColor="amber" />
        <StatCard title="Pazaryeri" value={marketplaces.length} icon={<Store size={18} />} accentColor="cyan" subtitle="aktif bağlantı" />
      </div>

      {/* Trend Chart */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Satış Trendi</h3>
          <div className="flex gap-1 bg-slate-800/60 rounded-lg p-1">
            {([7, 30] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${period === p ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {p === 7 ? '7 Gün' : '30 Gün'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="gelirGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₺${(v / 1000).toFixed(0)}K`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Area type="monotone" dataKey="Gelir" stroke="#6366f1" strokeWidth={2} fill="url(#gelirGrad)" />
            <Area type="monotone" dataKey="Satış" stroke="#22c55e" strokeWidth={2} fill="none" />
          </AreaChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* Marketplace Summary */}
      <GlassCard>
        <h3 className="text-white font-semibold mb-4">Pazaryeri Karşılaştırması</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                {['Pazaryeri', 'Gelir', 'Net Kâr', 'Marj %', 'Satış', 'İade %', 'ROAS', 'Puan'].map(h => (
                  <th key={h} className="text-left text-slate-400 text-xs font-medium pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {marketplaces.map((mp: Record<string, unknown>, i) => (
                <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 pr-4"><MarketplaceBadge marketplace={mp.marketplace as string} /></td>
                  <td className="py-3 pr-4 text-white font-medium">{formatCurrency(mp.total_revenue as number)}</td>
                  <td className={`py-3 pr-4 font-medium ${(mp.total_net_profit as number) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(mp.total_net_profit as number)}
                  </td>
                  <td className="py-3 pr-4 text-slate-300">{formatPercent(mp.net_margin_pct as number)}</td>
                  <td className="py-3 pr-4 text-slate-300">{formatNumber(mp.total_sales as number)}</td>
                  <td className="py-3 pr-4 text-slate-300">{formatPercent(mp.return_rate as number)}</td>
                  <td className="py-3 pr-4 text-slate-300">{(mp.roas as number).toFixed(2)}x</td>
                  <td className="py-3 pr-4">
                    <span className="text-amber-400 font-medium">⭐ {(mp.store_rating as number)?.toFixed(1) || '-'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Revenue by Marketplace (Bar) */}
      <GlassCard>
        <h3 className="text-white font-semibold mb-4">Pazaryeri Gelir Karşılaştırması</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={marketplaces.map((mp: Record<string, unknown>) => ({
            name: mp.marketplace === 'amazon_tr' ? 'Amazon TR' : mp.marketplace === 'hepsiburada' ? 'Hepsiburada' : 'Trendyol',
            Gelir: mp.total_revenue,
            'Net Kâr': mp.total_net_profit,
          }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `₺${(v / 1000).toFixed(0)}K`} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Bar dataKey="Gelir" fill={MP_CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Net Kâr" fill={MP_CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* Quick Actions */}
      <div>
        <h3 className="text-slate-300 text-sm font-medium mb-3">Hızlı Aksiyonlar</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'AI Danışman', icon: Bot, color: 'indigo', to: '/chat' },
            { label: 'Rapor Oluştur', icon: FileText, color: 'violet', to: '/reports' },
            { label: 'Bildirimler', icon: Bell, color: 'amber', to: '/notifications' },
            { label: 'Sağlık Skoru', icon: RefreshCw, color: 'emerald', to: '/health' },
          ].map(({ label, icon: Icon, color, to }) => (
            <GlassCard key={label} hover onClick={() => navigate(to)} className={`flex items-center gap-3 bg-${color}-500/5`}>
              <div className={`p-2 rounded-lg bg-${color}-500/20`}>
                <Icon size={16} className={`text-${color}-400`} />
              </div>
              <span className="text-slate-300 text-sm font-medium">{label}</span>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
}
