import { useEffect, useState } from 'react';
import { Plus, Link, Unlink, RefreshCw, CheckCircle } from 'lucide-react';
import { storeService } from '../services';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { MARKETPLACES } from '../utils/constants';

interface Connection {
  connected: boolean;
  store_name: string;
  connected_at: string;
}

export default function SettingsPage() {
  const [connections, setConnections] = useState<Record<string, Connection>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [connectForm, setConnectForm] = useState({ marketplace: 'trendyol', api_key: '', store_url: '' });

  useEffect(() => {
    storeService.connections().then(r => setConnections(r.connections || {})).finally(() => setLoading(false));
  }, []);

  const handleSync = async (mp: string) => {
    setSyncing(mp);
    try { await storeService.sync(mp); }
    finally { setSyncing(null); }
  };

  const handleSyncAll = async () => {
    setSyncing('all');
    try { await storeService.syncAll(); }
    finally { setSyncing(null); }
  };

  const handleDisconnect = async (mp: string) => {
    if (!confirm(`${mp} bağlantısını kaldırmak istediğinizden emin misiniz?`)) return;
    await storeService.disconnect(mp);
    setConnections(c => {
      const n = { ...c };
      delete n[mp];
      return n;
    });
  };

  const handleConnect = async () => {
    await storeService.connect(connectForm.marketplace, connectForm.api_key, connectForm.store_url);
    const r = await storeService.connections();
    setConnections(r.connections || {});
    setShowConnect(false);
  };

  if (loading) return <LoadingSpinner message="Bağlantılar yükleniyor..." size="lg" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white font-bold text-xl">Pazaryeri Bağlantıları</h2>
          <p className="text-slate-400 text-sm mt-0.5">{Object.keys(connections).length} aktif bağlantı</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSyncAll}
            disabled={!!syncing}
            className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 hover:border-indigo-500/40 text-slate-300 rounded-xl px-4 py-2 text-sm transition-all"
          >
            <RefreshCw size={14} className={syncing === 'all' ? 'animate-spin' : ''} /> Tümünü Senkronize Et
          </button>
          <button
            onClick={() => setShowConnect(s => !s)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl px-4 py-2 text-sm font-semibold shadow-lg shadow-indigo-500/20"
          >
            <Plus size={14} /> Yeni Bağlantı
          </button>
        </div>
      </div>

      {/* Connect Form */}
      {showConnect && (
        <GlassCard className="animate-fade-in border border-indigo-500/20 bg-indigo-500/5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Link size={16} /> Yeni Pazaryeri Bağla</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Pazaryeri</label>
              <select
                value={connectForm.marketplace}
                onChange={e => setConnectForm(p => ({ ...p, marketplace: e.target.value }))}
                className="w-full bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none"
              >
                {['trendyol', 'hepsiburada', 'amazon_tr', 'n11'].map(m => (
                  <option key={m} value={m}>{MARKETPLACES[m]?.label || m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">API Key</label>
              <input
                value={connectForm.api_key}
                onChange={e => setConnectForm(p => ({ ...p, api_key: e.target.value }))}
                placeholder="••••••••"
                className="w-full bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Mağaza URL</label>
              <input
                value={connectForm.store_url}
                onChange={e => setConnectForm(p => ({ ...p, store_url: e.target.value }))}
                placeholder="https://..."
                className="w-full bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleConnect} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl px-4 py-2 text-sm font-semibold">Bağla</button>
            <button onClick={() => setShowConnect(false)} className="bg-slate-800 text-slate-300 rounded-xl px-4 py-2 text-sm">İptal</button>
          </div>
        </GlassCard>
      )}

      {/* Connection Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(connections).map(([mp, conn]) => {
          const mpConfig = MARKETPLACES[mp] || { label: mp, bgColor: 'bg-slate-500/20', textColor: 'text-slate-400' };
          return (
            <GlassCard key={mp} className={`${conn.connected ? 'border border-emerald-500/20' : 'border border-rose-500/20'}`}>
              <div className="flex items-start justify-between mb-3">
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${mpConfig.bgColor} ${mpConfig.textColor}`}>
                  {mpConfig.label}
                </span>
                {conn.connected ? (
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle size={14} />
                    <span className="text-xs font-medium">Bağlı</span>
                  </div>
                ) : (
                  <span className="text-rose-400 text-xs">Bağlı Değil</span>
                )}
              </div>
              <p className="text-white font-semibold text-sm">{conn.store_name}</p>
              <p className="text-slate-500 text-xs mt-0.5">Bağlandı: {conn.connected_at}</p>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleSync(mp)}
                  disabled={!!syncing}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 text-xs transition-all"
                >
                  <RefreshCw size={12} className={syncing === mp ? 'animate-spin' : ''} />
                  {syncing === mp ? 'Senkronize...' : 'Senkronize'}
                </button>
                <button
                  onClick={() => handleDisconnect(mp)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs transition-all"
                >
                  <Unlink size={12} /> Kaldır
                </button>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Info */}
      <GlassCard className="bg-slate-800/20">
        <h3 className="text-white font-semibold mb-2">ℹ️ Bilgi</h3>
        <p className="text-slate-400 text-sm leading-relaxed">
          Şu an <strong className="text-white">Mock Veri</strong> kullanılmaktadır. Gerçek üründe API key'lerinizi girerek Trendyol, Hepsiburada ve Amazon TR entegrasyonlarını aktifleştirirsiniz. Veriler otomatik olarak her 30 dakikada bir senkronize edilir.
        </p>
      </GlassCard>
    </div>
  );
}
