import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Zap, LogIn } from 'lucide-react';
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
    <div className="min-h-screen bg-[#0f172a] relative overflow-hidden">
      <div className="absolute inset-0 -z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/15 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/40 mb-4">
              <Zap size={26} className="text-white" />
            </div>
            <h1 className="text-3xl font-extrabold gradient-text">Basiret AI</h1>
            <p className="text-slate-400 text-sm mt-1">Çoklu Pazaryeri Satıcı Zekası</p>
          </div>

          <div className="glass-card p-8 animate-fade-in">
            <h2 className="text-xl font-bold text-white mb-1">Hoş Geldin</h2>
            <p className="text-slate-400 text-sm mb-6">Devam etmek için giriş yap.</p>

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
                    className="p-1.5 text-slate-400 hover:text-slate-200"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
                required
              />

              <div className="flex items-center justify-end -mt-1">
                <Link to="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300">
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
              >
                Giriş Yap
              </Button>

            </form>

            <p className="text-center text-sm text-slate-400 mt-6">
              Hesabın yok mu?{' '}
              <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
                Kayıt ol
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-slate-600 mt-6">
            © 2026 Basiret AI · BTK Hackathon 26
          </p>
        </div>
      </div>
    </div>
  );
}
