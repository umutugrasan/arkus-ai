import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { notificationService } from '../../services';

const PAGE_TITLES: Array<[string, string]> = [
  ['/dashboard', 'Dashboard'],
  ['/products', 'Urun Yonetimi'],
  ['/reviews', 'Yorum Analizi'],
  ['/competitors', 'Rakip Analizi'],
  ['/arbitrage', 'Capraz Pazaryeri Arbitraj'],
  ['/financials', 'Finansal Panel'],
  ['/health', 'Magaza Saglik Skoru'],
  ['/finance-guide', 'Finansman Rehberi'],
  ['/sourcing', 'Tedarik Avcisi'],
  ['/listing-optimizer', 'Listing Optimizer'],
  ['/image-analyzer', 'Gorsel Analiz'],
  ['/chat', 'AI Danisman'],
  ['/notifications', 'Bildirimler'],
  ['/reports', 'Raporlar'],
  ['/integrations', 'Entegrasyonlar'],
  ['/settings', 'Ayarlar'],
];

const POLL_UNREAD_MS = 30_000;

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

  const title =
    PAGE_TITLES.find(([path]) => location.pathname.startsWith(path))?.[1] || 'Basiret AI';

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
    <div className="flex h-screen bg-[#0f172a] overflow-hidden">
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
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
