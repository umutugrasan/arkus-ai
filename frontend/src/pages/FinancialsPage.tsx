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
import type {
  FinancialOverviewResponse, MarketplaceFinancialRow, ProductFinancialRow,
  ExpensesResponse, CashFlowResponse, FinancialAnalyzeResponse
} from '../types/api';

const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444'];

type Tab = 'marketplace' | 'product' | 'expenses' | 'cashflow';

export default function FinancialsPage() {
  const [overview, setOverview] = useState<FinancialOverviewResponse | null>(null);
  const [byMP, setByMP] = useState<MarketplaceFinancialRow[]>([]);
  const [byProduct, setByProduct] = useState<ProductFinancialRow[]>([]);
  const [expenses, setExpenses] = useState<ExpensesResponse | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowResponse | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiSources, setAiSources] = useState<Array<{ title: string; uri: string }>>([]);
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
    try {
      const res: FinancialAnalyzeResponse = await financialService.analyze(true);
      if (ctrl.signal.aborted || !mountedRef.current) return;
      setAiAnalysis(res.ai_analysis || '');
      setAiSources(res.web_sources || []);
    } catch {
      if (ctrl.signal.aborted || !mountedRef.current) return;
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
    iyi: { text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', label: '💚 İyi' },
    dikkat: { text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', label: '⚠️ Dikkat' },
    kritik: { text: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30', label: '🔴 Kritik' },
  };
  const cfg = healthCfg[cashHealth] || healthCfg.dikkat;

  const pieData = expenses ? [
    { name: 'Ürün Maliyeti', value: expenses.breakdown?.urun_maliyeti?.amount || 0 },
    { name: 'Komisyon', value: expenses.breakdown?.komisyon?.amount || 0 },
    { name: 'Kargo', value: expenses.breakdown?.kargo?.amount || 0 },
    { name: 'Reklam', value: expenses.breakdown?.reklam?.amount || 0 },
  ] : [];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'marketplace', label: '🏪 Pazaryeri' },
    { id: 'product', label: '📦 Ürün Bazlı' },
    { id: 'expenses', label: '💸 Giderler' },
    { id: 'cashflow', label: '💧 Nakit Akışı' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Toplam Gelir" value={formatCurrency(ov?.total_revenue)} icon={<DollarSign size={18} />} accentColor="indigo" />
        <StatCard title="Net Kâr (Reklam Sonrası)" value={formatCurrency(ov?.total_net_after_ads)} icon={<TrendingUp size={18} />} accentColor="emerald" />
        <StatCard title="Net Marj" value={formatPercent(ov?.overall_net_margin)} icon={<BarChart2 size={18} />} accentColor="violet" />
        <StatCard title="ROAS" value={ov?.overall_roas?.toFixed(2) ?? '—'} icon={<Zap size={18} />} accentColor="amber" />
      </div>

      {history.length > 0 && (
        <GlassCard>
          <h3 className="text-slate-800 font-semibold mb-4">Aylık Gelir & Kâr Trendi</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v: number) => `₺${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Gelir" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" name="Kâr" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      <GlassCard>
        <div className="flex gap-1 mb-5 bg-gray-50 p-1 rounded-xl w-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-[#4a3f44] text-white shadow' : 'text-gray-500 hover:text-slate-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'marketplace' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100">
                  {['Pazaryeri', 'Gelir', 'Net Kâr', 'Marj', 'ROAS', 'Satış'].map(h => (
                    <th key={h} className="text-left pb-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byMP.map((mp, i) => (
                  <tr key={i} className="border-b border-gray-200/50 hover:bg-white/30 transition-colors">
                    <td className="py-3 pr-4 text-slate-800 font-medium capitalize">{mp.marketplace}</td>
                    <td className="py-3 pr-4 text-slate-800">{formatCurrency(mp.revenue)}</td>
                    <td className={`py-3 pr-4 font-semibold ${mp.net_after_ads >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(mp.net_after_ads)}</td>
                    <td className="py-3 pr-4 text-gray-600">{formatPercent(mp.net_margin_pct)}</td>
                    <td className="py-3 pr-4 text-gray-600">{mp.roas?.toFixed(2)}</td>
                    <td className="py-3 text-gray-600">{formatNumber(mp.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'product' && (
          <div className="space-y-2">
            {byProduct.slice(0, 10).map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/30 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs w-5">{i + 1}</span>
                  <div>
                    <p className="text-slate-800 text-sm font-medium">{p.name}</p>
                    <p className="text-gray-500 text-xs">{formatNumber(p.total_sales)} satış</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold text-sm ${p.total_net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(p.total_net_profit)}</p>
                  <p className="text-gray-500 text-xs">{formatPercent(p.net_margin_pct)} marj</p>
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
                  contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {Object.entries(expenses.breakdown || {}).map(([key, val], i) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 capitalize">{key.replace('_', ' ')}</span>
                    <span className="text-slate-800 font-medium">{formatCurrency(val.amount)} <span className="text-gray-500 text-xs">(%{val.pct})</span></span>
                  </div>
                  <div className="h-1.5 bg-white rounded-full overflow-hidden">
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
                <p className="text-gray-600 text-sm mt-1">{cashFlow.runway_months} aylık rezerv (tahmini)</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Mevcut Bakiye', value: formatCurrency(cashFlow.current_balance) },
                { label: 'Aylık Gelir', value: formatCurrency(cashFlow.monthly_revenue) },
                { label: 'Aylık Net Kâr', value: formatCurrency(cashFlow.monthly_net_profit) },
                { label: 'Bekleyen Alacaklar', value: formatCurrency(cashFlow.pending_receivables) },
                { label: 'Yaklaşan Giderler', value: formatCurrency(cashFlow.upcoming_expenses) },
              ].map(m => (
                <div key={m.label} className="p-3 bg-white/40 rounded-xl">
                  <p className="text-gray-500 text-xs">{m.label}</p>
                  <p className="text-slate-800 font-semibold mt-1">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-semibold flex items-center gap-2"><Brain size={16} className="text-indigo-600" /> AI Finansal Analiz</h3>
          <button onClick={handleAiAnalysis} disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#4a3f44] hover:bg-[#6b6266] text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
            {aiLoading ? <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Analiz ediliyor…</> : <><Brain size={14} /> Analiz Et</>}
          </button>
        </div>
        {aiAnalysis
          ? <StreamingMarkdown content={aiAnalysis} webSources={aiSources} title="Finansal AI Analizi" />
          : <p className="text-gray-500 text-sm">Gelir/gider trendleri ve marj optimizasyonu için Analiz Et'e tıklayın.</p>
        }
      </GlassCard>
    </div>
  );
}
