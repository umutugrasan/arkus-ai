import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  PlugZap,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import { storeService } from '../services';
import type { StoreConnection, StoreConnectionsResponse } from '../types/api';

interface Toast { type: 'success' | 'error'; message: string }

const AVAILABLE_MP = ['trendyol', 'hepsiburada', 'amazon_tr', 'n11'];

const API_KEY_MARKETPLACE: Record<string, string> = {
  'demo-key-trendyol': 'trendyol',
  'TRY-DEMO-12345-ABCDE': 'trendyol',
  'demo-key-hepsiburada': 'hepsiburada',
  'HB-DEMO-67890-FGHIJ': 'hepsiburada',
  'demo-key-amazon_tr': 'amazon_tr',
  'AMZ-DEMO-13579-KLMNO': 'amazon_tr',
  'demo-key-n11': 'n11',
  'N11-DEMO-24680-PRSTU': 'n11',
};

const parseApiKeyInput = (value: string) => {
  const input = value.trim();
  const apiKey = Object.keys(API_KEY_MARKETPLACE).find((key) => input.includes(key)) || input;
  return { apiKey, marketplace: API_KEY_MARKETPLACE[apiKey] };
};

export default function IntegrationsPage() {
  const [connections, setConnections] = useState<StoreConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [newMP, setNewMP] = useState('trendyol');
  const [newApiKey, setNewApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const refreshConnections = async () => {
    const res = await storeService.connections();
    setConnections(res);
  };

  useEffect(() => {
    refreshConnections().finally(() => setLoading(false));
  }, []);

  const handleConnect = async () => {
    const parsed = parseApiKeyInput(newApiKey);
    if (!parsed.apiKey) {
      showToast('error', 'API key gerekli');
      return;
    }

    const marketplace = parsed.marketplace || newMP;
    setConnecting(true);
    try {
      if (parsed.marketplace && parsed.marketplace !== newMP) {
        setNewMP(parsed.marketplace);
      }
      await storeService.connect(marketplace, parsed.apiKey);
      await refreshConnections();
      setNewApiKey('');
      showToast('success', `${marketplace} baglandi ve veriler cekildi`);
    } catch {
      showToast('error', 'API key veya baglanti linki gecersiz');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (mp: string) => {
    if (!confirm(`${mp} baglantisi kaldirilacak ve bu pazaryerine ait veriler silinecek. Emin misiniz?`)) return;
    try {
      await storeService.disconnect(mp);
      setConnections((prev) => prev ? {
        connections: prev.connections.filter((connection) => connection.marketplace !== mp),
      } : prev);
      await refreshConnections();
      showToast('success', `${mp} baglantisi ve verileri kaldirildi`);
    } catch {
      showToast('error', 'Baglanti kaldirilamadi');
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await storeService.syncAll();
      await refreshConnections();
      showToast('success', 'Tum entegrasyonlar APIden yeniden senkronize edildi');
    } catch {
      showToast('error', 'Senkronizasyon basarisiz');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <LoadingSpinner message="Entegrasyonlar yukleniyor..." size="lg" />;

  const connList: StoreConnection[] = (connections?.connections || []).filter((connection) => connection.status === 'connected');
  const connectedMPs = connList.map((connection) => connection.marketplace);
  const selectableMarketplaces = AVAILABLE_MP.filter((marketplace) => !connectedMPs.includes(marketplace));

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg animate-fade-in ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <PlugZap className="text-indigo-400" size={24} />
            Pazaryeri Entegrasyonlari
          </h2>
          <p className="text-slate-400 mt-1 text-sm">
            Trendyol, Hepsiburada, Amazon TR ve n11 API keylerini bagla; urun, yorum, stok, rakip ve finans verileri APIden cekilsin.
          </p>
        </div>
        <a
          href="/marketplace-portal.html"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-all"
        >
          <ExternalLink size={15} />
          Developer Portal
        </a>
      </div>

      <GlassCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="min-w-44">
            <label className="text-slate-400 text-xs block mb-1.5">Pazaryeri</label>
            <select
              value={newMP}
              onChange={(event) => setNewMP(event.target.value)}
              disabled={selectableMarketplaces.length === 0}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            >
              {selectableMarketplaces.map((marketplace) => (
                <option key={marketplace} value={marketplace}>{marketplace}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-slate-400 text-xs block mb-1.5">API key veya developer portal linki</label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={newApiKey}
                onChange={(event) => setNewApiKey(event.target.value)}
                placeholder="Portalden kopyaladigin API key"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting || selectableMarketplaces.length === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
          >
            {connecting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Bagla
          </button>
        </div>
        {selectableMarketplaces.length === 0 && (
          <p className="text-slate-400 text-sm mt-3">Tum pazaryerleri bagli.</p>
        )}
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-white font-semibold">Aktif Entegrasyonlar</h3>
          <button
            onClick={handleSyncAll}
            disabled={syncing || connList.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all disabled:opacity-50"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            APIden Yenile
          </button>
        </div>

        {connList.length === 0 ? (
          <p className="text-slate-400 text-sm">Henuz aktif pazaryeri entegrasyonu yok.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {connList.map((connection) => (
              <div key={connection.marketplace} className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <MarketplaceBadge marketplace={connection.marketplace} />
                    <p className="text-white text-sm font-medium mt-3 truncate">
                      {connection.store_name || connection.marketplace}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      {connection.product_count ?? 0} urun cekildi
                    </p>
                  </div>
                  <span className="text-emerald-400 text-xs font-semibold">Aktif</span>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700/40">
                  <span className="text-slate-500 text-xs">Kaldirinca verileri de silinir</span>
                  <button
                    onClick={() => handleDisconnect(connection.marketplace)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={12} />
                    Kaldir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
