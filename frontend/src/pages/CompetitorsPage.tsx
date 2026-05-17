import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../hooks/useTheme';
import { getChartTheme } from '../utils/chartTheme';
import { useBackgroundAnalysis } from '../context/AnalysisContext';
import type {
  CompetitorsResponse, CompetitorAnalyzeResponse,
  PriceMapResponse, CompetitorTrackResponse, ProductListItem, PriceMapEntry
} from '../types/api';

type SubTab = 'list' | 'pricemap' | 'track';
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const SELECTED_PRODUCT_KEY = 'arkus_competitor_product';


export default function CompetitorsPage() {
  const { t } = useI18n();
  const { isDark } = useTheme();
  const chart = getChartTheme(isDark);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [competitors, setCompetitors] = useState<CompetitorsResponse | null>(null);
  const [priceMap, setPriceMap] = useState<PriceMapResponse | null>(null);
  const [track, setTrack] = useState<CompetitorTrackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<SubTab>('list');
  const didInit = useRef(false);
  const mountedRef = useRef(true);

  const [searchParams, setSearchParams] = useSearchParams();
  const urlSelected = searchParams.get('id');

  const { text: aiAnalysis, isRunning: aiLoading, startFetch } = useBackgroundAnalysis({
    type: 'competitors',
    id: selectedProduct || 'none',
    label: `Rakip Analizi`,
    navigateTo: `/competitors?id=${selectedProduct || ''}`,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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
        let restoredId = unique[0].id;
        const savedId = sessionStorage.getItem(SELECTED_PRODUCT_KEY);
        
        if (urlSelected && unique.find(p => p.id === urlSelected)) {
          restoredId = urlSelected;
        } else if (savedId && unique.find(p => p.id === savedId)) {
          restoredId = savedId;
        }

        setSelectedProduct(restoredId);
        if (restoredId !== urlSelected) {
          setSearchParams(new URLSearchParams({ id: restoredId }));
        }
        didInit.current = true;
      }
    }).finally(() => setLoading(false));
  }, [urlSelected, setSearchParams]);

  useEffect(() => {
    if (urlSelected && urlSelected !== selectedProduct && products.find(p => p.id === urlSelected)) {
      setSelectedProduct(urlSelected);
    }
  }, [urlSelected, selectedProduct, products]);

  const loadProductData = useCallback((productId: string) => {
    setCompetitors(null); setPriceMap(null); setTrack(null);
    Promise.all([
      competitorService.list(productId),
      competitorService.priceMap(productId),
      competitorService.track(productId, 14),
    ]).then(([c, pm, tr]) => {
      if (!mountedRef.current) return;
      setCompetitors(c); setPriceMap(pm); setTrack(tr);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    // Seçili ürünü sessionStorage'a kaydet
    sessionStorage.setItem(SELECTED_PRODUCT_KEY, selectedProduct);
    loadProductData(selectedProduct);
  }, [selectedProduct, loadProductData]);

  const handleAiAnalysis = () => {
    if (!selectedProduct) return;
    startFetch(async () => {
      const res: CompetitorAnalyzeResponse = await competitorService.analyze(selectedProduct, 'detailed', true);
      return res.ai_analysis || '';
    });
  };

  if (loading) return <LoadingSpinner message={t('competitors.loading')} size="lg" />;
  if (products.length === 0) return <EmptyState title={t('competitors.no_product')} description={t('competitors.no_product_desc')} />;

  const comps = competitors?.competitors || [];
  const trackHistories = track?.histories || [];

  const trackChartData = trackHistories.length > 0
    ? (trackHistories[0].timeline || []).map((tl, i) => {
        const point: Record<string, string | number> = { date: tl.date };
        trackHistories.forEach(h => {
          const snap = (h.timeline || [])[i];
          if (snap) point[h.competitor] = snap.price;
        });
        return point;
      })
    : [];

  const tabLabel = (id: SubTab) =>
    id === 'list' ? `📋 ${t('competitors.list')}`
      : id === 'pricemap' ? `🗺 ${t('competitors.price_map')}`
        : `📈 ${t('competitors.price_track')}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <GlassCard>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[var(--text-muted)] text-sm font-medium">{t('competitors.select_product')}</label>
          <select value={selectedProduct} onChange={e => {
            setSelectedProduct(e.target.value);
            setSearchParams(new URLSearchParams({ id: e.target.value }));
          }}
            className="bg-[var(--bg-card)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {competitors && <span className="text-[var(--text-muted)] text-sm">{competitors.total} {t('competitors.found')}</span>}
        </div>
      </GlassCard>

      <div className="flex gap-2">
        {(['list', 'pricemap', 'track'] as SubTab[]).map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === tb ? 'bg-[var(--accent-solid)] text-[var(--accent-fg)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
            {tabLabel(tb)}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <div className="space-y-3">
          {comps.length === 0
            ? <EmptyState title={t('competitors.not_found')} description={t('competitors.not_found_desc')} />
            : comps.map((c) => (
              <GlassCard key={`${c.marketplace}-${c.competitor_name}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <MarketplaceBadge marketplace={c.marketplace} />
                      <span className="text-[var(--text-primary)] font-semibold">{c.competitor_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.we_are === 'ucuz' ? 'bg-emerald-500/20 text-emerald-500' :
                        c.we_are === 'pahali' ? 'bg-rose-500/20 text-rose-500' : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
                      }`}>{c.we_are === 'ucuz' ? `💚 ${t('competitors.cheaper')}` : c.we_are === 'pahali' ? `🔴 ${t('competitors.expensive')}` : `⚖️ ${t('competitors.equal')}`}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm mt-2">
                      <span className="text-[var(--text-muted)]">{t('competitors.competitor')} <span className="text-[var(--text-primary)] font-medium">{formatCurrency(c.competitor_price)}</span></span>
                      <span className="text-[var(--text-muted)]">{t('competitors.ours')} <span className="text-[var(--text-primary)] font-medium">{formatCurrency(c.our_price)}</span></span>
                      <span className="text-[var(--text-muted)]">{t('competitors.diff')} <span className={`font-medium ${c.price_diff > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{formatCurrency(Math.abs(c.price_diff))}</span></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[var(--text-primary)] font-bold text-lg">{c.competitor_rating?.toFixed(1)}</p>
                    <p className="text-[var(--text-muted)] text-xs">{formatNumber(c.competitor_review_count)} {t('competitors.reviews_count')}</p>
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
                  data.position === 'en ucuz' ? 'bg-emerald-500/20 text-emerald-500' :
                  data.position === 'en pahali' ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'
                }`}>{data.position}</span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-[var(--text-muted)]">{t('competitors.ours')} <span className="text-[var(--text-primary)] font-bold">{formatCurrency(data.our_price)}</span></span>
                <span className="text-[var(--text-muted)]">{t('competitors.min')} <span className="text-emerald-500">{formatCurrency(data.min_competitor_price)}</span></span>
                <span className="text-[var(--text-muted)]">{t('competitors.max')} <span className="text-rose-500">{formatCurrency(data.max_competitor_price)}</span></span>
                <span className="text-[var(--text-muted)]">{t('competitors.avg')} <span className="text-[var(--text-primary)]">{formatCurrency(data.avg_competitor_price)}</span></span>
              </div>
              {data.competitors.length > 0 && (
                <div className="mt-3">
                  <ResponsiveContainer width="100%" height={Math.max(60, data.competitors.length * 30)}>
                    <BarChart data={data.competitors} layout="vertical">
                      <XAxis type="number" tick={{ fill: chart.axis, fontSize: 10 }} tickFormatter={(v: number) => `₺${v}`} />
                      <YAxis type="category" dataKey="name" tick={{ fill: chart.axis, fontSize: 10 }} width={80} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))}
                        contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8 }}
                        labelStyle={{ color: chart.tooltipText }} itemStyle={{ color: chart.tooltipText }} />
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
          ? <EmptyState title={t('competitors.no_history')} description={t('competitors.no_history_desc')} />
          : (
            <GlassCard>
              <h3 className="text-[var(--text-primary)] font-semibold mb-4">{t('competitors.14d_change')}</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trackChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis dataKey="date" tick={{ fill: chart.axis, fontSize: 10 }} />
                  <YAxis tick={{ fill: chart.axis, fontSize: 10 }} tickFormatter={(v: number) => `₺${v}`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8 }}
                    labelStyle={{ color: chart.tooltipText }} itemStyle={{ color: chart.tooltipText }} />
                  <Legend />
                  {trackHistories.map((h, i) => (
                    <Line key={h.competitor} type="monotone" dataKey={h.competitor} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                {trackHistories.map((h) => (
                  <div key={h.competitor} className="p-3 bg-[var(--bg-elevated)] rounded-xl">
                    <p className="text-[var(--text-muted)] text-xs">{h.competitor}</p>
                    <p className="text-[var(--text-primary)] font-semibold">{formatCurrency(h.current_price)}</p>
                    <p className={`text-xs font-medium mt-1 ${h.trend === 'dusus' ? 'text-emerald-500' : h.trend === 'yukselis' ? 'text-rose-500' : 'text-[var(--text-muted)]'}`}>
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
          <h3 className="text-[var(--text-primary)] font-semibold flex items-center gap-2"><Brain size={16} className="text-indigo-600 dark:text-indigo-300" /> {t('competitors.ai_analysis')}</h3>
          <button onClick={handleAiAnalysis} disabled={aiLoading || !selectedProduct}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50">
            {aiLoading ? <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> {t('common.analyzing')}</> : <><Brain size={14} /> {t('competitors.detailed_analysis')}</>}
          </button>
        </div>
        {aiAnalysis
          ? <StreamingMarkdown content={aiAnalysis} title={t('competitors.ai_analysis')} />
          : <p className="text-[var(--text-muted)] text-sm">{t('competitors.ai_hint')}</p>
        }
      </GlassCard>
    </div>
  );
}
