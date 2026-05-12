import { useState, useEffect, useRef } from 'react';
import { Brain } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import EmptyState from '../components/shared/EmptyState';
import { competitorService, productService } from '../services';
import { formatCurrency, formatNumber } from '../utils/formatters';
import type {
  CompetitorsResponse, CompetitorAnalyzeResponse,
  PriceMapResponse, CompetitorTrackResponse, ProductListItem, PriceMapEntry
} from '../types/api';

type SubTab = 'list' | 'pricemap' | 'track';
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function CompetitorsPage() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [competitors, setCompetitors] = useState<CompetitorsResponse | null>(null);
  const [priceMap, setPriceMap] = useState<PriceMapResponse | null>(null);
  const [track, setTrack] = useState<CompetitorTrackResponse | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiSources, setAiSources] = useState<Array<{ title: string; uri: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [tab, setTab] = useState<SubTab>('list');
  const didInit = useRef(false);

  useEffect(() => {
    productService.list().then(res => {
      // Use id as the unique key — ProductListItem has 'id' not 'product_code'
      const seen = new Set<string>();
      const unique = res.products.filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      setProducts(unique);
      if (unique.length > 0 && !didInit.current) {
        setSelectedProduct(unique[0].id);
        didInit.current = true;
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    setCompetitors(null); setPriceMap(null); setTrack(null); setAiAnalysis('');
    Promise.all([
      competitorService.list(selectedProduct),
      competitorService.priceMap(selectedProduct),
      competitorService.track(selectedProduct, 14),
    ]).then(([c, pm, tr]) => {
      setCompetitors(c); setPriceMap(pm); setTrack(tr);
    }).catch(() => {});
  }, [selectedProduct]);

  const handleAiAnalysis = async () => {
    if (!selectedProduct) return;
    setAiLoading(true);
    try {
      const res: CompetitorAnalyzeResponse = await competitorService.analyze(selectedProduct, 'detailed', true);
      setAiAnalysis(res.ai_analysis || '');
      setAiSources(res.web_sources || []);
    } finally { setAiLoading(false); }
  };

  if (loading) return <LoadingSpinner message="Rakip verileri yükleniyor…" size="lg" />;
  if (products.length === 0) return <EmptyState title="Ürün Bulunamadı" description="Rakip analizi için önce bir pazaryeri bağlayın." />;

  const comps = competitors?.competitors || [];
  const trackHistories = track?.histories || [];

  const trackChartData = trackHistories.length > 0
    ? (trackHistories[0].timeline || []).map((t, i) => {
        const point: Record<string, string | number> = { date: t.date };
        trackHistories.forEach(h => {
          const snap = (h.timeline || [])[i];
          if (snap) point[h.competitor] = snap.price;
        });
        return point;
      })
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <GlassCard>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-slate-400 text-sm font-medium">Ürün Seç:</label>
          <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {competitors && <span className="text-slate-400 text-sm">{competitors.total} rakip bulundu</span>}
        </div>
      </GlassCard>

      <div className="flex gap-2">
        {(['list', 'pricemap', 'track'] as SubTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-white'}`}>
            {t === 'list' ? '📋 Rakip Listesi' : t === 'pricemap' ? '🗺 Fiyat Haritası' : '📈 Fiyat Takibi'}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <div className="space-y-3">
          {comps.length === 0
            ? <EmptyState title="Rakip Bulunamadı" description="Bu ürün için rakip verisi henüz yok." />
            : comps.map((c, i) => (
              <GlassCard key={i}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <MarketplaceBadge marketplace={c.marketplace} />
                      <span className="text-white font-semibold">{c.competitor_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.we_are === 'ucuz' ? 'bg-emerald-500/20 text-emerald-400' :
                        c.we_are === 'pahali' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-700 text-slate-400'
                      }`}>{c.we_are === 'ucuz' ? '💚 Biz daha ucuz' : c.we_are === 'pahali' ? '🔴 Biz daha pahalı' : '⚖️ Eşit'}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm mt-2">
                      <span className="text-slate-400">Rakip: <span className="text-white font-medium">{formatCurrency(c.competitor_price)}</span></span>
                      <span className="text-slate-400">Bizim: <span className="text-white font-medium">{formatCurrency(c.our_price)}</span></span>
                      <span className="text-slate-400">Fark: <span className={`font-medium ${c.price_diff > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCurrency(Math.abs(c.price_diff))}</span></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-lg">{c.competitor_rating?.toFixed(1)}</p>
                    <p className="text-slate-400 text-xs">{formatNumber(c.competitor_review_count)} yorum</p>
                  </div>
                </div>
              </GlassCard>
            ))}
        </div>
      )}

      {tab === 'pricemap' && priceMap && (
        <div className="space-y-4">
          {Object.entries(priceMap.price_map).map(([mp, data]: [string, PriceMapEntry]) => (
            <GlassCard key={mp}>
              <div className="flex items-center gap-2 mb-3">
                <MarketplaceBadge marketplace={mp} />
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  data.position === 'en ucuz' ? 'bg-emerald-500/20 text-emerald-400' :
                  data.position === 'en pahali' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                }`}>{data.position}</span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-slate-400">Bizim: <span className="text-white font-bold">{formatCurrency(data.our_price)}</span></span>
                <span className="text-slate-400">Min: <span className="text-emerald-400">{formatCurrency(data.min_competitor_price)}</span></span>
                <span className="text-slate-400">Max: <span className="text-rose-400">{formatCurrency(data.max_competitor_price)}</span></span>
                <span className="text-slate-400">Ort: <span className="text-white">{formatCurrency(data.avg_competitor_price)}</span></span>
              </div>
              {data.competitors.length > 0 && (
                <div className="mt-3">
                  <ResponsiveContainer width="100%" height={Math.max(60, data.competitors.length * 30)}>
                    <BarChart data={data.competitors} layout="vertical">
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v: number) => `₺${v}`} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={80} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))}
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                      <Bar dataKey="price" fill="#6366f1" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {tab === 'track' && (
        trackHistories.length === 0
          ? <EmptyState title="Fiyat Geçmişi Yok" description="Henüz yeterli snapshot toplanmamış." />
          : (
            <GlassCard>
              <h3 className="text-white font-semibold mb-4">Son 14 Gün Fiyat Değişimi</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trackChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v: number) => `₺${v}`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Legend />
                  {trackHistories.map((h, i) => (
                    <Line key={h.competitor} type="monotone" dataKey={h.competitor} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                {trackHistories.map((h, i) => (
                  <div key={i} className="p-3 bg-slate-800/40 rounded-xl">
                    <p className="text-slate-400 text-xs">{h.competitor}</p>
                    <p className="text-white font-semibold">{formatCurrency(h.current_price)}</p>
                    <p className={`text-xs font-medium mt-1 ${h.trend === 'dusus' ? 'text-emerald-400' : h.trend === 'yukselis' ? 'text-rose-400' : 'text-slate-400'}`}>
                      {h.trend === 'dusus' ? '↓' : h.trend === 'yukselis' ? '↑' : '→'} {h.change_pct}%
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )
      )}

      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><Brain size={16} className="text-indigo-400" /> AI Rakip Analizi</h3>
          <button onClick={handleAiAnalysis} disabled={aiLoading || !selectedProduct}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
            {aiLoading ? <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Analiz ediliyor…</> : <><Brain size={14} /> Detaylı Analiz</>}
          </button>
        </div>
        {aiAnalysis
          ? <StreamingMarkdown content={aiAnalysis} webSources={aiSources} title="Rakip AI Analizi" />
          : <p className="text-slate-500 text-sm">En tehlikeli rakip ve fiyat stratejisi önerileri için Analiz Et'e tıklayın.</p>
        }
      </GlassCard>
    </div>
  );
}
