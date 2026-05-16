import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock, Save } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { authService } from '../services';

type Tab = 'profile' | 'security';

interface Toast { type: 'success' | 'error'; message: string }

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [storeName, setStoreName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    authService.me().then((u) => {
      setName(u.name || '');
      setEmail(u.email || '');
      setStoreName(u.store_name || '');
    }).finally(() => setLoading(false));
  }, []);

  const handleProfileSave = async () => {
    setProfileSaving(true);
    try {
      await authService.updateProfile({ name, email, store_name: storeName });
      showToast('success', 'Profil guncellendi');
    } catch {
      showToast('error', 'Profil guncellenemedi');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPw !== confirmPw) { showToast('error', 'Sifreler eslesmiyor'); return; }
    if (newPw.length < 6) { showToast('error', 'Sifre en az 6 karakter olmali'); return; }
    setPwSaving(true);
    try {
      await authService.changePassword(currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      showToast('success', 'Sifre guncellendi');
    } catch {
      showToast('error', 'Sifre guncellenemedi. Mevcut sifrenizi kontrol edin.');
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Ayarlar yukleniyor..." size="lg" />;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg animate-fade-in ${
          toast.type === 'success' ? 'bg-emerald-600 text-slate-800' : 'bg-rose-600 text-slate-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      <div className="flex gap-1 bg-gray-50 p-1 rounded-xl w-fit">
        {([
          { id: 'profile' as Tab, label: 'Profil' },
          { id: 'security' as Tab, label: 'Guvenlik' },
        ]).map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === item.id ? 'bg-[#4a3f44] text-white' : 'text-gray-500 hover:text-slate-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <GlassCard>
          <h3 className="text-slate-800 font-semibold mb-4">Profil Bilgileri</h3>
          <div className="space-y-4">
            {[
              { label: 'Ad Soyad', value: name, setter: setName, placeholder: 'Adiniz', type: 'text' },
              { label: 'E-posta', value: email, setter: setEmail, placeholder: 'e-posta@adresiniz.com', type: 'email' },
              { label: 'Magaza Adi', value: storeName, setter: setStoreName, placeholder: 'Magazanizin adi', type: 'text' },
            ].map((field) => (
              <div key={field.label}>
                <label className="text-gray-500 text-xs block mb-1.5">{field.label}</label>
                <input
                  value={field.value}
                  onChange={(event) => field.setter(event.target.value)}
                  placeholder={field.placeholder}
                  type={field.type}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 text-slate-800 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                />
              </div>
            ))}
            <button
              onClick={handleProfileSave}
              disabled={profileSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#4a3f44] hover:bg-[#6b6266] text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              {profileSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Kaydet
            </button>
          </div>
        </GlassCard>
      )}

      {tab === 'security' && (
        <GlassCard>
          <h3 className="text-slate-800 font-semibold mb-4 flex items-center gap-2">
            <Lock size={16} className="text-indigo-600" /> Sifre Degistir
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Mevcut Sifre', value: currentPw, setter: setCurrentPw },
              { label: 'Yeni Sifre', value: newPw, setter: setNewPw },
              { label: 'Yeni Sifre (Tekrar)', value: confirmPw, setter: setConfirmPw },
            ].map((field) => (
              <div key={field.label}>
                <label className="text-gray-500 text-xs block mb-1.5">{field.label}</label>
                <div className="relative">
                  <input
                    value={field.value}
                    onChange={(event) => field.setter(event.target.value)}
                    type={showPw ? 'text' : 'password'}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 text-slate-800 rounded-xl px-4 py-3 pr-10 text-sm outline-none transition-colors"
                  />
                  <button
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-slate-800"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}
            {newPw && confirmPw && newPw !== confirmPw && (
              <p className="text-rose-400 text-xs flex items-center gap-1">
                <AlertCircle size={12} /> Sifreler eslesmiyor
              </p>
            )}
            <button
              onClick={handlePasswordChange}
              disabled={pwSaving || !currentPw || !newPw || !confirmPw}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#4a3f44] hover:bg-[#6b6266] text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              {pwSaving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              Sifreyi Guncelle
            </button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
