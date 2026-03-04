import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from '@/components/layout/Shell';
import { DashboardPage } from '@/pages/DashboardPage';
import { FeedbackPage } from '@/pages/FeedbackPage';
import { ThemesPage } from '@/pages/ThemesPage';
import { ProposalsPage } from '@/pages/ProposalsPage';
import { SpecsPage } from '@/pages/SpecsPage';
import { SettingsPage } from '@/pages/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/themes" element={<ThemesPage />} />
          <Route path="/proposals" element={<ProposalsPage />} />
          <Route path="/specs" element={<SpecsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
