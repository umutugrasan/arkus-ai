import { useState, useEffect, useMemo } from 'react';
import { Bell, CheckCheck, RefreshCw, Info, AlertTriangle, XCircle } from 'lucide-react';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import { notificationService } from '../services';
import { formatDate } from '../utils/formatters';
import { useI18n } from '../context/I18nContext';
import type { NotificationItem, NotificationsResponse } from '../types/api';

type FilterType = 'all' | 'unread' | 'stok_uyarisi' | 'puan_dususu' | 'rakip_fiyat' | 'tedarikci_indirimi';

export default function NotificationsPage() {
  const { t } = useI18n();
  const SEVERITY_CONFIG: Record<string, { icon: React.ReactNode; text: string; bg: string; label: string }> = useMemo(() => ({
    critical: { icon: <XCircle size={14} />, text: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/30', label: t('notifications.severity_critical') },
    warning:  { icon: <AlertTriangle size={14} />, text: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/30', label: t('notifications.severity_warning') },
    info:     { icon: <Info size={14} />, text: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10 border-[var(--accent)]/30', label: t('notifications.severity_info') },
  }), [t]);

  const TYPE_LABELS: Record<string, string> = useMemo(() => ({
    stok_uyarisi: '📦 ' + t('notifications.filter_stock').replace('📦 ', ''),
    puan_dususu: '⭐ ' + t('notifications.filter_rating').replace('⭐ ', ''),
    rakip_fiyat: '💰 ' + t('notifications.filter_competitor').replace('💰 ', ''),
    tedarikci_indirimi: '🏷️ ' + t('notifications.filter_discount').replace('🏷️ ', ''),
  }), [t]);

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
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    try {
      await notificationService.markRead(id);
    } catch {
      // Revert if failed
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: false } : n));
      setUnreadCount(prev => prev + 1);
    }
  };

  const handleMarkAll = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    
    // Optimistic
    const oldCount = unreadCount;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    
    try {
      await notificationService.markAllRead();
    } catch {
      // Revert if failed
      setUnreadCount(oldCount);
      fetchNotifications();
    } finally {
      setMarkingAll(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await notificationService.generate();
      await fetchNotifications();
    } finally { setGenerating(false); }
  };

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: t('notifications.filter_all') },
    { id: 'unread', label: `${t('notifications.filter_unread')} (${unreadCount})` },
    { id: 'stok_uyarisi', label: t('notifications.filter_stock') },
    { id: 'puan_dususu', label: t('notifications.filter_rating') },
    { id: 'rakip_fiyat', label: t('notifications.filter_competitor') },
    { id: 'tedarikci_indirimi', label: t('notifications.filter_discount') },
  ];

  if (loading) return <LoadingSpinner message={t('notifications.loading')} size="lg" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[var(--accent)]/10 rounded-xl">
            <Bell size={18} className="text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="text-[var(--text-primary)] font-semibold">{t('notifications.title')}</h2>
            {unreadCount > 0 && <p className="text-[var(--text-muted)] text-xs">{unreadCount} {t('notifications.unread_count')}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={handleMarkAll} disabled={markingAll}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[var(--bg-card)] hover:bg-[var(--bg-muted)] text-[var(--text-secondary)] border border-[var(--border-strong)] rounded-xl transition-all disabled:opacity-50">
              {markingAll ? <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" /> : <CheckCheck size={14} />}
              {t('notifications.mark_all')}
            </button>
          )}
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] rounded-xl transition-all disabled:opacity-50">
            {generating ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <RefreshCw size={14} />}
            {t('notifications.scan')}
          </button>
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-2">
        {filters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              filter === f.id ? 'bg-[var(--accent-solid)] text-[var(--accent-fg)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}>{f.label}</button>
        ))}
      </div>

      {/* Bildirim Listesi */}
      {notifications.length === 0
        ? <EmptyState title={t('notifications.empty_title')} description={t('notifications.empty_desc')} />
        : (
          <div className="space-y-2">
            {notifications.map(n => {
              const sev = SEVERITY_CONFIG[n.severity] || SEVERITY_CONFIG.info;
              return (
                <div key={n.id} onClick={() => !n.read && handleMarkRead(n.id)}
                  className={`p-4 rounded-2xl border transition-all ${
                    !n.read ? `${sev.bg} cursor-pointer hover:opacity-80` : 'bg-[var(--bg-elevated)] border-[var(--border-color)] opacity-70'
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 p-1.5 rounded-lg ${!n.read ? sev.bg : 'bg-[var(--bg-muted)]'}`}>
                        <span className={sev.text}>{sev.icon}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className={`text-sm font-semibold ${!n.read ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{n.title}</p>
                          {!n.read && <span className="w-2 h-2 bg-[var(--accent)] rounded-full flex-shrink-0" />}
                        </div>
                        <p className="text-[var(--text-muted)] text-xs leading-relaxed">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sev.bg} ${sev.text}`}>{sev.label}</span>
                          {TYPE_LABELS[n.type] && <span className="text-xs text-[var(--text-muted)]">{TYPE_LABELS[n.type]}</span>}
                        </div>
                      </div>
                    </div>
                    <p className="text-[var(--text-muted)] text-xs flex-shrink-0">{formatDate(n.created_at)}</p>
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
