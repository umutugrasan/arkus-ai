import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Auth pages (Layout dışı)
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';

// Business pages (Layout içi)
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ReviewsPage from './pages/ReviewsPage';
import CompetitorsPage from './pages/CompetitorsPage';
import ArbitragePage from './pages/ArbitragePage';
import FinancialsPage from './pages/FinancialsPage';
import HealthScorePage from './pages/HealthScorePage';
import FinanceGuidePage from './pages/FinanceGuidePage';
import SourcingPage from './pages/SourcingPage';
import ListingOptimizerPage from './pages/ListingOptimizerPage';
import ImageAnalyzerPage from './pages/ImageAnalyzerPage';
import ChatPage from './pages/ChatPage';
import AgentsPage from './pages/AgentsPage';
import NotificationsPage from './pages/NotificationsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

function AppRoutes() {
  return (
    <Routes>
      {/* Public auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Protected app shell */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Mağaza */}
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="reviews/:id" element={<ReviewsPage />} />

        {/* Analiz */}
        <Route path="competitors" element={<CompetitorsPage />} />
        <Route path="competitors/:id" element={<CompetitorsPage />} />
        <Route path="arbitrage" element={<ArbitragePage />} />
        <Route path="arbitrage/:id" element={<ArbitragePage />} />
        <Route path="financials" element={<FinancialsPage />} />
        <Route path="health" element={<HealthScorePage />} />
        <Route path="finance-guide" element={<FinanceGuidePage />} />

        {/* Optimizasyon */}
        <Route path="sourcing" element={<SourcingPage />} />
        <Route path="listing-optimizer" element={<ListingOptimizerPage />} />
        <Route path="listing-optimizer/:id" element={<ListingOptimizerPage />} />
        <Route path="image-analyzer" element={<ImageAnalyzerPage />} />
        <Route path="image-analyzer/:id" element={<ImageAnalyzerPage />} />

        {/* AI */}
        <Route path="chat" element={<ChatPage />} />
        <Route path="agents" element={<AgentsPage />} />

        {/* Sistem */}
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/:id" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />

        {/* 404 — Layout içinde, sidebar ile birlikte */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
