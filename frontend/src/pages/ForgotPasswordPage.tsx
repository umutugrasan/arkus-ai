import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, KeyRound, Zap, ArrowLeft, Eye, EyeOff, Send } from 'lucide-react';
import { authService } from '../services';
import { useToast } from '../context/ToastContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { getErrorMessage } from '../utils/errors';

type Step = 'request' | 'reset' | 'done';

export default function ForgotPasswordPage() {
  const toast = useToast();
  const navigate = useNavigate();

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
      toast.success(r.message || 'E-posta gonderildi (eger kayitliysa)');
      setStep('reset');
    } catch (err) {
      toast.error(getErrorMessage(err, 'İstek başarısız'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetToken || !newPassword) {
      toast.error('Token ve yeni şifre gerekli');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Şifre en az 8 karakter olmalı');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Şifreler eşleşmiyor');
      return;
    }
    setSubmitting(true);
    try {
      await authService.resetPassword(resetToken, newPassword);
      toast.success('Şifre sıfırlandı, giriş yapabilirsin');
      setStep('done');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Sıfırlama başarısız'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f8f4] relative overflow-hidden">
      <div className="absolute inset-0 -z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/15 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/40 mb-4">
              <Zap size={26} className="text-slate-800" />
            </div>
            <h1 className="text-3xl font-extrabold gradient-text">Arkus AI</h1>
          </div>

          <div className="glass-card p-8 animate-fade-in">
            <Link to="/login" className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 mb-4">
              <ArrowLeft size={12} /> Giriş'e dön
            </Link>

            {step === 'request' && (
              <>
                <h2 className="text-xl font-bold text-slate-800 mb-1">Şifremi Unuttum</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Kayıtlı e-posta adresine sıfırlama bağlantısı göndereceğiz.
                </p>
                <form onSubmit={handleRequest} className="space-y-4">
                  <Input
                    label="E-posta"
                    type="email"
                    placeholder="ornek@firma.com"
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
                    Sıfırlama Bağlantısı Gönder
                  </Button>
                </form>
              </>
            )}

            {step === 'reset' && (
              <>
                <h2 className="text-xl font-bold text-slate-800 mb-1">Yeni Şifre Belirle</h2>
                <p className="text-gray-500 text-sm mb-4">
                  E-postana gelen sıfırlama token'ını gir ve yeni şifreni belirle.
                </p>

                <form onSubmit={handleReset} className="space-y-4">
                  <Input
                    label="Sıfırlama Token'ı"
                    type="text"
                    placeholder="e-postana gelen kod"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    leftIcon={<KeyRound size={15} />}
                    required
                  />
                  <Input
                    label="Yeni Şifre"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="En az 8 karakter"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    leftIcon={<Lock size={15} />}
                    rightAddon={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="p-1.5 text-gray-500 hover:text-slate-200"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    }
                    required
                  />
                  <Input
                    label="Şifre (Tekrar)"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    leftIcon={<Lock size={15} />}
                    error={
                      confirmPassword && newPassword !== confirmPassword
                        ? 'Şifreler eşleşmiyor'
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
                    Şifreyi Sıfırla
                  </Button>
                </form>
              </>
            )}

            {step === 'done' && (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
                  <KeyRound size={26} className="text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Şifre Sıfırlandı</h2>
                <p className="text-gray-500 text-sm">Giriş sayfasına yönlendiriliyorsun…</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
