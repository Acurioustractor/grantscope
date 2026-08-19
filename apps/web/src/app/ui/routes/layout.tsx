import type { ReactNode } from 'react';
import { requireAdminPage } from '@/lib/admin-auth';

/**
 * Gated at /ui/routes, not at /ui.
 *
 * The two pages need different audiences. /ui is the style reference — the thing you hand a
 * designer, a contractor or anyone you are briefing, and it gives away nothing. /ui/routes
 * enumerates every route in the app including /admin and /ops, which is a map of the operator
 * surface. Gating the whole tree made the reference unshowable to the people who most need it.
 */
export default async function RoutesLayout({ children }: { children: ReactNode }) {
  await requireAdminPage('/ui/routes');
  return <>{children}</>;
}
