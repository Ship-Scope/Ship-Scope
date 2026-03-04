import { type ReactNode } from 'react';

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-6 py-6">{children}</div>
    </div>
  );
}
