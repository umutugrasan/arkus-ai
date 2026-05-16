import { useState, useEffect } from 'react';
import { Bell, CheckCheck, RefreshCw, Info, AlertTriangle, XCircle } from 'lucide-react';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import { notificationService } from '../services';
import { formatDate } from '../utils/formatters';
import type { NotificationItem, NotificationsResponse } from '../types/api';

type FilterType = 'all' | 'unread' | 'stok_uyarisi' | 'puan_dususu' | 'rakip_fiyat' | 'tedarikci_indirimi';

const SEVERITY_CONFIG: Record<string, { icon: React.ReactNode; text: string; bg: string; label: string }> = {
  critical: { icon: <XCircle size={14} />, text: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30', label: 'Kritik' },
  warning:  { icon: <AlertTriangle size={14} />, text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', label: 'Uyarı' },
  info:     { icon: <Info size={14} />, text: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-500/30', label: 'Bilgi' },
};

const TYPE_LABELS: Record<string, string> = {
  stok_uyarisi: '📦 Stok Uyarısı',
  puan_dususu: '⭐ Puan Düşüşü',
  rakip_fiyat: '💰 Rakip Fiyat',
  tedarikci_indirimi: '🏷️ Tedarikçi İndirimi',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = async () => {
    const opts = filter === 'unread' ? { unread_only: true } :
      filter !== 'all' ? { type: filter } : {};
    const [res, cnt] = await Promise.all([
      notificationService.list({ ...opts, limit: 100 }) as Promise<NotificationsResponse>,
      notificationService.unreadCount(),
    ]);
    setNotifications(res.notifications || []);
    setUnreadCount(cnt.unread_count || 0);
  };

  useEffect(() => {
    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleMarkRead = async (id: number) => {
    await notificationService.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    await notificationService.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    setMarkingAll(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await notificationService.generate();
      await fetchNotifications();
    } finally { setGenerating(false); }
  };

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'Tümü' },
    { id: 'unread', label: `Okunmamış (${unreadCount})` },
    { id: 'stok_uyarisi', label: '📦 Stok' },
    { id: 'puan_dususu', label: '⭐ Puan' },
    { id: 'rakip_fiyat', label: '💰 Rakip Fiyat' },
    { id: 'tedarikci_indirimi', label: '🏷️ İndirim' },
  ];

  if (loading) return <LoadingSpinner message="Bildirimler yükleniyor…" size="lg" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 rounded-xl">
            <Bell size={18} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-slate-800 font-semibold">Bildirimler</h2>
            {unreadCount > 0 && <p className="text-gray-500 text-xs">{unreadCount} okunmamış</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={handleMarkAll} disabled={markingAll}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white hover:bg-slate-700 text-gray-600 rounded-xl transition-all disabled:opacity-50">
              {markingAll ? <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" /> : <CheckCheck size={14} />}
              Tümünü Oku
            </button>
          )}
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#4a3f44] hover:bg-[#6b6266] text-white rounded-xl transition-all disabled:opacity-50">
            {generating ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <RefreshCw size={14} />}
            Bildirimleri Tara
          </button>
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-2">
        {filters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              filter === f.id ? 'bg-[#4a3f44] text-white' : 'bg-gray-50 text-gray-500 hover:text-slate-800'
            }`}>{f.label}</button>
        ))}
      </div>

      {/* Bildirim Listesi */}
      {notifications.length === 0
        ? <EmptyState title="Bildirim Yok" description='Henüz bildirim yok. "Bildirimleri Tara" butonuyla otomatik bildirim oluşturun.' />
        : (
          <div className="space-y-2">
            {notifications.map(n => {
              const sev = SEVERITY_CONFIG[n.severity] || SEVERITY_CONFIG.info;
              return (
                <div key={n.id} onClick={() => !n.read && handleMarkRead(n.id)}
                  className={`p-4 rounded-2xl border transition-all ${
                    !n.read ? `${sev.bg} cursor-pointer hover:opacity-80` : 'bg-white/20 border-gray-200/50 opacity-70'
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 p-1.5 rounded-lg ${!n.read ? sev.bg : 'bg-white/40'}`}>
                        <span className={sev.text}>{sev.icon}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className={`text-sm font-semibold ${!n.read ? 'text-slate-800' : 'text-gray-500'}`}>{n.title}</p>
                          {!n.read && <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />}
                        </div>
                        <p className="text-gray-500 text-xs leading-relaxed">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sev.bg} ${sev.text}`}>{sev.label}</span>
                          {TYPE_LABELS[n.type] && <span className="text-xs text-gray-500">{TYPE_LABELS[n.type]}</span>}
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-500 text-xs flex-shrink-0">{formatDate(n.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}
