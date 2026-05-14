import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center mb-6">
        <Compass size={36} className="text-indigo-600" />
      </div>
      <h1 className="text-6xl font-extrabold text-slate-800 tracking-tight">404</h1>
      <p className="text-gray-500 mt-3 mb-1 text-lg">Sayfa bulunamadı</p>
      <p className="text-gray-500 text-sm max-w-md">
        Aradığınız sayfa kaldırılmış, ismi değişmiş veya geçici olarak erişilemez olabilir.
      </p>
      <Link
        to="/dashboard"
        className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-slate-800 text-sm font-medium transition-all shadow-lg shadow-indigo-500/30"
      >
        <Home size={16} />
        Dashboard'a Dön
      </Link>
    </div>
  );
}
