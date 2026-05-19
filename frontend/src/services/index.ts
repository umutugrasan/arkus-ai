// Backend /api/v1/* endpoint'leriyle %100 hizali servis katmani.
// Tum cagrilar JWT Bearer ile authenticated, axios interceptor 401'de refresh dener.

import api, { BASE_URL } from '../api/client';

import type {
  AiSummaryResponse,
  AnalyzeCurrentResponse,
  ArbitrageDetail,
  ArbitrageOpportunitiesResponse,
  AuthUser,
  BestPriceResponse,
  CashFlowResponse,
  ChatHistoryResponse,
  ChatMessageRecord,
  CompetitorAnalyzeResponse,
  CompetitorTrackResponse,
  CompetitorsResponse,
  ConnectResponse,
  DashboardOverview,
  DescriptionResponse,
  ExpensesResponse,
  FinanceAnalyzeResponse,
  FinanceEligibilityResponse,
  FinanceOptionsResponse,
  FinancialAnalyzeResponse,
  FinancialFullResponse,
  FinancialOverviewResponse,
  HealthAnalyzeResponse,
  HealthBreakdownResponse,
  HealthHistoryResponse,
  HealthScoreResponse,
  ImageAnalyzeResponse,
  ImageHistoryResponse,
  ImageSuggestionsResponse,
  KeywordsResponse,
  ListingHistoryResponse,
  LoginResponse,
  LowStockAlert,
  MarketplaceFinancialRow,
  MarketplaceSummary,
  NotificationItem,
  NotificationsResponse,
  OptimizeResponse,
  PriceAlertsResponse,
  PriceMapResponse,
  ProductDetail,
  ProductFinancialRow,
  ProductImages,
  ProductListItem,
  RealSearchResponse,
  RefreshResponse,
  RegisterResponse,
  ReportItem,
  ReportsListResponse,
  ReviewAnalysis,
  ReviewAnalysisHistory,
  ReviewsListResponse,
  SentimentResponse,
  SourcingOpportunitiesResponse,
  StoreConnectionsResponse,
  SuppliersResponse,
  SyncResponse,
  TrendsResponse,
  UnreadCountResponse,
  UploadImageResponse,
} from '../types/api';

// ===================== AUTH =====================
export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const r = await api.post<LoginResponse>('/auth/login', { email, password });
    return r.data;
  },
  register: async (name: string, email: string, password: string, store_name = ''): Promise<RegisterResponse> => {
    const r = await api.post<RegisterResponse>('/auth/register', { name, email, password, store_name });
    return r.data;
  },
  refresh: async (refresh_token: string): Promise<RefreshResponse> => {
    const r = await api.post<RefreshResponse>('/auth/refresh', { refresh_token });
    return r.data;
  },
  me: async (): Promise<AuthUser> => {
    const r = await api.get<AuthUser>('/auth/me');
    return r.data;
  },
  changePassword: async (current_password: string, new_password: string) => {
    const r = await api.put('/auth/change-password', { current_password, new_password });
    return r.data as { message: string; access_token: string; refresh_token: string; token_type: string };
  },
  updateProfile: async (payload: { name?: string; email?: string; store_name?: string }) => {
    const r = await api.put<{ message: string; user: AuthUser }>('/auth/update-profile', payload);
    return r.data;
  },
  sendVerificationCode: async (email: string) => {
    const r = await api.post<{ message: string }>('/auth/verify-email', { email });
    return r.data;
  },
  confirmVerification: async (email: string, code: string) => {
    const r = await api.post<{ message: string }>('/auth/verify-email/confirm', { email, code });
    return r.data;
  },
  forgotPassword: async (email: string) => {
    const r = await api.post<{ message: string }>('/auth/forgot-password', { email });
    return r.data;
  },
  resetPassword: async (reset_token: string, new_password: string) => {
    const r = await api.post<{ message: string }>('/auth/reset-password', { reset_token, new_password });
    return r.data;
  },
};

// ===================== STORE =====================
export const storeService = {
  connect: async (marketplace: string, api_key = '', store_url = '') => {
    const r = await api.post<ConnectResponse>('/store/connect', { marketplace, api_key, store_url });
    return r.data;
  },
  connections: async (): Promise<StoreConnectionsResponse> => {
    const r = await api.get<StoreConnectionsResponse>('/store/connections');
    return r.data;
  },
  disconnect: async (marketplace: string) => {
    const r = await api.delete<{ message: string }>(`/store/disconnect/${marketplace}`);
    return r.data;
  },
  sync: async (marketplace: string): Promise<SyncResponse> => {
    const r = await api.get<SyncResponse>(`/store/sync/${marketplace}`);
    return r.data;
  },
  syncAll: async (): Promise<SyncResponse> => {
    const r = await api.get<SyncResponse>('/store/sync-all');
    return r.data;
  },
  updateKey: async (marketplace: string, api_key: string) => {
    const r = await api.put<{ message: string; status: string }>(`/store/update-key/${marketplace}`, { api_key });
    return r.data;
  },
};

// ===================== DASHBOARD =====================
export const dashboardService = {
  overview: async (): Promise<DashboardOverview> => {
    const r = await api.get<DashboardOverview>('/dashboard/overview');
    return r.data;
  },
  marketplaceSummary: async (): Promise<{ marketplaces: MarketplaceSummary[] }> => {
    const r = await api.get<{ marketplaces: MarketplaceSummary[] }>('/dashboard/marketplace-summary');
    return r.data;
  },
  trends: async (period: number = 30): Promise<TrendsResponse> => {
    const r = await api.get<TrendsResponse>(`/dashboard/trends?period=${period}`);
    return r.data;
  },
  aiSummary: async (use_web = true): Promise<AiSummaryResponse> => {
    const r = await api.get<AiSummaryResponse>(`/dashboard/ai-summary?use_web=${use_web}`);
    return r.data;
  },
};

// ===================== PRODUCTS =====================
export const productService = {
  list: async (): Promise<{ products: ProductListItem[] }> => {
    const r = await api.get<{ products: ProductListItem[] }>('/products/list');
    return r.data;
  },
  topSellers: async (limit = 10): Promise<{ top_sellers: ProductListItem[] }> => {
    const r = await api.get(`/products/top-sellers?limit=${limit}`);
    return r.data as { top_sellers: ProductListItem[] };
  },
  lowStock: async (threshold_days = 15): Promise<{ low_stock_alerts: LowStockAlert[] }> => {
    const r = await api.get(`/products/low-stock?threshold_days=${threshold_days}`);
    return r.data as { low_stock_alerts: LowStockAlert[] };
  },
  detail: async (id: string): Promise<ProductDetail> => {
    const r = await api.get<ProductDetail>(`/products/${encodeURIComponent(id)}`);
    return r.data;
  },
  compare: async (id: string) => {
    const r = await api.get(`/products/${encodeURIComponent(id)}/compare`);
    return r.data;
  },
  images: async (id: string): Promise<ProductImages> => {
    const r = await api.get<ProductImages>(`/products/${encodeURIComponent(id)}/images`);
    return r.data;
  },
};

// ===================== REVIEWS =====================
export const reviewService = {
  list: async (id: string, opts: { marketplace?: string; month?: string; last_n?: number } = {}): Promise<ReviewsListResponse> => {
    const params = new URLSearchParams();
    if (opts.marketplace) params.set('marketplace', opts.marketplace);
    if (opts.month) params.set('month', opts.month);
    if (opts.last_n) params.set('last_n', String(opts.last_n));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const r = await api.get<ReviewsListResponse>(`/reviews/${encodeURIComponent(id)}${qs}`);
    return r.data;
  },
  sentiment: async (id: string): Promise<SentimentResponse> => {
    const r = await api.get<SentimentResponse>(`/reviews/${encodeURIComponent(id)}/sentiment`);
    return r.data;
  },
  analyze: async (id: string, detail: 'short' | 'detailed' = 'short', refresh = false): Promise<ReviewAnalysis> => {
    const r = await api.get<ReviewAnalysis>(`/reviews/${encodeURIComponent(id)}/analyze?detail=${detail}&refresh=${refresh}`);
    return r.data;
  },
  compare: async (id: string) => {
    const r = await api.get(`/reviews/${encodeURIComponent(id)}/compare`);
    return r.data;
  },
  history: async (id: string): Promise<ReviewAnalysisHistory> => {
    const r = await api.get<ReviewAnalysisHistory>(`/reviews/${encodeURIComponent(id)}/history`);
    return r.data;
  },
  analyzeCustom: async (id: string, body: {
    marketplace?: string; month?: string; last_n?: number;
    date_from?: string; date_to?: string; detail?: 'short' | 'detailed';
  }) => {
    const r = await api.post(`/reviews/${encodeURIComponent(id)}/analyze-custom`, body);
    return r.data;
  },
  // Streaming endpoint URL (frontend bunu fetch ile çağırır)
  analyzeStreamUrl: (id: string, detail: 'short' | 'detailed' = 'short') =>
    `${BASE_URL}/reviews/${encodeURIComponent(id)}/analyze/stream?detail=${detail}`,
};

// ===================== COMPETITORS =====================
export const competitorService = {
  list: async (id: string): Promise<CompetitorsResponse> => {
    const r = await api.get<CompetitorsResponse>(`/competitors/${encodeURIComponent(id)}`);
    return r.data;
  },
  analyze: async (id: string, detail: 'short' | 'detailed' = 'short', use_web = true, signal?: AbortSignal): Promise<CompetitorAnalyzeResponse> => {
    const r = await api.get<CompetitorAnalyzeResponse>(
      `/competitors/${encodeURIComponent(id)}/analyze?detail=${detail}&use_web=${use_web}`,
      { signal }
    );
    return r.data;
  },
  priceMap: async (id: string): Promise<PriceMapResponse> => {
    const r = await api.get<PriceMapResponse>(`/competitors/${encodeURIComponent(id)}/price-map`);
    return r.data;
  },
  track: async (id: string, days = 14): Promise<CompetitorTrackResponse> => {
    const r = await api.get<CompetitorTrackResponse>(`/competitors/${encodeURIComponent(id)}/track?days=${days}`);
    return r.data;
  },
};

// ===================== ARBITRAGE =====================
export const arbitrageService = {
  opportunities: async (): Promise<ArbitrageOpportunitiesResponse> => {
    const r = await api.get<ArbitrageOpportunitiesResponse>('/arbitrage/opportunities');
    return r.data;
  },
  detail: async (id: string): Promise<ArbitrageDetail> => {
    const r = await api.get<ArbitrageDetail>(`/arbitrage/${encodeURIComponent(id)}`);
    return r.data;
  },
  analyze: async (id: string, use_web = true): Promise<ArbitrageDetail> => {
    const r = await api.get<ArbitrageDetail>(`/arbitrage/${encodeURIComponent(id)}/analyze?use_web=${use_web}`);
    return r.data;
  },
};

// ===================== FINANCIALS =====================
export const financialService = {
  full: async (signal?: AbortSignal): Promise<FinancialFullResponse> => {
    const r = await api.get<FinancialFullResponse>('/financials/full', { signal });
    return r.data;
  },
  overview: async (signal?: AbortSignal): Promise<FinancialOverviewResponse> => {
    const r = await api.get<FinancialOverviewResponse>('/financials/overview', { signal });
    return r.data;
  },
  byMarketplace: async (signal?: AbortSignal): Promise<{ marketplaces: MarketplaceFinancialRow[] }> => {
    const r = await api.get<{ marketplaces: MarketplaceFinancialRow[] }>('/financials/by-marketplace', { signal });
    return r.data;
  },
  byProduct: async (signal?: AbortSignal): Promise<{ products: ProductFinancialRow[] }> => {
    const r = await api.get<{ products: ProductFinancialRow[] }>('/financials/by-product', { signal });
    return r.data;
  },
  expenses: async (signal?: AbortSignal): Promise<ExpensesResponse> => {
    const r = await api.get<ExpensesResponse>('/financials/expenses', { signal });
    return r.data;
  },
  cashFlow: async (signal?: AbortSignal): Promise<CashFlowResponse> => {
    const r = await api.get<CashFlowResponse>('/financials/cash-flow', { signal });
    return r.data;
  },
  analyze: async (use_web = true, signal?: AbortSignal): Promise<FinancialAnalyzeResponse> => {
    const r = await api.get<FinancialAnalyzeResponse>(`/financials/analyze?use_web=${use_web}`, { signal });
    return r.data;
  },
};

// ===================== HEALTH SCORE =====================
export const healthScoreService = {
  score: async (): Promise<HealthScoreResponse> => {
    const r = await api.get<HealthScoreResponse>('/health-score/score');
    return r.data;
  },
  breakdown: async (): Promise<HealthBreakdownResponse> => {
    const r = await api.get<HealthBreakdownResponse>('/health-score/breakdown');
    return r.data;
  },
  analyze: async (use_web = true): Promise<HealthAnalyzeResponse> => {
    const r = await api.get<HealthAnalyzeResponse>(`/health-score/analyze?use_web=${use_web}`);
    return r.data;
  },
  history: async (): Promise<HealthHistoryResponse> => {
    const r = await api.get<HealthHistoryResponse>('/health-score/history');
    return r.data;
  },
};

// ===================== FINANCE GUIDE =====================
export const financeGuideService = {
  // useAi=false (varsayilan): aninda sabit liste — sayfa hizli acilir.
  // useAi=true: Gemini Google Search ile guncel krediler (yavas, arka planda cagrilmali).
  options: async (useAi = false): Promise<FinanceOptionsResponse> => {
    const r = await api.get<FinanceOptionsResponse>(`/finance-guide/options?use_ai=${useAi}`);
    return r.data;
  },
  eligibility: async (): Promise<FinanceEligibilityResponse> => {
    const r = await api.get<FinanceEligibilityResponse>('/finance-guide/eligibility');
    return r.data;
  },
  analyze: async (use_web = true): Promise<FinanceAnalyzeResponse> => {
    const r = await api.get<FinanceAnalyzeResponse>(`/finance-guide/analyze?use_web=${use_web}`);
    return r.data;
  },
};

// ===================== SOURCING =====================
export const sourcingService = {
  suppliers: async (opts: { product?: string; has_discount?: boolean } = {}): Promise<SuppliersResponse> => {
    const params = new URLSearchParams();
    if (opts.product) params.set('product', opts.product);
    if (opts.has_discount !== undefined) params.set('has_discount', String(opts.has_discount));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const r = await api.get<SuppliersResponse>(`/sourcing/suppliers${qs}`);
    return r.data;
  },
  bestPrice: async (productName: string): Promise<BestPriceResponse> => {
    const r = await api.get<BestPriceResponse>(`/sourcing/best-price/${encodeURIComponent(productName)}`);
    return r.data;
  },
  opportunities: async (use_web = true): Promise<SourcingOpportunitiesResponse> => {
    const r = await api.get<SourcingOpportunitiesResponse>(`/sourcing/opportunities?use_web=${use_web}`);
    return r.data;
  },
  realSearch: async (query: string): Promise<RealSearchResponse> => {
    const r = await api.get<RealSearchResponse>(`/sourcing/real-search/${encodeURIComponent(query)}`);
    return r.data;
  },
  createAlert: async (body: { product_name: string; target_price: number; supplier_name?: string }) => {
    const r = await api.post<{ message: string; alert: import('../types/api').PriceAlert }>('/sourcing/alerts', body);
    return r.data;
  },
  listAlerts: async (status?: string): Promise<PriceAlertsResponse> => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const r = await api.get<PriceAlertsResponse>(`/sourcing/alerts${qs}`);
    return r.data;
  },
  deleteAlert: async (id: number) => {
    const r = await api.delete(`/sourcing/alerts/${id}`);
    return r.data as { message: string; id: number };
  },
};

// ===================== CHAT =====================
export const chatService = {
  ask: async (message: string): Promise<ChatMessageRecord> => {
    const r = await api.post<ChatMessageRecord>('/chat/ask', { message });
    return r.data;
  },
  history: async (limit = 50): Promise<ChatHistoryResponse> => {
    const r = await api.get<ChatHistoryResponse>(`/chat/history?limit=${limit}`);
    return r.data;
  },
  clearHistory: async () => {
    const r = await api.delete<{ message: string; deleted_count: number }>('/chat/history');
    return r.data;
  },
  askStreamUrl: () => `${BASE_URL}/chat/ask/stream`,

};

// ===================== NOTIFICATIONS =====================
export const notificationService = {
  list: async (opts: { unread_only?: boolean; type?: string; severity?: string; limit?: number } = {}): Promise<NotificationsResponse> => {
    const params = new URLSearchParams();
    if (opts.unread_only) params.set('unread_only', 'true');
    if (opts.type) params.set('type', opts.type);
    if (opts.severity) params.set('severity', opts.severity);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const r = await api.get<NotificationsResponse>(`/notifications/${qs}`);
    return r.data;
  },
  unreadCount: async (): Promise<UnreadCountResponse> => {
    const r = await api.get<UnreadCountResponse>('/notifications/unread-count');
    return r.data;
  },
  markRead: async (id: number) => {
    const r = await api.put(`/notifications/${id}/read`);
    return r.data as { message: string; id: number };
  },
  markAllRead: async () => {
    const r = await api.put('/notifications/read-all');
    return r.data as { message: string; updated_count: number };
  },
  generate: async () => {
    const r = await api.post<{
      message: string;
      new_count: number;
      new_notifications: NotificationItem[];
    }>('/notifications/generate');
    return r.data;
  },
  generateDrafts: async () => {
    const r = await api.post<{
      message: string;
      new_count: number;
      new_notifications: NotificationItem[];
      review_drafts_created: number;
    }>('/notifications/generate-drafts');
    return r.data;
  },
};

// ===================== REPORTS =====================
export const reportService = {
  generateDaily: async (use_web = true): Promise<ReportItem> => {
    const r = await api.post<ReportItem>(`/reports/daily?use_web=${use_web}`);
    return r.data;
  },
  generateWeekly: async (use_web = true): Promise<ReportItem> => {
    const r = await api.post<ReportItem>(`/reports/weekly?use_web=${use_web}`);
    return r.data;
  },
  list: async (type?: 'daily' | 'weekly', limit = 50): Promise<ReportsListResponse> => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    params.set('limit', String(limit));
    const r = await api.get<ReportsListResponse>(`/reports/list?${params.toString()}`);
    return r.data;
  },
  byId: async (id: number): Promise<ReportItem> => {
    const r = await api.get<ReportItem>(`/reports/${id}`);
    return r.data;
  },
  delete: async (id: number) => {
    const r = await api.delete<{ message: string; id: number }>(`/reports/${id}`);
    return r.data;
  },
  generateDailyStreamUrl: () => `${BASE_URL}/reports/daily/stream`,
  generateWeeklyStreamUrl: () => `${BASE_URL}/reports/weekly/stream`,
};

// ===================== LISTING OPTIMIZER =====================
export const listingOptimizerService = {
  optimize: async (id: string, target_marketplace?: string, use_web = true): Promise<OptimizeResponse> => {
    const r = await api.post<OptimizeResponse>(
      `/listing-optimizer/${encodeURIComponent(id)}/optimize?use_web=${use_web}`,
      target_marketplace ? { target_marketplace } : {},
    );
    return r.data;
  },
  keywords: async (id: string, use_web = true): Promise<KeywordsResponse> => {
    const r = await api.post<KeywordsResponse>(
      `/listing-optimizer/${encodeURIComponent(id)}/keywords?use_web=${use_web}`,
    );
    return r.data;
  },
  description: async (id: string, use_web = true): Promise<DescriptionResponse> => {
    const r = await api.post<DescriptionResponse>(
      `/listing-optimizer/${encodeURIComponent(id)}/description?use_web=${use_web}`,
    );
    return r.data;
  },
  history: async (id: string): Promise<ListingHistoryResponse> => {
    const r = await api.get<ListingHistoryResponse>(`/listing-optimizer/${encodeURIComponent(id)}/history`);
    return r.data;
  },
  // Gecmisteki tek bir optimizasyon kaydini detayli getirir (AI cagrisi yapmaz).
  getOptimization: async (id: string, optId: number): Promise<OptimizeResponse> => {
    const r = await api.get<OptimizeResponse>(
      `/listing-optimizer/${encodeURIComponent(id)}/optimization/${optId}`,
    );
    return r.data;
  },
  analyzeCurrent: async (id: string, target_marketplace?: string): Promise<AnalyzeCurrentResponse> => {
    const qs = target_marketplace ? `?target_marketplace=${encodeURIComponent(target_marketplace)}` : '';
    const r = await api.get<AnalyzeCurrentResponse>(
      `/listing-optimizer/${encodeURIComponent(id)}/analyze-current${qs}`,
    );
    return r.data;
  },
};

// ===================== IMAGE ANALYZER =====================
export const imageAnalyzerService = {
  analyze: async (id: string, image_url?: string): Promise<ImageAnalyzeResponse> => {
    const r = await api.post<ImageAnalyzeResponse>(
      `/image-analyzer/${encodeURIComponent(id)}/analyze`,
      image_url ? { image_url } : {},
    );
    return r.data;
  },
  suggestions: async (id: string, image_url?: string): Promise<ImageSuggestionsResponse> => {
    const r = await api.post<ImageSuggestionsResponse>(
      `/image-analyzer/${encodeURIComponent(id)}/suggestions`,
      image_url ? { image_url } : {},
    );
    return r.data;
  },
  history: async (id: string): Promise<ImageHistoryResponse> => {
    const r = await api.get<ImageHistoryResponse>(`/image-analyzer/${encodeURIComponent(id)}/history`);
    return r.data;
  },
};

// ===================== UPLOADS =====================
export const uploadService = {
  image: async (file: File): Promise<UploadImageResponse> => {
    const fd = new FormData();
    fd.append('file', file);
    const r = await api.post<UploadImageResponse>('/uploads/image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
  },
};

