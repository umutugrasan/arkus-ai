import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Target,
  Percent, RotateCcw, BarChart3, Calendar, Sparkles, RefreshCw,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import PageHeader from '../components/shared/PageHeader';
import StatCard from '../components/shared/StatCard';
import GlassCard from '../components/shared/GlassCard';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import EmptyState from '../components/shared/EmptyState';
import Button from '../components/ui/Button';
import { Skeleton, SkeletonCard } from '../components/shared/Skeleton';
import { dashboardService } from '../services';
import { streamSSE } from '../utils/streaming';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errors';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters';
import { MARKETPLACES, MP_CHART_COLORS } from '../utils/constants';
import type {
  AiSummaryResponse, DashboardOverview, MarketplaceSummary, TrendsResponse,
} from '../types/api';

type TrendPeriod = 7 | 30;

export default function DashboardPage() {
  const toast = useToast();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [mpSummaries, setMpSummaries] = useState<MarketplaceSummary[]>([]);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>(7);
  const [loading, setLoading] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(false);

  // AI Summary streaming state
  const [aiText, setAiText] = useState('');
  const [aiSources] = useState<AiSummaryResponse['web_sources']>([]);
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiSnapshot, setAiSnapshot] = useState<AiSummaryResponse['snapshot'] | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, ms, tr] = await Promise.all([
        dashboardService.overview(),
        dashboardService.marketplaceSummary(),
        dashboardService.trends(trendPeriod),
      ]);
      setOverview(ov);
      setMpSummaries(ms.marketplaces);
      setTrends(tr);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Dashboard verisi yüklenemedi'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Trend period değişince sadece trends çek
  useEffect(() => {
    if (loading) return;
    setLoadingTrend(true);
    dashboardService
      .trends(trendPeriod)
      .then(setTrends)
      .catch((e) => toast.error(getErrorMessage(e, 'Trend yüklenemedi')))
      .finally(() => setLoadingTrend(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendPeriod]);

  const runAiSummary = useCallback(() => {
    aiAbortRef.current?.abort();
    const ctrl = new AbortController();
    aiAbortRef.current = ctrl;
    setAiText('');
    setAiSnapshot(null);
    setAiStreaming(true);

    streamSSE(
      '/api/v1/dashboard/ai-summary/stream',
      {
        onMeta: (m) => {
          if (m.snapshot && typeof m.snapshot === 'object') {
            setAiSnapshot(m.snapshot as AiSummaryResponse['snapshot']);
          }
        },
        onChunk: (text) => setAiText((prev) => prev + text),
        onDone: () => setAiStreaming(false),
        onError: (e) => {
          setAiStreaming(false);
          const msg = e instanceof Error ? e.message : (e as Record<string, unknown>).error;
          toast.error(typeof msg === 'string' ? msg : 'AI özet alınamadı');
        },
      },
      { signal: ctrl.signal },
    );
  }, [toast]);

  useEffect(() => {
    if (!loading && overview) runAiSummary();
    return () => aiAbortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" subtitle="Yükleniyor…" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!overview) {
    return <EmptyState title="Veri yok" description="Bağlı pazaryeri görünmüyor." />;
  }

  const o = overview.overall;
  const trendData = trends?.daily
    ? trends.daily.map((d) => ({ name: d.date.slice(5), Ciro: d.revenue, Satış: d.sales, İade: d.returns }))
    : trends?.weekly?.map((w) => ({ name: w.week, Ciro: w.revenue, Satış: w.sales, İade: w.returns })) || [];

  const mpBarData = mpSummaries.map((m) => ({
    name: MARKETPLACES[m.marketplace]?.label || m.marketplace,
    Ciro: m.total_revenue,
    NetKar: m.total_net_profit,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard"
        subtitle="Tüm pazaryerlerinin birleşik genel görünümü"
        icon={<BarChart3 size={20} />}
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw size={14} />}
            onClick={() => { loadAll(); runAiSummary(); }}
          >
            Yenile
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title="Toplam Ciro"
          value={formatCurrency(o.total_revenue)}
          icon={<DollarSign size={18} />}
          accentColor="indigo"
          subtitle="Son 30 gün"
        />
        <StatCard
          title="Net Kâr"
          value={formatCurrency(o.total_net_after_ads)}
          icon={<TrendingUp size={18} />}
          accentColor="emerald"
          subtitle="Reklamdan sonra"
        />
        <StatCard
          title="Kâr Marjı"
          value={formatPercent(o.overall_net_margin)}
          icon={<Percent size={18} />}
          accentColor="violet"
        />
        <StatCard
          title="Toplam Satış"
          value={formatNumber(o.total_sales)}
          icon={<ShoppingCart size={18} />}
          accentColor="cyan"
          subtitle="Adet"
        />
        <StatCard
          title="ROAS"
          value={o.overall_roas ? `${o.overall_roas.toFixed(2)}x` : '—'}
          icon={<Target size={18} />}
          accentColor="amber"
          subtitle="Reklam getirisi"
        />
        <StatCard
          title="İade Oranı"
          value={formatPercent(o.overall_return_rate)}
          icon={<RotateCcw size={18} />}
          accentColor="rose"
        />
      </div>

      {/* AI Summary (streaming) */}
      <StreamingMarkdown
        title="Bugünün Özeti — Basiret AI"
        content={aiText}
        streaming={aiStreaming}
        webSources={aiSources}
      />

      {aiSnapshot && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniMetric label="Son 7g Satış" value={formatNumber(aiSnapshot.sales_7d)} />
          <MiniMetric label="Son 7g Ciro" value={formatCurrency(aiSnapshot.revenue_7d)} />
          <MiniMetric
            label="Stok Kritik"
            value={aiSnapshot.low_stock_count}
            highlight={aiSnapshot.low_stock_count > 0}
          />
          <MiniMetric
            label="Düşük Puan"
            value={aiSnapshot.low_rated_count}
            highlight={aiSnapshot.low_rated_count > 0}
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-indigo-400" />
                <h3 className="text-white font-semibold">Trend</h3>
              </div>
              <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700/60 rounded-lg p-0.5">
                {([7, 30] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setTrendPeriod(p)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      trendPeriod === p
                        ? 'bg-indigo-500/30 text-indigo-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p} gün
                  </button>
                ))}
              </div>
            </div>
            {loadingTrend ? (
              <Skeleton className="h-64 w-full" />
            ) : trendData.length === 0 ? (
              <EmptyState
                icon={<TrendingDown size={24} />}
                title="Trend verisi yok"
                description="Henüz sipariş verisi yok ya da senkronize edilmedi."
              />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Ciro" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Satış" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="İade" stroke="#f43f5e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        </div>

        <div>
          <GlassCard className="p-5 h-full">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-violet-400" />
              <h3 className="text-white font-semibold">Pazaryeri Kırılımı</h3>
            </div>
            {mpBarData.length === 0 ? (
              <EmptyState title="Pazaryeri yok" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={mpBarData} layout="vertical">
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} width={80} />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="Ciro" radius={[0, 6, 6, 0]}>
                    {mpBarData.map((_, i) => (
                      <Cell key={i} fill={MP_CHART_COLORS[i % MP_CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Marketplace özet kartlar */}
      <div>
        <h3 className="text-white font-semibold mb-3">Pazaryeri Özet Kartları</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mpSummaries.map((mp) => {
            const cfg = MARKETPLACES[mp.marketplace];
            return (
              <GlassCard key={mp.marketplace} className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs font-semibold ${cfg?.textColor || 'text-slate-400'}`}>
                      {cfg?.label || mp.marketplace}
                    </p>
                    <p className="text-white font-bold mt-0.5 truncate" title={mp.store_name}>
                      {mp.store_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-400 font-bold text-sm">⭐ {mp.store_rating?.toFixed(1) ?? '—'}</p>
                    <p className="text-slate-500 text-[10px]">{mp.product_count} ürün</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Row label="Ciro" value={formatCurrency(mp.total_revenue)} />
                  <Row label="Net Kâr" value={formatCurrency(mp.total_net_profit)} positive={mp.total_net_profit >= 0} />
                  <Row label="Marj" value={formatPercent(mp.net_margin_pct)} />
                  <Row label="Satış" value={formatNumber(mp.total_sales)} />
                  <Row label="ROAS" value={mp.roas ? `${mp.roas.toFixed(2)}x` : '—'} />
                  <Row label="İade %" value={formatPercent(mp.return_rate)} />
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`glass-card p-3 ${highlight ? 'border-amber-500/30' : ''}`}>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function Row({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <p className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">{label}</p>
      <p
        className={`font-semibold ${
          positive === false ? 'text-rose-400' : positive ? 'text-emerald-400' : 'text-slate-200'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
