// Arkus AI — pastel pazaryeri paleti (doygun neon yerine yumuşak tonlar)
export const MARKETPLACES: Record<string, { label: string; color: string; bgColor: string; textColor: string }> = {
  trendyol: {
    label: 'Trendyol',
    color: '#d98aa0', // soft pembe
    bgColor: 'bg-rose-400/12',
    textColor: 'text-rose-500',
  },
  hepsiburada: {
    label: 'Hepsiburada',
    color: '#8fae94', // soft adaçayı / mint
    bgColor: 'bg-emerald-400/12',
    textColor: 'text-emerald-500',
  },
  amazon_tr: {
    label: 'Amazon TR',
    color: '#a99bc4', // soft lavanta
    bgColor: 'bg-violet-400/12',
    textColor: 'text-violet-500',
  },
  n11: {
    label: 'N11',
    color: '#c9a05c', // soft oker
    bgColor: 'bg-amber-400/14',
    textColor: 'text-amber-600',
  },
};

// Arkus AI — sıcak grafik paleti (espresso · mocha · oker · adaçayı · lavanta)
export const MP_CHART_COLORS = ['#4a3f44', '#b0826b', '#c9a05c', '#8fae94', '#a99bc4'];

// Arkus AI — yumuşatılmış severity tonları (neon yerine pastel)
export const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  critical: { label: 'Kritik', color: 'text-rose-500', bg: 'bg-rose-400/12 border-rose-400/25', icon: '🚨' },
  warning: { label: 'Uyarı', color: 'text-amber-600', bg: 'bg-amber-400/14 border-amber-400/25', icon: '⚠️' },
  info: { label: 'Bilgi', color: 'text-sky-500', bg: 'bg-sky-400/12 border-sky-400/20', icon: 'ℹ️' },
};

export const MOCK_PRODUCTS = ['P001', 'P002', 'P003', 'P004', 'P005'];
export const MOCK_PRODUCT_NAMES: Record<string, string> = {
  P001: 'Bluetooth Kulaklık Pro Max',
  P002: 'Akıllı Saat Fitness Tracker',
  P003: 'USB-C Hızlı Şarj Kablosu',
  P004: 'Bluetooth Hoparlör',
  P005: 'Laptop Standı Alüminyum',
};
