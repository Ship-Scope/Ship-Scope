import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  children: React.ReactNode;
  className?: string;
}

const variants = {
  blue: 'bg-accent-blue-dim text-accent-blue',
  green: 'bg-success-dim text-success',
  yellow: 'bg-warning-dim text-warning',
  red: 'bg-danger-dim text-danger',
  gray: 'bg-bg-surface-2 text-text-secondary',
};

export function Badge({ variant = 'gray', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
