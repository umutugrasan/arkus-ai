import { useEffect, useRef, useState } from 'react';
import { Bell, Menu, LogOut, User, Settings as SettingsIcon, RefreshCw, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useI18n } from '../../context/I18nContext';
import { storeService } from '../../services';
import { getErrorMessage } from '../../utils/errors';
import { ThemeToggle } from '@/components/ui/curtain-theme-toggle';

interface TopbarProps {
  onMenuClick: () => void;
  pageTitle: string;
  unreadCount: number;
  onUnreadRefresh: () => void;
}

export default function Topbar({ onMenuClick, pageTitle, unreadCount, onUnreadRefresh }: TopbarProps) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [userMenu, setUserMenu] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenu(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await storeService.syncAll();
      const total = Object.values(r.results || {}).reduce((s, m) => s + (m.product_count || 0), 0);
      toast.success(
        t('topbar.sync_success')
          .replace('{count}', String(Object.keys(r.results || {}).length))
          .replace('{total}', String(total)),
      );
      onUnreadRefresh();
    } catch (e) {
      toast.error(getErrorMessage(e, t('topbar.sync_failed')));
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-16 bg-[var(--accent-solid)] text-white flex items-center px-8 gap-4 sticky top-0 z-20 shrink-0">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        aria-label={t('topbar.open_menu')}
      >
        <Menu size={20} />
      </button>

      <h2 className="font-semibold text-sm flex-1 truncate">{pageTitle}</h2>

      <div className="flex items-center gap-6">
        {/* Sync (tüm pazaryerlerini yenile) */}
        <button
          title={t('topbar.sync_all')}
          onClick={handleSync}
          disabled={syncing}
          className="text-white/70 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
        </button>

        {/* Tema değiştir (perde animasyonlu) */}
        <ThemeToggle variant="icon" buttonSize={32} duration={550} />

        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative text-white/70 hover:text-white transition-colors"
          aria-label={t('nav.notifications')}
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenu((m) => !m)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs transition-colors"
          >
            <User size={14} className="opacity-80" />
            <span className="font-medium hidden sm:block max-w-[120px] truncate">
              {user?.name || t('common.user')}
            </span>
          </button>

          {userMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] py-2 shadow-lg z-50 animate-fade-in text-[var(--text-primary)]">
              <div className="px-4 py-3 border-b border-[var(--border-color)]">
                <p className="text-sm font-bold truncate">{user?.name}</p>
                <p className="text-[var(--text-muted)] text-xs truncate">{user?.email}</p>
                {user?.store_name && (
                  <p className="text-[var(--accent)] text-xs mt-1 font-semibold truncate">{user.store_name}</p>
                )}
                {user && !user.email_verified && (
                  <div className="mt-2 px-2 py-1 rounded bg-amber-50 border border-amber-200 flex items-center gap-1.5">
                    <Mail size={11} className="text-amber-500" />
                    <span className="text-amber-600 text-[10px] font-medium">{t('topbar.email_unverified')}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setUserMenu(false);
                  navigate('/settings');
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] text-sm transition-colors"
              >
                <SettingsIcon size={16} />
                {t('nav.settings')}
              </button>

              <div className="my-1 border-t border-[var(--border-color)]" />

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-red-500 hover:bg-red-50 text-sm transition-colors"
              >
                <LogOut size={16} />
                {t('topbar.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
