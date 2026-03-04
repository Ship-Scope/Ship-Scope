import { BarChart3 } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/ui/EmptyState';

export function DashboardPage() {
  return (
    <>
      <Topbar title="Dashboard" />
      <PageContainer>
        <EmptyState
          icon={BarChart3}
          title="No data yet"
          description="Import feedback to see your dashboard come to life."
        />
      </PageContainer>
    </>
  );
}
