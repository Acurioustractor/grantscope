import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'ben@civicgraph.app').split(',').map(e => e.trim());

/** GET /api/admin/api-usage — admin view of all API key usage across orgs */
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServiceSupabase();

  // All orgs with their keys
  const { data: orgs } = await db
    .from('org_profiles')
    .select('id, name, user_id, subscription_plan, created_at');

  // All API keys with usage
  const { data: keys } = await db
    .from('api_keys')
    .select('id, org_id, name, key_prefix, rate_limit_per_min, total_requests, total_errors, created_at, last_used_at, revoked_at');

  // Recent usage (last 7 days, capped at 2000 rows)
  const { data: recentUsage } = await db
    .from('api_usage')
    .select('key_id, action, status_code, response_ms, created_at')
    .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
    .order('created_at', { ascending: false })
    .limit(2000);

  // Aggregate per-org
  const keysByOrg = new Map<string, typeof keys>();
  for (const key of keys || []) {
    const orgId = key.org_id as string;
    if (!keysByOrg.has(orgId)) keysByOrg.set(orgId, []);
    keysByOrg.get(orgId)!.push(key);
  }

  // Aggregate usage by key
  const usageByKey = new Map<string, { requests: number; errors: number; actions: Map<string, number> }>();
  for (const row of recentUsage || []) {
    const keyId = row.key_id as string;
    if (!keyId) continue;
    const entry = usageByKey.get(keyId) || { requests: 0, errors: 0, actions: new Map() };
    entry.requests++;
    if ((row.status_code as number) >= 400) entry.errors++;
    const action = (row.action as string) || 'unknown';
    entry.actions.set(action, (entry.actions.get(action) || 0) + 1);
    usageByKey.set(keyId, entry);
  }

  const orgSummaries = (orgs || []).map(org => {
    const orgKeys = keysByOrg.get(org.id) || [];
    const activeKeys = orgKeys.filter(k => !k.revoked_at);
    const totalRequests = orgKeys.reduce((s, k) => s + ((k.total_requests as number) || 0), 0);
    const totalErrors = orgKeys.reduce((s, k) => s + ((k.total_errors as number) || 0), 0);

    // 7-day usage
    const weekRequests = activeKeys.reduce((s, k) => s + (usageByKey.get(k.id)?.requests || 0), 0);

    return {
      id: org.id,
      name: org.name,
      plan: org.subscription_plan,
      created_at: org.created_at,
      active_keys: activeKeys.length,
      total_keys: orgKeys.length,
      total_requests: totalRequests,
      total_errors: totalErrors,
      week_requests: weekRequests,
      keys: activeKeys.map(k => ({
        id: k.id,
        name: k.name,
        prefix: k.key_prefix,
        rate_limit: k.rate_limit_per_min,
        total_requests: k.total_requests,
        last_used: k.last_used_at,
        week_requests: usageByKey.get(k.id)?.requests || 0,
        top_actions: Array.from(usageByKey.get(k.id)?.actions?.entries() || [])
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([action, count]) => ({ action, count })),
      })),
    };
  }).sort((a, b) => b.total_requests - a.total_requests);

  // Global totals
  const globalTotals = {
    total_orgs: (orgs || []).length,
    total_active_keys: (keys || []).filter(k => !k.revoked_at).length,
    total_requests: orgSummaries.reduce((s, o) => s + o.total_requests, 0),
    week_requests: orgSummaries.reduce((s, o) => s + o.week_requests, 0),
  };

  return NextResponse.json({ totals: globalTotals, orgs: orgSummaries });
}
