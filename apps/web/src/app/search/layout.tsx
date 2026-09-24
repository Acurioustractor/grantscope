import type { ReactNode } from 'react';
import { BrowseScope } from '@/components/shell/browse-scope';

export default function SearchLayout({ children }: { children: ReactNode }) {
  return (
    <BrowseScope>
      {children}
    </BrowseScope>
  );
}
