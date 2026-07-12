import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgProfileContext } from '@/lib/org-profile';
import { isAdminEmail } from '@/lib/admin';

export interface OrgAuthResult {
  userId: string;
  orgProfileId: string;
  role: string;
  serviceDb: ReturnType<typeof getServiceSupabase>;
}

const ORG_WRITE_ROLES = new Set(['admin', 'editor']);

export function isOrgWriteRole(role: string) {
  return ORG_WRITE_ROLES.has(role);
}

/**
 * Verify the current user has access to the given org profile.
 * Super admins can access any org's data.
 * Returns auth context or a NextResponse error.
 */
export async function requireOrgAccess(
  orgProfileId: string,
): Promise<OrgAuthResult | NextResponse> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceDb = getServiceSupabase();

  // Super admins can access any org
  if (isAdminEmail(user.email)) {
    return {
      userId: user.id,
      orgProfileId,
      role: 'admin',
      serviceDb,
    };
  }

  const ctx = await getCurrentOrgProfileContext(serviceDb, user.id);

  if (!ctx.orgProfileId || ctx.orgProfileId !== orgProfileId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return {
    userId: user.id,
    orgProfileId: ctx.orgProfileId,
    role: ctx.currentUserRole ?? 'viewer',
    serviceDb,
  };
}

export async function requireOrgWriteAccess(
  orgProfileId: string,
): Promise<OrgAuthResult | NextResponse> {
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;
  if (!isOrgWriteRole(auth.role)) {
    return NextResponse.json({ error: 'Editor access is required' }, { status: 403 });
  }
  return auth;
}
