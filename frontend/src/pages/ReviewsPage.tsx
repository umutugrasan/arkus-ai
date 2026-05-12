import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MessageSquare, Star, Brain, Filter, ChevronDown, History, RefreshCw,
  Smile, Frown, Meh,
} from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import GlassCard from '../components/shared/GlassCard';
import EmptyState from '../components/shared/EmptyState';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import Button from '../components/ui/Button';
import { Skeleton } from '../components/shared/Skeleton';
import { productService, reviewService } from '../services';
import { streamSSE } from '../utils/streaming';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errors';
import { formatPercent } from '../utils/formatters';
import { MARKETPLACES } from '../utils/constants';
import type {
  ProductListItem, ReviewAnalysisHistory, ReviewsListResponse, SentimentResponse,
} from '../types/api';

type Detail = 'short' | 'detailed';

export default function ReviewsPage() {
  const { id: paramId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [productId, setProductId] = useState<string>('');

  const [reviewsResp, setReviewsResp] = useState<ReviewsListResponse | null>(null);
  const [sentiment, setSentiment] = useState<SentimentResponse | null>(null);
  const [history, setHistory] = useState<ReviewAnalysisHistory | null>(null);

  const [marketplaceFilter, setMarketplaceFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [lastN, setLastN] = useState<number | ''>('');

  const [loadingList, setLoadingList] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);

  // AI analyze (streaming)
  const [detail, setDetail] = useState<Detail>('short');
  const [aiTexts, setAiTexts] = useState({ short: '', detailed: '' });
  const [aiStreaming, setAiStreaming] = useState({ short: false, detailed: false });
  const aiAbortRef = useRef<AbortController | null>(null);

  // Ürün listesi
  useEffect(() => {
    productService
      .list()
      .then((d) => {
        setProducts(d.products);
        if (paramId) {
          setProductId(paramId);
        } else if (d.products.length && !productId) {
          setProductId(d.products[0].id);
        }
      })
      .catch((e) => toast.error(getErrorMessage(e, 'Ürünler yüklenemedi')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramId]);

  // URL'i seçilen ürün ile sync tut
  useEffect(() => {
    if (productId && productId !== paramId) {
      navigate(`/reviews/${encodeURIComponent(productId)}`, { replace: true });
    }
  }, [productId, paramId, navigate]);

  // Reviews fetch
  const fetchReviews = useCallback(async () => {
    if (!productId) return;
    setLoadingList(true);
    try {
      const r = await reviewService.list(productId, {
        marketplace: marketplaceFilter,
        month: monthFilter || undefined,
        last_n: typeof lastN === 'number' ? lastN : undefined,
      });
      setReviewsResp(r);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Yorumlar yüklenemedi'));
    } finally {
      setLoadingList(false);
    }
  }, [productId, marketplaceFilter, monthFilter, lastN, toast]);

  // Sentiment + history (her ürün değişiminde)
  useEffect(() => {
    if (!productId) return;
    setLoadingMeta(true);
    Promise.all([
      reviewService.sentiment(productId).catch(() => null),
      reviewService.history(productId).catch(() => null),
    ]).then(([s, h]) => {
      setSentiment(s);
      setHistory(h);
      setLoadingMeta(false);
    });
    fetchReviews();
  }, [productId, fetchReviews]);

  const months = useMemo(() => {
    const set = new Set<string>();
    reviewsResp?.reviews.forEach((r) => r.date && set.add(r.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [reviewsResp]);

  // AI Analyze streaming
  const runAnalyze = useCallback(() => {
    if (!productId) return;
    aiAbortRef.current?.abort();
    const ctrl = new AbortController();
    aiAbortRef.current = ctrl;
    
    setAiTexts({ short: '', detailed: '' });
    setAiStreaming({ short: false, detailed: false });

    const first = detail;
    const second = detail === 'short' ? 'detailed' : 'short';

    const fetchSecond = () => {
      if (ctrl.signal.aborted) return;
      setAiStreaming((s) => ({ ...s, [second]: true }));
      streamSSE(
        `/api/v1/reviews/${encodeURIComponent(productId)}/analyze/stream?detail=${second}`,
        {
          onChunk: (t) => setAiTexts((p) => ({ ...p, [second]: p[second] + t })),
          onDone: (data) => {
            setAiStreaming((s) => ({ ...s, [second]: false }));
            if (!data.is_fallback) reviewService.history(productId).then(setHistory).catch(() => {});
          },
          onError: (e) => {
            setAiStreaming((s) => ({ ...s, [second]: false }));
            console.error(`Second analysis (${second}) failed`, e);
          },
        },
        { signal: ctrl.signal },
      );
    };

    setAiStreaming((s) => ({ ...s, [first]: true }));
    streamSSE(
      `/api/v1/reviews/${encodeURIComponent(productId)}/analyze/stream?detail=${first}`,
      {
        onChunk: (t) => setAiTexts((p) => ({ ...p, [first]: p[first] + t })),
        onDone: (data) => {
          setAiStreaming((s) => ({ ...s, [first]: false }));
          if (data.is_fallback) toast.warning('AI fallback yanıt verdi (Gemini ulaşılamadı)');
          else toast.success('Aktif sekme analizi tamamlandı, arka planda diğeri hazırlanıyor...');
          reviewService.history(productId).then(setHistory).catch(() => {});
          fetchSecond();
        },
        onError: (e) => {
          setAiStreaming((s) => ({ ...s, [first]: false }));
          const msg = e instanceof Error ? e.message : (e as Record<string, unknown>).error;
          toast.error(typeof msg === 'string' ? msg : 'AI analizi başarısız');
          fetchSecond();
        },
      },
      { signal: ctrl.signal },
    );
  }, [productId, detail, toast]);

  useEffect(() => () => aiAbortRef.current?.abort(), []);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Yorum Analizi"
        subtitle="Müşteri yorumları + Gemini analizi"
        icon={<MessageSquare size={20} />}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="bg-slate-800/60 border border-slate-700/60 rounded-xl pl-3 pr-8 py-2 text-sm text-white outline-none appearance-none min-w-[220px]"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} — {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>
        }
      />

      {/* Sentiment + AI controls */}
      <div className="grid lg:grid-cols-3 gap-4">
        <GlassCard className="p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Brain size={16} className="text-violet-400" />
            <h3 className="text-white font-semibold">AI Analiz</h3>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700/60 rounded-lg p-0.5">
                {(['short', 'detailed'] as Detail[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDetail(d)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      detail === d
                        ? 'bg-indigo-500/30 text-indigo-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d === 'short' ? 'Kısa' : 'Detaylı'}
                  </button>
                ))}
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<RefreshCw size={14} />}
                onClick={runAnalyze}
                loading={aiStreaming.short || aiStreaming.detailed}
              >
                Analiz Et
              </Button>
            </div>
          </div>
          
          {(aiStreaming.short || aiStreaming.detailed) && !aiStreaming[detail] && (
            <div className="mb-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-xs text-indigo-300 flex items-center gap-2">
              <RefreshCw size={12} className="animate-spin" /> Arka planda diğer analiz ({detail === 'short' ? 'Detaylı' : 'Kısa'}) tamamlanıyor...
            </div>
          )}

          <StreamingMarkdown
            title="Yorum Analizi"
            content={aiTexts[detail]}
            streaming={aiStreaming[detail]}
            className="!border-0 !bg-transparent"
          />
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} className="text-amber-400" />
            <h3 className="text-white font-semibold">Duygu Özeti</h3>
          </div>
          {loadingMeta ? (
            <Skeleton className="h-32 w-full" />
          ) : !sentiment ? (
            <EmptyState title="Yorum yok" />
          ) : (
            <div className="space-y-3">
              <div className="text-center py-2">
                <p className="text-4xl font-bold text-amber-400">{sentiment.avg_rating.toFixed(1)}</p>
                <p className="text-xs text-slate-500">/ 5 (toplam {sentiment.total_reviews})</p>
              </div>
              <div className="space-y-2">
                <SentimentBar
                  label="Pozitif"
                  pct={sentiment.sentiment.positive_pct}
                  color="emerald"
                  icon={<Smile size={12} />}
                />
                <SentimentBar
                  label="Nötr"
                  pct={sentiment.sentiment.neutral_pct}
                  color="slate"
                  icon={<Meh size={12} />}
                />
                <SentimentBar
                  label="Negatif"
                  pct={sentiment.sentiment.negative_pct}
                  color="rose"
                  icon={<Frown size={12} />}
                />
              </div>
              <div className="pt-2 border-t border-slate-700/50 text-xs space-y-1">
                {Object.entries(sentiment.by_marketplace).map(([mp, b]) => (
                  <div key={mp} className="flex justify-between">
                    <span className="text-slate-400">{MARKETPLACES[mp]?.label || mp}</span>
                    <span className="text-slate-300">⭐ {b.avg_rating.toFixed(1)} <span className="text-slate-500 ml-1">({b.count})</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Filters + Reviews list */}
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Pazaryeri</p>
            <div className="relative">
              <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <select
                value={marketplaceFilter}
                onChange={(e) => setMarketplaceFilter(e.target.value)}
                className="bg-slate-800/60 border border-slate-700/60 rounded-xl pl-8 pr-3 py-2 text-sm text-white outline-none"
              >
                <option value="all">Hepsi</option>
                {Object.entries(MARKETPLACES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Ay</p>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">Tüm aylar</option>
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Son N</p>
            <input
              type="number"
              placeholder="örn 20"
              value={lastN}
              onChange={(e) => setLastN(e.target.value ? Number(e.target.value) : '')}
              className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white outline-none w-24"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={fetchReviews} loading={loadingList}>
            Uygula
          </Button>
        </div>

        {loadingList ? (
          <Skeleton className="h-48 w-full" />
        ) : !reviewsResp || reviewsResp.reviews.length === 0 ? (
          <EmptyState title="Yorum bulunamadı" description="Filtreyi gevşet ya da farklı ürün seç." />
        ) : (
          <ul className="space-y-2 max-h-[480px] overflow-y-auto">
            {reviewsResp.reviews.map((r, i) => (
              <li
                key={i}
                className={`p-3 rounded-xl border ${
                  r.rating >= 4
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : r.rating <= 2
                    ? 'bg-rose-500/5 border-rose-500/20'
                    : 'bg-slate-800/40 border-slate-700/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    {'⭐'.repeat(r.rating)}
                    <span className="text-slate-500 text-[10px]">({r.rating}/5)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MarketplaceBadge marketplace={r.marketplace} />
                    <span className="text-slate-500 text-[11px]">{r.date}</span>
                  </div>
                </div>
                <p className="text-slate-200 text-sm mt-2 leading-relaxed">"{r.text}"</p>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {/* Analiz Geçmişi */}
      {history && history.total > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <History size={16} className="text-cyan-400" />
            <h3 className="text-white font-semibold">Analiz Geçmişi</h3>
            <span className="text-xs text-slate-500 ml-auto">{history.total} kayıt</span>
          </div>
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {history.analyses.slice(0, 10).map((a) => (
              <li key={a.id} className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 capitalize">
                    {a.analysis_type}
                  </span>
                  <span className="text-slate-500 text-[10px]">{a.created_at}</span>
                </div>
                <p className="text-slate-300 text-xs line-clamp-3 whitespace-pre-wrap">{a.content}</p>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}

function SentimentBar({ label, pct, color, icon }: { label: string; pct: number; color: string; icon: React.ReactNode }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-500', text: 'text-emerald-400' },
    rose: { bg: 'bg-rose-500', text: 'text-rose-400' },
    slate: { bg: 'bg-slate-500', text: 'text-slate-400' },
  };
  const c = colorMap[color] || colorMap.slate;
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-xs">
        <span className={`flex items-center gap-1 ${c.text}`}>{icon} {label}</span>
        <span className={c.text}>{formatPercent(pct)}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${c.bg} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
