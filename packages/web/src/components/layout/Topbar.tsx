import { type ReactNode } from 'react';

interface TopbarProps {
  title: string;
  actions?: ReactNode;
}

export function Topbar({ title, actions }: TopbarProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border">
      <h2 className="text-2xl font-semibold text-text-primary">{title}</h2>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
