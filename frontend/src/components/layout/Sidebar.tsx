import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, MessageSquare, Swords, ArrowLeftRight,
  TrendingUp, Heart, Banknote, Search, Bot, Bell, FileText, Settings,
  X, Sparkles, ImageIcon, PlugZap,
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
    ],
  },
  {
    title: 'Sistem',
    items: [
      { to: '/notifications', icon: Bell, label: 'Bildirimler', badge: 'notifications' },
      { to: '/reports', icon: FileText, label: 'Raporlar' },
      { to: '/integrations', icon: PlugZap, label: 'Entegrasyonlar' },
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
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-40 w-64 flex flex-col
          bg-[#f9f8f4] border-r border-gray-200
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between p-6">
          <NavLink to="/dashboard" onClick={onClose} className="flex items-center gap-4 group">
            <img 
              src="/assets/logos/logo-bird.png" 
              alt="Arkus Logo" 
              className="w-12 h-12 object-contain group-hover:scale-105 transition-transform duration-300" 
            />
            <div className="flex flex-col justify-center">
              <h1 className="font-black text-2xl leading-none text-slate-800 tracking-tighter">Arkus</h1>
              <p className="text-[8px] text-indigo-600/70 font-black uppercase tracking-[0.25em] mt-1">AI SOLUTIONS</p>
            </div>
          </NavLink>
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-slate-800 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Nav (grouped) */}
        <nav className="flex-1 overflow-y-auto py-2 px-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-6">
              <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map(({ to, icon: Icon, label, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors relative ${
                        isActive
                          ? 'bg-[#4a3f44] text-white font-medium shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          size={16}
                          strokeWidth={isActive ? 2 : 1.5}
                          className={
                            isActive
                              ? 'text-white'
                              : 'text-gray-400 group-hover:text-gray-500 opacity-80'
                          }
                        />
                        <span className="flex-1 truncate font-medium">{label}</span>
                        {badge === 'notifications' && unreadCount > 0 && (
                          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
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
        <div className="mt-auto p-4">
          <div className="bg-[#f0ece7] rounded-xl p-4">
            <p className="text-[10px] font-bold text-gray-600">v1.0.0</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Çoklu Pazaryeri AI Zekası</p>
          </div>
        </div>
      </aside>
    </>
  );
}
