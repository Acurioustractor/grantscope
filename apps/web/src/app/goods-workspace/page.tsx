import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgProfileContext } from '@/lib/org-profile';
import { resolveSubscriptionTier, hasModule } from '@/lib/subscription';
import { getGoodsWorkspaceData } from '@/lib/goods-workspace-data';
import GoodsWorkspaceClient from './goods-workspace-client';
import ModuleGate from '@/app/components/module-gate';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Goods Workspace | CivicGraph',
  description:
    'Buyer, capital, and partner intelligence for Goods on Country. NT-first remote procurement, community manufacturing, and catalytic capital in one workspace.',
};

export default async function GoodsWorkspacePage() {
  const authSupabase = await createSupabaseServer();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/goods-workspace');
  }

  const serviceDb = getServiceSupabase();
  const orgContext = await getCurrentOrgProfileContext(serviceDb, user.id);
  const tier = resolveSubscriptionTier(orgContext.profile?.subscription_plan);

  if (!hasModule(tier, 'supply-chain')) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center">
        <ModuleGate module="supply-chain" currentTier={tier} />
      </div>
    );
  }

  const workspace = await getGoodsWorkspaceData(serviceDb, orgContext);

  return <GoodsWorkspaceClient initialData={workspace} />;
}
