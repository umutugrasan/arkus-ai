import { useEffect, useState } from 'react';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { notificationService } from '../services';
import GlassCard from '../components/shared/GlassCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { SEVERITY_CONFIG } from '../utils/constants';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = () => {
    notificationService.list().then(r => setNotifications(r.notifications || [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleMarkRead = async (id: string) => {
    await notificationService.markRead(id);
    setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x));
  };

  const handleMarkAll = async () => {
    await notificationService.markAllRead();
    setNotifications(n => n.map(x => ({ ...x, read: true })));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await notificationService.generate();
    load();
    setGenerating(false);
  };

  if (loading) return <LoadingSpinner message="Bildirimler yükleniyor..." size="lg" />;

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats + Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <GlassCard className="px-4 py-2 flex items-center gap-2">
            <Bell size={16} className="text-indigo-400" />
            <span className="text-white font-semibold">{notifications.length}</span>
            <span className="text-slate-400 text-sm">toplam</span>
          </GlassCard>
          {unread > 0 && (
            <GlassCard className="px-4 py-2 flex items-center gap-2 border border-rose-500/20 bg-rose-500/5">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-rose-400 font-semibold">{unread}</span>
              <span className="text-slate-400 text-sm">okunmamış</span>
            </GlassCard>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={handleMarkAll} disabled={unread === 0} className="flex items-center gap-1.5 text-xs bg-slate-800/60 border border-slate-700/50 hover:border-indigo-500/40 text-slate-300 hover:text-white rounded-xl px-3 py-2 transition-all disabled:opacity-40">
            <CheckCheck size={14} /> Tümünü Okundu İşaretle
          </button>
          <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 hover:border-indigo-400/50 text-indigo-300 rounded-xl px-3 py-2 transition-all">
            <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Oluşturuluyor...' : 'Otomatik Oluştur'}
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <GlassCard className="text-center py-12">
            <Bell size={40} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Henüz bildirim yok.</p>
            <button onClick={handleGenerate} className="mt-4 text-indigo-400 text-sm underline">Bildirimleri Otomatik Oluştur</button>
          </GlassCard>
        ) : (
          notifications.map(n => {
            const sev = SEVERITY_CONFIG[n.severity] || SEVERITY_CONFIG.info;
            return (
              <div
                key={n.id}
                onClick={() => !n.read && handleMarkRead(n.id)}
                className={`glass-card p-4 flex items-start gap-4 transition-all cursor-pointer ${!n.read ? 'border-l-2 border-l-indigo-500 bg-indigo-500/3' : 'opacity-70'} ${sev.bg} border`}
              >
                <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-lg ${!n.read ? 'bg-slate-700/50' : 'bg-slate-800/30'}`}>
                  {sev.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`font-semibold text-sm ${!n.read ? 'text-white' : 'text-slate-300'}`}>{n.title}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded-md ${sev.color} bg-current/10`}>{sev.label}</span>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">{n.message}</p>
                  <p className="text-slate-600 text-xs mt-1">{n.created_at}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
