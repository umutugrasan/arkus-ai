import { Suspense, useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import LoadingSpinner from '../shared/LoadingSpinner';
import { notificationService } from '../../services';
import { useI18n } from '../../context/I18nContext';
import type { TranslationKey } from '../../i18n';

const PAGE_TITLES: Array<[string, TranslationKey]> = [
  ['/dashboard', 'nav.dashboard'],
  ['/products', 'nav.products'],
  ['/reviews', 'nav.reviews'],
  ['/competitors', 'nav.competitors'],
  ['/arbitrage', 'nav.arbitrage'],
  ['/financials', 'nav.financials'],
  ['/health', 'nav.health'],
  ['/finance-guide', 'nav.finance_guide'],
  ['/sourcing', 'nav.sourcing'],
  ['/listing-optimizer', 'nav.listing_optimizer'],
  ['/image-analyzer', 'nav.image_analyzer'],
  ['/chat', 'nav.chat'],
  ['/notifications', 'nav.notifications'],
  ['/reports', 'nav.reports'],
  ['/integrations', 'nav.integrations'],
  ['/settings', 'nav.settings'],
];

const POLL_UNREAD_MS = 30_000;

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const { t } = useI18n();

  const titleKey =
    PAGE_TITLES.find(([path]) => location.pathname.startsWith(path))?.[1];
  const title = titleKey ? t(titleKey) : 'Arkus AI';

  const refreshUnread = useCallback(() => {
    notificationService
      .unreadCount()
      .then((data) => setUnreadCount(data.unread_count || 0))
      .catch(() => {
        /* silent fail before auth settles */
      });
  }, []);

  useEffect(() => {
    refreshUnread();
    const interval = window.setInterval(refreshUnread, POLL_UNREAD_MS);
    return () => window.clearInterval(interval);
  }, [refreshUnread]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] overflow-hidden text-[var(--text-primary)]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        unreadCount={unreadCount}
      />

      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          pageTitle={title}
          unreadCount={unreadCount}
          onUnreadRefresh={refreshUnread}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <LoadingSpinner message={t('common.loading')} size="lg" />
              </div>
            }>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
