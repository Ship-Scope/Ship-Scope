import { Lightbulb } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/ui/EmptyState';

export function ProposalsPage() {
  return (
    <>
      <Topbar title="Proposals" />
      <PageContainer>
        <EmptyState
          icon={Lightbulb}
          title="No proposals yet"
          description="Discover themes first, then generate feature proposals."
        />
      </PageContainer>
    </>
  );
}
