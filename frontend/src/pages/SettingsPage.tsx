import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock, Save } from 'lucide-react';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import LanguageSwitcher from '../components/ui/LanguageSwitcher';
import { authService } from '../services';
import { useI18n } from '../context/I18nContext';

type Tab = 'profile' | 'security';

interface Toast { type: 'success' | 'error'; message: string }

export default function SettingsPage() {
  const { t } = useI18n();
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
      showToast('success', t('settings.profile_updated'));
    } catch {
      showToast('error', t('settings.profile_update_failed'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPw !== confirmPw) { showToast('error', t('settings.passwords_mismatch')); return; }
    if (newPw.length < 6) { showToast('error', t('settings.password_short')); return; }
    setPwSaving(true);
    try {
      await authService.changePassword(currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      showToast('success', t('settings.password_updated'));
    } catch {
      showToast('error', t('settings.password_update_failed'));
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message={t('settings.loading')} size="lg" />;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg animate-fade-in ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      <div className="flex gap-1 bg-[var(--bg-muted)] p-1 rounded-xl w-fit">
        {([
          { id: 'profile' as Tab, label: t('settings.tab_profile') },
          { id: 'security' as Tab, label: t('settings.tab_security') },
        ]).map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === item.id ? 'bg-[var(--accent-solid)] text-[var(--accent-fg)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Language section */}
      <GlassCard>
        <h3 className="text-[var(--text-primary)] font-semibold mb-4">{t('settings.language')}</h3>
        <LanguageSwitcher />
      </GlassCard>

      {tab === 'profile' && (
        <GlassCard>
          <h3 className="text-[var(--text-primary)] font-semibold mb-4">{t('settings.profile_info')}</h3>
          <div className="space-y-4">
            {[
              { key: 'name', label: t('settings.name'), value: name, setter: setName, placeholder: t('settings.name_placeholder'), type: 'text' },
              { key: 'email', label: t('settings.email'), value: email, setter: setEmail, placeholder: t('settings.email_placeholder'), type: 'email' },
              { key: 'store', label: t('settings.store_name'), value: storeName, setter: setStoreName, placeholder: t('settings.store_placeholder'), type: 'text' },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-[var(--text-muted)] text-xs block mb-1.5">{field.label}</label>
                <input
                  value={field.value}
                  onChange={(event) => field.setter(event.target.value)}
                  placeholder={field.placeholder}
                  type={field.type}
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] focus:border-[var(--accent)] text-[var(--text-primary)] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                />
              </div>
            ))}
            <button
              onClick={handleProfileSave}
              disabled={profileSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              {profileSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t('settings.save')}
            </button>
          </div>
        </GlassCard>
      )}

      {tab === 'security' && (
        <GlassCard>
          <h3 className="text-[var(--text-primary)] font-semibold mb-4 flex items-center gap-2">
            <Lock size={16} className="text-[var(--accent)]" /> {t('settings.change_password')}
          </h3>
          <div className="space-y-4">
            {[
              { key: 'current', label: t('settings.current_password'), value: currentPw, setter: setCurrentPw },
              { key: 'new', label: t('settings.new_password'), value: newPw, setter: setNewPw },
              { key: 'confirm', label: t('settings.confirm_password'), value: confirmPw, setter: setConfirmPw },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-[var(--text-muted)] text-xs block mb-1.5">{field.label}</label>
                <div className="relative">
                  <input
                    value={field.value}
                    onChange={(event) => field.setter(event.target.value)}
                    type={showPw ? 'text' : 'password'}
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] focus:border-[var(--accent)] text-[var(--text-primary)] rounded-xl px-4 py-3 pr-10 text-sm outline-none transition-colors"
                  />
                  <button
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}
            {newPw && confirmPw && newPw !== confirmPw && (
              <p className="text-rose-500 text-xs flex items-center gap-1">
                <AlertCircle size={12} /> {t('settings.passwords_mismatch')}
              </p>
            )}
            <button
              onClick={handlePasswordChange}
              disabled={pwSaving || !currentPw || !newPw || !confirmPw}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              {pwSaving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              {t('settings.update_password')}
            </button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
