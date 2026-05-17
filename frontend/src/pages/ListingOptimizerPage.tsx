import { useState, useEffect, useRef } from 'react';
import { Search, CheckCircle2, Brain, Sparkles, AlertCircle } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import EmptyState from '../components/shared/EmptyState';
import { listingOptimizerService, productService } from '../services';
import { formatDate } from '../utils/formatters';
import { useI18n } from '../context/I18nContext';
import type {
  OptimizeResponse, KeywordsResponse, AnalyzeCurrentResponse,
  ListingHistoryResponse, ProductListItem
} from '../types/api';

type Tab = 'analyze' | 'optimize' | 'keywords' | 'history';
const MARKETPLACES = ['trendyol', 'hepsiburada', 'amazon_tr', 'n11'];

export default function ListingOptimizerPage() {
  const { t } = useI18n();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [targetMP, setTargetMP] = useState('trendyol');
  const [tab, setTab] = useState<Tab>('analyze');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [currentAnalysis, setCurrentAnalysis] = useState<AnalyzeCurrentResponse | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResponse | null>(null);
  const [keywordsResult, setKeywordsResult] = useState<KeywordsResponse | null>(null);
  const [history, setHistory] = useState<ListingHistoryResponse | null>(null);
  const didInit = useRef(false);

  useEffect(() => {
    productService.list().then(res => {
      const seen = new Set<string>();
      const unique = res.products.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
      setProducts(unique);
      if (unique.length > 0 && !didInit.current) {
        setSelectedProduct(unique[0].id);
        didInit.current = true;
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    setCurrentAnalysis(null);
    setOptimizeResult(null);
    setKeywordsResult(null);
    setHistory(null);
    listingOptimizerService.analyzeCurrent(selectedProduct, targetMP).then(setCurrentAnalysis).catch(() => {});
    listingOptimizerService.history(selectedProduct).then(setHistory).catch(() => {});
  }, [selectedProduct, targetMP]);

  const handleOptimize = async () => {
    if (!selectedProduct) return;
    setActionLoading(true);
    try {
      const res = await listingOptimizerService.optimize(selectedProduct, targetMP, true);
      setOptimizeResult(res);
      setTab('optimize');
    } finally { setActionLoading(false); }
  };

  const handleKeywords = async () => {
    if (!selectedProduct) return;
    setActionLoading(true);
    try {
      const res = await listingOptimizerService.keywords(selectedProduct, true);
      setKeywordsResult(res);
      setTab('keywords');
    } finally { setActionLoading(false); }
  };

  if (loading) return <LoadingSpinner message={t('common.loading_products')} size="lg" />;
  if (products.length === 0) return <EmptyState title={t('competitors.no_product')} description={t('listing.no_product_desc')} />;

  const analysis = currentAnalysis?.analysis;
  const seoScore = analysis?.seo_score ?? 0;
  const scoreColor = seoScore >= 80 ? 'text-emerald-500' : seoScore >= 50 ? 'text-amber-500' : 'text-rose-500';
  const scoreBg = seoScore >= 80 ? 'from-emerald-500/20' : seoScore >= 50 ? 'from-amber-500/20' : 'from-rose-500/20';

  const tabs = [
    { id: 'analyze' as Tab, label: `🔍 ${t('listing.tab_analyze')}` },
    { id: 'optimize' as Tab, label: `✨ ${t('listing.tab_optimize')}` },
    { id: 'keywords' as Tab, label: `🔑 ${t('listing.tab_keywords')}` },
    { id: 'history' as Tab, label: `📜 ${t('listing.tab_history')}` },
  ];

  const kbData = keywordsResult?.keywords_breakdown as Record<string, string[]> | null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls */}
      <GlassCard>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[var(--text-muted)] text-sm">{t('products.col_product')}:</label>
            <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
              className="bg-[var(--bg-card)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[var(--text-muted)] text-sm">{t('common.marketplace')}:</label>
            <select value={targetMP} onChange={e => setTargetMP(e.target.value)}
              className="bg-[var(--bg-card)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
              {MARKETPLACES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={handleOptimize} disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50">
              {actionLoading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Sparkles size={14} />}
              {t('listing.optimize_btn')}
            </button>
            <button onClick={handleKeywords} disabled={actionLoading}
              className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-muted)] border border-[var(--border-strong)] text-[var(--text-secondary)] rounded-xl text-sm transition-all disabled:opacity-50">
              <Search size={14} /> {t('listing.keyword_btn')}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === tb.id ? 'bg-[var(--accent-solid)] text-[var(--accent-fg)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}>{tb.label}</button>
        ))}
      </div>

      {/* Mevcut Analiz */}
      {tab === 'analyze' && (
        <div className="space-y-4">
          {currentAnalysis ? (
            <>
              <GlassCard className={`bg-gradient-to-br ${scoreBg} to-transparent`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[var(--text-muted)] text-sm">{t('listing.current_title')}</p>
                    <p className="text-[var(--text-primary)] font-semibold mt-1 text-lg">{currentAnalysis.current_title}</p>
                    <p className="text-[var(--text-muted)] text-xs mt-1">{t('listing.target')} <MarketplaceBadge marketplace={currentAnalysis.target_marketplace} /></p>
                  </div>
                  <div className="text-center">
                    <p className={`text-4xl font-bold ${scoreColor}`}>{seoScore}</p>
                    <p className="text-[var(--text-muted)] text-xs">{t('listing.seo_score')}</p>
                    <p className="text-[var(--text-secondary)] text-sm font-medium mt-1">{currentAnalysis.recommendation}</p>
                  </div>
                </div>
              </GlassCard>
              {analysis?.warnings && analysis.warnings.length > 0 && (
                <GlassCard>
                  <h3 className="text-[var(--text-primary)] font-semibold mb-3 flex items-center gap-2"><AlertCircle size={16} className="text-amber-500" /> {t('listing.warnings')}</h3>
                  <div className="space-y-2">
                    {analysis.warnings.map((w: string, i: number) => (
                      <div key={`warn-${i}-${w.slice(0, 24)}`} className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> {w}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
              <GlassCard>
                <h3 className="text-[var(--text-primary)] font-semibold mb-3">{t('listing.title_metrics')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: t('listing.m_chars'), value: analysis?.length ?? '—' },
                    { label: t('listing.m_words'), value: analysis?.word_count ?? '—' },
                    { label: t('listing.m_in_limit'), value: analysis?.in_hard_limit ? `✅ ${t('common.yes')}` : `❌ ${t('common.no')}` },
                    { label: t('listing.m_ideal'), value: analysis?.in_ideal_range ? `✅ ${t('common.yes')}` : `⚠️ ${t('common.no')}` },
                  ].map(m => (
                    <div key={m.label} className="p-3 bg-[var(--bg-elevated)] rounded-xl">
                      <p className="text-[var(--text-muted)] text-xs">{m.label}</p>
                      <p className="text-[var(--text-primary)] font-semibold mt-1">{String(m.value)}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </>
          ) : <LoadingSpinner message={t('listing.analyzing_current')} size="sm" />}
        </div>
      )}

      {/* Optimizasyon Sonucu */}
      {tab === 'optimize' && (
        <>
          {!optimizeResult
            ? <GlassCard><p className="text-[var(--text-muted)] text-sm text-center py-8">{t('listing.optimize_hint')}</p></GlassCard>
            : (
              <div className="space-y-4">
                <GlassCard>
                  <h3 className="text-[var(--text-primary)] font-semibold mb-4">{t('listing.old_vs_new')}</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                      <p className="text-rose-500 text-xs font-medium mb-2">{t('listing.old_title')}</p>
                      <p className="text-[var(--text-primary)]">{optimizeResult.comparison.original.title}</p>
                      <p className="text-rose-500 font-bold text-2xl mt-2">{optimizeResult.comparison.original.analysis?.seo_score}/100</p>
                    </div>
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <p className="text-emerald-500 text-xs font-medium mb-2">{t('listing.new_title')} ✨</p>
                      <p className="text-[var(--text-primary)]">{optimizeResult.comparison.optimized.title}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-emerald-500 font-bold text-2xl">{optimizeResult.comparison.optimized.analysis?.seo_score}/100</p>
                        <span className="text-emerald-500 text-sm font-medium">
                          +{optimizeResult.comparison.seo_score_delta}
                        </span>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {optimizeResult.keywords.length > 0 && (
                  <GlassCard>
                    <h3 className="text-[var(--text-primary)] font-semibold mb-3">🔑 {t('listing.keywords')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {optimizeResult.keywords.map((kw: string, i: number) => (
                        <span key={`kw-${i}-${kw}`} className="px-3 py-1 bg-indigo-50 border border-indigo-500/30 rounded-full text-indigo-600 dark:text-indigo-300 text-sm">{kw}</span>
                      ))}
                    </div>
                  </GlassCard>
                )}

                {optimizeResult.description && (
                  <GlassCard>
                    <h3 className="text-[var(--text-primary)] font-semibold mb-3">📝 {t('listing.opt_description')}</h3>
                    <div className="ai-response text-sm text-[var(--text-secondary)] max-h-60 overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-sans">{optimizeResult.description}</pre>
                    </div>
                  </GlassCard>
                )}

                {(optimizeResult.improvements || []).length > 0 && (
                  <GlassCard>
                    <h3 className="text-[var(--text-primary)] font-semibold mb-3">💡 {t('listing.improvements')}</h3>
                    <div className="space-y-2">
                      {(optimizeResult.improvements as string[]).map((imp: string, i: number) => (
                        <div key={`imp-${i}-${imp.slice(0, 24)}`} className="flex items-start gap-2 text-sm text-emerald-600 dark:text-emerald-300">
                          <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" /> {imp}
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}
              </div>
            )
          }
        </>
      )}

      {/* Keyword Stratejisi */}
      {tab === 'keywords' && (
        <>
          {!keywordsResult
            ? <GlassCard><p className="text-[var(--text-muted)] text-sm text-center py-8">{t('listing.keyword_hint')}</p></GlassCard>
            : (
              <div className="space-y-4">
                {kbData && Object.entries(kbData).map(([group, kws]) => Array.isArray(kws) && kws.length > 0 ? (
                  <GlassCard key={group}>
                    <h3 className="text-[var(--text-primary)] font-semibold mb-3 capitalize">{group.replace('_', ' ')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {(kws as string[]).map((kw: string) => (
                        <span key={`${group}-${kw}`} className="px-3 py-1 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-full text-[var(--text-secondary)] text-sm hover:border-indigo-500/50 transition-colors">{kw}</span>
                      ))}
                    </div>
                  </GlassCard>
                ) : null)}
                {kbData?.strategy_note && (
                  <GlassCard className="border border-indigo-100 dark:border-indigo-400/15">
                    <h3 className="text-indigo-600 dark:text-indigo-300 font-semibold mb-2 flex items-center gap-2"><Brain size={14} /> {t('listing.strategy_note')}</h3>
                    <p className="text-[var(--text-secondary)] text-sm">{String(kbData.strategy_note)}</p>
                  </GlassCard>
                )}
              </div>
            )
          }
        </>
      )}

      {/* Geçmiş */}
      {tab === 'history' && (
        <>
          {!history || history.optimizations.length === 0
            ? <EmptyState title={t('image.no_history')} description={t('listing.no_history_desc')} />
            : (
              <div className="space-y-3">
                {history.optimizations.map((opt) => (
                  <GlassCard key={opt.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-[var(--text-muted)] text-xs">{formatDate(opt.created_at)}</p>
                        <p className="text-[var(--text-primary)] font-medium mt-1">{opt.optimized_title}</p>
                        {opt.description_preview && (
                          <p className="text-[var(--text-muted)] text-xs mt-1 line-clamp-2">{opt.description_preview}</p>
                        )}
                      </div>
                      {opt.seo_score !== null && (
                        <div className="text-right ml-4">
                          <p className={`text-2xl font-bold ${
                            (opt.seo_score ?? 0) >= 80 ? 'text-emerald-500' :
                            (opt.seo_score ?? 0) >= 50 ? 'text-amber-500' : 'text-rose-500'
                          }`}>{opt.seo_score}</p>
                          <p className="text-[var(--text-muted)] text-xs">SEO</p>
                        </div>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            )
          }
        </>
      )}
    </div>
  );
}
