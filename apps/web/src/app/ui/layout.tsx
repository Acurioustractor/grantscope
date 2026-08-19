import type { ReactNode } from 'react';
import { requireAdminPage } from '@/lib/admin-auth';

/**
 * Admin-gated, like /admin, /ops and /clarity.
 *
 * /ui/routes enumerates every route in the app — including the admin and ops paths — so it is
 * a map of the operator surface, not a public style guide. The reference page itself is
 * harmless, but the two live together and the gate belongs on the tree, not on one page.
 */
export default async function UiLayout({ children }: { children: ReactNode }) {
  await requireAdminPage('/ui');
  return <>{children}</>;
}
