import type { ReactNode } from 'react';
import { requireAdminPage } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function MissionControlLayout({ children }: { children: ReactNode }) {
  await requireAdminPage('/mission-control');
  return children;
}
