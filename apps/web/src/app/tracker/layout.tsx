import type { ReactNode } from 'react';
import { Shell } from '@/components/shell/shell';

/** Operator tool inside the app shell (phase-2 ruling 2026-08-17). The page's own Bauhaus
 *  content sits contained inside the soft shell — the accepted /clarity pattern. */
export default function Layout({ children }: { children: ReactNode }) {
  return <Shell title="Grant tracker">{children}</Shell>;
}
