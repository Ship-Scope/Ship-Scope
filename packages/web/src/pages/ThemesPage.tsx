import { Brain } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/ui/EmptyState';

export function ThemesPage() {
  return (
    <>
      <Topbar title="Themes" />
      <PageContainer>
        <EmptyState
          icon={Brain}
          title="No themes yet"
          description="Import feedback and run synthesis to discover themes."
        />
      </PageContainer>
    </>
  );
}
