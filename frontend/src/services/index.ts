import api from '../api/client';

export const dashboardService = {
  getOverview: () => api.get('/dashboard/overview').then(r => r.data),
  getMarketplaceSummary: () => api.get('/dashboard/marketplace-summary').then(r => r.data),
  getTrends: (period: number = 7) => api.get(`/dashboard/trends?period=${period}`).then(r => r.data),
};

export const productService = {
  list: () => api.get('/products/list').then(r => r.data),
  topSellers: () => api.get('/products/top-sellers').then(r => r.data),
  lowStock: () => api.get('/products/low-stock').then(r => r.data),
  getById: (id: string) => api.get(`/products/${id}`).then(r => r.data),
  compare: (id: string) => api.get(`/products/${id}/compare`).then(r => r.data),
};

export const reviewService = {
  getReviews: (id: string, marketplace = 'all') =>
    api.get(`/reviews/${id}?marketplace=${marketplace}`).then(r => r.data),
  getSentiment: (id: string) => api.get(`/reviews/${id}/sentiment`).then(r => r.data),
  analyze: (id: string) => api.get(`/reviews/${id}/analyze`).then(r => r.data),
  compare: (id: string) => api.get(`/reviews/${id}/compare`).then(r => r.data),
};

export const competitorService = {
  getCompetitors: (id: string) => api.get(`/competitors/${id}`).then(r => r.data),
  analyze: (id: string) => api.get(`/competitors/${id}/analyze`).then(r => r.data),
  priceMap: (id: string) => api.get(`/competitors/${id}/price-map`).then(r => r.data),
};

export const arbitrageService = {
  opportunities: () => api.get('/arbitrage/opportunities').then(r => r.data),
  getDetail: (id: string) => api.get(`/arbitrage/${id}`).then(r => r.data),
  analyze: (id: string) => api.get(`/arbitrage/${id}/analyze`).then(r => r.data),
};

export const financialService = {
  overview: () => api.get('/financials/overview').then(r => r.data),
  byMarketplace: () => api.get('/financials/by-marketplace').then(r => r.data),
  byProduct: () => api.get('/financials/by-product').then(r => r.data),
  expenses: () => api.get('/financials/expenses').then(r => r.data),
  cashFlow: () => api.get('/financials/cash-flow').then(r => r.data),
  analyze: () => api.get('/financials/analyze').then(r => r.data),
};

export const healthService = {
  score: () => api.get('/health/score').then(r => r.data),
  breakdown: () => api.get('/health/breakdown').then(r => r.data),
  analyze: () => api.get('/health/analyze').then(r => r.data),
  history: () => api.get('/health/history').then(r => r.data),
};

export const financeGuideService = {
  options: () => api.get('/finance-guide/options').then(r => r.data),
  eligibility: () => api.get('/finance-guide/eligibility').then(r => r.data),
  analyze: () => api.get('/finance-guide/analyze').then(r => r.data),
};

export const sourcingService = {
  suppliers: () => api.get('/sourcing/suppliers').then(r => r.data),
  bestPrice: (name: string) => api.get(`/sourcing/best-price/${encodeURIComponent(name)}`).then(r => r.data),
  opportunities: () => api.get('/sourcing/opportunities').then(r => r.data),
  createAlert: (data: { product_name: string; target_price: number; supplier_name?: string }) =>
    api.post('/sourcing/alerts', data).then(r => r.data),
  listAlerts: () => api.get('/sourcing/alerts').then(r => r.data),
  deleteAlert: (id: string) => api.delete(`/sourcing/alerts/${id}`).then(r => r.data),
};

export const chatService = {
  ask: (message: string) => api.post('/chat/ask', { message }).then(r => r.data),
  history: () => api.get('/chat/history').then(r => r.data),
  clearHistory: () => api.delete('/chat/history').then(r => r.data),
};

export const notificationService = {
  list: () => api.get('/notifications/').then(r => r.data),
  unreadCount: () => api.get('/notifications/unread-count').then(r => r.data),
  markRead: (id: string) => api.put(`/notifications/${id}/read`).then(r => r.data),
  markAllRead: () => api.put('/notifications/read-all').then(r => r.data),
  generate: () => api.post('/notifications/generate').then(r => r.data),
};

export const reportService = {
  generateDaily: () => api.post('/reports/daily').then(r => r.data),
  generateWeekly: () => api.post('/reports/weekly').then(r => r.data),
  list: () => api.get('/reports/list').then(r => r.data),
  getById: (id: string) => api.get(`/reports/${id}`).then(r => r.data),
};

export const storeService = {
  connect: (marketplace: string, api_key = '', store_url = '') =>
    api.post('/store/connect', { marketplace, api_key, store_url }).then(r => r.data),
  connections: () => api.get('/store/connections').then(r => r.data),
  disconnect: (mp: string) => api.delete(`/store/disconnect/${mp}`).then(r => r.data),
  sync: (mp: string) => api.get(`/store/sync/${mp}`).then(r => r.data),
  syncAll: () => api.get('/store/sync-all').then(r => r.data),
};
