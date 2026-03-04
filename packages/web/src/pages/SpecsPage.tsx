import { FileText } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/ui/EmptyState';

export function SpecsPage() {
  return (
    <>
      <Topbar title="Specs" />
      <PageContainer>
        <EmptyState
          icon={FileText}
          title="No specs yet"
          description="Approve proposals to generate PRDs and agent prompts."
        />
      </PageContainer>
    </>
  );
}
