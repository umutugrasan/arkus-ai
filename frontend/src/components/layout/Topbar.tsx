import { useState, useEffect } from 'react';
import { Bell, Menu, LogOut, User, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services';

interface TopbarProps {
  onMenuClick: () => void;
  pageTitle: string;
}

export default function Topbar({ onMenuClick, pageTitle }: TopbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [userMenu, setUserMenu] = useState(false);

  useEffect(() => {
    notificationService.unreadCount().then(d => setUnread(d.unread_count || 0)).catch(() => {});
    const interval = setInterval(() => {
      notificationService.unreadCount().then(d => setUnread(d.unread_count || 0)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center px-4 gap-4 sticky top-0 z-20">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
      >
        <Menu size={20} />
      </button>

      <h2 className="text-slate-200 font-semibold text-base flex-1 truncate">{pageTitle}</h2>

      <div className="flex items-center gap-2">
        {/* Sync button */}
        <button
          title="Veri Yenile"
          onClick={() => window.location.reload()}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <RefreshCw size={16} />
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenu(m => !m)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <User size={14} className="text-white" />
            </div>
            <span className="text-slate-300 text-xs font-medium hidden sm:block max-w-[100px] truncate">
              {user?.name}
            </span>
          </button>

          {userMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 glass-card py-2 z-50 animate-fade-in">
              <div className="px-3 py-2 border-b border-slate-700/50">
                <p className="text-white text-sm font-semibold">{user?.name}</p>
                <p className="text-slate-400 text-xs">{user?.store_name}</p>
              </div>
              <button
                onClick={() => { logout(); navigate('/login'); }}
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
