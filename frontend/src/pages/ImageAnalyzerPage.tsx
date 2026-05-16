import { useState, useEffect, useRef } from 'react';
import { Zap, CheckCircle2, XCircle, BarChart2, Loader2, AlertCircle } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import EmptyState from '../components/shared/EmptyState';
import { imageAnalyzerService, productService } from '../services';
import { formatDate } from '../utils/formatters';
import type { ImageAnalyzeResponse, ImageSuggestionsResponse, ImageHistoryResponse, ProductListItem } from '../types/api';

type Tab = 'analyze' | 'suggestions' | 'history';

const SCORE_LABELS: Record<string, string> = {
  arka_plan: 'Arka Plan',
  aydinlatma: 'Aydınlatma',
  cerceveleme: 'Çerçeveleme',
  cozunurluk_algisi: 'Çözünürlük',
  kalite: 'Kalite',
  pazaryeri_uyumu: 'Pazaryeri Uyumu',
};

export default function ImageAnalyzerPage() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [tab, setTab] = useState<Tab>('analyze');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ImageAnalyzeResponse | null>(null);
  const [suggestions, setSuggestions] = useState<ImageSuggestionsResponse | null>(null);
  const [historyData, setHistoryData] = useState<ImageHistoryResponse | null>(null);
  const didInit = useRef(false);

  useEffect(() => {
    productService.list().then(res => {
      const seen = new Set<string>();
      const unique = res.products.filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      setProducts(unique);
      if (unique.length > 0 && !didInit.current) {
        setSelectedProductId(unique[0].id);
        didInit.current = true;
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProductId) return;
    setAnalysis(null); setSuggestions(null);
    imageAnalyzerService.history(selectedProductId).then(setHistoryData).catch(() => {});
  }, [selectedProductId]);

  const handleAnalyze = async () => {
    if (!selectedProductId) return;
    setAnalyzing(true);
    try {
      const res = await imageAnalyzerService.analyze(selectedProductId, customImageUrl || undefined);
      setAnalysis(res);
      setTab('analyze');
    } finally { setAnalyzing(false); }
  };

  const handleSuggestions = async () => {
    if (!selectedProductId) return;
    setAnalyzing(true);
    try {
      const res = await imageAnalyzerService.suggestions(selectedProductId, customImageUrl || undefined);
      setSuggestions(res);
      setTab('suggestions');
    } finally { setAnalyzing(false); }
  };

  if (loading) return <LoadingSpinner message="Ürünler yükleniyor…" size="lg" />;
  if (products.length === 0) return <EmptyState title="Ürün Bulunamadı" description="Görsel analizi için önce bir pazaryeri bağlayın." />;

  const breakdown = analysis?.scores_breakdown as Record<string, number> | null;
  const overallScore = analysis?.overall_score ?? 0;
  const scoreColor = overallScore >= 80 ? 'text-emerald-400' : overallScore >= 50 ? 'text-amber-400' : 'text-rose-400';
  const scoreBg = overallScore >= 80 ? 'from-emerald-500/20' : overallScore >= 50 ? 'from-amber-500/20' : 'from-rose-500/20';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls */}
      <GlassCard>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-gray-500 text-xs block mb-1">Ürün</label>
            <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}
              className="bg-white border border-gray-200 text-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="text-gray-500 text-xs block mb-1">Özel Görsel URL (opsiyonel)</label>
            <input value={customImageUrl} onChange={e => setCustomImageUrl(e.target.value)}
              placeholder="https://…"
              className="w-full bg-white border border-gray-200 text-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAnalyze} disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 bg-[#4a3f44] hover:bg-[#6b6266] text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <BarChart2 size={14} />}
              Analiz Et
            </button>
            <button onClick={handleSuggestions} disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-slate-800 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              İyileştirme Öner
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['analyze', 'suggestions', 'history'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t ? 'bg-[#4a3f44] text-white' : 'bg-gray-50 text-gray-500 hover:text-slate-800'
            }`}>
            {t === 'analyze' ? '📊 Analiz' : t === 'suggestions' ? '💡 Öneriler' : '📜 Geçmiş'}
          </button>
        ))}
      </div>

      {/* Analiz Sonucu */}
      {tab === 'analyze' && analysis && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <GlassCard className={`bg-gradient-to-br ${scoreBg} to-transparent`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs">Genel Skor</p>
                  <p className={`text-5xl font-extrabold mt-1 ${scoreColor}`}>{Math.round(overallScore)}</p>
                  <p className="text-gray-500 text-sm">/100</p>
                </div>
                <MarketplaceBadge marketplace={analysis.marketplace} />
              </div>
            </GlassCard>
            {breakdown && (
              <GlassCard>
                <h3 className="text-slate-800 font-semibold mb-3 text-sm">Kategori Skorları</h3>
                <div className="space-y-2">
                  {Object.entries(breakdown).map(([key, val]) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-500">{SCORE_LABELS[key] || key}</span>
                        <span className="text-slate-800">{val}/10</span>
                      </div>
                      <div className="h-1.5 bg-white rounded-full">
                        <div className={`h-full rounded-full ${val >= 8 ? 'bg-emerald-500' : val >= 5 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${val * 10}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>
          {(analysis.detected_issues || []).length > 0 && (
            <GlassCard>
              <h3 className="text-slate-800 font-semibold mb-3 flex items-center gap-2"><AlertCircle size={14} className="text-rose-400" /> Tespit Edilen Sorunlar</h3>
              <div className="space-y-2">
                {analysis.detected_issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                    <XCircle size={14} className="flex-shrink-0 mt-0.5 text-rose-400" /> {issue}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
          {(analysis.positive_aspects || []).length > 0 && (
            <GlassCard>
              <h3 className="text-slate-800 font-semibold mb-3 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /> Olumlu Yönler</h3>
              <div className="space-y-1">
                {analysis.positive_aspects.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-emerald-300">
                    <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" /> {p}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* İyileştirme Önerileri */}
      {tab === 'suggestions' && suggestions && (
        <div className="space-y-3">
          {suggestions.priority_actions.map((a, i) => (
            <GlassCard key={i}>
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 p-1.5 rounded-lg text-xs font-bold ${
                  a.difficulty === 'kolay' ? 'bg-emerald-500/20 text-emerald-400' :
                  a.difficulty === 'orta' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-rose-500/20 text-rose-400'
                }`}>{i + 1}</div>
                <div>
                  <p className="text-slate-800 font-semibold">{a.action}</p>
                  <p className="text-gray-500 text-sm mt-0.5">{a.reason}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">📈 {a.expected_impact}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      a.difficulty === 'kolay' ? 'bg-emerald-500/10 text-emerald-400' :
                      a.difficulty === 'orta' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-rose-500/10 text-rose-400'
                    }`}>{a.difficulty}</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
          {suggestions.tools_to_use.length > 0 && (
            <GlassCard>
              <h3 className="text-slate-800 font-semibold mb-2">🛠️ Önerilen Araçlar</h3>
              <ul className="space-y-1">
                {suggestions.tools_to_use.map((t, i) => (
                  <li key={i} className="text-gray-600 text-sm flex items-center gap-2">
                    <span className="text-indigo-600">•</span> {t}
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}
        </div>
      )}

      {/* Geçmiş */}
      {tab === 'history' && (
        historyData && historyData.analyses.length > 0
          ? (
            <div className="space-y-3">
              {historyData.analyses.map((a, i) => (
                <GlassCard key={i}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-xs">{formatDate(a.created_at)}</p>
                      <p className="text-gray-600 text-sm mt-1 line-clamp-2">{a.suggestions}</p>
                    </div>
                    <div className={`text-2xl font-bold ml-4 ${(a.score ?? 0) >= 80 ? 'text-emerald-400' : (a.score ?? 0) >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {Math.round(a.score ?? 0)}
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )
          : <EmptyState title="Geçmiş Yok" description="Henüz bu ürün için görsel analizi yapılmamış." />
      )}

      {analyzing && <LoadingSpinner message="Gemini Vision ile görsel analiz ediliyor…" size="sm" />}
    </div>
  );
}
