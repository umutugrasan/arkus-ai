import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, Eye, EyeOff, Loader2, Play } from 'lucide-react';

export default function LoginPage() {
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setError('E-posta veya şifre hatalı. Demo giriş deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    demoLogin();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-200px] right-[-200px] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-2xl shadow-indigo-500/40 mb-4 animate-pulse-glow">
            <Zap size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Basiret AI</h1>
          <p className="text-slate-400 mt-1 text-sm">Çoklu Pazaryeri Satıcı Zekası Paneli</p>
          <div className="inline-block bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 mt-2">
            <p className="text-indigo-400 text-xs font-medium">🏆 BTK Hackathon 26</p>
          </div>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h2 className="text-white text-xl font-bold mb-6">Giriş Yap</h2>

          {/* Demo Login */}
          <button
            onClick={handleDemo}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 hover:border-emerald-400/50 text-emerald-300 rounded-xl py-3 mb-6 text-sm font-semibold transition-all hover:shadow-lg hover:shadow-emerald-500/10"
          >
            <Play size={16} className="fill-current" />
            🚀 Demo Modunda Giriş Yap (Hızlı Erişim)
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-700/50" />
            <span className="text-slate-500 text-xs">veya hesabınızla girin</span>
            <div className="flex-1 h-px bg-slate-700/50" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1.5">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                className="w-full bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 placeholder-slate-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1.5">Şifre</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 placeholder-slate-500 transition-all"
                />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl py-3 font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <p className="text-center text-slate-500 text-xs mt-5">
            Hesabınız yok mu?{' '}
            <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Kayıt Ol
            </Link>
          </p>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Gemini AI • Trendyol • Hepsiburada • Amazon TR
        </p>
      </div>
    </div>
  );
}
