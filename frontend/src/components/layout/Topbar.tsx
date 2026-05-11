import { useEffect, useRef, useState } from 'react';
import { Bell, Menu, LogOut, User, Settings as SettingsIcon, RefreshCw, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { storeService } from '../../services';
import { getErrorMessage } from '../../utils/errors';

interface TopbarProps {
  onMenuClick: () => void;
  pageTitle: string;
  unreadCount: number;
  onUnreadRefresh: () => void;
}

export default function Topbar({ onMenuClick, pageTitle, unreadCount, onUnreadRefresh }: TopbarProps) {
  const { user, logout } = useAuth();
  const toast = useToast();
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
      toast.success(`${Object.keys(r.results || {}).length} pazaryeri senkronize edildi, ${total} ürün güncel.`);
      onUnreadRefresh();
    } catch (e) {
      toast.error(getErrorMessage(e, 'Senkronizasyon başarısız'));
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center px-4 gap-4 sticky top-0 z-20">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        aria-label="Menüyü aç"
      >
        <Menu size={20} />
      </button>

      <h2 className="text-slate-200 font-semibold text-base flex-1 truncate">{pageTitle}</h2>

      <div className="flex items-center gap-2">
        {/* Sync (tüm pazaryerlerini yenile) */}
        <button
          title="Tüm Pazaryerlerini Senkronize Et"
          onClick={handleSync}
          disabled={syncing}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Bildirimler"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenu((m) => !m)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <User size={14} className="text-white" />
            </div>
            <span className="text-slate-300 text-xs font-medium hidden sm:block max-w-[120px] truncate">
              {user?.name || 'Kullanıcı'}
            </span>
          </button>

          {userMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-xl py-2 shadow-2xl z-50 animate-fade-in">
              <div className="px-3 py-2 border-b border-slate-700/50">
                <p className="text-white text-sm font-semibold truncate">{user?.name}</p>
                <p className="text-slate-400 text-xs truncate">{user?.email}</p>
                {user?.store_name && (
                  <p className="text-indigo-400 text-xs mt-0.5 truncate">{user.store_name}</p>
                )}
                {user && !user.email_verified && (
                  <div className="mt-2 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 flex items-center gap-1.5">
                    <Mail size={11} className="text-amber-400" />
                    <span className="text-amber-300 text-[10px]">E-posta doğrulanmadı</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setUserMenu(false);
                  navigate('/settings');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-800/60 text-sm transition-colors"
              >
                <SettingsIcon size={14} />
                Ayarlar
              </button>

              <div className="my-1 border-t border-slate-700/50" />

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-500/10 text-sm transition-colors"
              >
                <LogOut size={14} />
                Çıkış Yap
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
