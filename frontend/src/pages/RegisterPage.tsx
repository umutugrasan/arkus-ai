import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Store, Eye, EyeOff, UserPlus, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../context/I18nContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import LanguageSwitcher from '../components/ui/LanguageSwitcher';
import { getErrorMessage } from '../utils/errors';

export default function RegisterPage() {
  const { register, user, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [storeName, setStoreName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const validatePassword = (p: string): string | null => {
    if (p.length < 8) return t('auth.password_min');
    if (!/[A-Za-z]/.test(p)) return t('auth.password_letter');
    if (!/[0-9]/.test(p)) return t('auth.password_digit');
    return null;
  };

  const passwordError = password ? validatePassword(password) : null;
  const confirmError =
    confirmPassword && password !== confirmPassword ? t('auth.password_mismatch') : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error(t('auth.register_required'));
      return;
    }
    const pErr = validatePassword(password);
    if (pErr) {
      toast.error(pErr);
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t('auth.password_mismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await register(name, email, password, storeName);
      toast.success(t('auth.register_success'));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err, t('auth.register_failed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden flex items-center justify-center py-8">
      <div className="absolute inset-0 -z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-amber-100 dark:bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[var(--accent)]/10 blur-3xl" />
      </div>

      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 w-full max-w-md p-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col items-center mb-8"
        >
          <img src="/assets/logos/logo-bird.png" alt="Arkus AI Logo" className="w-32 h-32 object-contain mb-4 drop-shadow-md" />
          <h1 className="text-5xl font-black text-[var(--text-primary)] tracking-tighter">Arkus</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1 font-medium">{t('auth.free_trial')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
          className="bg-[var(--bg-card)] rounded-2xl shadow-[0_12px_40px_rgba(74,63,68,0.08)] border border-[var(--border-color)] p-8"
        >
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">{t('auth.create_account')}</h2>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            {t('auth.register_subtitle')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('auth.name')}
              type="text"
              name="name"
              placeholder={t('auth.name_placeholder')}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leftIcon={<User size={15} />}
              required
            />

            <Input
              label={t('auth.email')}
              type="email"
              name="email"
              placeholder={t('auth.email_placeholder')}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail size={15} />}
              required
            />

            <Input
              label={t('auth.store_name')}
              type="text"
              name="storeName"
              placeholder={t('auth.store_placeholder')}
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              leftIcon={<Store size={15} />}
            />

            <Input
              label={t('auth.password')}
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder={t('auth.password_placeholder_short')}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock size={15} />}
              error={passwordError ?? undefined}
              hint={t('auth.password_hint')}
              rightAddon={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="p-1.5 text-[var(--text-faint)] hover:text-[var(--text-secondary)]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
              required
            />

            <Input
              label={t('auth.confirm_password')}
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              placeholder="••••••••"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftIcon={<Lock size={15} />}
              error={confirmError ?? undefined}
              rightAddon={
                password && password === confirmPassword ? (
                  <div className="p-1.5 text-emerald-500">
                    <CheckCircle2 size={15} />
                  </div>
                ) : undefined
              }
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              fullWidth
              leftIcon={<UserPlus size={16} />}
              disabled={!!passwordError || !!confirmError}
              className="border-none shadow-md"
            >
              {t('auth.register')}
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--text-muted)] mt-6 font-medium">
            {t('auth.has_account')}{' '}
            <Link to="/login" className="text-[var(--accent)] hover:text-[var(--text-primary)] font-bold transition-colors">
              {t('auth.sign_in')}
            </Link>
          </p>
        </motion.div>

        <p className="text-center text-xs text-[var(--text-faint)] mt-6 font-medium">
          {t('auth.terms_prefix')}{' '}
          <a href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t('auth.terms_link')}</a>
          {t('auth.terms_and')}{' '}
          <a href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t('auth.privacy_link')}</a>
          {t('auth.terms_suffix')}
        </p>
      </div>
    </div>
  );
}
