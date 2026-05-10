import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, MessageSquare, Swords, ArrowLeftRight,
  TrendingUp, Heart, Banknote, Search, Bot, Bell, FileText, Settings, X,
  ChevronRight, Zap
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/products', icon: Package, label: 'Ürünler' },
  { to: '/reviews', icon: MessageSquare, label: 'Yorum Analizi' },
  { to: '/competitors', icon: Swords, label: 'Rakip Analizi' },
  { to: '/arbitrage', icon: ArrowLeftRight, label: 'Arbitraj' },
  { to: '/financials', icon: TrendingUp, label: 'Finansal Panel' },
  { to: '/health', icon: Heart, label: 'Sağlık Skoru' },
  { to: '/finance-guide', icon: Banknote, label: 'Finansman Rehberi' },
  { to: '/sourcing', icon: Search, label: 'Tedarik Avcısı' },
  { to: '/chat', icon: Bot, label: 'AI Danışman' },
  { to: '/reports', icon: FileText, label: 'Raporlar' },
  { to: '/notifications', icon: Bell, label: 'Bildirimler' },
  { to: '/settings', icon: Settings, label: 'Ayarlar' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full z-40 w-64 flex flex-col
        bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50
        transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">Basiret AI</h1>
              <p className="text-indigo-400 text-xs">Satıcı Zekası Paneli</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                onClick={() => onClose()}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200 group relative
                  ${active
                    ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/10 text-indigo-300 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }
                `}
              >
                <Icon size={17} className={active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={14} className="text-indigo-400" />}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50">
          <div className="glass-card p-3 bg-gradient-to-r from-indigo-500/10 to-violet-500/10">
            <p className="text-xs text-indigo-300 font-semibold">🏆 BTK Hackathon 26</p>
            <p className="text-xs text-slate-400 mt-0.5">Çoklu Pazaryeri AI Zekası</p>
          </div>
        </div>
      </aside>
    </>
  );
}
