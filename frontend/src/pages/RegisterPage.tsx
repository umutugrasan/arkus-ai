import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, Loader2, ArrowLeft } from 'lucide-react';

export default function RegisterPage() {
  const { register, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', store_name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(form.name, form.email, form.password, form.store_name);
      navigate('/dashboard');
    } catch {
      setError('Kayıt başarısız. Bu e-posta zaten kayıtlı olabilir.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-200px] right-[-200px] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-2xl shadow-indigo-500/40 mb-4">
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Basiret AI'ya Katıl</h1>
          <p className="text-slate-400 mt-1 text-sm">Ücretsiz hesap oluştur</p>
        </div>

        <div className="glass-card p-8">
          <button
            onClick={() => { demoLogin(); navigate('/dashboard'); }}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl py-3 mb-6 text-sm font-semibold hover:border-emerald-400/50 transition-all"
          >
            🚀 Demo ile Hemen Başla
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-700/50" />
            <span className="text-slate-500 text-xs">veya kayıt ol</span>
            <div className="flex-1 h-px bg-slate-700/50" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: 'name', label: 'Ad Soyad', placeholder: 'Mehmet Yılmaz', type: 'text' },
              { key: 'email', label: 'E-posta', placeholder: 'ornek@email.com', type: 'email' },
              { key: 'store_name', label: 'Mağaza Adı', placeholder: 'TechStore TR', type: 'text' },
              { key: 'password', label: 'Şifre', placeholder: '••••••••', type: 'password' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-slate-400 text-xs font-medium mb-1.5">{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  required={f.key !== 'store_name'}
                  className="w-full bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-500 transition-all"
                />
              </div>
            ))}

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg px-3 py-2">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl py-3 font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Oluşturuluyor...' : 'Hesap Oluştur'}
            </button>
          </form>

          <p className="text-center text-slate-500 text-xs mt-5">
            Hesabınız var mı?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1">
              <ArrowLeft size={12} /> Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
