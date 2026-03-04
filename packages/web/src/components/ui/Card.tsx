import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ className, hover, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-bg-surface border border-border rounded-xl p-5',
        hover && 'hover:border-border-hover transition-colors cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
