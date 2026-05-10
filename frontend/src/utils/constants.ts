export const MARKETPLACES: Record<string, { label: string; color: string; bgColor: string; textColor: string }> = {
  trendyol: {
    label: 'Trendyol',
    color: '#f27a1a',
    bgColor: 'bg-orange-500/20',
    textColor: 'text-orange-400',
  },
  hepsiburada: {
    label: 'Hepsiburada',
    color: '#ff6600',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
  },
  amazon_tr: {
    label: 'Amazon TR',
    color: '#ff9900',
    bgColor: 'bg-yellow-500/20',
    textColor: 'text-yellow-400',
  },
  n11: {
    label: 'N11',
    color: '#7a00cc',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
  },
};

export const MP_CHART_COLORS = ['#6366f1', '#f59e0b', '#22c55e', '#f97316', '#06b6d4'];

export const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  critical: { label: 'Kritik', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30', icon: '🚨' },
  warning: { label: 'Uyarı', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30', icon: '⚠️' },
  info: { label: 'Bilgi', color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30', icon: 'ℹ️' },
};

export const MOCK_PRODUCTS = ['P001', 'P002', 'P003', 'P004', 'P005'];
export const MOCK_PRODUCT_NAMES: Record<string, string> = {
  P001: 'Bluetooth Kulaklık Pro Max',
  P002: 'Akıllı Saat Fitness Tracker',
  P003: 'USB-C Hızlı Şarj Kablosu',
  P004: 'Bluetooth Hoparlör',
  P005: 'Laptop Standı Alüminyum',
};
