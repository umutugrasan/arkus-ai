import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Store, Eye, EyeOff, Zap, UserPlus, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { getErrorMessage } from '../utils/errors';

export default function RegisterPage() {
  const { register, user, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

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
    if (p.length < 8) return 'Şifre en az 8 karakter olmalı';
    if (!/[A-Za-z]/.test(p)) return 'Şifre en az bir harf içermeli';
    if (!/[0-9]/.test(p)) return 'Şifre en az bir rakam içermeli';
    return null;
  };

  const passwordError = password ? validatePassword(password) : null;
  const confirmError =
    confirmPassword && password !== confirmPassword ? 'Şifreler eşleşmiyor' : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error('Ad, e-posta ve şifre alanları gerekli');
      return;
    }
    const pErr = validatePassword(password);
    if (pErr) {
      toast.error(pErr);
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Şifreler eşleşmiyor');
      return;
    }
    setSubmitting(true);
    try {
      await register(name, email, password, storeName);
      toast.success('Kayıt başarılı! Hoş geldin.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Kayıt olunamadı'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] relative overflow-hidden py-8">
      <div className="absolute inset-0 -z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/15 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/40 mb-4">
              <Zap size={26} className="text-white" />
            </div>
            <h1 className="text-3xl font-extrabold gradient-text">Basiret AI</h1>
            <p className="text-slate-400 text-sm mt-1">14 günlük ücretsiz dene</p>
          </div>

          <div className="glass-card p-8 animate-fade-in">
            <h2 className="text-xl font-bold text-white mb-1">Hesap Oluştur</h2>
            <p className="text-slate-400 text-sm mb-6">
              E-ticaret işini bir üst seviyeye taşı.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Ad Soyad"
                type="text"
                name="name"
                placeholder="Mehmet Yılmaz"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                leftIcon={<User size={15} />}
                required
              />

              <Input
                label="E-posta"
                type="email"
                name="email"
                placeholder="ornek@firma.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail size={15} />}
                required
              />

              <Input
                label="Mağaza Adı (opsiyonel)"
                type="text"
                name="storeName"
                placeholder="TechStore TR"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                leftIcon={<Store size={15} />}
              />

              <Input
                label="Şifre"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="En az 8 karakter, harf+rakam"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock size={15} />}
                error={passwordError ?? undefined}
                hint="En az 8 karakter, harf ve rakam içermeli"
                rightAddon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="p-1.5 text-slate-400 hover:text-slate-200"
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
                name="confirmPassword"
                placeholder="••••••••"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock size={15} />}
                error={confirmError ?? undefined}
                rightAddon={
                  password && password === confirmPassword ? (
                    <div className="p-1.5 text-emerald-400">
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
              >
                Kayıt Ol
              </Button>
            </form>

            <p className="text-center text-sm text-slate-400 mt-6">
              Zaten hesabın var mı?{' '}
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
                Giriş yap
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-slate-600 mt-6">
            Kayıt olarak{' '}
            <a href="#" className="text-slate-500 hover:text-slate-400">Hizmet Şartları</a>'nı
            ve{' '}
            <a href="#" className="text-slate-500 hover:text-slate-400">Gizlilik Politikası</a>'nı
            kabul etmiş olursun.
          </p>
        </div>
      </div>
    </div>
  );
}
