import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Package, MessageSquare, Swords, ArrowLeftRight,
  TrendingUp, Heart, Banknote, Search, Bot, Bell, FileText, Settings,
  X, Sparkles, ImageIcon, PlugZap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { TranslationKey } from '../../i18n';
import LanguageSwitcher from '../ui/LanguageSwitcher';

interface NavItem {
  to: string;
  icon: LucideIcon;
  labelKey: TranslationKey;
  badge?: 'notifications';
}

interface NavGroup {
  titleKey: TranslationKey;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: 'nav.general',
    items: [{ to: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' }],
  },
  {
    titleKey: 'nav.store',
    items: [
      { to: '/products', icon: Package, labelKey: 'nav.products' },
      { to: '/reviews', icon: MessageSquare, labelKey: 'nav.reviews' },
    ],
  },
  {
    titleKey: 'nav.analysis',
    items: [
      { to: '/competitors', icon: Swords, labelKey: 'nav.competitors' },
      { to: '/arbitrage', icon: ArrowLeftRight, labelKey: 'nav.arbitrage' },
      { to: '/financials', icon: TrendingUp, labelKey: 'nav.financials' },
      { to: '/health', icon: Heart, labelKey: 'nav.health' },
      { to: '/finance-guide', icon: Banknote, labelKey: 'nav.finance_guide' },
    ],
  },
  {
    titleKey: 'nav.optimization',
    items: [
      { to: '/sourcing', icon: Search, labelKey: 'nav.sourcing' },
      { to: '/listing-optimizer', icon: Sparkles, labelKey: 'nav.listing_optimizer' },
      { to: '/image-analyzer', icon: ImageIcon, labelKey: 'nav.image_analyzer' },
    ],
  },
  {
    titleKey: 'nav.ai',
    items: [
      { to: '/chat', icon: Bot, labelKey: 'nav.chat' },
    ],
  },
  {
    titleKey: 'nav.system',
    items: [
      { to: '/notifications', icon: Bell, labelKey: 'nav.notifications', badge: 'notifications' },
      { to: '/reports', icon: FileText, labelKey: 'nav.reports' },
      { to: '/integrations', icon: PlugZap, labelKey: 'nav.integrations' },
      { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
    ],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  unreadCount?: number;
}

export default function Sidebar({ open, onClose, unreadCount = 0 }: SidebarProps) {
  const { t } = useI18n();

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
          bg-[var(--bg-primary)] border-r border-[var(--border-strong)]
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
              <h1 className="font-black text-2xl leading-none text-[var(--text-primary)] tracking-tighter">Arkus</h1>
              <p className="text-[8px] text-[var(--accent)]/70 font-black uppercase tracking-[0.25em] mt-1">AI SOLUTIONS</p>
            </div>
          </NavLink>
          <button onClick={onClose} className="lg:hidden text-[var(--text-faint)] hover:text-[var(--text-primary)] p-1">
            <X size={18} />
          </button>
        </div>

        {/* Nav (grouped) */}
        <nav className="flex-1 overflow-y-auto py-2 px-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.titleKey} className="mb-6">
              <p className="text-[10px] font-bold text-[var(--text-faint)] mb-2 uppercase tracking-wider">
                {t(group.titleKey)}
              </p>
              <div className="space-y-1">
                {group.items.map(({ to, icon: Icon, labelKey, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm relative ${
                        isActive
                          ? 'text-[var(--accent-fg)] font-medium'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span
                            layoutId="sidebar-active-pill"
                            className="absolute inset-0 bg-[var(--accent-solid)] rounded-lg shadow-sm"
                            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                          />
                        )}
                        <Icon
                          size={16}
                          strokeWidth={isActive ? 2 : 1.5}
                          className={`relative z-10 ${
                            isActive ? 'text-[var(--accent-fg)]' : 'text-[var(--text-faint)] opacity-80'
                          }`}
                        />
                        <span className="relative z-10 flex-1 truncate font-medium">{t(labelKey)}</span>
                        {badge === 'notifications' && unreadCount > 0 && (
                          <span className="relative z-10 ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
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

        {/* Footer with language switcher */}
        <div className="mt-auto p-4 space-y-3">
          <LanguageSwitcher className="w-full justify-center" />
          <div className="bg-[var(--bg-muted)] rounded-xl p-4">
            <p className="text-[10px] font-bold text-[var(--text-secondary)]">v1.0.0</p>
            <p className="text-[10px] text-[var(--text-faint)] mt-0.5">Arkus AI Solutions</p>
          </div>
        </div>
      </aside>
    </>
  );
}
