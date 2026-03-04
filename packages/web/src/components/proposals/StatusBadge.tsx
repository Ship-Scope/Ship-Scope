import { Badge } from '@/components/ui/Badge';

const statusConfig: Record<
  string,
  { label: string; variant: 'blue' | 'green' | 'yellow' | 'red' | 'gray' }
> = {
  proposed: { label: 'Proposed', variant: 'blue' },
  approved: { label: 'Approved', variant: 'green' },
  rejected: { label: 'Rejected', variant: 'red' },
  shipped: { label: 'Shipped', variant: 'green' },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, variant: 'gray' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
