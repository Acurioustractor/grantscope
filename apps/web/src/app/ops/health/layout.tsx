import type { ReactNode } from 'react';

/** The shell wrap moved up to /ops/layout.tsx when the whole ops group entered the shell —
 *  wrapping here again would nest a shell inside a shell. */
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
