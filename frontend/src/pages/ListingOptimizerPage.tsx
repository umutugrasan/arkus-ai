import { useState, useEffect, useRef } from 'react';
import { Search, CheckCircle2, Brain, Sparkles, AlertCircle } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import EmptyState from '../components/shared/EmptyState';
import { listingOptimizerService, productService } from '../services';
import { formatDate } from '../utils/formatters';
import type {
  OptimizeResponse, KeywordsResponse, AnalyzeCurrentResponse,
  ListingHistoryResponse, ProductListItem
} from '../types/api';

type Tab = 'analyze' | 'optimize' | 'keywords' | 'history';
const MARKETPLACES = ['trendyol', 'hepsiburada', 'amazon_tr', 'n11'];

export default function ListingOptimizerPage() {
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

  if (loading) return <LoadingSpinner message="Ürünler yükleniyor…" size="lg" />;
  if (products.length === 0) return <EmptyState title="Ürün Bulunamadı" description="Listing optimizasyonu için önce bir pazaryeri bağlayın." />;

  const analysis = currentAnalysis?.analysis;
  const seoScore = analysis?.seo_score ?? 0;
  const scoreColor = seoScore >= 80 ? 'text-emerald-400' : seoScore >= 50 ? 'text-amber-400' : 'text-rose-400';
  const scoreBg = seoScore >= 80 ? 'from-emerald-500/20' : seoScore >= 50 ? 'from-amber-500/20' : 'from-rose-500/20';

  const tabs = [
    { id: 'analyze' as Tab, label: '🔍 Mevcut Analiz' },
    { id: 'optimize' as Tab, label: '✨ Optimizasyon' },
    { id: 'keywords' as Tab, label: '🔑 Keyword Stratejisi' },
    { id: 'history' as Tab, label: '📜 Geçmiş' },
  ];

  const kbData = keywordsResult?.keywords_breakdown as Record<string, string[]> | null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls */}
      <GlassCard>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">Ürün:</label>
            <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">Pazaryeri:</label>
            <select value={targetMP} onChange={e => setTargetMP(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
              {MARKETPLACES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={handleOptimize} disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
              {actionLoading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Sparkles size={14} />}
              Başlık Optimize Et
            </button>
            <button onClick={handleKeywords} disabled={actionLoading}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-all disabled:opacity-50">
              <Search size={14} /> Keyword Bul
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}>{t.label}</button>
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
                    <p className="text-slate-400 text-sm">Mevcut Başlık</p>
                    <p className="text-white font-semibold mt-1 text-lg">{currentAnalysis.current_title}</p>
                    <p className="text-slate-400 text-xs mt-1">Hedef: <MarketplaceBadge marketplace={currentAnalysis.target_marketplace} /></p>
                  </div>
                  <div className="text-center">
                    <p className={`text-4xl font-bold ${scoreColor}`}>{seoScore}</p>
                    <p className="text-slate-400 text-xs">SEO Skoru</p>
                    <p className="text-slate-300 text-sm font-medium mt-1">{currentAnalysis.recommendation}</p>
                  </div>
                </div>
              </GlassCard>
              {analysis?.warnings && analysis.warnings.length > 0 && (
                <GlassCard>
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><AlertCircle size={16} className="text-amber-400" /> Uyarılar</h3>
                  <div className="space-y-2">
                    {analysis.warnings.map((w: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> {w}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
              <GlassCard>
                <h3 className="text-white font-semibold mb-3">Başlık Metrikleri</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Karakter Sayısı', value: analysis?.length ?? '—' },
                    { label: 'Kelime Sayısı', value: analysis?.word_count ?? '—' },
                    { label: 'Limit İçinde', value: analysis?.in_hard_limit ? '✅ Evet' : '❌ Hayır' },
                    { label: 'İdeal Aralık', value: analysis?.in_ideal_range ? '✅ Evet' : '⚠️ Hayır' },
                  ].map(m => (
                    <div key={m.label} className="p-3 bg-slate-800/40 rounded-xl">
                      <p className="text-slate-400 text-xs">{m.label}</p>
                      <p className="text-white font-semibold mt-1">{String(m.value)}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </>
          ) : <LoadingSpinner message="Mevcut başlık analiz ediliyor…" size="sm" />}
        </div>
      )}

      {/* Optimizasyon Sonucu */}
      {tab === 'optimize' && (
        <>
          {!optimizeResult
            ? <GlassCard><p className="text-slate-400 text-sm text-center py-8">Başlık optimize etmek için yukarıdaki "Başlık Optimize Et" butonuna tıklayın.</p></GlassCard>
            : (
              <div className="space-y-4">
                <GlassCard>
                  <h3 className="text-white font-semibold mb-4">Eski vs Yeni Başlık</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                      <p className="text-rose-400 text-xs font-medium mb-2">ESKİ BAŞLIK</p>
                      <p className="text-white">{optimizeResult.comparison.original.title}</p>
                      <p className="text-rose-400 font-bold text-2xl mt-2">{optimizeResult.comparison.original.analysis?.seo_score}/100</p>
                    </div>
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <p className="text-emerald-400 text-xs font-medium mb-2">YENİ BAŞLIK ✨</p>
                      <p className="text-white">{optimizeResult.comparison.optimized.title}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-emerald-400 font-bold text-2xl">{optimizeResult.comparison.optimized.analysis?.seo_score}/100</p>
                        <span className="text-emerald-400 text-sm font-medium">
                          +{optimizeResult.comparison.seo_score_delta}
                        </span>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {optimizeResult.keywords.length > 0 && (
                  <GlassCard>
                    <h3 className="text-white font-semibold mb-3">🔑 Anahtar Kelimeler</h3>
                    <div className="flex flex-wrap gap-2">
                      {optimizeResult.keywords.map((kw: string, i: number) => (
                        <span key={i} className="px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-indigo-300 text-sm">{kw}</span>
                      ))}
                    </div>
                  </GlassCard>
                )}

                {optimizeResult.description && (
                  <GlassCard>
                    <h3 className="text-white font-semibold mb-3">📝 Optimize Edilmiş Açıklama</h3>
                    <div className="ai-response text-sm text-slate-300 max-h-60 overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-sans">{optimizeResult.description}</pre>
                    </div>
                  </GlassCard>
                )}

                {(optimizeResult.improvements || []).length > 0 && (
                  <GlassCard>
                    <h3 className="text-white font-semibold mb-3">💡 İyileştirmeler</h3>
                    <div className="space-y-2">
                      {(optimizeResult.improvements as string[]).map((imp: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-emerald-300">
                          <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" /> {imp}
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
            ? <GlassCard><p className="text-slate-400 text-sm text-center py-8">"Keyword Bul" butonuna tıklayarak AI destekli anahtar kelime stratejisi oluşturun.</p></GlassCard>
            : (
              <div className="space-y-4">
                {kbData && Object.entries(kbData).map(([group, kws]) => Array.isArray(kws) && kws.length > 0 ? (
                  <GlassCard key={group}>
                    <h3 className="text-white font-semibold mb-3 capitalize">{group.replace('_', ' ')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {(kws as string[]).map((kw: string, i: number) => (
                        <span key={i} className="px-3 py-1 bg-slate-800/60 border border-slate-700 rounded-full text-slate-300 text-sm hover:border-indigo-500/50 transition-colors">{kw}</span>
                      ))}
                    </div>
                  </GlassCard>
                ) : null)}
                {kbData?.strategy_note && (
                  <GlassCard className="border border-indigo-500/20">
                    <h3 className="text-indigo-300 font-semibold mb-2 flex items-center gap-2"><Brain size={14} /> Strateji Notu</h3>
                    <p className="text-slate-300 text-sm">{String(kbData.strategy_note)}</p>
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
            ? <EmptyState title="Geçmiş Yok" description="Henüz bu ürün için optimizasyon yapılmamış." />
            : (
              <div className="space-y-3">
                {history.optimizations.map((opt, i) => (
                  <GlassCard key={i}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-slate-400 text-xs">{formatDate(opt.created_at)}</p>
                        <p className="text-white font-medium mt-1">{opt.optimized_title}</p>
                        {opt.description_preview && (
                          <p className="text-slate-400 text-xs mt-1 line-clamp-2">{opt.description_preview}</p>
                        )}
                      </div>
                      {opt.seo_score !== null && (
                        <div className="text-right ml-4">
                          <p className={`text-2xl font-bold ${
                            (opt.seo_score ?? 0) >= 80 ? 'text-emerald-400' :
                            (opt.seo_score ?? 0) >= 50 ? 'text-amber-400' : 'text-rose-400'
                          }`}>{opt.seo_score}</p>
                          <p className="text-slate-400 text-xs">SEO</p>
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
