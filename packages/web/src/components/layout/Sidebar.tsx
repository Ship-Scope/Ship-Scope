import { Link, useLocation } from 'react-router-dom';
import { BarChart3, MessageSquare, Brain, Lightbulb, FileText, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/feedback', label: 'Feedback', icon: MessageSquare },
  { path: '/themes', label: 'Themes', icon: Brain },
  { path: '/proposals', label: 'Proposals', icon: Lightbulb },
  { path: '/specs', label: 'Specs', icon: FileText },
];

export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="w-60 h-screen bg-bg-surface border-r border-border flex flex-col shrink-0">
      <div className="px-5 py-5">
        <h1 className="text-lg font-semibold text-text-primary tracking-tight">ShipScope</h1>
        <p className="text-xs text-text-muted mt-0.5">Feedback Intelligence</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = pathname === path || pathname.startsWith(path + '/');
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-accent-blue-dim text-accent-blue'
                  : 'text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary',
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <Link
          to="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            pathname === '/settings'
              ? 'bg-accent-blue-dim text-accent-blue'
              : 'text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary',
          )}
        >
          <Settings size={18} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
