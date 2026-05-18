import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Target,
  Percent, RotateCcw, BarChart3, Calendar, Sparkles, RefreshCw,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
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
import { pageVariants, staggerItem } from '../utils/motion';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../hooks/useTheme';
import { getChartTheme } from '../utils/chartTheme';
import type {
  AiSummaryResponse, DashboardOverview, MarketplaceSummary, TrendsResponse,
} from '../types/api';

type TrendPeriod = 7 | 30;

export default function DashboardPage() {
  const toast = useToast();
  const { t, locale } = useI18n();
  const { isDark } = useTheme();
  const chart = getChartTheme(isDark);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [mpSummaries, setMpSummaries] = useState<MarketplaceSummary[]>([]);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>(7);
  const [loading, setLoading] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(false);

  // AI Summary streaming state
  const [aiText, setAiText] = useState('');
  const [aiSources, setAiSources] = useState<AiSummaryResponse['web_sources']>([]);
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSnapshot, setAiSnapshot] = useState<AiSummaryResponse['snapshot'] | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);

  const getDashboardCacheKey = () => `arkus_dashboard_summary_${new Date().toISOString().split('T')[0]}`;

  interface DashboardAICache {
    aiText: string;
    aiSources: AiSummaryResponse['web_sources'];
    snapshot: AiSummaryResponse['snapshot'] | null;
  }

  /** DB snapshot'tan basit özet üretir (Gemini yokken fallback) */
  const buildFallbackSummary = (snap: AiSummaryResponse['snapshot']): string => {
    const nf = (n: number) => n.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 0 });
    const parts: string[] = [
      t('dashboard.fb_summary_30d')
        .replace('{revenue}', nf(snap.total_revenue_30d))
        .replace('{profit}', nf(snap.net_profit_30d))
        .replace('{margin}', String(snap.net_margin_pct)),
      t('dashboard.fb_summary_7d')
        .replace('{sales}', String(snap.sales_7d))
        .replace('{revenue}', nf(snap.revenue_7d)),
    ];
    if (snap.low_stock_count > 0) parts.push(t('dashboard.fb_low_stock').replace('{count}', String(snap.low_stock_count)));
    if (snap.low_rated_count > 0) parts.push(t('dashboard.fb_low_rated').replace('{count}', String(snap.low_rated_count)));
    parts.push(t('dashboard.fb_note'));
    return parts.join('\n\n');
  };

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
      toast.error(getErrorMessage(e, t('dashboard.load_failed')));
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
      .catch((e) => toast.error(getErrorMessage(e, t('dashboard.trend_load_failed'))))
      .finally(() => setLoadingTrend(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendPeriod]);

  const runAiSummary = useCallback(() => {
    aiAbortRef.current?.abort();
    const ctrl = new AbortController();
    aiAbortRef.current = ctrl;
    setAiText('');
    setAiSnapshot(null);
    setAiError(null);
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
        onDone: (data) => {
          setAiStreaming(false);
          if (data.full_text && typeof data.full_text === 'string' && !aiText) {
            setAiText(data.full_text as string);
          }
          if (Array.isArray(data.sources)) setAiSources(data.sources as AiSummaryResponse['web_sources']);
          
          // Cache the final result
          setAiText((finalText) => {
            setAiSources((finalSources) => {
              setAiSnapshot((finalSnapshot) => {
                try {
                  localStorage.setItem(getDashboardCacheKey(), JSON.stringify({
                    aiText: data.full_text || finalText,
                    aiSources: data.sources || finalSources,
                    snapshot: finalSnapshot,
                  }));
                } catch { /* ignore */ }
                return finalSnapshot;
              });
              return finalSources;
            });
            return finalText;
          });
        },
        onError: (e) => {
          setAiStreaming(false);
          const msg = e instanceof Error ? e.message : String((e as Record<string, unknown>).error || 'AI özet alınamadı');
          setAiError(msg);
          // Snapshot varsa fallback özet üret
          setAiSnapshot((snap) => {
            if (snap) {
              const fallbackText = buildFallbackSummary(snap);
              setAiText(fallbackText);
              try {
                localStorage.setItem(getDashboardCacheKey(), JSON.stringify({
                  aiText: fallbackText,
                  aiSources: [],
                  snapshot: snap,
                }));
              } catch { /* ignore */ }
            }
            return snap;
          });
        },
      },
      { signal: ctrl.signal },
    );
  }, [toast, buildFallbackSummary]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && overview) {
      try {
        const cached = localStorage.getItem(getDashboardCacheKey());
        if (cached) {
          const parsed = JSON.parse(cached) as DashboardAICache;
          if (parsed.aiText) {
            setAiText(parsed.aiText);
            setAiSources(parsed.aiSources || []);
            setAiSnapshot(parsed.snapshot);
            return;
          }
        }
      } catch { /* ignore */ }
      runAiSummary();
    }
    return () => aiAbortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.loading')} />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!overview) {
    return <EmptyState title={t('dashboard.no_data')} description={t('dashboard.no_data_desc')} />;
  }

  const o = overview.overall;
  
  const connectedMps = mpSummaries.map(m => m.marketplace);
  const trendData = trends?.daily
    ? trends.daily.map((d) => {
        const item: any = { name: d.date.slice(5) };
        const record = d as Record<string, any>;
        // Eksik pazaryeri değerlerini 0 ile doldur (undefined bırakmak çizgiyi koparır)
        connectedMps.forEach(mp => { item[mp] = record[mp] !== undefined && record[mp] !== null ? Number(record[mp]) : 0; });
        return item;
      })
    : trends?.weekly?.map((w) => {
        const item: any = { name: w.week };
        const record = w as Record<string, any>;
        connectedMps.forEach(mp => { item[mp] = record[mp] !== undefined && record[mp] !== null ? Number(record[mp]) : 0; });
        return item;
      }) || [];

  const mpBarData = mpSummaries.map((m) => ({
    name: MARKETPLACES[m.marketplace]?.label || m.marketplace,
    Ciro: m.total_revenue,
    NetKar: m.total_net_profit,
  }));

  return (
    <motion.div className="space-y-6" variants={pageVariants} initial="hidden" animate="visible">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        icon={<BarChart3 size={20} />}
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw size={14} />}
            onClick={() => { loadAll(); runAiSummary(); }}
          >
            {t('dashboard.refresh')}
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title={t('dashboard.total_revenue')}
          value={formatCurrency(o.total_revenue)}
          icon={<DollarSign size={18} />}
          accentColor="indigo"
          subtitle={t('dashboard.last_30d')}
          index={0}
        />
        <StatCard
          title={t('dashboard.net_profit')}
          value={formatCurrency(o.total_net_after_ads)}
          icon={<TrendingUp size={18} />}
          accentColor="emerald"
          subtitle={t('dashboard.after_ads')}
          index={1}
        />
        <StatCard
          title={t('dashboard.profit_margin')}
          value={formatPercent(o.overall_net_margin)}
          icon={<Percent size={18} />}
          accentColor="violet"
          index={2}
        />
        <StatCard
          title={t('dashboard.total_sales')}
          value={formatNumber(o.total_sales)}
          icon={<ShoppingCart size={18} />}
          accentColor="cyan"
          subtitle={t('dashboard.units')}
          index={3}
        />
        <StatCard
          title={t('dashboard.roas')}
          value={o.overall_roas ? `${o.overall_roas.toFixed(2)}x` : '—'}
          icon={<Target size={18} />}
          accentColor="amber"
          subtitle={t('dashboard.ad_return')}
          index={4}
        />
        <StatCard
          title={t('dashboard.return_rate')}
          value={formatPercent(o.overall_return_rate)}
          icon={<RotateCcw size={18} />}
          accentColor="rose"
          index={5}
        />
      </div>

      {/* AI Summary (streaming) */}
      <StreamingMarkdown
        title={t('dashboard.ai_summary')}
        content={aiText}
        streaming={aiStreaming}
        webSources={aiSources}
      />
      {/* AI hata göstergesi (fallback özet gösteriliyorsa bilgi notu) */}
      {aiError && !aiStreaming && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600">
          <span>{t('dashboard.ai_error')} ({aiError})</span>
          <button onClick={runAiSummary} className="ml-4 underline font-medium hover:text-amber-700">{t('common.retry')}</button>
        </div>
      )}

      {aiSnapshot && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniMetric label={t('dashboard.7d_sales')} value={formatNumber(aiSnapshot.sales_7d)} />
          <MiniMetric label={t('dashboard.7d_revenue')} value={formatCurrency(aiSnapshot.revenue_7d)} />
          <MiniMetric
            label={t('dashboard.low_stock')}
            value={aiSnapshot.low_stock_count}
            highlight={aiSnapshot.low_stock_count > 0}
          />
          <MiniMetric
            label={t('dashboard.low_rated')}
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
                <Calendar size={16} className="text-[var(--text-faint)]" />
                <h3 className="text-[var(--text-primary)] font-bold">{t('dashboard.trend')}</h3>
              </div>
              <div className="flex items-center gap-1 bg-[var(--bg-muted)] rounded-lg p-1">
                {([7, 30] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setTrendPeriod(p)}
                    className={`px-3 py-1 text-xs font-semibold rounded shadow-sm transition-colors ${
                      trendPeriod === p
                        ? 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    {p} {t('dashboard.days')}
                  </button>
                ))}
              </div>
            </div>
            {loadingTrend ? (
              <Skeleton className="h-64 w-full" />
            ) : trendData.length === 0 ? (
              <EmptyState
                icon={<TrendingDown size={24} />}
                title={t('dashboard.no_trend')}
                description={t('dashboard.no_trend_desc')}
              />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    {connectedMps.map((mp, i) => (
                      <linearGradient key={mp} id={`color${mp}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={MP_CHART_COLORS[i % MP_CHART_COLORS.length]} stopOpacity={0.22}/>
                        <stop offset="85%" stopColor={MP_CHART_COLORS[i % MP_CHART_COLORS.length]} stopOpacity={0.02}/>
                        <stop offset="100%" stopColor={MP_CHART_COLORS[i % MP_CHART_COLORS.length]} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid stroke={chart.grid} strokeDasharray="4 4" vertical={false} strokeOpacity={0.7} />
                  <XAxis dataKey="name" stroke={chart.axis} fontSize={11} tickLine={false} axisLine={false} dy={4} />
                  <YAxis
                    stroke={chart.axis}
                    fontSize={11}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
                    tickLine={false}
                    axisLine={false}
                    width={38}
                  />
                  <Tooltip
                    itemSorter={(item: any) => -item.value}
                    formatter={(value: any, name: any) => [
                      formatCurrency(Number(value) || 0),
                      MARKETPLACES[name as string]?.label || name
                    ]}
                    contentStyle={{
                      background: chart.tooltipBg,
                      border: `1px solid ${chart.tooltipBorder}`,
                      borderRadius: 10,
                      fontSize: 12,
                      boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                      padding: '8px 12px',
                    }}
                    labelStyle={{ color: chart.tooltipText, fontWeight: 600, marginBottom: 4 }}
                    itemStyle={{ color: chart.tooltipText }}
                    cursor={{ stroke: chart.grid, strokeWidth: 1.5, strokeDasharray: '3 3' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(value) => MARKETPLACES[value]?.label || value} />
                  {connectedMps.map((mp, i) => (
                    <Area
                      key={mp}
                      type="monotone"
                      dataKey={mp}
                      stroke={MP_CHART_COLORS[i % MP_CHART_COLORS.length]}
                      fillOpacity={1}
                      fill={`url(#color${mp})`}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls={true}
                      activeDot={{ r: 4, strokeWidth: 2, fill: MP_CHART_COLORS[i % MP_CHART_COLORS.length] }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        </div>

        <div>
          <GlassCard className="p-5 h-full">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-[var(--text-faint)]" />
              <h3 className="text-[var(--text-primary)] font-bold">{t('dashboard.mp_breakdown')}</h3>
            </div>
            {mpBarData.length === 0 ? (
              <EmptyState title={t('dashboard.no_mp')} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={mpBarData} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={chart.grid} strokeDasharray="4 4" horizontal={false} strokeOpacity={0.7} />
                  <XAxis
                    type="number"
                    stroke={chart.axis}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
                  />
                  <YAxis dataKey="name" type="category" stroke={chart.axis} fontSize={11} width={82} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: chart.tooltipBg,
                      border: `1px solid ${chart.tooltipBorder}`,
                      borderRadius: 10,
                      fontSize: 12,
                      boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                      padding: '8px 12px',
                    }}
                    formatter={(value: any) => formatCurrency(Number(value) || 0)}
                    labelStyle={{ color: chart.tooltipText, fontWeight: 600 }}
                    itemStyle={{ color: chart.tooltipText }}
                    cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                  />
                  <Bar dataKey="Ciro" radius={[0, 7, 7, 0]} maxBarSize={28}>
                    {mpBarData.map((_, i) => (
                      <Cell key={i} fill={MP_CHART_COLORS[i % MP_CHART_COLORS.length]} fillOpacity={0.9} />
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
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 mt-8">{t('dashboard.mp_cards')}</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mpSummaries.map((mp, i) => {
            const cfg = MARKETPLACES[mp.marketplace];
            return (
              <GlassCard key={mp.marketplace} index={i} className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-[11px] font-bold ${cfg?.textColor || 'text-[var(--text-muted)]'}`}>
                      {cfg?.label || mp.marketplace}
                    </p>
                    <p className="text-[var(--text-primary)] font-bold mt-0.5 truncate" title={mp.store_name}>
                      {mp.store_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-400 font-bold text-sm">⭐ {mp.store_rating?.toFixed(1) ?? '—'}</p>
                    <p className="text-[var(--text-muted)] text-[10px]">{mp.product_count} {t('common.products_count')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Row label={t('common.revenue')} value={formatCurrency(mp.total_revenue)} />
                  <Row label={t('common.net_profit')} value={formatCurrency(mp.total_net_profit)} positive={mp.total_net_profit >= 0} />
                  <Row label={t('common.margin')} value={formatPercent(mp.net_margin_pct)} />
                  <Row label={t('common.sales')} value={formatNumber(mp.total_sales)} />
                  <Row label={t('common.roas')} value={mp.roas ? `${mp.roas.toFixed(2)}x` : '—'} />
                  <Row label={t('common.return_pct')} value={formatPercent(mp.return_rate)} />
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function MiniMetric({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <motion.div
      variants={staggerItem}
      className={`metric-card shadow-[0_2px_12px_rgba(0,0,0,0.05)] ${
        highlight
          ? 'border-amber-300/40 bg-gradient-to-br from-amber-50/80 to-amber-100/40 dark:from-amber-900/20 dark:to-amber-800/10'
          : ''
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-bold">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? 'text-amber-600' : 'text-[var(--text-primary)]'}`}>{value}</p>
    </motion.div>
  );
}

function Row({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <p className="text-[var(--text-muted)] uppercase tracking-wider text-[10px] font-semibold">{label}</p>
      <p
        className={`font-semibold text-sm ${
          positive === false ? 'text-rose-500' : positive ? 'text-emerald-500' : 'text-[var(--text-primary)]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
