import { MessageSquare, Brain, Lightbulb, FileText } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { PageContainer } from '@/components/layout/PageContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { TopThemesChart } from '@/components/dashboard/TopThemesChart';
import { SentimentGauge } from '@/components/dashboard/SentimentGauge';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState';
import { OnboardingSteps } from '@/components/dashboard/OnboardingSteps';
import {
  useDashboardStats,
  useActivityFeed,
  useTopThemes,
  useSentimentDistribution,
} from '@/hooks/useDashboard';

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: activity, isLoading: activityLoading } = useActivityFeed();
  const { data: topThemes, isLoading: themesLoading } = useTopThemes();
  const { data: sentiment, isLoading: sentimentLoading } = useSentimentDistribution();

  const hasData =
    stats &&
    (stats.feedback.total > 0 ||
      stats.themes.total > 0 ||
      stats.proposals.total > 0 ||
      stats.specs.total > 0);

  const allStepsComplete =
    stats &&
    stats.feedback.total > 0 &&
    stats.themes.total > 0 &&
    stats.proposals.total > 0 &&
    stats.specs.total > 0;

  return (
    <>
      <Topbar title="Dashboard" />
      <PageContainer>
        {statsLoading ? (
          <DashboardSkeleton />
        ) : stats && !hasData ? (
          <DashboardEmptyState stats={stats} />
        ) : (
          <div className="space-y-6">
            {/* Stat Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Feedback"
                icon={<MessageSquare size={18} />}
                value={stats?.feedback.total ?? 0}
                trendPercent={stats?.feedback.trendPercent ?? 0}
                trendDirection={stats?.feedback.trendDirection ?? 'flat'}
              />
              <StatCard
                label="Themes Discovered"
                icon={<Brain size={18} />}
                value={stats?.themes.total ?? 0}
                trendPercent={stats?.themes.trendPercent ?? 0}
                trendDirection={stats?.themes.trendDirection ?? 'flat'}
              />
              <StatCard
                label="Proposals Generated"
                icon={<Lightbulb size={18} />}
                value={stats?.proposals.total ?? 0}
                trendPercent={stats?.proposals.trendPercent ?? 0}
                trendDirection={stats?.proposals.trendDirection ?? 'flat'}
              />
              <StatCard
                label="Specs Created"
                icon={<FileText size={18} />}
                value={stats?.specs.total ?? 0}
                trendPercent={stats?.specs.trendPercent ?? 0}
                trendDirection={stats?.specs.trendDirection ?? 'flat'}
              />
            </div>

            {/* Middle Row: Activity + Top Themes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-bg-surface border border-border rounded-xl p-5">
                <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
                  Recent Activity
                </h3>
                {activityLoading ? (
                  <ActivitySkeleton />
                ) : (
                  <ActivityFeed activities={activity ?? []} />
                )}
              </div>
              <div className="bg-bg-surface border border-border rounded-xl p-5">
                <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
                  Top Themes
                </h3>
                {themesLoading ? <ChartSkeleton /> : <TopThemesChart themes={topThemes ?? []} />}
              </div>
            </div>

            {/* Bottom Row: Sentiment + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-bg-surface border border-border rounded-xl p-5">
                <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
                  Sentiment Distribution
                </h3>
                {sentimentLoading ? (
                  <ChartSkeleton />
                ) : sentiment ? (
                  <SentimentGauge data={sentiment} />
                ) : null}
              </div>
              <div className="bg-bg-surface border border-border rounded-xl p-5">
                <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">
                  Quick Actions
                </h3>
                <QuickActions />
              </div>
            </div>

            {/* Onboarding banner when some steps incomplete */}
            {!allStepsComplete && stats && (
              <div className="bg-bg-surface border border-border rounded-xl p-5">
                <OnboardingSteps
                  feedbackCount={stats.feedback.total}
                  themeCount={stats.themes.total}
                  proposalCount={stats.proposals.total}
                  specCount={stats.specs.total}
                />
              </div>
            )}
          </div>
        )}
      </PageContainer>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="h-3 flex-1 rounded" />
          <Skeleton className="h-3 w-12 rounded" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i}>
          <Skeleton className="h-3 w-32 rounded mb-2" />
          <div style={{ width: `${100 - i * 15}%` }}>
            <Skeleton className="h-2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
