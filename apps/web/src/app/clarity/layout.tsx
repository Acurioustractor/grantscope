import type { ReactNode } from 'react';
import { requireAdminPage } from '@/lib/admin-auth';

// The catalog enumerates which objects are anon-readable — a map of our own attack
// surface. Admin-gating is not deference to the 2026-04-24 "kill SaaS-shaped surfaces"
// decision, it is independently correct. See issue #196.
export const dynamic = 'force-dynamic';

export default async function ClarityLayout({ children }: { children: ReactNode }) {
  await requireAdminPage('/clarity');
  return children;
}
