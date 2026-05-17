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
import { useI18n } from '../context/I18nContext';
import { getErrorMessage } from '../utils/errors';
import { formatPercent } from '../utils/formatters';
import { MARKETPLACES } from '../utils/constants';
import type {
  ProductListItem, ReviewAnalysisHistory, ReviewsListResponse, SentimentResponse,
} from '../types/api';

type Detail = 'short' | 'detailed';

// ─── SessionStorage cache for AI analysis results ───────────────────────────
const REVIEWS_CACHE_KEY = 'arkus_reviews_ai_cache';

interface ReviewsAICache {
  productId: string;
  aiTexts: { short: string; detailed: string };
  timestamp: number;
}

function getReviewsCache(productId: string): ReviewsAICache | null {
  try {
    const raw = sessionStorage.getItem(REVIEWS_CACHE_KEY);
    if (!raw) return null;
    const data: ReviewsAICache = JSON.parse(raw);
    if (data.productId === productId && Date.now() - data.timestamp < 15 * 60 * 1000) return data;
  } catch { /* ignore */ }
  return null;
}

function setReviewsCache(productId: string, aiTexts: { short: string; detailed: string }) {
  try {
    sessionStorage.setItem(REVIEWS_CACHE_KEY, JSON.stringify({ productId, aiTexts, timestamp: Date.now() }));
  } catch { /* ignore */ }
}

export default function ReviewsPage() {
  const { id: paramId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useI18n();

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
      .catch((e) => toast.error(getErrorMessage(e, t('products.loading'))));
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
    setReviewsResp(null); // stale data'yı temizle – button race condition önlenir
    try {
      const r = await reviewService.list(productId, {
        marketplace: marketplaceFilter,
        month: monthFilter || undefined,
        last_n: typeof lastN === 'number' ? lastN : undefined,
      });
      setReviewsResp(r);
    } catch (e) {
      toast.error(getErrorMessage(e, t('reviews.list_failed')));
    } finally {
      setLoadingList(false);
    }
  }, [productId, marketplaceFilter, monthFilter, lastN, toast, t]);

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
  }, [productId, fetchReviews]);  // Ürün değiştiğinde AI cache'ini geri yükle
  useEffect(() => {
    if (!productId) return;
    const cached = getReviewsCache(productId);
    if (cached) {
      setAiTexts(cached.aiTexts);
    } else {
      setAiTexts({ short: '', detailed: '' });
    }
  }, [productId]);


  const months = useMemo(() => {
    const set = new Set<string>();
    reviewsResp?.reviews.forEach((r) => r.date && set.add(r.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [reviewsResp]);

  const hasReviews = !!(reviewsResp && reviewsResp.reviews.length > 0);

  // AI Analyze streaming
  const runAnalyze = useCallback(() => {
    if (!productId || !hasReviews) return;
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
          onChunk: (chunk) => setAiTexts((p) => ({ ...p, [second]: p[second] + chunk })),
          onDone: (data) => {
            setAiStreaming((s) => ({ ...s, [second]: false }));
            if (!data.is_fallback) reviewService.history(productId).then(setHistory).catch(() => {});
            // Cache'e yaz (her iki tab tamamlandığında güncelle)
            setAiTexts((prev) => {
              const updated = { ...prev };
              setReviewsCache(productId, updated);
              return prev;
            });
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
        onChunk: (chunk) => setAiTexts((p) => ({ ...p, [first]: p[first] + chunk })),
        onDone: (data) => {
          setAiStreaming((s) => ({ ...s, [first]: false }));
          if (data.is_fallback) toast.warning(t('reviews.fallback_warn'));
          else toast.success(t('reviews.active_done'));
          reviewService.history(productId).then(setHistory).catch(() => {});
          fetchSecond();
        },
        onError: (e) => {
          setAiStreaming((s) => ({ ...s, [first]: false }));
          const msg = e instanceof Error ? e.message : (e as Record<string, unknown>).error;
          toast.error(typeof msg === 'string' ? msg : t('reviews.analysis_failed'));
          fetchSecond();
        },
      },
      { signal: ctrl.signal },
    );
  }, [productId, detail, toast, hasReviews, t]);

  useEffect(() => () => aiAbortRef.current?.abort(), []);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('reviews.title')}
        subtitle={t('reviews.subtitle')}
        icon={<MessageSquare size={20} />}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl pl-3 pr-8 py-2 text-sm text-[var(--text-primary)] outline-none appearance-none min-w-[220px]"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} — {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            </div>
          </div>
        }
      />

      {/* Sentiment + AI controls */}
      <div className="grid lg:grid-cols-3 gap-4">
        <GlassCard className="p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Brain size={16} className="text-[var(--accent)]" />
            <h3 className="text-[var(--text-primary)] font-semibold">{t('reviews.ai_analysis')}</h3>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-lg p-0.5">
                {(['short', 'detailed'] as Detail[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDetail(d)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      detail === d
                        ? 'bg-[var(--accent)]/20 text-[var(--accent)] font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {d === 'short' ? t('reviews.short') : t('reviews.detailed')}
                  </button>
                ))}
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<RefreshCw size={14} />}
                onClick={runAnalyze}
                loading={aiStreaming.short || aiStreaming.detailed}
                disabled={!reviewsResp || reviewsResp.reviews.length === 0}
              >
                {t('common.analyze')}
              </Button>
            </div>
          </div>

          {(aiStreaming.short || aiStreaming.detailed) && !aiStreaming[detail] && (
            <div className="mb-2 px-3 py-1.5 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-md text-xs text-[var(--accent)] flex items-center gap-2">
              <RefreshCw size={12} className="animate-spin" /> {t('reviews.bg_analysis')}
            </div>
          )}

          <StreamingMarkdown
            title={t('reviews.title')}
            content={aiTexts[detail]}
            streaming={aiStreaming[detail]}
            className="!border-0 !bg-transparent"
          />
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} className="text-amber-400" />
            <h3 className="text-[var(--text-primary)] font-semibold">{t('reviews.sentiment')}</h3>
          </div>
          {loadingMeta ? (
            <Skeleton className="h-32 w-full" />
          ) : !sentiment ? (
            <EmptyState title={t('reviews.no_reviews')} />
          ) : (
            <div className="space-y-3">
              <div className="text-center py-2">
                <p className="text-4xl font-bold text-amber-400">{sentiment.avg_rating.toFixed(1)}</p>
                <p className="text-xs text-[var(--text-muted)]">{t('reviews.rating_total').replace('{n}', String(sentiment.total_reviews))}</p>
              </div>
              <div className="space-y-2">
                <SentimentBar
                  label={t('reviews.positive')}
                  pct={sentiment.sentiment.positive_pct}
                  color="emerald"
                  icon={<Smile size={12} />}
                />
                <SentimentBar
                  label={t('reviews.neutral')}
                  pct={sentiment.sentiment.neutral_pct}
                  color="slate"
                  icon={<Meh size={12} />}
                />
                <SentimentBar
                  label={t('reviews.negative')}
                  pct={sentiment.sentiment.negative_pct}
                  color="rose"
                  icon={<Frown size={12} />}
                />
              </div>
              <div className="pt-2 border-t border-[var(--border-color)] text-xs space-y-1">
                {Object.entries(sentiment.by_marketplace).map(([mp, b]) => (
                  <div key={mp} className="flex justify-between">
                    <span className="text-[var(--text-muted)]">{MARKETPLACES[mp]?.label || mp}</span>
                    <span className="text-[var(--text-secondary)]">⭐ {b.avg_rating.toFixed(1)} <span className="text-[var(--text-muted)] ml-1">({b.count})</span></span>
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
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">{t('common.marketplace')}</p>
            <div className="relative">
              <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <select
                value={marketplaceFilter}
                onChange={(e) => setMarketplaceFilter(e.target.value)}
                className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl pl-8 pr-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              >
                <option value="all">{t('common.all')}</option>
                {Object.entries(MARKETPLACES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">{t('common.month')}</p>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
            >
              <option value="">{t('common.all_months')}</option>
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">{t('common.last_n')}</p>
            <input
              type="number"
              placeholder={t('reviews.last_n_placeholder')}
              value={lastN}
              onChange={(e) => setLastN(e.target.value ? Number(e.target.value) : '')}
              className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] outline-none w-24"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={fetchReviews} loading={loadingList}>
            {t('common.apply')}
          </Button>
        </div>

        {loadingList ? (
          <Skeleton className="h-48 w-full" />
        ) : !reviewsResp || reviewsResp.reviews.length === 0 ? (
          <EmptyState title={t('reviews.no_reviews_filter')} description={t('reviews.no_reviews_filter_desc')} />
        ) : (
          <ul className="space-y-2 max-h-[480px] overflow-y-auto">
            {reviewsResp.reviews.map((r, i) => (
              <li
                key={`${r.marketplace}-${r.date}-${i}`}
                className={`p-3 rounded-xl border ${
                  r.rating >= 4
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : r.rating <= 2
                    ? 'bg-rose-500/5 border-rose-500/20'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-color)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    {'⭐'.repeat(r.rating)}
                    <span className="text-[var(--text-muted)] text-[10px]">({r.rating}/5)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MarketplaceBadge marketplace={r.marketplace} />
                    <span className="text-[var(--text-muted)] text-[11px]">{r.date}</span>
                  </div>
                </div>
                <p className="text-[var(--text-secondary)] text-sm mt-2 leading-relaxed">"{r.text}"</p>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {/* Analiz Geçmişi (her zaman görünür — boşken empty state) */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <History size={16} className="text-cyan-400" />
          <h3 className="text-[var(--text-primary)] font-semibold">{t('reviews.history')}</h3>
          <span className="text-xs text-[var(--text-muted)] ml-auto">
            {history?.total ?? 0} {t('reviews.records')}
          </span>
        </div>

        {!history || history.total === 0 ? (
          <EmptyState
            icon={<Brain size={20} />}
            title={t('reviews.no_history')}
            description={t('reviews.no_history_desc')}
          />
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {history.analyses.slice(0, 20).map((a) => (
              <li key={a.id} className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] hover:border-[var(--border-strong)] transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:text-indigo-300 capitalize font-medium">
                    {a.analysis_type === 'short' ? t('reviews.short') : a.analysis_type === 'detailed' ? t('reviews.detailed') : a.analysis_type}
                  </span>
                  <span className="text-[var(--text-muted)] text-[10px]">{a.created_at}</span>
                </div>
                <p className="text-[var(--text-secondary)] text-xs line-clamp-3 whitespace-pre-wrap">{a.content}</p>
              </li>
            ))}
            {history.total > 20 && (
              <li className="text-center text-xs text-[var(--text-faint)] py-2">
                {t('reviews.more_records').replace('{n}', String(history.total - 20))}
              </li>
            )}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

function SentimentBar({ label, pct, color, icon }: { label: string; pct: number; color: string; icon: React.ReactNode }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-500', text: 'text-emerald-500' },
    rose: { bg: 'bg-rose-500', text: 'text-rose-500' },
    slate: { bg: 'bg-slate-500', text: 'text-[var(--text-muted)]' },
  };
  const c = colorMap[color] || colorMap.slate;
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-xs">
        <span className={`flex items-center gap-1 ${c.text}`}>{icon} {label}</span>
        <span className={c.text}>{formatPercent(pct)}</span>
      </div>
      <div className="h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
        <div className={`h-full ${c.bg} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
