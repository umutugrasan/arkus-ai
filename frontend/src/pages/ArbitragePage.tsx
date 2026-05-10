import { useEffect, useState } from 'react';
import { Brain, ArrowRight, TrendingUp } from 'lucide-react';
import { arbitrageService } from '../services';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import AIResponseBox from '../components/shared/AIResponseBox';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import { formatCurrency, formatPercent } from '../utils/formatters';

interface Opportunity {
  product_id: string;
  product_name: string;
  best_marketplace: string;
  worst_marketplace: string;
  profit_gap_per_item: number;
  monthly_opportunity: number;
  listings: { marketplace: string; price: number; net_per_item: number; net_margin_pct: number; monthly_net_profit: number; commission_rate: number }[];
}

export default function ArbitragePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    arbitrageService.opportunities()
      .then(r => setOpportunities(r.opportunities || []))
      .finally(() => setLoading(false));
  }, []);

  const handleSelectProduct = async (opp: Opportunity) => {
    setSelected(opp);
    setAiAnalysis('');
  };

  const handleAi = async () => {
    if (!selected) return;
    setAiLoading(true);
    try {
      const res = await arbitrageService.analyze(selected.product_id);
      setAiAnalysis(res.ai_analysis || '');
    } finally { setAiLoading(false); }
  };

  if (loading) return <LoadingSpinner message="Arbitraj fırsatları yükleniyor..." size="lg" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Opportunity Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {opportunities.map((opp) => (
          <GlassCard
            key={opp.product_id}
            hover
            onClick={() => handleSelectProduct(opp)}
            className={`transition-all ${selected?.product_id === opp.product_id ? 'border border-indigo-500/50 bg-indigo-500/5' : ''}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-1 rounded-lg">
                +{formatCurrency(opp.profit_gap_per_item)}/adet
              </div>
              <TrendingUp size={16} className="text-indigo-400" />
            </div>
            <p className="text-white font-semibold text-sm leading-tight mb-2">{opp.product_name}</p>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
              <MarketplaceBadge marketplace={opp.best_marketplace} size="sm" />
              <ArrowRight size={10} />
              <span className="text-rose-400">{opp.worst_marketplace}</span>
            </div>
            <p className="text-indigo-300 font-bold">{formatCurrency(opp.monthly_opportunity)}<span className="text-slate-400 font-normal text-xs ml-1">aylık fırsat</span></p>
          </GlassCard>
        ))}
      </div>

      {/* Detail */}
      {selected && (
        <GlassCard className="animate-fade-in">
          <h3 className="text-white font-semibold mb-4">{selected.product_name} — Pazaryeri Karşılaştırması</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {['Pazaryeri', 'Fiyat', 'Komisyon', 'Adet Kâr', 'Marj', 'Aylık Kâr'].map(h => (
                    <th key={h} className="text-left text-slate-400 text-xs font-medium pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {selected.listings.map((l, i) => (
                  <tr key={i} className={`${l.marketplace === selected.best_marketplace ? 'bg-emerald-500/5' : ''}`}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <MarketplaceBadge marketplace={l.marketplace} />
                        {l.marketplace === selected.best_marketplace && <span className="text-emerald-400 text-xs font-bold">✓ En İyi</span>}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-white font-medium">{formatCurrency(l.price)}</td>
                    <td className="py-3 pr-4 text-slate-400">{formatPercent(l.commission_rate)}</td>
                    <td className={`py-3 pr-4 font-bold ${l.net_per_item > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(l.net_per_item)}</td>
                    <td className="py-3 pr-4 text-slate-300">{formatPercent(l.net_margin_pct)}</td>
                    <td className={`py-3 pr-4 font-medium ${l.monthly_net_profit > 0 ? 'text-indigo-400' : 'text-rose-400'}`}>{formatCurrency(l.monthly_net_profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* AI */}
          <div className="mt-4">
            {!aiAnalysis ? (
              <button
                onClick={handleAi}
                disabled={aiLoading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 hover:border-indigo-400/50 text-indigo-300 rounded-xl py-3 text-sm font-semibold transition-all"
              >
                {aiLoading ? <LoadingSpinner ai message="Arbitraj analiz ediliyor..." size="sm" /> : <><Brain size={16} /> 🤖 AI Arbitraj Stratejisi Al</>}
              </button>
            ) : <AIResponseBox content={aiAnalysis} title="Arbitraj Strateji Analizi" />}
          </div>
        </GlassCard>
      )}

      {opportunities.length === 0 && (
        <GlassCard className="text-center py-12">
          <p className="text-slate-400">Arbitraj fırsatı bulunamadı. Ürünleriniz birden fazla pazaryerinde satılmıyor olabilir.</p>
        </GlassCard>
      )}
    </div>
  );
}
