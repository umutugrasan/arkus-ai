import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { getErrorMessage } from '../utils/errors';

interface LocationState {
  from?: string;
}

export default function LoginPage() {
  const { login, user, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!authLoading && user) {
    const from = (location.state as LocationState)?.from || '/dashboard';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('E-posta ve şifre gerekli');
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success('Hoş geldin!');
      const from = (location.state as LocationState)?.from || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Giriş yapılamadı'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f8f4] relative overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 -z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-amber-100 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-50 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md p-4">
        <div className="flex flex-col items-center mb-10">
          <img src="/assets/logos/logo-bird.png" alt="Arkus Logo" className="w-24 h-24 object-contain mb-4 drop-shadow-md" />
          <h1 className="text-5xl font-black text-slate-800 tracking-tighter">Arkus</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">Çoklu Pazaryeri Satıcı Zekası</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 animate-fade-in">
          <h2 className="text-xl font-bold text-slate-800 mb-1">Hoş Geldin</h2>
          <p className="text-gray-500 text-sm mb-6">Devam etmek için giriş yap.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              label="Şifre"
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock size={15} />}
              rightAddon={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="p-1.5 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
              required
            />

            <div className="flex items-center justify-end -mt-1">
              <Link to="/forgot-password" className="text-xs text-[#4a3f44] font-medium hover:text-slate-800 transition-colors">
                Şifremi unuttum
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              fullWidth
              leftIcon={<LogIn size={16} />}
              className="bg-[#4a3f44] hover:bg-[#6b6266] border-none shadow-md"
            >
              Giriş Yap
            </Button>

          </form>

          <p className="text-center text-sm text-gray-500 mt-6 font-medium">
            Hesabın yok mu?{' '}
            <Link to="/register" className="text-[#4a3f44] hover:text-slate-800 font-bold transition-colors">
              Kayıt ol
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 font-medium">
          © 2026 Arkus · Tüm hakları saklıdır.
        </p>
      </div>
    </div>
  );
}
