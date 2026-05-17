import { useState, useEffect } from 'react';
import { Shuffle, Brain, ChevronRight } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import EmptyState from '../components/shared/EmptyState';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import { arbitrageService } from '../services';
import { formatCurrency } from '../utils/formatters';
import { useI18n } from '../context/I18nContext';
import type { ArbitrageOpportunitiesResponse, ArbitrageDetail, ArbitrageListing } from '../types/api';

export default function ArbitragePage() {
  const { t } = useI18n();
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

  if (loading) return <LoadingSpinner message={t('arbitrage.loading')} size="lg" />;

  const summary = opps?.summary;
  const opportunities = opps?.opportunities || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Özet */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="bg-gradient-to-br from-indigo-500/20 to-indigo-600/10">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider">{t('arbitrage.total_opp')}</p>
          <p className="text-4xl font-bold text-[var(--text-primary)] mt-1">{summary?.total_opportunities ?? 0}</p>
        </GlassCard>
        <GlassCard className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider">{t('arbitrage.monthly_potential')}</p>
          <p className="text-3xl font-bold text-emerald-500 mt-1">{formatCurrency(summary?.total_monthly_potential)}</p>
        </GlassCard>
        <GlassCard className="bg-gradient-to-br from-violet-500/20 to-violet-600/10">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider">{t('arbitrage.biggest_gap')}</p>
          <p className="text-[var(--text-primary)] font-semibold mt-1 text-sm">{summary?.biggest_gap_product ?? '—'}</p>
        </GlassCard>
      </div>

      {opportunities.length === 0
        ? <EmptyState title={t('arbitrage.no_opp')} description={t('arbitrage.no_opp_desc')} />
        : (
          <div className="space-y-3">
            {opportunities.map((opp) => {
              const isOpen = selected === opp.product_id;
              return (
                <GlassCard key={opp.product_id} className={`cursor-pointer transition-all ${isOpen ? 'border border-indigo-500/40' : 'hover:border-[var(--border-strong)]'}`}
                  onClick={() => handleSelect(opp.product_id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-xl">
                        <Shuffle size={16} className="text-indigo-600 dark:text-indigo-300" />
                      </div>
                      <div>
                        <p className="text-[var(--text-primary)] font-semibold">{opp.product_name || opp.product_id}</p>
                        <p className="text-[var(--text-muted)] text-xs">{opp.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-emerald-500 font-bold text-lg">{formatCurrency(opp.monthly_opportunity)}</p>
                        <p className="text-[var(--text-muted)] text-xs">{t('arbitrage.monthly_potential_lc')}</p>
                      </div>
                      <ChevronRight size={16} className={`text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4 border-t border-[var(--border-color)] pt-4">
                      {detailLoading
                        ? <LoadingSpinner message={t('arbitrage.detail_loading')} size="sm" />
                        : detail && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {(detail.listings || []).map((l: ArbitrageListing, li: number) => (
                                <div key={li} className="p-3 bg-[var(--bg-elevated)] rounded-xl">
                                  <MarketplaceBadge marketplace={l.marketplace} />
                                  <p className="text-[var(--text-primary)] font-bold text-lg mt-2">{formatCurrency(l.price)}</p>
                                  <div className="space-y-1 mt-2 text-xs text-[var(--text-muted)]">
                                    <p>{t('arbitrage.net_per_item')} <span className={`font-medium ${l.net_per_item > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(l.net_per_item)}</span></p>
                                    <p>{t('common.margin')}: <span className="text-[var(--text-primary)]">{l.net_margin_pct.toFixed(1)}%</span></p>
                                    <p>{t('arbitrage.monthly_profit')} {formatCurrency(l.monthly_net_profit)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-end">
                              <button onClick={(e) => { e.stopPropagation(); handleAi(); }} disabled={aiLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                                {aiLoading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Brain size={14} />}
                                {t('arbitrage.ai_strategy')}
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
        <StreamingMarkdown content={aiAnalysis} webSources={aiSources} title={t('arbitrage.ai_analysis')} />
      )}
    </div>
  );
}
