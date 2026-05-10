import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import { financialService } from '../services';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import AIResponseBox from '../components/shared/AIResponseBox';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const EXPENSE_COLORS = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444'];

export default function FinancialsPage() {
  const [overall, setOverall] = useState<Record<string, number> | null>(null);
  const [byMp, setByMp] = useState<Record<string, unknown>[]>([]);
  const [byProduct, setByProduct] = useState<Record<string, unknown>[]>([]);
  const [expenses, setExpenses] = useState<{ breakdown: Record<string, { amount: number; pct: number }> } | null>(null);
  const [cashFlow, setCashFlow] = useState<Record<string, number> | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [tab, setTab] = useState<'overview' | 'marketplace' | 'product' | 'cashflow'>('overview');

  useEffect(() => {
    Promise.all([
      financialService.overview(),
      financialService.byMarketplace(),
      financialService.byProduct(),
      financialService.expenses(),
      financialService.cashFlow(),
    ]).then(([ov, mp, prod, exp, cf]) => {
      setOverall(ov.overall);
      setByMp(mp.marketplaces || []);
      setByProduct(prod.products || []);
      setExpenses(exp);
      setCashFlow(cf);
    }).finally(() => setLoading(false));
  }, []);

  const handleAi = async () => {
    setAiLoading(true);
    try {
      const res = await financialService.analyze();
      setAiAnalysis(res.ai_analysis || '');
    } finally { setAiLoading(false); }
  };

  if (loading) return <LoadingSpinner message="Finansal veriler yükleniyor..." size="lg" />;

  const expPieData = expenses ? Object.entries(expenses.breakdown).map(([k, v], i) => ({
    name: { urun_maliyeti: 'Ürün Maliyeti', komisyon: 'Komisyon', kargo: 'Kargo', reklam: 'Reklam' }[k] || k,
    value: v.amount,
    pct: v.pct,
    color: EXPENSE_COLORS[i],
  })) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Main metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Toplam Gelir', value: formatCurrency(overall?.total_revenue || 0), color: 'text-indigo-400' },
          { label: 'Brüt Kâr', value: formatCurrency(overall?.total_gross_profit || 0), color: 'text-violet-400' },
          { label: 'Net Kâr', value: formatCurrency(overall?.total_net_after_ads || 0), color: 'text-emerald-400' },
          { label: 'Reklam Harcaması', value: formatCurrency(overall?.total_ad_spend || 0), color: 'text-amber-400' },
          { label: 'Brüt Marj', value: formatPercent(overall?.overall_gross_margin || 0), color: 'text-cyan-400' },
          { label: 'Net Marj', value: formatPercent(overall?.overall_net_margin || 0), color: 'text-rose-400' },
        ].map(m => (
          <GlassCard key={m.label} className="text-center bg-slate-800/30">
            <p className="text-slate-400 text-xs mb-1">{m.label}</p>
            <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
          </GlassCard>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/40 rounded-xl p-1 overflow-x-auto">
        {[
          { key: 'overview', label: '📊 Gider Dağılımı' },
          { key: 'marketplace', label: '🏪 Pazaryeri Bazlı' },
          { key: 'product', label: '📦 Ürün Bazlı' },
          { key: 'cashflow', label: '💵 Nakit Akışı' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'overview' | 'marketplace' | 'product' | 'cashflow')}
            className={`flex-shrink-0 py-2 px-4 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${tab === t.key ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >{t.label}</button>
        ))}
      </div>

      {/* Expense Breakdown */}
      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-6">
          <GlassCard>
            <h3 className="text-white font-semibold mb-4">Gider Dağılımı</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={expPieData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85}>
                  {expPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v) => [formatCurrency(v as number)]} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {expPieData.map(d => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-slate-300">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-xs">%{d.pct}</span>
                    <span className="text-white font-medium">{formatCurrency(d.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="text-white font-semibold mb-4">Gelir-Gider Özeti</h3>
            <div className="space-y-3">
              {[
                { label: 'Brüt Gelir', value: overall?.total_revenue || 0, color: 'bg-indigo-500' },
                { label: '— Ürün Maliyeti', value: -(overall?.total_cost || 0), color: 'bg-rose-500/60' },
                { label: '— Komisyonlar', value: -(overall?.total_commission || 0), color: 'bg-amber-500/60' },
                { label: '— Kargo', value: -(overall?.total_shipping || 0), color: 'bg-orange-500/60' },
                { label: '— Reklam', value: -(overall?.total_ad_spend || 0), color: 'bg-pink-500/60' },
                { label: '= Net Kâr', value: overall?.total_net_after_ads || 0, color: 'bg-emerald-500' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${item.value >= 0 ? 'text-white' : 'text-rose-400'}`}>
                      {item.value < 0 ? '-' : ''}{formatCurrency(Math.abs(item.value))}
                    </span>
                  </div>
                </div>
              ))}
              <div className="border-t border-slate-700/50 pt-2" />
            </div>
          </GlassCard>
        </div>
      )}

      {/* Marketplace tab */}
      {tab === 'marketplace' && (
        <GlassCard>
          <h3 className="text-white font-semibold mb-4">Pazaryeri Bazlı Kârlılık</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {['Pazaryeri', 'Gelir', 'Net Kâr', 'Marj', 'Komisyon', 'Reklam', 'ROAS', 'Satış'].map(h => (
                    <th key={h} className="text-left text-slate-400 text-xs font-medium pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {byMp.map((m: Record<string, unknown>, i) => (
                  <tr key={i} className="hover:bg-slate-800/30">
                    <td className="py-3 pr-4"><MarketplaceBadge marketplace={m.marketplace as string} /></td>
                    <td className="py-3 pr-4 text-white font-medium">{formatCurrency(m.revenue as number)}</td>
                    <td className={`py-3 pr-4 font-medium ${(m.net_profit as number) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(m.net_profit as number)}</td>
                    <td className="py-3 pr-4 text-slate-300">{formatPercent(m.net_margin_pct as number)}</td>
                    <td className="py-3 pr-4 text-slate-400">{formatCurrency(m.commission as number)}</td>
                    <td className="py-3 pr-4 text-slate-400">{formatCurrency(m.ad_spend as number)}</td>
                    <td className="py-3 pr-4 text-indigo-400 font-medium">{(m.roas as number)?.toFixed(2)}x</td>
                    <td className="py-3 pr-4 text-slate-300">{m.sales as number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Product tab */}
      {tab === 'product' && (
        <GlassCard>
          <h3 className="text-white font-semibold mb-4">Ürün Bazlı Kârlılık</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {['Ürün', 'Toplam Gelir', 'Net Kâr', 'Marj', 'Satış'].map(h => (
                    <th key={h} className="text-left text-slate-400 text-xs font-medium pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {byProduct.map((p: Record<string, unknown>, i) => (
                  <tr key={i} className="hover:bg-slate-800/30">
                    <td className="py-3 pr-4">
                      <p className="text-white text-sm truncate max-w-[200px]">{p.name as string}</p>
                      <p className="text-slate-500 text-xs">{p.id as string}</p>
                    </td>
                    <td className="py-3 pr-4 text-white font-medium">{formatCurrency(p.total_revenue as number)}</td>
                    <td className={`py-3 pr-4 font-medium ${(p.total_net_profit as number) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(p.total_net_profit as number)}</td>
                    <td className="py-3 pr-4 text-slate-300">{formatPercent(p.net_margin_pct as number)}</td>
                    <td className="py-3 pr-4 text-slate-300">{p.total_sales as number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Cash Flow tab */}
      {tab === 'cashflow' && cashFlow && (
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { label: '💰 Mevcut Bakiye', value: cashFlow.current_balance, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20' },
            { label: '📈 Aylık Gelir', value: cashFlow.monthly_revenue, color: 'text-indigo-400', bg: 'bg-indigo-500/5 border-indigo-500/20' },
            { label: '🎯 Aylık Net Kâr', value: cashFlow.monthly_net_profit, color: 'text-violet-400', bg: 'bg-violet-500/5 border-violet-500/20' },
            { label: '⏳ Bekleyen Alacaklar', value: cashFlow.pending_receivables, color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/20' },
            { label: '📤 Yaklaşan Giderler', value: cashFlow.upcoming_expenses, color: 'text-rose-400', bg: 'bg-rose-500/5 border-rose-500/20' },
            { label: '🛫 Pist (Ay)', value: cashFlow.runway_months + ' ay', color: 'text-cyan-400', bg: 'bg-cyan-500/5 border-cyan-500/20', isText: true },
          ].map(m => (
            <GlassCard key={m.label} className={`border ${m.bg}`}>
              <p className="text-slate-400 text-xs mb-1">{m.label}</p>
              <p className={`text-2xl font-bold ${m.color}`}>{m.isText ? m.value : formatCurrency(m.value as number)}</p>
            </GlassCard>
          ))}
        </div>
      )}

      {/* AI Analysis */}
      <div>
        {!aiAnalysis ? (
          <button
            onClick={handleAi}
            disabled={aiLoading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 hover:border-indigo-400/50 text-indigo-300 rounded-xl py-4 font-semibold text-sm transition-all"
          >
            {aiLoading ? <LoadingSpinner ai message="Finansal analiz yapılıyor..." size="sm" /> : <><Brain size={18} /> 🤖 AI Finansal Analiz Al</>}
          </button>
        ) : <AIResponseBox content={aiAnalysis} title="Finansal Analiz" />}
      </div>
    </div>
  );
}
