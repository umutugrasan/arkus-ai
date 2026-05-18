import { useState, useEffect } from 'react';
import { Search, Bell, Trash2, Brain, Loader2 } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import { sourcingService } from '../services';
import { formatCurrency } from '../utils/formatters';
import { useI18n } from '../context/I18nContext';
import type {
  SuppliersResponse, BestPriceResponse, SourcingOpportunitiesResponse,
  PriceAlertsResponse, Supplier, PriceAlert, RealSearchResponse,
} from '../types/api';

type Tab = 'suppliers' | 'search' | 'alerts' | 'opportunities';

function getApiErrorMessage(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
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
      if (bestPriceResult.status === 'fulfilled') setBestPrice(bestPriceResult.value);
      if (realSearchResult.status === 'fulfilled') setRealSearch(realSearchResult.value);

      const bestFailed = bestPriceResult.status === 'rejected';
      const webFailed = realSearchResult.status === 'rejected';
      if (bestFailed && webFailed) {
        // Her ikisi de başarısız: tam hata
        setSearchError(getApiErrorMessage(bestPriceResult.reason, t('sourcing.search_error')));
      } else if (bestFailed) {
        // Sadece DB tarafı patladı: kullanıcı web sonuçlarını yine görür, uyarı ver
        setSearchError(t('sourcing.partial_best_price_failed'));
      } else if (webFailed) {
        // Sadece web araması patladı: DB sonuçları yine var, uyarı ver
        setSearchError(t('sourcing.partial_web_search_failed'));
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

  if (loading) return <LoadingSpinner message={t('sourcing.loading')} size="lg" />;

  const supplierList: Supplier[] = suppliers?.suppliers || [];
  const alertList: PriceAlert[] = alerts?.alerts || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === tb.id ? 'bg-[var(--accent-solid)] text-[var(--accent-fg)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}>{tb.label}</button>
        ))}
      </div>

      {/* Tedarikçiler */}
      {tab === 'suppliers' && (
        supplierList.length === 0
          ? <EmptyState title={t('sourcing.no_suppliers')} description={t('sourcing.no_suppliers_desc')} />
          : (
            <div className="grid md:grid-cols-2 gap-4">
              {supplierList.map((s) => (
                <GlassCard key={s.id ?? `${s.name}-${s.product}`} className={s.discount_pct > 0 ? 'border border-emerald-500/30' : ''}>
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

          {bestPrice && (
            <div className="space-y-3">
              {([...bestPrice.all_suppliers || []].sort((a, b) => a.discounted_price - b.discounted_price)).map((s: Supplier) => {
                // Saticinin adina gore yonlendirilecek temsili URL (Alibaba/AliExpress aramasi)
                const isValidUrl = s.url && (s.url.startsWith('http://') || s.url.startsWith('https://'));
                const searchDomain = s.name.toLowerCase().includes('alibaba') ? 'alibaba.com/trade/search?SearchText=' :
                                     s.name.toLowerCase().includes('aliexpress') ? 'aliexpress.com/w/wholesale-' :
                                     'google.com/search?q=buy+wholesale+';
                const href = isValidUrl ? s.url! : `https://www.${searchDomain}${encodeURIComponent(s.product + ' ' + s.name)}`;

                return (
                  <a key={s.id ?? `${s.name}-${s.discounted_price}`} href={href} target="_blank" rel="noopener noreferrer" className="block transition-transform hover:scale-[1.01]">
                    <GlassCard className="hover:border-[var(--accent)]/50 transition-colors cursor-pointer">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-[var(--text-primary)] font-medium text-lg">{s.name}</p>
                          <div className="flex gap-3 mt-1 text-xs text-[var(--text-muted)]">
                            <span>{t('sourcing.min_short').replace('{n}', String(s.min_order))}</span>
                            <span>{t('sourcing.delivery_short').replace('{n}', String(s.shipping_days))}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[var(--text-primary)] font-bold text-xl">{formatCurrency(s.current_price)}</p>
                          {s.discount_pct > 0 && (
                            <p className="text-emerald-500 text-sm mt-0.5">{t('sourcing.savings').replace('{pct}', String(s.discount_pct))}</p>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  </a>
                );
              })}
            </div>
          )}

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
            : alertList.map((a: PriceAlert) => (
              <GlassCard key={a.id}>
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
