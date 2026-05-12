// Backend response şemalarının TypeScript tipleri.
// /api/v1/* endpoint'leriyle %100 uyumlu.

// ============ Auth ============
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  store_name: string;
  email_verified: boolean;
  created_at: string;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface LoginResponse {
  message: string;
  user: AuthUser;
}

export interface RegisterResponse {
  message: string;
  user: AuthUser;
  demo_verification_code: string | null;
}

export interface RefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// ============ Dashboard ============
export interface OverallMetrics {
  total_revenue: number;
  total_cost: number;
  total_commission: number;
  total_shipping: number;
  total_ad_spend: number;
  total_sales: number;
  total_returns: number;
  total_gross_profit: number;
  total_net_profit: number;
  total_net_after_ads: number;
  overall_gross_margin: number;
  overall_net_margin: number;
  overall_return_rate: number;
  overall_roas: number;
}

export interface MarketplaceBreakdownItem {
  total_revenue: number;
  total_net_profit: number;
  net_margin_pct: number;
  total_sales: number;
}

export interface DashboardOverview {
  overall: OverallMetrics;
  marketplace_count: number;
  by_marketplace: Record<string, MarketplaceBreakdownItem>;
}

export interface MarketplaceSummary {
  marketplace: string;
  store_name: string;
  store_rating: number;
  commission_rate: number;
  total_revenue: number;
  total_net_profit: number;
  net_margin_pct: number;
  total_sales: number;
  return_rate: number;
  ad_spend: number;
  roas: number;
  product_count: number;
}

export interface DailyTrendPoint {
  date: string;
  revenue: number;
  sales: number;
  returns: number;
}

export interface WeeklyTrendPoint {
  week: string;
  revenue: number;
  sales: number;
  returns: number;
}

export interface TrendsResponse {
  period: string;
  daily?: DailyTrendPoint[];
  weekly?: WeeklyTrendPoint[];
}

export interface AiSummaryResponse {
  summary: string;
  web_sources: Array<{ title: string; uri: string }>;
  used_web_search: boolean;
  snapshot: {
    total_revenue_30d: number;
    net_profit_30d: number;
    net_margin_pct: number;
    sales_7d: number;
    revenue_7d: number;
    low_stock_count: number;
    low_rated_count: number;
  };
  generated_at: string;
}

// ============ Products ============
export interface ProductListItem {
  id: string;
  name: string;
  category: string;
  marketplace_count: number;
  total_sales: number;
  total_revenue: number;
  total_net_profit: number;
  avg_profit_per_item: number;
  total_stock: number;
  rating: number;
  review_count: number;
}

export interface ProductListing {
  marketplace: string;
  price: number;
  cost: number;
  stock: number;
  sales_30d: number;
  shipping_cost: number;
  rating: number;
  review_count: number;
  return_rate: number;
  commission_rate: number;
  days_until_stockout: number;
  revenue: number;
  total_cost: number;
  commission_amount: number;
  total_shipping: number;
  gross_profit: number;
  net_profit: number;
  gross_margin_pct: number;
  net_margin_pct: number;
  profit_per_item: number;
}

export interface ProductDetail {
  id: string;
  name: string;
  category: string;
  listings: ProductListing[];
  total_sales: number;
  total_revenue: number;
  total_net_profit: number;
  total_stock: number;
  avg_profit_per_item: number;
}

export interface LowStockAlert {
  product_id: string;
  product_name: string;
  marketplace: string;
  stock: number;
  daily_sales: number;
  days_until_stockout: number;
  urgency: 'kritik' | 'uyari';
}

export interface ProductImages {
  product_id: string;
  product_name: string;
  images_by_marketplace: Array<{
    marketplace: string;
    primary_image: string;
    gallery: string[];
  }>;
}

// ============ Reviews ============
export interface Review {
  marketplace: string;
  rating: number;
  text: string;
  date: string;
}

export interface ReviewsListResponse {
  product_id: string;
  marketplace: string;
  month: string | null;
  last_n: number | null;
  total: number;
  reviews: Review[];
}

export interface SentimentByMarketplace {
  count: number;
  total_rating: number;
  positive: number;
  negative: number;
  avg_rating: number;
}

export interface SentimentResponse {
  product_id: string;
  total_reviews: number;
  avg_rating: number;
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
    positive_pct: number;
    negative_pct: number;
    neutral_pct: number;
  };
  by_marketplace: Record<string, SentimentByMarketplace>;
}

export interface ReviewAnalysis {
  product_id: string;
  detail: 'short' | 'detailed';
  cached: boolean;
  total_reviews?: number;
  ai_analysis: string;
  created_at: string;
  warning?: string;
}

export interface ReviewAnalysisHistory {
  product_id: string;
  total: number;
  analyses: Array<{
    id: number;
    analysis_type: string;
    filters: Record<string, unknown>;
    content: string;
    created_at: string;
  }>;
}

// ============ Competitors ============
export interface CompetitorRow {
  marketplace: string;
  our_price: number;
  our_rating: number;
  our_sales: number;
  competitor_name: string;
  competitor_price: number;
  competitor_rating: number;
  competitor_sales: number;
  competitor_review_count: number;
  price_diff: number;
  price_diff_pct: number;
  we_are: 'pahali' | 'ucuz' | 'esit';
  last_updated: string | null;
}

export interface CompetitorsResponse {
  product_id: string;
  total: number;
  competitors: CompetitorRow[];
}

export interface CompetitorAnalyzeResponse extends CompetitorsResponse {
  product_name?: string;
  detail: 'short' | 'detailed';
  ai_analysis: string;
  web_sources: Array<{ title: string; uri: string }>;
  used_web_search: boolean;
}

export interface PriceMapEntry {
  our_price: number;
  min_competitor_price: number;
  max_competitor_price: number;
  avg_competitor_price: number;
  position: 'en ucuz' | 'orta' | 'en pahali';
  competitors: Array<{
    name: string;
    price: number;
    rating: number;
    sales_30d: number;
    diff: number;
    diff_pct: number;
  }>;
}

export interface PriceMapResponse {
  product_id: string;
  price_map: Record<string, PriceMapEntry>;
}

export interface CompetitorTrackHistory {
  competitor: string;
  marketplace: string;
  current_price: number;
  min_in_period: number;
  max_in_period: number;
  change_in_period: number;
  change_pct: number;
  trend: 'yukselis' | 'dusus' | 'sabit';
  snapshot_count: number;
  timeline: Array<{ date: string; price: number }>;
}

export interface CompetitorTrackResponse {
  product_id: string;
  period_days: number;
  tracked_count: number;
  histories: CompetitorTrackHistory[];
  message?: string;
}

// ============ Arbitrage ============
export interface ArbitrageListing {
  marketplace: string;
  price: number;
  cost: number;
  commission_rate: number;
  commission_amount: number;
  shipping: number;
  net_per_item: number;
  net_margin_pct: number;
  sales_30d: number;
  monthly_net_profit: number;
}

export interface ArbitrageDetail {
  product_id: string;
  product_name?: string;
  category?: string;
  listings: ArbitrageListing[];
  best_marketplace: string;
  worst_marketplace: string;
  profit_gap_per_item: number;
  monthly_opportunity: number;
  ai_analysis?: string;
  web_sources?: Array<{ title: string; uri: string }>;
  used_web_search?: boolean;
}

export interface ArbitrageOpportunitiesResponse {
  summary: {
    total_opportunities: number;
    total_monthly_potential: number;
    biggest_gap_product: string | null;
  };
  opportunities: ArbitrageDetail[];
}

// ============ Financials ============
export interface MonthlyHistoryPoint {
  month: string;
  revenue: number;
  profit: number;
  margin_pct: number;
  roas: number;
  ad_spend: number;
}

export interface FinancialOverviewResponse {
  overall: OverallMetrics;
  monthly_history: MonthlyHistoryPoint[];
}

export interface MarketplaceFinancialRow {
  marketplace: string;
  revenue: number;
  cost: number;
  commission: number;
  shipping: number;
  ad_spend: number;
  gross_profit: number;
  net_profit: number;
  net_after_ads: number;
  net_margin_pct: number;
  roas: number;
  sales: number;
}

export interface ProductFinancialRow {
  id: string;
  name: string;
  total_revenue: number;
  total_cost: number;
  total_commission: number;
  total_shipping: number;
  total_net_profit: number;
  total_sales: number;
  net_margin_pct: number;
  profit_per_item: number;
}

export interface ExpenseBreakdownItem {
  amount: number;
  pct: number;
}

export interface ExpensesResponse {
  total_expense: number;
  breakdown: Record<string, ExpenseBreakdownItem>;
}

export interface CashFlowResponse {
  current_balance: number;
  monthly_revenue: number;
  monthly_net_profit: number;
  pending_receivables: number;
  upcoming_expenses: number;
  runway_months: number | null;
  health: 'iyi' | 'dikkat' | 'kritik';
  monthly_history: Array<{ month: string; profit: number; revenue: number }>;
}

export interface FinancialAnalyzeResponse {
  overall: OverallMetrics;
  by_marketplace: Record<string, unknown>;
  monthly_history: MonthlyHistoryPoint[];
  ai_analysis: string;
  web_sources: Array<{ title: string; uri: string }>;
  used_web_search: boolean;
}

// ============ Health Score ============
export interface HealthScoreResponse {
  total_score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  label: string;
  scores: Record<string, number>;
  metrics: {
    avg_rating: number;
    return_rate: number;
    net_margin: number;
    marketplace_count: number;
    unique_products: number;
    monthly_net_profit: number;
    total_revenue_30d: number;
  };
}

export interface HealthBreakdownItem {
  category: string;
  score: number;
  max_score: number;
  percentage: number;
}

export interface HealthBreakdownResponse {
  total_score: number;
  breakdown: HealthBreakdownItem[];
  metrics: HealthScoreResponse['metrics'];
}

export interface HealthAnalyzeResponse {
  total_score: number;
  scores: Record<string, number>;
  ai_analysis: string;
  web_sources: Array<{ title: string; uri: string }>;
  used_web_search: boolean;
}

export interface HealthHistoryPoint {
  month: string;
  score: number;
  revenue: number | null;
  profit: number | null;
  margin_pct: number | null;
}

export interface HealthHistoryResponse {
  history: HealthHistoryPoint[];
  current_score: number;
}

// ============ Finance Guide ============
export interface FinanceOption {
  name: string;
  provider: string;
  max_amount: string;
  interest: string;
  term: string;
  requirements: string;
  min_score: number;
  min_monthly_revenue: number;
  eligible: boolean;
  reasons?: string[];
  url?: string;
  is_recommended?: boolean;
  recommendation_reason?: string;
}

export interface SellerProfile {
  eligibility_score: number;
  monthly_revenue: number;
  monthly_net_profit: number;
  net_margin_pct: number;
  cash_balance: number;
  positive_months: number;
  total_history_months: number;
  marketplace_count: number;
}

export interface FinanceOptionsResponse {
  seller_profile: SellerProfile;
  eligible_options: FinanceOption[];
  not_eligible_options: FinanceOption[];
  total_options: number;
}

export interface FinanceEligibilityResponse {
  profile: SellerProfile;
  status: 'guclu' | 'orta' | 'zayif';
  message: string;
  eligible_options_count: number;
  total_options: number;
}

export interface FinanceAnalyzeResponse {
  profile: SellerProfile;
  eligible_options: FinanceOption[];
  ai_analysis: string;
  web_sources: Array<{ title: string; uri: string }>;
  used_web_search: boolean;
}

// ============ Sourcing ============
export interface Supplier {
  id: number;
  name: string;
  product: string;
  current_price: number;
  min_order: number;
  shipping_days: number;
  discount_pct: number;
  discounted_price: number;
  has_discount: boolean;
  last_checked_at: string | null;
  url?: string;
}

export interface SuppliersResponse {
  total: number;
  suppliers: Supplier[];
}

export interface BestPriceResponse {
  product: string;
  best_supplier: Supplier;
  avg_price: number;
  savings_vs_avg: number;
  all_suppliers: Supplier[];
}

export interface SourcingOpportunitiesResponse {
  cash_balance: number;
  monthly_net_profit: number;
  discount_count: number;
  db_suppliers: Supplier[];
  ai_analysis: string;
  web_sources: Array<{ title: string; uri: string }>;
  used_web_search: boolean;
}

export interface RealSearchResponse {
  query: string;
  db_matches_count: number;
  db_lowest_price: number | null;
  ai_analysis: string;
  web_sources: Array<{ title: string; uri: string }>;
  used_web_search: boolean;
}

export interface PriceAlert {
  id: number;
  product_name: string;
  target_price: number;
  supplier: string | null;
  status: 'active' | 'triggered' | 'cancelled';
  created_at: string;
}

export interface PriceAlertsResponse {
  total: number;
  alerts: PriceAlert[];
}

// ============ Chat ============
export interface ChatMessageRecord {
  id: number;
  question: string;
  answer: string;
  created_at: string;
}

export interface ChatHistoryResponse {
  total: number;
  history: ChatMessageRecord[];
}

// ============ Notifications ============
export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  total: number;
  notifications: NotificationItem[];
}

export interface UnreadCountResponse {
  unread_count: number;
}

// ============ Reports ============
export interface ReportItem {
  id: number;
  type: 'daily' | 'weekly';
  title: string;
  content: string;
  metrics: Record<string, unknown> & {
    revenue: number;
    profit: number;
    net_profit: number;
    sales: number;
  };
  metrics_json?: Record<string, unknown>;
  revenue: number;
  net_profit: number;
  profit: number;
  sales: number;
  created_at: string;
}

export interface ReportsListResponse {
  total: number;
  reports: Array<Omit<ReportItem, 'content'> & { preview: string }>;
}

// ============ Listing Optimizer ============
export interface TitleAnalysis {
  length: number;
  word_count: number;
  in_hard_limit: boolean;
  in_ideal_range: boolean;
  marketplace_rules: Record<string, unknown>;
  seo_score: number;
  has_emoji: boolean;
  has_capslock_words: boolean;
  banned_hits: string[];
  keyword_in_first_30_chars: boolean;
  keyword_density: Record<string, { count: number; density_pct: number }>;
  warnings: string[];
}

export interface OptimizeResponse {
  id: number;
  product_id: string;
  target_marketplace: string;
  comparison: {
    original: { title: string; analysis: TitleAnalysis };
    optimized: { title: string; analysis: TitleAnalysis };
    seo_score_delta: number;
    diff: {
      original_length: number;
      optimized_length: number;
      length_delta: number;
      added_words: string[];
      removed_words: string[];
    };
  };
  keywords: string[];
  description: string;
  description_length: number;
  description_ok: boolean;
  improvements: string[];
  expected_impact: string;
  primary_keyword: string | null;
  web_sources: Array<{ title: string; uri: string }>;
  used_web_search: boolean;
  marketplace_rules: Record<string, unknown>;
  ready_to_apply: boolean;
  publish_note: string;
  raw_ai_output: string | null;
  created_at: string;
}

export interface KeywordsResponse {
  id: number;
  product_id: string;
  product_name: string;
  marketplace: string;
  keywords_breakdown: {
    primary_keywords?: string[];
    long_tail_keywords?: string[];
    trending_keywords?: string[];
    seasonal_keywords?: string[];
    negative_keywords?: string[];
    search_intent_groups?: Record<string, string[]>;
    estimated_difficulty?: Record<string, string>;
    strategy_note?: string;
  };
  all_keywords: string[];
  total_keyword_count: number;
  web_sources: Array<{ title: string; uri: string }>;
  used_web_search: boolean;
  raw_ai_output: string | null;
  created_at: string;
}

export interface DescriptionResponse {
  id: number;
  product_id: string;
  product_name: string;
  marketplace: string;
  description: string;
  char_count: number;
  word_count: number;
  within_marketplace_limit: boolean;
  marketplace_limits: { min: number; max: number };
  web_sources: Array<{ title: string; uri: string }>;
  used_web_search: boolean;
  created_at: string;
}

export interface ListingHistoryResponse {
  product_id: string;
  product_name: string;
  marketplace: string;
  total: number;
  best_seo_score: number | null;
  optimizations: Array<{
    id: number;
    original_title: string;
    optimized_title: string;
    seo_score: number | null;
    warnings_count: number | null;
    keywords: string[] | null;
    has_description: boolean;
    description_preview: string;
    created_at: string;
  }>;
}

export interface AnalyzeCurrentResponse {
  product_id: string;
  current_title: string;
  target_marketplace: string;
  analysis: TitleAnalysis;
  recommendation: string;
}

// ============ Image Analyzer ============
export interface ImageAnalyzeResponse {
  id: number;
  product_id: string;
  product_name: string;
  marketplace: string;
  image_url: string;
  overall_score: number;
  scores_breakdown: Record<string, number> | null;
  detected_issues: string[];
  positive_aspects: string[];
  object_detection: Record<string, unknown>;
  marketplace_compliance: Record<string, unknown>;
  marketplace_rules: Record<string, unknown>;
  vision_model: string | null;
  raw_ai_output: string | null;
  created_at: string;
}

export interface ImageSuggestionsResponse {
  id: number;
  product_id: string;
  product_name: string;
  marketplace: string;
  image_url: string;
  priority_actions: Array<{
    action: string;
    reason: string;
    expected_impact: string;
    difficulty: 'kolay' | 'orta' | 'zor';
  }>;
  additional_shots_needed: string[];
  competitor_comparison_note: string;
  tools_to_use: string[];
  estimated_score_after_fixes: number | null;
  vision_model: string | null;
  raw_ai_output: string | null;
  created_at: string;
}

export interface ImageHistoryResponse {
  product_id: string;
  product_name: string;
  total: number;
  best_score: number | null;
  analyses: Array<{
    id: number;
    image_url: string;
    score: number;
    suggestions: string;
    created_at: string;
  }>;
}

export interface UploadImageResponse {
  filename: string;
  size_bytes: number;
  content_type: string;
  data_uri: string;
  uploaded_at: string;
}

// ============ Store ============
export interface StoreConnection {
  marketplace: string;
  store_name: string;
  store_rating: number;
  status: 'connected' | 'disconnected' | 'error';
  connected_at: string | null;
  store_url: string | null;
  product_count: number;
}

export interface StoreConnectionsResponse {
  connections: StoreConnection[];
}

export interface ConnectResponse {
  message: string;
  store: {
    marketplace: string;
    store_name: string;
    status: string;
    connected_at: string;
    product_count: number;
  };
}

export interface SyncResponse {
  message: string;
  marketplace?: string;
  product_count?: number;
  synced_at: string;
  results?: Record<string, { store_name: string; product_count: number }>;
}

// ============ Agents ============
export interface AgentStatus {
  name: string;
  last_run: string | null;
}

export interface AgentStatusResponse {
  agents: AgentStatus[];
  total_agents: number;
}

export interface AgentResult {
  agent: string;
  status: 'ok' | 'partial' | 'error';
  items_processed: number;
  notifications_created: number;
  events_emitted: string[];
  details: Record<string, unknown>;
  error: string | null;
  finished_at: string;
}

export interface RunAllAgentsResponse {
  user_id: number;
  ran_at: string;
  agents_run: number;
  total_events_emitted: number;
  results: AgentResult[];
}

// ============ Common ============
export interface ApiError {
  detail: string;
}
