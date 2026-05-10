import { useEffect, useState, useCallback } from 'react';
import { Brain, TrendingDown, TrendingUp } from 'lucide-react';
import { competitorService } from '../services';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import AIResponseBox from '../components/shared/AIResponseBox';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import { MOCK_PRODUCTS, MOCK_PRODUCT_NAMES } from '../utils/constants';
import { formatCurrency } from '../utils/formatters';

interface Competitor {
  marketplace: string;
  our_price: number;
  our_rating: number;
  our_sales: number;
  competitor_name: string;
  competitor_price: number;
  competitor_rating: number;
  competitor_sales: number;
  price_diff: number;
  price_diff_pct: number;
  we_are: string;
}

export default function CompetitorsPage() {
  const [selectedProduct, setSelectedProduct] = useState(MOCK_PRODUCTS[0]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setAiAnalysis('');
    try {
      const res = await competitorService.getCompetitors(selectedProduct);
      setCompetitors(res.competitors || []);
    } catch { setCompetitors([]); }
    finally { setLoading(false); }
  }, [selectedProduct]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAi = async () => {
    setAiLoading(true);
    try {
      const res = await competitorService.analyze(selectedProduct);
      setAiAnalysis(res.ai_analysis || '');
    } finally { setAiLoading(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <GlassCard className="flex items-center gap-4">
        <label className="text-slate-400 text-sm font-medium whitespace-nowrap">Ürün Seç:</label>
        <select
          value={selectedProduct}
          onChange={e => setSelectedProduct(e.target.value)}
          className="flex-1 bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50"
        >
          {MOCK_PRODUCTS.map(id => <option key={id} value={id}>{MOCK_PRODUCT_NAMES[id] || id}</option>)}
        </select>
      </GlassCard>

      {loading ? <LoadingSpinner message="Rakipler yükleniyor..." /> : (
        <>
          {competitors.length === 0 ? (
            <GlassCard className="text-center py-8">
              <p className="text-slate-400">Bu ürün için rakip verisi bulunamadı.</p>
            </GlassCard>
          ) : (
            <GlassCard>
              <h3 className="text-white font-semibold mb-4">Rakip Karşılaştırması</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      {['Pazaryeri', 'Bizim Fiyat', 'Rakip', 'Rakip Fiyat', 'Fark', 'Durum', 'Biz', 'Rakip (Puan)', 'Rakip (Satış)'].map(h => (
                        <th key={h} className="text-left text-slate-400 text-xs font-medium pb-3 pr-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {competitors.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 pr-3"><MarketplaceBadge marketplace={c.marketplace} /></td>
                        <td className="py-3 pr-3 text-indigo-300 font-medium">{formatCurrency(c.our_price)}</td>
                        <td className="py-3 pr-3 text-slate-300 font-medium">{c.competitor_name}</td>
                        <td className="py-3 pr-3 text-white">{formatCurrency(c.competitor_price)}</td>
                        <td className={`py-3 pr-3 font-medium ${c.price_diff > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {c.price_diff > 0 ? '+' : ''}{formatCurrency(c.price_diff)} ({c.price_diff_pct > 0 ? '+' : ''}{c.price_diff_pct}%)
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.we_are === 'pahali' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {c.we_are === 'pahali' ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                            {c.we_are === 'pahali' ? 'Pahalıyız' : 'Ucuzuz'}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-amber-400 text-xs">⭐ {c.our_rating}</td>
                        <td className="py-3 pr-3 text-amber-400 text-xs">⭐ {c.competitor_rating}</td>
                        <td className="py-3 pr-3 text-slate-300">{c.competitor_sales}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* AI Analysis */}
          <div>
            {!aiAnalysis ? (
              <button
                onClick={handleAi}
                disabled={aiLoading || competitors.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 hover:border-indigo-400/50 text-indigo-300 rounded-xl py-4 font-semibold text-sm transition-all disabled:opacity-50"
              >
                {aiLoading ? <LoadingSpinner ai message="Strateji analiz ediliyor..." size="sm" /> : <><Brain size={18} /> 🤖 AI Rakip Stratejisi Al</>}
              </button>
            ) : <AIResponseBox content={aiAnalysis} title="Rakip Strateji Analizi" />}
          </div>
        </>
      )}
    </div>
  );
}
