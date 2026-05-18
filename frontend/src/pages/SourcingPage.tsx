import { useState, useEffect } from 'react';
import { Search, Bell, Trash2, Brain, Loader2, History, X, Clock } from 'lucide-react';

const HISTORY_KEY = 'sourcing_history_v1';
const MAX_HISTORY = 20;

interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  bestPrice: BestPriceResponse | null;
  realSearch: RealSearchResponse | null;
}
import type { Supplier as SupplierType } from '../types/api';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import { sourcingService } from '../services';
import { formatCurrency } from '../utils/formatters';
import { useI18n } from '../context/I18nContext';
import type {
  SuppliersResponse, BestPriceResponse, SourcingOpportunitiesResponse,
  PriceAlertsResponse, PriceAlert, RealSearchResponse,
} from '../types/api';

function loadHistory(): SearchHistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(h: SearchHistoryItem[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY))); } catch { /* ignore */ }
}

type Tab = 'suppliers' | 'search' | 'alerts' | 'opportunities';

function getApiErrorMessage(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

function SourceBadge({ source }: { source?: string }) {
  if (source === 'toptanbul') return (
    <span className="text-xs px-2 py-0.5 bg-emerald-500/15 text-emerald-500 rounded-full border border-emerald-500/30 font-medium">
      Trendyol
    </span>
  );
  if (source === 'aliexpress') return (
    <span className="text-xs px-2 py-0.5 bg-orange-500/15 text-orange-400 rounded-full border border-orange-500/30 font-medium">
      AliExpress
    </span>
  );
  if (source === 'web' || source === 'gemini') return (
    <span className="text-xs px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded-full border border-blue-500/30 font-medium">
      Web Araştırması
    </span>
  );
  if (!source || source === 'db') return null;
  return (
    <span className="text-xs px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full border border-[var(--accent)]/30 font-medium">
      AI Tahmini
    </span>
  );
}

export default function SourcingPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('suppliers');
  const [suppliers, setSuppliers] = useState<SuppliersResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bestPrice, setBestPrice] = useState<BestPriceResponse | null>(null);
  const [realSearch, setRealSearch] = useState<RealSearchResponse | null>(null);
  const [opportunities, setOpportunities] = useState<SourcingOpportunitiesResponse | null>(null);
  const [alerts, setAlerts] = useState<PriceAlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [oppLoading, setOppLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [priceView, setPriceView] = useState<'sale' | 'wholesale'>('sale');
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);

  // Alert form
  const [alertProduct, setAlertProduct] = useState('');
  const [alertPrice, setAlertPrice] = useState('');
  const [alertCreating, setAlertCreating] = useState(false);

  useEffect(() => {
    Promise.all([
      sourcingService.suppliers(),
      sourcingService.listAlerts(),
    ]).then(([s, a]) => {
      setSuppliers(s);
      setAlerts(a);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (searchLoading || oppLoading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress(p => (p >= 90 ? 90 : p + 5));
      }, 1000);
    } else {
      setProgress(100);
      const to = setTimeout(() => setProgress(0), 500);
      return () => clearTimeout(to);
    }
    return () => clearInterval(interval);
  }, [searchLoading, oppLoading]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    setBestPrice(null);
    setRealSearch(null);
    try {
      const [bestPriceResult, realSearchResult] = await Promise.allSettled([
        sourcingService.bestPrice(searchQuery),
        sourcingService.realSearch(searchQuery),
      ]);
      if (bestPriceResult.status === 'fulfilled') {
        setBestPrice(bestPriceResult.value);
        const all = bestPriceResult.value.all_suppliers || [];
        setPriceView(all.some((s) => s.source === 'toptanbul') ? 'sale' : 'wholesale');
      }
      if (realSearchResult.status === 'fulfilled') setRealSearch(realSearchResult.value);

      const bestFailed = bestPriceResult.status === 'rejected';
      const webFailed = realSearchResult.status === 'rejected';
      if (bestFailed && webFailed) {
        setSearchError(getApiErrorMessage(bestPriceResult.reason, t('sourcing.search_error')));
      } else if (bestFailed) {
        setSearchError(t('sourcing.partial_best_price_failed'));
      } else if (webFailed) {
        setSearchError(t('sourcing.partial_web_search_failed'));
      }
      // Geçmişe kaydet
      const bp = bestPriceResult.status === 'fulfilled' ? bestPriceResult.value : null;
      const rs = realSearchResult.status === 'fulfilled' ? realSearchResult.value : null;
      if (bp || rs) {
        const item: SearchHistoryItem = {
          id: Date.now().toString(),
          query: searchQuery.trim(),
          timestamp: Date.now(),
          bestPrice: bp,
          realSearch: rs,
        };
        setHistory(prev => {
          const filtered = prev.filter(h => h.query.toLowerCase() !== item.query.toLowerCase());
          const next = [item, ...filtered].slice(0, MAX_HISTORY);
          saveHistory(next);
          return next;
        });
      }
    } catch (err: unknown) {
      setSearchError(getApiErrorMessage(err, t('sourcing.search_error')));
    } finally {
      setSearchLoading(false);
    }
  };

  const handleOpportunities = async () => {
    setOppLoading(true);
    try {
      const res = await sourcingService.opportunities(true);
      setOpportunities(res);
    } finally { setOppLoading(false); }
  };

  const handleCreateAlert = async () => {
    if (!alertProduct.trim() || !alertPrice) return;
    setAlertCreating(true);
    try {
      await sourcingService.createAlert({ product_name: alertProduct, target_price: Number(alertPrice) });
      const res = await sourcingService.listAlerts();
      setAlerts(res);
      setAlertProduct('');
      setAlertPrice('');
    } finally { setAlertCreating(false); }
  };

  const handleDeleteAlert = async (id: number) => {
    await sourcingService.deleteAlert(id);
    setAlerts(prev => prev ? { ...prev, alerts: prev.alerts.filter((a: PriceAlert) => a.id !== id) } : prev);
  };

  const tabs = [
    { id: 'suppliers' as Tab, label: `🏭 ${t('sourcing.tab_suppliers')}` },
    { id: 'search' as Tab, label: `🔍 ${t('sourcing.tab_search')}` },
    { id: 'alerts' as Tab, label: `🔔 ${t('sourcing.tab_alerts')} (${alerts?.alerts?.length ?? 0})` },
    { id: 'opportunities' as Tab, label: `🤖 ${t('sourcing.tab_opportunities')}` },
  ];

  const restoreHistory = (item: SearchHistoryItem) => {
    setSearchQuery(item.query);
    setBestPrice(item.bestPrice);
    setRealSearch(item.realSearch);
    setSearchError(null);
    setTab('search');
    if (item.bestPrice) {
      const all = item.bestPrice.all_suppliers || [];
      setPriceView(all.some(s => s.source === 'toptanbul') ? 'sale' : 'wholesale');
    }
    setShowHistory(false);
  };

  const deleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => { const next = prev.filter(h => h.id !== id); saveHistory(next); return next; });
  };

  const clearAllHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  if (loading) return <LoadingSpinner message={t('sourcing.loading')} size="lg" />;

  const supplierList: SupplierType[] = suppliers?.suppliers || [];
  const alertList: PriceAlert[] = alerts?.alerts || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tabs + Geçmiş butonu */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === tb.id ? 'bg-[var(--accent-solid)] text-[var(--accent-fg)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}>{tb.label}</button>
          ))}
        </div>
        <button onClick={() => setShowHistory(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
            showHistory ? 'bg-[var(--accent-solid)] text-[var(--accent-fg)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}>
          <History size={14} />
          Geçmiş ({history.length})
        </button>
      </div>

      {/* Arama Geçmişi Paneli */}
      {showHistory && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-elevated)]">
            <h3 className="text-[var(--text-primary)] font-semibold text-sm flex items-center gap-2">
              <History size={14} className="text-[var(--accent)]" /> Arama Geçmişi
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={clearAllHistory} className="text-xs text-rose-500 hover:text-rose-400 transition-colors px-2 py-1 rounded-lg hover:bg-rose-500/10">
                Tümünü Sil
              </button>
              <button onClick={() => setShowHistory(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-color)]">
            {history.map(item => (
              <div key={item.id} onClick={() => restoreHistory(item)}
                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-elevated)] cursor-pointer transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <Search size={13} className="text-[var(--accent)] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[var(--text-primary)] text-sm font-medium truncate">{item.query}</p>
                    <p className="text-[var(--text-muted)] text-xs flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      {new Date(item.timestamp).toLocaleString('tr-TR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                      {item.bestPrice && <span className="ml-2 text-emerald-500">· {(item.bestPrice.all_suppliers||[]).length} sonuç</span>}
                      {item.realSearch && <span className="ml-1 text-blue-400">· AI analiz</span>}
                    </p>
                  </div>
                </div>
                <button onClick={e => deleteHistory(item.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-500/10 rounded-lg text-[var(--text-muted)] hover:text-rose-500 transition-all flex-shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tedarikçiler */}
      {tab === 'suppliers' && (
        supplierList.length === 0
          ? <EmptyState title={t('sourcing.no_suppliers')} description={t('sourcing.no_suppliers_desc')} />
          : (
            <div className="grid md:grid-cols-2 gap-4">
              {supplierList.map((s, i) => (
                <GlassCard key={s.id ?? `${s.name}-${s.product}`} index={i} className={s.discount_pct > 0 ? 'border border-emerald-500/30' : ''}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[var(--text-primary)] font-semibold">{s.name}</p>
                        {s.discount_pct > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-500 rounded-full font-medium">
                            {t('sourcing.discount_badge').replace('{pct}', String(s.discount_pct))}
                          </span>
                        )}
                      </div>
                      <p className="text-[var(--text-muted)] text-sm mt-0.5">{s.product}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[var(--text-primary)] font-bold">{formatCurrency(s.current_price)}</p>
                      {s.discount_pct > 0 && (
                        <p className="text-emerald-500 text-sm">{formatCurrency(s.discounted_price)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-3 text-xs text-[var(--text-muted)]">
                    <span>{t('sourcing.min_order').replace('{n}', String(s.min_order))}</span>
                    {/* Supplier type has shipping_days, not delivery_days */}
                    <span>{t('sourcing.delivery').replace('{n}', String(s.shipping_days))}</span>
                  </div>
                </GlassCard>
              ))}
            </div>
          )
      )}

      {/* En İyi Fiyat Arama */}
      {tab === 'search' && (
        <div className="space-y-4">
          <GlassCard>
            <div className="flex gap-3">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder={t('sourcing.search_placeholder')}
                className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <button onClick={handleSearch} disabled={searchLoading || !searchQuery.trim()}
                className="flex items-center gap-2 px-5 py-3 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                {searchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {t('sourcing.search_btn')}
              </button>
            </div>

            {/* Progress Bar */}
            {(searchLoading || (progress > 0 && progress < 100)) && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1 font-medium">
                  <span>{t('sourcing.ai_progress')}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent-solid)] transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </GlassCard>

          {searchError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-xl text-center font-medium">
              {searchError}
            </div>
          )}

          {bestPrice && (() => {
            const all: SupplierType[] = bestPrice.all_suppliers || [];
            const saleItems = all
              .filter((s) => s.source === 'toptanbul')
              .sort((a, b) => a.current_price - b.current_price);
            const wholesaleItems = all
              .filter((s) => s.source !== 'toptanbul')
              .sort((a, b) => a.discounted_price - b.discounted_price);

            const avgSale = saleItems.length
              ? saleItems.reduce((sum, i) => sum + i.current_price, 0) / saleItems.length
              : 0;
            const minWholesale = wholesaleItems.length
              ? Math.min(...wholesaleItems.map((i) => i.discounted_price))
              : 0;
            const profit = avgSale > 0 && minWholesale > 0 ? avgSale - minWholesale : 0;
            const marginPct = avgSale > 0 ? Math.round((profit / avgSale) * 100) : 0;

            const shown = priceView === 'sale' ? saleItems : wholesaleItems;

            const renderCard = (s: SupplierType, idx: number) => {
              const isValidUrl = s.url && (s.url.startsWith('http://') || s.url.startsWith('https://'));
              const searchDomain = s.name.toLowerCase().includes('alibaba') ? 'alibaba.com/trade/search?SearchText=' :
                                   s.name.toLowerCase().includes('aliexpress') ? 'aliexpress.com/w/wholesale-' :
                                   'google.com/search?q=buy+wholesale+';
              const href = isValidUrl ? s.url! : `https://www.${searchDomain}${encodeURIComponent(s.product + ' ' + s.name)}`;

              return (
                <a key={s.id ?? `${s.name}-${s.discounted_price}`} href={href} target="_blank" rel="noopener noreferrer" className="block transition-transform hover:scale-[1.01]">
                  <GlassCard index={idx} className="hover:border-[var(--accent)]/50 transition-colors cursor-pointer">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[var(--text-primary)] font-medium text-lg leading-tight">{s.name}</p>
                          <SourceBadge source={s.source} />
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-[var(--text-muted)]">
                          <span>{t('sourcing.min_short').replace('{n}', String(s.min_order))}</span>
                          <span>{t('sourcing.delivery_short').replace('{n}', String(s.shipping_days))}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[var(--text-primary)] font-bold text-xl">{formatCurrency(s.current_price)}</p>
                        {s.price_usd && s.price_usd > 0 && (
                          <p className="text-[var(--text-muted)] text-xs mt-0.5">≈ ${s.price_usd.toFixed(2)}</p>
                        )}
                        {s.discount_pct > 0 && (
                          <p className="text-emerald-500 text-sm mt-0.5">{t('sourcing.savings').replace('{pct}', String(s.discount_pct))}</p>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                </a>
              );
            };

            return (
              <div className="space-y-4">
                {/* Kâr Marjı Analizi */}
                {saleItems.length > 0 && wholesaleItems.length > 0 && (
                  <GlassCard>
                    <p className="text-[var(--text-primary)] font-semibold mb-3">Kâr Marjı Analizi</p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-xs text-[var(--text-muted)] mb-1">Ort. Satış Fiyatı</p>
                        <p className="text-lg sm:text-xl font-bold text-emerald-500">{formatCurrency(avgSale)}</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Trendyol</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-muted)] mb-1">En Ucuz Toptan</p>
                        <p className="text-lg sm:text-xl font-bold text-blue-400">{formatCurrency(minWholesale)}</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Toptancı</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-muted)] mb-1">Tahmini Kâr / Adet</p>
                        <p className="text-lg sm:text-xl font-bold text-[var(--accent)]">{formatCurrency(profit)}</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">%{marginPct} marj</p>
                      </div>
                    </div>
                  </GlassCard>
                )}

                {/* Satış / Toptancı geçiş butonları */}
                <div className="flex gap-1.5 bg-[var(--bg-elevated)] p-1 rounded-xl">
                  <button onClick={() => setPriceView('sale')}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      priceView === 'sale'
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}>
                    Satış Fiyatı ({saleItems.length})
                  </button>
                  <button onClick={() => setPriceView('wholesale')}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      priceView === 'wholesale'
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}>
                    Toptancı Fiyatları ({wholesaleItems.length})
                  </button>
                </div>

                {/* Seçili görünüm açıklaması */}
                <p className="text-xs text-[var(--text-muted)] px-1">
                  {priceView === 'sale'
                    ? 'Trendyol’da bu ürünün güncel perakende satış fiyatları — pazardaki satış fiyatı referansı.'
                    : 'Alibaba / DHgate / 1688 toptancılarından bulunan B2B fiyatlar — minimum 50 adet alımda geçerli.'}
                </p>

                {/* Liste */}
                {shown.length === 0 ? (
                  <div className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--text-muted)] p-6 rounded-xl text-center text-sm">
                    {priceView === 'sale'
                      ? 'Trendyol’da satış fiyatı bulunamadı.'
                      : 'Toptancı fiyatı bulunamadı.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shown.map(renderCard)}
                  </div>
                )}
              </div>
            );
          })()}

          {realSearch && (
            <StreamingMarkdown
              content={realSearch.ai_analysis || ''}
              webSources={realSearch.web_sources || []}
              title={t('sourcing.web_search_title')}
            />
          )}
        </div>
      )}

      {/* Alarmlar */}
      {tab === 'alerts' && (
        <div className="space-y-4">
          <GlassCard>
            <h3 className="text-[var(--text-primary)] font-semibold mb-3">{t('sourcing.new_alert')}</h3>
            <div className="flex flex-wrap gap-3">
              <input value={alertProduct} onChange={e => setAlertProduct(e.target.value)}
                placeholder={t('sourcing.product_name')}
                className="flex-1 min-w-40 bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
              <input value={alertPrice} onChange={e => setAlertPrice(e.target.value)} type="number"
                placeholder={t('sourcing.target_price')}
                className="w-40 bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
              <button onClick={handleCreateAlert} disabled={alertCreating || !alertProduct || !alertPrice}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                {alertCreating ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                {t('sourcing.add_alert')}
              </button>
            </div>
          </GlassCard>

          {alertList.length === 0
            ? <EmptyState title={t('sourcing.no_alerts')} description={t('sourcing.no_alerts_desc')} />
            : alertList.map((a: PriceAlert, i: number) => (
              <GlassCard key={a.id} index={i}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[var(--text-primary)] font-medium">{a.product_name}</p>
                    <p className="text-[var(--text-muted)] text-sm">{t('sourcing.target')} {formatCurrency(a.target_price)}</p>
                    {/* PriceAlert.supplier (not supplier_name) */}
                    {a.supplier && <p className="text-[var(--text-muted)] text-xs">{t('sourcing.supplier')} {a.supplier}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      a.status === 'active' ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
                    }`}>{a.status === 'active' ? t('sourcing.active') : t('sourcing.triggered')}</span>
                    <button onClick={() => handleDeleteAlert(a.id)}
                      className="p-1.5 hover:bg-rose-500/10 rounded-lg text-[var(--text-muted)] hover:text-rose-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </GlassCard>
            ))
          }
        </div>
      )}

      {/* AI Fırsatlar */}
      {tab === 'opportunities' && (
        <div className="space-y-4">
          <GlassCard>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[var(--text-primary)] font-semibold">{t('sourcing.ai_opp_title')}</h3>
                <p className="text-[var(--text-muted)] text-sm">{t('sourcing.ai_opp_desc')}</p>
              </div>
              <button onClick={handleOpportunities} disabled={oppLoading}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                {oppLoading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                {t('sourcing.find_opp')}
              </button>
            </div>

            {/* Progress Bar */}
            {(oppLoading || (progress > 0 && progress < 100)) && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1 font-medium">
                  <span>{t('sourcing.ai_progress_opp')}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent-solid)] transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </GlassCard>

          {oppLoading && <LoadingSpinner message={t('sourcing.searching_web')} size="sm" />}

          {opportunities && (
            <StreamingMarkdown
              content={opportunities.ai_analysis || ''}
              webSources={opportunities.web_sources || []}
              title={t('sourcing.ai_opp_title')}
            />
          )}
        </div>
      )}
    </div>
  );
}
