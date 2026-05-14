import { useState, useEffect } from 'react';
import { Shuffle, Brain, ChevronRight } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import EmptyState from '../components/shared/EmptyState';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import { arbitrageService } from '../services';
import { formatCurrency } from '../utils/formatters';
import type { ArbitrageOpportunitiesResponse, ArbitrageDetail, ArbitrageListing } from '../types/api';

export default function ArbitragePage() {
  const [opps, setOpps] = useState<ArbitrageOpportunitiesResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArbitrageDetail | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiSources, setAiSources] = useState<Array<{ title: string; uri: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    arbitrageService.opportunities().then(setOpps).finally(() => setLoading(false));
  }, []);

  const handleSelect = async (productId: string) => {
    if (selected === productId) { setSelected(null); setDetail(null); return; }
    setSelected(productId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await arbitrageService.detail(productId);
      setDetail(res);
    } finally { setDetailLoading(false); }
  };

  const handleAi = async () => {
    if (!selected) return;
    setAiLoading(true);
    try {
      const res = await arbitrageService.analyze(selected, true);
      setAiAnalysis(res.ai_analysis || '');
      setAiSources(res.web_sources || []);
    } finally { setAiLoading(false); }
  };

  if (loading) return <LoadingSpinner message="Arbitraj fırsatları hesaplanıyor…" size="lg" />;

  const summary = opps?.summary;
  const opportunities = opps?.opportunities || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Özet */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="bg-gradient-to-br from-indigo-500/20 to-indigo-600/10">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Toplam Fırsat</p>
          <p className="text-4xl font-bold text-slate-800 mt-1">{summary?.total_opportunities ?? 0}</p>
        </GlassCard>
        <GlassCard className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Aylık Potansiyel</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{formatCurrency(summary?.total_monthly_potential)}</p>
        </GlassCard>
        <GlassCard className="bg-gradient-to-br from-violet-500/20 to-violet-600/10">
          <p className="text-gray-500 text-xs uppercase tracking-wider">En Büyük Fırsat</p>
          <p className="text-slate-800 font-semibold mt-1 text-sm">{summary?.biggest_gap_product ?? '—'}</p>
        </GlassCard>
      </div>

      {opportunities.length === 0
        ? <EmptyState title="Arbitraj Fırsatı Yok" description="Arbitraj analizi için birden fazla pazaryerinde aynı ürün olması gerekiyor." />
        : (
          <div className="space-y-3">
            {opportunities.map((opp, i) => {
              const isOpen = selected === opp.product_id;
              return (
                <GlassCard key={i} className={`cursor-pointer transition-all ${isOpen ? 'border border-indigo-500/40' : 'hover:border-slate-600'}`}
                  onClick={() => handleSelect(opp.product_id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-xl">
                        <Shuffle size={16} className="text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-slate-800 font-semibold">{opp.product_name || opp.product_id}</p>
                        <p className="text-gray-500 text-xs">{opp.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-emerald-400 font-bold text-lg">{formatCurrency(opp.monthly_opportunity)}</p>
                        <p className="text-gray-500 text-xs">aylık potansiyel</p>
                      </div>
                      <ChevronRight size={16} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      {detailLoading
                        ? <LoadingSpinner message="Detaylar yükleniyor…" size="sm" />
                        : detail && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {(detail.listings || []).map((l: ArbitrageListing, li: number) => (
                                <div key={li} className="p-3 bg-white/40 rounded-xl">
                                  <MarketplaceBadge marketplace={l.marketplace} />
                                  <p className="text-slate-800 font-bold text-lg mt-2">{formatCurrency(l.price)}</p>
                                  <div className="space-y-1 mt-2 text-xs text-gray-500">
                                    <p>Net/Adet: <span className={`font-medium ${l.net_per_item > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(l.net_per_item)}</span></p>
                                    <p>Marj: <span className="text-slate-800">{l.net_margin_pct.toFixed(1)}%</span></p>
                                    <p>Aylık Kâr: {formatCurrency(l.monthly_net_profit)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-end">
                              <button onClick={(e) => { e.stopPropagation(); handleAi(); }} disabled={aiLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-slate-800 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                                {aiLoading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Brain size={14} />}
                                AI Strateji Analizi
                              </button>
                            </div>
                          </div>
                        )
                      }
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        )
      }

      {aiAnalysis && (
        <StreamingMarkdown content={aiAnalysis} webSources={aiSources} title="Arbitraj AI Analizi" />
      )}
    </div>
  );
}
