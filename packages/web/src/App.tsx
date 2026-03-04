import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from '@/components/layout/Shell';
import { LoadingFallback } from '@/components/LoadingFallback';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const FeedbackPage = lazy(() => import('@/pages/FeedbackPage'));
const ThemesPage = lazy(() => import('@/pages/ThemesPage'));
const ProposalsPage = lazy(() => import('@/pages/ProposalsPage'));
const SpecsPage = lazy(() => import('@/pages/SpecsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

export function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/themes" element={<ThemesPage />} />
            <Route path="/proposals" element={<ProposalsPage />} />
            <Route path="/specs" element={<SpecsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </Shell>
    </BrowserRouter>
  );
}
