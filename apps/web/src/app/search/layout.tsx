import type { ReactNode } from 'react';
import { Shell } from '@/components/shell/shell';

export default function SearchLayout({ children }: { children: ReactNode }) {
  return (
    <Shell title="Search" activeHref="/search">
      {children}
    </Shell>
  );
}
