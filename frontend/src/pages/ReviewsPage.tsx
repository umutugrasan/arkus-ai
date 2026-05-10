import { useEffect, useState, useCallback } from 'react';
import { Brain, Star } from 'lucide-react';
import { reviewService } from '../services';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import AIResponseBox from '../components/shared/AIResponseBox';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import { MOCK_PRODUCTS, MOCK_PRODUCT_NAMES } from '../utils/constants';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

const SENTIMENT_COLORS = ['#22c55e', '#ef4444', '#94a3b8'];

export default function ReviewsPage() {
  const [selectedProduct, setSelectedProduct] = useState(MOCK_PRODUCTS[0]);
  const [reviews, setReviews] = useState<Record<string, unknown>[]>([]);
  const [sentiment, setSentiment] = useState<Record<string, unknown> | null>(null);
  const [mpCompare, setMpCompare] = useState<Record<string, unknown> | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setAiAnalysis('');
    try {
      const [r, s, c] = await Promise.all([
        reviewService.getReviews(selectedProduct),
        reviewService.getSentiment(selectedProduct),
        reviewService.compare(selectedProduct),
      ]);
      setReviews(r.reviews || []);
      setSentiment(s);
      setMpCompare(c);
    } catch { /* no reviews */ }
    finally { setLoading(false); }
  }, [selectedProduct]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAiAnalyze = async () => {
    setAiLoading(true);
    try {
      const res = await reviewService.analyze(selectedProduct);
      setAiAnalysis(res.ai_analysis || '');
    } finally { setAiLoading(false); }
  };

  const sent = sentiment?.sentiment as Record<string, number> | undefined;
  const pieData = sent ? [
    { name: 'Pozitif', value: sent.positive, pct: sent.positive_pct },
    { name: 'Negatif', value: sent.negative, pct: sent.negative_pct },
    { name: 'Nötr', value: sent.neutral, pct: sent.neutral_pct },
  ] : [];

  const mpData = mpCompare ? Object.entries(mpCompare.marketplace_comparison as Record<string, Record<string, number>> || {}).map(([mp, d]) => ({
    name: mp,
    Pozitif: d.positive,
    Negatif: d.negative,
    'Ort. Puan': d.avg_rating,
  })) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Product selector */}
      <GlassCard className="flex items-center gap-4">
        <label className="text-slate-400 text-sm font-medium whitespace-nowrap">Ürün Seç:</label>
        <select
          value={selectedProduct}
          onChange={e => setSelectedProduct(e.target.value)}
          className="flex-1 bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50"
        >
          {MOCK_PRODUCTS.map(id => (
            <option key={id} value={id}>{MOCK_PRODUCT_NAMES[id] || id}</option>
          ))}
        </select>
      </GlassCard>

      {loading ? <LoadingSpinner message="Yorumlar yükleniyor..." /> : (
        <>
          {/* Stats row */}
          {sentiment && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <GlassCard className="text-center bg-indigo-500/5">
                <p className="text-slate-400 text-xs">Toplam Yorum</p>
                <p className="text-white text-2xl font-bold mt-1">{sentiment.total_reviews as number}</p>
              </GlassCard>
              <GlassCard className="text-center bg-amber-500/5">
                <p className="text-slate-400 text-xs">Ort. Puan</p>
                <p className="text-amber-400 text-2xl font-bold mt-1">⭐ {(sentiment.avg_rating as number)?.toFixed(1)}</p>
              </GlassCard>
              <GlassCard className="text-center bg-emerald-500/5">
                <p className="text-slate-400 text-xs">Pozitif</p>
                <p className="text-emerald-400 text-2xl font-bold mt-1">{sent?.positive_pct?.toFixed(0)}%</p>
              </GlassCard>
              <GlassCard className="text-center bg-rose-500/5">
                <p className="text-slate-400 text-xs">Negatif</p>
                <p className="text-rose-400 text-2xl font-bold mt-1">{sent?.negative_pct?.toFixed(0)}%</p>
              </GlassCard>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Pie chart */}
            <GlassCard>
              <h3 className="text-white font-semibold mb-4">Duygu Dağılımı</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4}>
                    {pieData.map((_, i) => <Cell key={i} fill={SENTIMENT_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} yorum`, n]} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: SENTIMENT_COLORS[i] }} />
                    <span className="text-slate-400 text-xs">{d.name} ({d.pct?.toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Marketplace comparison */}
            <GlassCard>
              <h3 className="text-white font-semibold mb-4">Pazaryeri Karşılaştırması</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={mpData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  <Bar dataKey="Pozitif" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Negatif" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>

          {/* Review list */}
          <GlassCard>
            <h3 className="text-white font-semibold mb-4">Son Yorumlar</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {reviews.map((r, i) => (
                <div key={i} className="flex gap-3 p-3 bg-slate-800/40 rounded-xl">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="flex">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={12} className={s <= (r.rating as number) ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 text-sm">{r.text as string}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <MarketplaceBadge marketplace={r.marketplace as string} />
                      <span className="text-slate-600 text-xs">{r.date as string}</span>
                    </div>
                  </div>
                </div>
              ))}
              {reviews.length === 0 && <p className="text-slate-400 text-sm text-center py-4">Bu ürün için yorum bulunamadı.</p>}
            </div>
          </GlassCard>

          {/* AI Analysis */}
          <div>
            {!aiAnalysis ? (
              <button
                onClick={handleAiAnalyze}
                disabled={aiLoading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 hover:border-indigo-400/50 text-indigo-300 rounded-xl py-4 font-semibold text-sm transition-all"
              >
                {aiLoading ? <LoadingSpinner ai message="Gemini analiz ediyor..." size="sm" /> : <><Brain size={18} /> 🤖 AI ile Yorum Analizi Yap</>}
              </button>
            ) : <AIResponseBox content={aiAnalysis} title="Yorum Analizi" />}
          </div>
        </>
      )}
    </div>
  );
}
