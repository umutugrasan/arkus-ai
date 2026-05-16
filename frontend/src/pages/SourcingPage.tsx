import { useState, useEffect } from 'react';
import { Search, Bell, Trash2, Brain, Loader2 } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import StreamingMarkdown from '../components/shared/StreamingMarkdown';
import { sourcingService } from '../services';
import { formatCurrency } from '../utils/formatters';
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
      if (bestPriceResult.status === 'rejected' && realSearchResult.status === 'rejected') {
        setSearchError(getApiErrorMessage(bestPriceResult.reason, 'Arama sirasinda bir hata olustu.'));
      }
    } catch (err: unknown) {
      setSearchError(getApiErrorMessage(err, 'Arama sirasinda bir hata olustu.'));
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
    { id: 'suppliers' as Tab, label: '🏭 Tedarikçiler' },
    { id: 'search' as Tab, label: '🔍 En İyi Fiyat' },
    { id: 'alerts' as Tab, label: `🔔 Alarmlar (${alerts?.alerts?.length ?? 0})` },
    { id: 'opportunities' as Tab, label: '🤖 AI Fırsatlar' },
  ];

  if (loading) return <LoadingSpinner message="Tedarikçi verileri yükleniyor…" size="lg" />;

  const supplierList: Supplier[] = suppliers?.suppliers || [];
  const alertList: PriceAlert[] = alerts?.alerts || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.id ? 'bg-[#4a3f44] text-white' : 'bg-gray-50 text-gray-500 hover:text-slate-800'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Tedarikçiler */}
      {tab === 'suppliers' && (
        supplierList.length === 0
          ? <EmptyState title="Tedarikçi Bulunamadı" description="Henüz tedarikçi verisi yok." />
          : (
            <div className="grid md:grid-cols-2 gap-4">
              {supplierList.map((s, i) => (
                <GlassCard key={i} className={s.discount_pct > 0 ? 'border border-emerald-500/30' : ''}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-slate-800 font-semibold">{s.name}</p>
                        {s.discount_pct > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-medium">
                            %{s.discount_pct} İNDİRİM
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm mt-0.5">{s.product}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-800 font-bold">{formatCurrency(s.current_price)}</p>
                      {s.discount_pct > 0 && (
                        <p className="text-emerald-400 text-sm">{formatCurrency(s.discounted_price)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-3 text-xs text-gray-500">
                    <span>Min. Sipariş: {s.min_order} adet</span>
                    {/* Supplier type has shipping_days, not delivery_days */}
                    <span>Teslimat: {s.shipping_days} gün</span>
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
                placeholder="Ürün adı girin… (örn: Bluetooth Kulaklık)"
                className="flex-1 bg-gray-50 border border-gray-200 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#4a3f44] transition-colors"
              />
              <button onClick={handleSearch} disabled={searchLoading || !searchQuery.trim()}
                className="flex items-center gap-2 px-5 py-3 bg-[#4a3f44] hover:bg-[#6b6266] text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                {searchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Ara
              </button>
            </div>
            
            {/* Progress Bar */}
            {(searchLoading || (progress > 0 && progress < 100)) && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1 font-medium">
                  <span>AI Analizi yapılıyor...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#4a3f44] transition-all duration-300 ease-out"
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
              {([...bestPrice.all_suppliers || []].sort((a, b) => a.discounted_price - b.discounted_price)).map((s: Supplier, i: number) => {
                // Saticinin adina gore yonlendirilecek temsili URL (Alibaba/AliExpress aramasi)
                const isValidUrl = s.url && (s.url.startsWith('http://') || s.url.startsWith('https://'));
                const searchDomain = s.name.toLowerCase().includes('alibaba') ? 'alibaba.com/trade/search?SearchText=' :
                                     s.name.toLowerCase().includes('aliexpress') ? 'aliexpress.com/w/wholesale-' :
                                     'google.com/search?q=buy+wholesale+';
                const href = isValidUrl ? s.url! : `https://www.${searchDomain}${encodeURIComponent(s.product + ' ' + s.name)}`;
                
                return (
                  <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="block transition-transform hover:scale-[1.01]">
                    <GlassCard className="hover:border-indigo-500/50 transition-colors cursor-pointer">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-slate-800 font-medium text-lg">{s.name}</p>
                          <div className="flex gap-3 mt-1 text-xs text-gray-500">
                            <span>Min. {s.min_order} adet</span>
                            <span>{s.shipping_days} günde teslimat</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-800 font-bold text-xl">{formatCurrency(s.current_price)}</p>
                          {s.discount_pct > 0 && (
                            <p className="text-emerald-400 text-sm mt-0.5">Tasarruf: %{s.discount_pct}</p>
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
              title="Guncel Web Tedarik Aramasi"
            />
          )}
        </div>
      )}

      {/* Alarmlar */}
      {tab === 'alerts' && (
        <div className="space-y-4">
          <GlassCard>
            <h3 className="text-slate-800 font-semibold mb-3">Yeni Fiyat Alarmı</h3>
            <div className="flex flex-wrap gap-3">
              <input value={alertProduct} onChange={e => setAlertProduct(e.target.value)}
                placeholder="Ürün adı"
                className="flex-1 min-w-40 bg-gray-50 border border-gray-200 text-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#4a3f44]" />
              <input value={alertPrice} onChange={e => setAlertPrice(e.target.value)} type="number"
                placeholder="Hedef fiyat (₺)"
                className="w-40 bg-gray-50 border border-gray-200 text-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#4a3f44]" />
              <button onClick={handleCreateAlert} disabled={alertCreating || !alertProduct || !alertPrice}
                className="flex items-center gap-2 px-4 py-2 bg-[#4a3f44] hover:bg-[#6b6266] text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                {alertCreating ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                Alarm Ekle
              </button>
            </div>
          </GlassCard>

          {alertList.length === 0
            ? <EmptyState title="Alarm Yok" description="Henüz fiyat alarmı oluşturmadınız." />
            : alertList.map((a: PriceAlert) => (
              <GlassCard key={a.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-800 font-medium">{a.product_name}</p>
                    <p className="text-gray-500 text-sm">Hedef: {formatCurrency(a.target_price)}</p>
                    {/* PriceAlert.supplier (not supplier_name) */}
                    {a.supplier && <p className="text-gray-500 text-xs">Tedarikçi: {a.supplier}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      a.status === 'active' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-700 text-gray-500'
                    }`}>{a.status === 'active' ? '🔔 Aktif' : '✓ Tetiklendi'}</span>
                    <button onClick={() => handleDeleteAlert(a.id)}
                      className="p-1.5 hover:bg-rose-500/10 rounded-lg text-gray-500 hover:text-rose-400 transition-colors">
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
                <h3 className="text-slate-800 font-semibold">AI Tedarik Fırsatları</h3>
                <p className="text-gray-500 text-sm">Gemini web araması ile güncel tedarikçi fırsatları</p>
              </div>
              <button onClick={handleOpportunities} disabled={oppLoading}
                className="flex items-center gap-2 px-4 py-2 bg-[#4a3f44] hover:bg-[#6b6266] text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                {oppLoading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                Fırsatları Bul
              </button>
            </div>
            
            {/* Progress Bar */}
            {(oppLoading || (progress > 0 && progress < 100)) && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1 font-medium">
                  <span>AI Fırsatları araştırılıyor...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#4a3f44] transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </GlassCard>

          {oppLoading && <LoadingSpinner message="Web'de tedarikçi fırsatları aranıyor…" size="sm" />}

          {opportunities && (
            <StreamingMarkdown
              content={opportunities.ai_analysis || ''}
              webSources={opportunities.web_sources || []}
              title="AI Tedarik Fırsatları"
            />
          )}
        </div>
      )}
    </div>
  );
}
