import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': '📊 Dashboard',
  '/products': '📦 Ürün Yönetimi',
  '/reviews': '💬 Yorum Analizi',
  '/competitors': '⚔️ Rakip Karşılaştırma',
  '/arbitrage': '🔄 Çapraz Pazaryeri Arbitraj',
  '/financials': '💰 Finansal Panel',
  '/health': '🏥 Mağaza Sağlık Skoru',
  '/finance-guide': '🏦 Finansman Rehberi',
  '/sourcing': '🔍 Tedarik Avcısı',
  '/chat': '🤖 AI Danışman',
  '/reports': '📋 Raporlar',
  '/notifications': '🔔 Bildirimler',
  '/settings': '⚙️ Ayarlar',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const title = Object.entries(PAGE_TITLES).find(([path]) => location.pathname.startsWith(path))?.[1] || 'Basiret AI';

  return (
    <div className="flex h-screen bg-[#0f172a] overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <Topbar onMenuClick={() => setSidebarOpen(true)} pageTitle={title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
