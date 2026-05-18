import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, KeyRound, Zap, ArrowLeft, Eye, EyeOff, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { authService } from '../services';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../context/I18nContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import LanguageSwitcher from '../components/ui/LanguageSwitcher';
import { getErrorMessage } from '../utils/errors';

type Step = 'request' | 'reset' | 'done';

export default function ForgotPasswordPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      const r = await authService.forgotPassword(email);
      toast.success(r.message || t('auth.reset_email_sent'));
      setStep('reset');
    } catch (err) {
      toast.error(getErrorMessage(err, t('auth.reset_request_failed')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetToken || !newPassword) {
      toast.error(t('auth.reset_token_required'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('auth.reset_password_short'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('auth.password_mismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await authService.resetPassword(resetToken, newPassword);
      toast.success(t('auth.reset_success'));
      setStep('done');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      toast.error(getErrorMessage(err, t('auth.reset_failed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden">
      <div className="absolute inset-0 -z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-amber-100 dark:bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[var(--accent)]/10 blur-3xl" />
      </div>

      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col items-center mb-6"
          >
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent-solid)] flex items-center justify-center shadow-2xl shadow-black/20 mb-4">
              <Zap size={26} className="text-[var(--accent-fg)]" />
            </div>
            <h1 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tighter">Arkus AI</h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
            className="bg-[var(--bg-card)] rounded-2xl shadow-[0_12px_40px_rgba(74,63,68,0.08)] border border-[var(--border-color)] p-8"
          >
            <Link to="/login" className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] mb-4">
              <ArrowLeft size={12} /> {t('auth.forgot_back')}
            </Link>

            {step === 'request' && (
              <>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">{t('auth.forgot_title')}</h2>
                <p className="text-[var(--text-muted)] text-sm mb-6">
                  {t('auth.forgot_subtitle')}
                </p>
                <form onSubmit={handleRequest} className="space-y-4">
                  <Input
                    label={t('auth.email')}
                    type="email"
                    placeholder={t('auth.email_placeholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    leftIcon={<Mail size={15} />}
                    required
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={submitting}
                    fullWidth
                    leftIcon={<Send size={16} />}
                  >
                    {t('auth.forgot_send')}
                  </Button>
                </form>
              </>
            )}

            {step === 'reset' && (
              <>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">{t('auth.reset_title')}</h2>
                <p className="text-[var(--text-muted)] text-sm mb-4">
                  {t('auth.reset_subtitle')}
                </p>

                <form onSubmit={handleReset} className="space-y-4">
                  <Input
                    label={t('auth.reset_token')}
                    type="text"
                    placeholder={t('auth.reset_token_placeholder')}
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    leftIcon={<KeyRound size={15} />}
                    required
                  />
                  <Input
                    label={t('auth.reset_new')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth.reset_new_placeholder')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    leftIcon={<Lock size={15} />}
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
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    leftIcon={<Lock size={15} />}
                    error={
                      confirmPassword && newPassword !== confirmPassword
                        ? t('auth.password_mismatch')
                        : undefined
                    }
                    required
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={submitting}
                    fullWidth
                  >
                    {t('auth.reset_submit')}
                  </Button>
                </form>
              </>
            )}

            {step === 'done' && (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
                  <KeyRound size={26} className="text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t('auth.reset_done')}</h2>
                <p className="text-[var(--text-muted)] text-sm">{t('auth.reset_done_desc')}</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
