import type { ReactNode } from 'react';
import { requireAdminPage } from '@/lib/admin-auth';
import { Shell } from '@/components/shell/shell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage('/admin');
  return <Shell title="Admin">{children}</Shell>;
}
