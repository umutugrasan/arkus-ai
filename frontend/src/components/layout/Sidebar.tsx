import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, MessageSquare, Swords, ArrowLeftRight,
  TrendingUp, Heart, Banknote, Search, Bot, Bell, FileText, Settings,
  X, ChevronRight, Zap, Sparkles, ImageIcon, Cpu,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavGroup {
  title: string;
  items: Array<{
    to: string;
    icon: LucideIcon;
    label: string;
    badge?: 'notifications';
  }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Genel',
    items: [{ to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    title: 'Mağaza',
    items: [
      { to: '/products', icon: Package, label: 'Ürünler' },
      { to: '/reviews', icon: MessageSquare, label: 'Yorum Analizi' },
    ],
  },
  {
    title: 'Analiz',
    items: [
      { to: '/competitors', icon: Swords, label: 'Rakip Analizi' },
      { to: '/arbitrage', icon: ArrowLeftRight, label: 'Arbitraj' },
      { to: '/financials', icon: TrendingUp, label: 'Finansal Panel' },
      { to: '/health', icon: Heart, label: 'Sağlık Skoru' },
      { to: '/finance-guide', icon: Banknote, label: 'Finansman' },
    ],
  },
  {
    title: 'Optimizasyon',
    items: [
      { to: '/sourcing', icon: Search, label: 'Tedarik Avcısı' },
      { to: '/listing-optimizer', icon: Sparkles, label: 'Listing Optimizer' },
      { to: '/image-analyzer', icon: ImageIcon, label: 'Görsel Analiz' },
    ],
  },
  {
    title: 'AI',
    items: [
      { to: '/chat', icon: Bot, label: 'AI Danışman' },
      { to: '/agents', icon: Cpu, label: 'Otonom Ajanlar' },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { to: '/notifications', icon: Bell, label: 'Bildirimler', badge: 'notifications' },
      { to: '/reports', icon: FileText, label: 'Raporlar' },
      { to: '/settings', icon: Settings, label: 'Ayarlar' },
    ],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  unreadCount?: number;
}

export default function Sidebar({ open, onClose, unreadCount = 0 }: SidebarProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-40 w-64 flex flex-col
          bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <NavLink to="/dashboard" onClick={onClose} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">Basiret AI</h1>
              <p className="text-indigo-400 text-xs">Satıcı Zekası Paneli</p>
            </div>
          </NavLink>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        {/* Nav (grouped) */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-4">
              <p className="px-3 mb-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ to, icon: Icon, label, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/10 text-indigo-300 border border-indigo-500/20'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          size={16}
                          className={
                            isActive
                              ? 'text-indigo-400'
                              : 'text-slate-500 group-hover:text-slate-300'
                          }
                        />
                        <span className="flex-1 truncate">{label}</span>
                        {badge === 'notifications' && unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                        {isActive && !badge && (
                          <ChevronRight size={12} className="text-indigo-400" />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50">
          <div className="rounded-lg p-3 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20">
            <p className="text-xs text-indigo-300 font-semibold">v1.0.0</p>
            <p className="text-xs text-slate-400 mt-0.5">Çoklu Pazaryeri AI Zekası</p>
          </div>
        </div>
      </aside>
    </>
  );
}
