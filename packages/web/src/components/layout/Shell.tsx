import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-bg-primary">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
