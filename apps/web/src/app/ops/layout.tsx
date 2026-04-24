import type { ReactNode } from 'react';
import { requireAdminPage } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function OpsLayout({ children }: { children: ReactNode }) {
  await requireAdminPage('/ops');
  return children;
}
