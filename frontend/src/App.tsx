import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { I18nProvider } from './context/I18nContext';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoadingSpinner from './components/shared/LoadingSpinner';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'));
const CompetitorsPage = lazy(() => import('./pages/CompetitorsPage'));
const ArbitragePage = lazy(() => import('./pages/ArbitragePage'));
const FinancialsPage = lazy(() => import('./pages/FinancialsPage'));
const HealthScorePage = lazy(() => import('./pages/HealthScorePage'));
const FinanceGuidePage = lazy(() => import('./pages/FinanceGuidePage'));
const SourcingPage = lazy(() => import('./pages/SourcingPage'));
const ListingOptimizerPage = lazy(() => import('./pages/ListingOptimizerPage'));
const ImageAnalyzerPage = lazy(() => import('./pages/ImageAnalyzerPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const routeFallback = (
  <div className="min-h-screen bg-[#f9f8f4] flex items-center justify-center">
    <LoadingSpinner message="Sayfa yukleniyor..." size="lg" />
  </div>
);

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes — full-screen fallback OK here */}
      <Route path="/login" element={<Suspense fallback={routeFallback}><LoginPage /></Suspense>} />
      <Route path="/register" element={<Suspense fallback={routeFallback}><RegisterPage /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={routeFallback}><ForgotPasswordPage /></Suspense>} />
      <Route path="/" element={<Suspense fallback={routeFallback}><LandingPage /></Suspense>} />

      {/* Protected routes — Suspense is inside Layout (sidebar stays visible) */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />

        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="reviews/:id" element={<ReviewsPage />} />

        <Route path="competitors" element={<CompetitorsPage />} />
        <Route path="competitors/:id" element={<CompetitorsPage />} />
        <Route path="arbitrage" element={<ArbitragePage />} />
        <Route path="arbitrage/:id" element={<ArbitragePage />} />
        <Route path="financials" element={<FinancialsPage />} />
        <Route path="health" element={<HealthScorePage />} />
        <Route path="finance-guide" element={<FinanceGuidePage />} />

        <Route path="sourcing" element={<SourcingPage />} />
        <Route path="listing-optimizer" element={<ListingOptimizerPage />} />
        <Route path="listing-optimizer/:id" element={<ListingOptimizerPage />} />
        <Route path="image-analyzer" element={<ImageAnalyzerPage />} />
        <Route path="image-analyzer/:id" element={<ImageAnalyzerPage />} />

        <Route path="chat" element={<ChatPage />} />

        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/:id" element={<ReportsPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="settings" element={<SettingsPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
