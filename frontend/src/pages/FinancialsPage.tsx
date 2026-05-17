import { useState, useEffect, useRef } from 'react';
import { DollarSign, TrendingUp, BarChart2, Zap, Brain } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import StatCard from '../components/shared/StatCard';
import GlassCard from '../components/shared/GlassCard';
import { Skeleton, SkeletonCard } from '../components/shared/Skeleton';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import { financialService } from '../services';
import { formatCurrency, formatPercent, formatNumber } from '../utils/formatters';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../hooks/useTheme';
import { getChartTheme } from '../utils/chartTheme';
import type {
  FinancialOverviewResponse, MarketplaceFinancialRow, ProductFinancialRow,
  ExpensesResponse, CashFlowResponse, FinancialAnalyzeResponse
} from '../types/api';

const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444'];

type Tab = 'marketplace' | 'product' | 'expenses' | 'cashflow';

export default function FinancialsPage() {
  const { t } = useI18n();
  const { isDark } = useTheme();
  const chart = getChartTheme(isDark);
  const [overview, setOverview] = useState<FinancialOverviewResponse | null>(null);
  const [byMP, setByMP] = useState<MarketplaceFinancialRow[]>([]);
  const [byProduct, setByProduct] = useState<ProductFinancialRow[]>([]);
  const [expenses, setExpenses] = useState<ExpensesResponse | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowResponse | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiSources, setAiSources] = useState<Array<{ title: string; uri: string }>>([]);
  const [aiError, setAiError] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('marketplace');
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    Promise.all([
      financialService.overview(),
      financialService.byMarketplace(),
      financialService.byProduct(),
      financialService.expenses(),
      financialService.cashFlow(),
    ]).then(([ov, mp, prod, exp, cf]) => {
      if (!mountedRef.current) return;
      setOverview(ov);
      setByMP(mp.marketplaces);
      setByProduct(prod.products);
      setExpenses(exp);
      setCashFlow(cf);
    }).finally(() => {
      if (mountedRef.current) setLoading(false);
    });
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleAiAnalysis = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAiLoading(true);
    setAiError('');
    setAiAnalysis('');
    try {
      const res: FinancialAnalyzeResponse = await financialService.analyze(true);
      if (ctrl.signal.aborted || !mountedRef.current) return;
      setAiAnalysis(res.ai_analysis || '');
      setAiSources(res.web_sources || []);
    } catch (err) {
      if (ctrl.signal.aborted || !mountedRef.current) return;
      const msg = err instanceof Error ? err.message : t('financials.load_failed');
      setAiError(msg);
    } finally {
      if (mountedRef.current) setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const ov = overview?.overall;
  const history = overview?.monthly_history || [];
  const cashHealth = cashFlow?.health || 'dikkat';
  const healthCfg: Record<string, { text: string; bg: string; label: string }> = {
    iyi: { text: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30', label: `💚 ${t('financials.health_good')}` },
    dikkat: { text: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/30', label: `⚠️ ${t('financials.health_warn')}` },
    kritik: { text: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/30', label: `🔴 ${t('financials.health_critical')}` },
  };
  const cfg = healthCfg[cashHealth] || healthCfg.dikkat;

  const pieData = expenses ? [
    { name: t('financials.exp_product'), value: expenses.breakdown?.urun_maliyeti?.amount || 0 },
    { name: t('financials.exp_commission'), value: expenses.breakdown?.komisyon?.amount || 0 },
    { name: t('financials.exp_shipping'), value: expenses.breakdown?.kargo?.amount || 0 },
    { name: t('financials.exp_ads'), value: expenses.breakdown?.reklam?.amount || 0 },
  ] : [];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'marketplace', label: `🏪 ${t('financials.by_marketplace')}` },
    { id: 'product', label: `📦 ${t('financials.by_product')}` },
    { id: 'expenses', label: `💸 ${t('financials.expenses')}` },
    { id: 'cashflow', label: `💧 ${t('financials.cashflow')}` },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title={t('financials.total_revenue')} value={formatCurrency(ov?.total_revenue)} icon={<DollarSign size={18} />} accentColor="indigo" />
        <StatCard title={t('financials.net_profit_ads')} value={formatCurrency(ov?.total_net_after_ads)} icon={<TrendingUp size={18} />} accentColor="emerald" />
        <StatCard title={t('financials.net_margin')} value={formatPercent(ov?.overall_net_margin)} icon={<BarChart2 size={18} />} accentColor="violet" />
        <StatCard title={t('common.roas')} value={ov?.overall_roas?.toFixed(2) ?? '—'} icon={<Zap size={18} />} accentColor="amber" />
      </div>

      {history.length > 0 && (
        <GlassCard>
          <h3 className="text-[var(--text-primary)] font-semibold mb-4">{t('financials.monthly_trend')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis dataKey="month" tick={{ fill: chart.axis, fontSize: 11 }} />
              <YAxis tick={{ fill: chart.axis, fontSize: 11 }} tickFormatter={(v: number) => `₺${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8 }}
                labelStyle={{ color: chart.tooltipText }} itemStyle={{ color: chart.tooltipText }}
                formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name={t('financials.revenue')} stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" name={t('financials.profit')} stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      <GlassCard>
        <div className="flex gap-1 mb-5 bg-[var(--bg-muted)] p-1 rounded-xl w-fit">
          {tabs.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === tb.id ? 'bg-[var(--accent-solid)] text-[var(--accent-fg)] shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
              {tb.label}
            </button>
          ))}
        </div>

        {tab === 'marketplace' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                  {[t('common.marketplace'), t('financials.revenue'), t('common.net_profit'), t('common.margin'), t('common.roas'), t('common.sales')].map(h => (
                    <th key={h} className="text-left pb-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byMP.map((mp, i) => (
                  <tr key={i} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-elevated)] transition-colors">
                    <td className="py-3 pr-4 text-[var(--text-primary)] font-medium capitalize">{mp.marketplace}</td>
                    <td className="py-3 pr-4 text-[var(--text-primary)]">{formatCurrency(mp.revenue)}</td>
                    <td className={`py-3 pr-4 font-semibold ${mp.net_after_ads >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(mp.net_after_ads)}</td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{formatPercent(mp.net_margin_pct)}</td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{mp.roas?.toFixed(2)}</td>
                    <td className="py-3 text-[var(--text-secondary)]">{formatNumber(mp.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'product' && (
          <div className="space-y-2">
            {byProduct.slice(0, 10).map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-muted)] transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-[var(--text-muted)] text-xs w-5">{i + 1}</span>
                  <div>
                    <p className="text-[var(--text-primary)] text-sm font-medium">{p.name}</p>
                    <p className="text-[var(--text-muted)] text-xs">{formatNumber(p.total_sales)} {t('products.units')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold text-sm ${p.total_net_profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(p.total_net_profit)}</p>
                  <p className="text-[var(--text-muted)] text-xs">{formatPercent(p.net_margin_pct)} {t('common.margin').toLowerCase()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'expenses' && expenses && (
          <div className="grid md:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                  {pieData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8 }}
                  labelStyle={{ color: chart.tooltipText }} itemStyle={{ color: chart.tooltipText }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {Object.entries(expenses.breakdown || {}).map(([key, val], i) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--text-secondary)] capitalize">{key.replace('_', ' ')}</span>
                    <span className="text-[var(--text-primary)] font-medium">{formatCurrency(val.amount)} <span className="text-[var(--text-muted)] text-xs">(%{val.pct})</span></span>
                  </div>
                  <div className="h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${val.pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'cashflow' && cashFlow && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border ${cfg.bg}`}>
              <p className={`text-lg font-bold ${cfg.text}`}>{cfg.label}</p>
              {cashFlow.runway_months != null && (
                <p className="text-[var(--text-secondary)] text-sm mt-1">{t('financials.runway').replace('{months}', String(cashFlow.runway_months))}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: t('financials.cf_balance'), value: formatCurrency(cashFlow.current_balance) },
                { label: t('financials.cf_monthly_revenue'), value: formatCurrency(cashFlow.monthly_revenue) },
                { label: t('financials.cf_monthly_profit'), value: formatCurrency(cashFlow.monthly_net_profit) },
                { label: t('financials.cf_receivables'), value: formatCurrency(cashFlow.pending_receivables) },
                { label: t('financials.cf_upcoming'), value: formatCurrency(cashFlow.upcoming_expenses) },
              ].map(m => (
                <div key={m.label} className="p-3 bg-[var(--bg-elevated)] rounded-xl">
                  <p className="text-[var(--text-muted)] text-xs">{m.label}</p>
                  <p className="text-[var(--text-primary)] font-semibold mt-1">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[var(--text-primary)] font-semibold flex items-center gap-2"><Brain size={16} className="text-indigo-600 dark:text-indigo-300" /> {t('financials.ai_analysis')}</h3>
          <button onClick={handleAiAnalysis} disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50">
            {aiLoading ? <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> {t('common.analyzing')}</> : <><Brain size={14} /> {t('common.analyze')}</>}
          </button>
        </div>
        {aiAnalysis
          ? <StreamingMarkdown content={aiAnalysis} webSources={aiSources} title={t('financials.ai_analysis')} />
          : aiError
            ? (
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                <p className="text-rose-500 text-sm font-medium">{t('financials.ai_failed')}</p>
                <p className="text-rose-500/80 text-xs mt-1">{aiError}</p>
                <button onClick={handleAiAnalysis} className="mt-3 text-xs text-rose-500 underline">{t('common.retry')}</button>
              </div>
            )
            : <p className="text-[var(--text-muted)] text-sm">{t('financials.ai_desc')}</p>
        }
      </GlassCard>
    </div>
  );
}
