import type { ReactNode } from 'react';

/**
 * Retired 2026-09-24. This used to replace the site frame on /changes, /feedback, /get-a-report and
 * /account with a canvas, a second <main> and its own footer, while the root layout dropped the top
 * nav for them. Its old note said "the global NavBar provides top navigation"; it never did there.
 * Those pages now render in the one public frame (lib/public-frame.ts), so this only passes its
 * children through until it and the four layouts that call it are deleted.
 */
export function LandingChrome({ children }: { children: ReactNode; currentPage?: string }) {
  return <>{children}</>;
}
