import { Link, useLocation } from 'react-router-dom';
import { BarChart3, MessageSquare, Brain, Lightbulb, FileText, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/context/SidebarContext';
import { ShipScopeLogo } from '@/components/ui/ShipScopeLogo';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/feedback', label: 'Feedback', icon: MessageSquare },
  { path: '/themes', label: 'Themes', icon: Brain },
  { path: '/proposals', label: 'Proposals', icon: Lightbulb },
  { path: '/specs', label: 'Specs', icon: FileText },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const { isCollapsed, isMobile, isMobileOpen, setMobileOpen } = useSidebar();

  const collapsed = isMobile ? false : isCollapsed;

  const sidebarContent = (
    <aside
      className={cn(
        'h-screen bg-bg-surface border-r border-border flex flex-col shrink-0 transition-all duration-200',
        isMobile ? 'w-60' : collapsed ? 'w-[60px]' : 'w-60',
      )}
    >
      <div className={cn('px-5 py-5 flex items-center gap-3', collapsed && 'px-0 justify-center')}>
        <ShipScopeLogo size={collapsed ? 28 : 24} />
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-text-primary tracking-tight">ShipScope</h1>
            <p className="text-xs text-text-muted mt-0.5">Feedback Intelligence</p>
          </div>
        )}
      </div>

      <nav className={cn('flex-1 space-y-1', collapsed ? 'px-1.5' : 'px-3')}>
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = pathname === path || pathname.startsWith(path + '/');
          return (
            <Link
              key={path}
              to={path}
              title={collapsed ? label : undefined}
              onClick={() => isMobile && setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
                collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2',
                active
                  ? 'bg-accent-blue-dim text-accent-blue'
                  : 'text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary',
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      <div className={cn(collapsed ? 'px-1.5 pb-4' : 'px-3 pb-4')}>
        <Link
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          onClick={() => isMobile && setMobileOpen(false)}
          className={cn(
            'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
            collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2',
            pathname === '/settings'
              ? 'bg-accent-blue-dim text-accent-blue'
              : 'text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary',
          )}
        >
          <Settings size={18} className="shrink-0" />
          {!collapsed && 'Settings'}
        </Link>
      </div>
    </aside>
  );

  if (isMobile) {
    return (
      <>
        {isMobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 transition-transform duration-200',
            isMobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {sidebarContent}
        </div>
      </>
    );
  }

  return sidebarContent;
}
