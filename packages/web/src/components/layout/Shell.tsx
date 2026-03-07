import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { DemoBanner } from './DemoBanner';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { CommandPalette } from '@/components/ui/CommandPalette';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-bg-primary">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <DemoBanner />
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      </div>
      <ToastContainer />
      <CommandPalette />
    </div>
  );
}
