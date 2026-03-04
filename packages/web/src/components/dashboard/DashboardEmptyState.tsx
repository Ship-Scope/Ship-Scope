import { Compass, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OnboardingSteps } from './OnboardingSteps';
import type { DashboardStats } from '@/lib/api';

interface DashboardEmptyStateProps {
  stats: DashboardStats;
}

export function DashboardEmptyState({ stats }: DashboardEmptyStateProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center py-12 px-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center mb-5">
        <Compass size={28} className="text-white" />
      </div>
      <h2 className="text-2xl font-semibold text-text-primary mb-2">Welcome to ShipScope</h2>
      <p className="text-sm text-text-secondary max-w-md text-center mb-10 leading-relaxed">
        Transform customer feedback into actionable product intelligence. Follow the steps below to
        get started.
      </p>

      <div className="w-full max-w-lg bg-bg-surface border border-border rounded-xl p-6">
        <OnboardingSteps
          feedbackCount={stats.feedback.total}
          themeCount={stats.themes.total}
          proposalCount={stats.proposals.total}
          specCount={stats.specs.total}
        />
      </div>

      <div className="w-full max-w-lg mt-4 bg-bg-surface-2 border border-border rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings size={16} className="text-warning flex-shrink-0" />
          <p className="text-sm text-text-secondary">
            <span className="text-text-primary font-medium">Tip:</span> Configure your OpenAI API
            key in Settings before running synthesis.
          </p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="flex-shrink-0 text-xs font-medium text-accent-blue hover:text-accent-blue/80 transition-colors ml-4"
        >
          Go to Settings
        </button>
      </div>
    </div>
  );
}
