import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { DemoBanner } from './DemoBanner';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-bg-primary">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DemoBanner />
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
