import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/ui/EmptyState';
import { SpecCard } from '@/components/specs/SpecCard';
import { SpecDetail } from '@/components/specs/SpecDetail';
import { useSpecsList } from '@/hooks/useSpecs';

export default function SpecsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: specs, isLoading } = useSpecsList();

  const selectedSpec = specs?.find((s) => s.id === selectedId) ?? null;

  return (
    <>
      <Topbar title="Specs" />
      <PageContainer>
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading specs...
          </div>
        ) : !specs || specs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No specs yet"
            description="Approve proposals to generate PRDs and agent prompts."
          />
        ) : (
          <div className="flex gap-4">
            {/* Spec list */}
            <div className="flex-1 min-w-0 space-y-3 transition-all">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {specs.map((spec) => (
                  <SpecCard
                    key={spec.id}
                    spec={spec}
                    isSelected={spec.id === selectedId}
                    onClick={() => setSelectedId(spec.id === selectedId ? null : spec.id)}
                  />
                ))}
              </div>
            </div>

            {/* Detail panel */}
            {selectedSpec && <SpecDetail spec={selectedSpec} onClose={() => setSelectedId(null)} />}
          </div>
        )}
      </PageContainer>
    </>
  );
}
