import { useState, useEffect } from 'react';
import { Lock, ShoppingBag, Save, Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import MarketplaceBadge from '../components/shared/MarketplaceBadge';
import { authService, storeService } from '../services';
import type { StoreConnection, StoreConnectionsResponse } from '../types/api';

type Tab = 'profile' | 'security' | 'stores';

interface Toast { type: 'success' | 'error'; message: string }

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');
  const [connections, setConnections] = useState<StoreConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  // Profil formu
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [storeName, setStoreName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Şifre formu
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // Mağaza bağlantısı
  const [newMP, setNewMP] = useState('trendyol');
  const [newApiKey, setNewApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    Promise.all([authService.me(), storeService.connections()]).then(([u, c]) => {
      setName(u.name || '');
      setEmail(u.email || '');
      setStoreName(u.store_name || '');
      setConnections(c);
    }).finally(() => setLoading(false));
  }, []);

  const handleProfileSave = async () => {
    setProfileSaving(true);
    try {
      await authService.updateProfile({ name, email, store_name: storeName });
      showToast('success', 'Profil güncellendi');
    } catch { showToast('error', 'Profil güncellenemedi'); }
    finally { setProfileSaving(false); }
  };

  const handlePasswordChange = async () => {
    if (newPw !== confirmPw) { showToast('error', 'Şifreler eşleşmiyor'); return; }
    if (newPw.length < 6) { showToast('error', 'Şifre en az 6 karakter olmalı'); return; }
    setPwSaving(true);
    try {
      await authService.changePassword(currentPw, newPw);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      showToast('success', 'Şifre güncellendi');
    } catch { showToast('error', 'Şifre güncellenemedi. Mevcut şifrenizi kontrol edin.'); }
    finally { setPwSaving(false); }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await storeService.connect(newMP, newApiKey || 'demo');
      const res = await storeService.connections();
      setConnections(res);
      setNewApiKey('');
      showToast('success', `${newMP} bağlandı`);
    } catch { showToast('error', 'Bağlantı kurulamadı'); }
    finally { setConnecting(false); }
  };

  const handleDisconnect = async (mp: string) => {
    if (!confirm(`${mp} bağlantısını kesmek istediğinizden emin misiniz?`)) return;
    try {
      await storeService.disconnect(mp);
      const res = await storeService.connections();
      setConnections(res);
      showToast('success', `${mp} bağlantısı kesildi`);
    } catch { showToast('error', 'Bağlantı kesilemedi'); }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await storeService.syncAll();
      showToast('success', 'Tüm mağazalar senkronize edildi');
    } catch { showToast('error', 'Senkronizasyon başarısız'); }
    finally { setSyncing(false); }
  };

  if (loading) return <LoadingSpinner message="Ayarlar yükleniyor…" size="lg" />;

  const AVAILABLE_MP = ['trendyol', 'hepsiburada', 'amazon_tr', 'n11'];
  // Use StoreConnection type directly
  const connList: StoreConnection[] = connections?.connections || [];
  const connectedMPs = connList.map((c) => c.marketplace);

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg animate-fade-in ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl w-fit">
        {([
          { id: 'profile' as Tab, label: 'Profil', icon: '👤' },
          { id: 'security' as Tab, label: 'Güvenlik', icon: '🔒' },
          { id: 'stores' as Tab, label: 'Pazaryerleri', icon: '🏪' },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* Profil */}
      {tab === 'profile' && (
        <GlassCard>
          <h3 className="text-white font-semibold mb-4">Profil Bilgileri</h3>
          <div className="space-y-4">
            {[
              { label: 'Ad Soyad', value: name, setter: setName, placeholder: 'Adınız', type: 'text' },
              { label: 'E-posta', value: email, setter: setEmail, placeholder: 'e-posta@adresiniz.com', type: 'email' },
              { label: 'Mağaza Adı', value: storeName, setter: setStoreName, placeholder: 'Mağazanızın adı', type: 'text' },
            ].map(f => (
              <div key={f.label}>
                <label className="text-slate-400 text-xs block mb-1.5">{f.label}</label>
                <input
                  value={f.value}
                  onChange={e => f.setter(e.target.value)}
                  placeholder={f.placeholder}
                  type={f.type}
                  className="w-full bg-slate-800/60 border border-slate-700 focus:border-indigo-500 text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                />
              </div>
            ))}
            <button onClick={handleProfileSave} disabled={profileSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
              {profileSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Kaydet
            </button>
          </div>
        </GlassCard>
      )}

      {/* Güvenlik */}
      {tab === 'security' && (
        <GlassCard>
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Lock size={16} className="text-indigo-400" /> Şifre Değiştir</h3>
          <div className="space-y-4">
            {[
              { label: 'Mevcut Şifre', value: currentPw, setter: setCurrentPw },
              { label: 'Yeni Şifre', value: newPw, setter: setNewPw },
              { label: 'Yeni Şifre (Tekrar)', value: confirmPw, setter: setConfirmPw },
            ].map(f => (
              <div key={f.label}>
                <label className="text-slate-400 text-xs block mb-1.5">{f.label}</label>
                <div className="relative">
                  <input
                    value={f.value}
                    onChange={e => f.setter(e.target.value)}
                    type={showPw ? 'text' : 'password'}
                    className="w-full bg-slate-800/60 border border-slate-700 focus:border-indigo-500 text-white rounded-xl px-4 py-3 pr-10 text-sm outline-none transition-colors"
                  />
                  <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}
            {newPw && confirmPw && newPw !== confirmPw && (
              <p className="text-rose-400 text-xs flex items-center gap-1"><AlertCircle size={12} /> Şifreler eşleşmiyor</p>
            )}
            <button onClick={handlePasswordChange} disabled={pwSaving || !currentPw || !newPw || !confirmPw}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
              {pwSaving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              Şifreyi Güncelle
            </button>
          </div>
        </GlassCard>
      )}

      {/* Pazaryerleri */}
      {tab === 'stores' && (
        <div className="space-y-4">
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2"><ShoppingBag size={16} className="text-indigo-400" /> Bağlı Pazaryerleri</h3>
              <button onClick={handleSyncAll} disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all disabled:opacity-50">
                {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Tümünü Senkronize Et
              </button>
            </div>
            {connList.length === 0
              ? <p className="text-slate-400 text-sm">Henüz bağlı pazaryeri yok.</p>
              : (
                <div className="space-y-3">
                  {connList.map((c: StoreConnection, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl">
                      <div className="flex items-center gap-3">
                        <MarketplaceBadge marketplace={c.marketplace} />
                        <div>
                          <p className="text-white text-sm font-medium">{c.store_name || c.marketplace}</p>
                          <p className="text-slate-400 text-xs">
                            {c.product_count !== undefined ? `${c.product_count} ürün · ` : ''}
                            <span className={c.status === 'connected' ? 'text-emerald-400' : 'text-slate-500'}>
                              {c.status === 'connected' ? '● Aktif' : '● Pasif'}
                            </span>
                          </p>
                        </div>
                      </div>
                      <button onClick={() => handleDisconnect(c.marketplace)}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                        <Trash2 size={12} /> Çıkar
                      </button>
                    </div>
                  ))}
                </div>
              )
            }
          </GlassCard>

          <GlassCard>
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Plus size={16} className="text-emerald-400" /> Pazaryeri Ekle</h3>
            <div className="flex flex-wrap gap-3">
              <select value={newMP} onChange={e => setNewMP(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                {AVAILABLE_MP.filter(m => !connectedMPs.includes(m)).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input value={newApiKey} onChange={e => setNewApiKey(e.target.value)}
                placeholder="API Key (demo için boş bırakabilirsiniz)"
                className="flex-1 min-w-48 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
              <button onClick={handleConnect} disabled={connecting}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                {connecting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Bağla
              </button>
            </div>
            {connectedMPs.length === AVAILABLE_MP.length && (
              <p className="text-slate-400 text-sm mt-3">Tüm pazaryerleri bağlı.</p>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
}
