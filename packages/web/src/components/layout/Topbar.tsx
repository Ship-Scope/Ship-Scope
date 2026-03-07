import { type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen, Menu } from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';

interface TopbarProps {
  title: string;
  actions?: ReactNode;
}

export function Topbar({ title, actions }: TopbarProps) {
  const { isCollapsed, isMobile, toggle } = useSidebar();

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border">
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="text-text-secondary hover:text-text-primary p-1 rounded-md hover:bg-bg-surface-2 transition-colors"
          aria-label={isMobile ? 'Open menu' : isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isMobile ? (
            <Menu size={20} />
          ) : isCollapsed ? (
            <PanelLeftOpen size={20} />
          ) : (
            <PanelLeftClose size={20} />
          )}
        </button>
        <h2 className="text-2xl font-semibold text-text-primary">{title}</h2>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
