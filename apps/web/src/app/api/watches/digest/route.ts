import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/gmail';

/**
 * POST /api/watches/digest — Generate and send weekly watchlist digests.
 * Called by cron or manually. Finds all users with entity watches,
 * matches discoveries from the last 7 days, and sends email digests.
 *
 * Query params:
 *   ?dry_run=true — preview without sending
 *   ?user_id=UUID — send for specific user only
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.CRON_API_KEY;
  if (expectedKey && apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dry_run') === 'true';
  const specificUserId = request.nextUrl.searchParams.get('user_id');

  const db = getServiceSupabase();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Get all entity watches (optionally for one user)
  let watchQuery = db.from('entity_watches').select('*');
  if (specificUserId) watchQuery = watchQuery.eq('user_id', specificUserId);
  const { data: watches, error: watchErr } = await watchQuery;
  if (watchErr) return NextResponse.json({ error: watchErr.message }, { status: 500 });
  if (!watches?.length) return NextResponse.json({ message: 'No watches found', digests: 0 });

  // 2. Group watches by user
  const byUser = new Map<string, typeof watches>();
  for (const w of watches) {
    const existing = byUser.get(w.user_id) || [];
    existing.push(w);
    byUser.set(w.user_id, existing);
  }

  // 3. Get all watched entity IDs
  const allEntityIds = [...new Set(watches.map(w => w.entity_id))];

  // 4. Find discoveries matching watched entities (last 7 days)
  const { data: discoveries } = await db
    .from('discoveries')
    .select('*')
    .gte('created_at', oneWeekAgo)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(500);

  // Match discoveries to entity IDs
  const discoveryByEntity = new Map<string, Array<{
    title: string;
    description: string;
    severity: string;
    discovery_type: string;
    created_at: string;
  }>>();

  for (const d of discoveries || []) {
    const entityIds: string[] = d.entity_ids || [];
    for (const eid of entityIds) {
      if (allEntityIds.includes(eid)) {
        const existing = discoveryByEntity.get(eid) || [];
        existing.push({
          title: d.title,
          description: d.description,
          severity: d.severity,
          discovery_type: d.discovery_type,
          created_at: d.created_at,
        });
        discoveryByEntity.set(eid, existing);
      }
    }
  }

  // 5. Get civic_alerts from last week
  const { data: civicAlerts } = await db
    .from('civic_alerts')
    .select('*')
    .gte('created_at', oneWeekAgo)
    .order('created_at', { ascending: false })
    .limit(50);

  // 6. Get user emails
  const userIds = [...byUser.keys()];
  const { data: profiles } = await db
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds);

  const profileMap = new Map(
    (profiles || []).map(p => [p.id, p])
  );

  // 7. Generate and send digests
  const results: Array<{ userId: string; email: string; discoveryCount: number; sent: boolean }> = [];

  for (const [userId, userWatches] of byUser) {
    const profile = profileMap.get(userId);
    if (!profile?.email) continue;

    // Count discoveries for this user's watches
    let totalDiscoveries = 0;
    const watchSummaries: Array<{
      name: string;
      gsId: string;
      discoveries: Array<{ title: string; severity: string; description: string }>;
    }> = [];

    for (const w of userWatches) {
      const entityDiscoveries = discoveryByEntity.get(w.entity_id) || [];
      totalDiscoveries += entityDiscoveries.length;
      if (entityDiscoveries.length > 0) {
        watchSummaries.push({
          name: w.canonical_name || w.gs_id,
          gsId: w.gs_id,
          discoveries: entityDiscoveries.map(d => ({
            title: d.title,
            severity: d.severity,
            description: d.description,
          })),
        });
      }
    }

    // Skip if nothing to report
    if (totalDiscoveries === 0 && (!civicAlerts || civicAlerts.length === 0)) {
      results.push({ userId, email: profile.email, discoveryCount: 0, sent: false });
      continue;
    }

    // Build email
    const subject = `CivicGraph Weekly Digest — ${totalDiscoveries} updates across ${watchSummaries.length} watched entities`;
    const html = buildDigestHtml({
      userName: profile.full_name || profile.email,
      watchSummaries,
      civicAlerts: (civicAlerts || []).slice(0, 10),
      totalWatches: userWatches.length,
      periodStart: oneWeekAgo,
      periodEnd: new Date().toISOString(),
    });

    if (dryRun) {
      results.push({ userId, email: profile.email, discoveryCount: totalDiscoveries, sent: false });
    } else {
      try {
        await sendEmail({
          to: profile.email,
          subject,
          body: `${totalDiscoveries} updates found for your ${userWatches.length} watched entities this week.`,
          html,
          senderName: 'CivicGraph Watchlist',
        });
        results.push({ userId, email: profile.email, discoveryCount: totalDiscoveries, sent: true });

        // Update last_checked_at on watches
        for (const w of userWatches) {
          await db.from('entity_watches')
            .update({ last_checked_at: new Date().toISOString() })
            .eq('id', w.id);
        }
      } catch (err) {
        results.push({ userId, email: profile.email, discoveryCount: totalDiscoveries, sent: false });
      }
    }
  }

  return NextResponse.json({
    dryRun,
    period: { start: oneWeekAgo, end: new Date().toISOString() },
    totalDiscoveries: discoveries?.length || 0,
    totalAlerts: civicAlerts?.length || 0,
    digests: results,
  });
}

function buildDigestHtml(opts: {
  userName: string;
  watchSummaries: Array<{
    name: string;
    gsId: string;
    discoveries: Array<{ title: string; severity: string; description: string }>;
  }>;
  civicAlerts: Array<{ title: string; severity: string; summary: string }>;
  totalWatches: number;
  periodStart: string;
  periodEnd: string;
}): string {
  const severityColor: Record<string, string> = {
    critical: '#de1c1e',
    significant: '#f97316',
    notable: '#1c47d1',
    info: '#6b7280',
  };

  const watchHtml = opts.watchSummaries.map(w => `
    <div style="margin-bottom:16px;border:2px solid #141414;padding:12px;">
      <div style="font-weight:900;font-size:14px;margin-bottom:4px;">
        <a href="https://civicgraph.au/entities/${w.gsId}" style="color:#141414;text-decoration:none;">${w.name}</a>
      </div>
      <div style="font-size:11px;color:#6b6b6b;margin-bottom:8px;">${w.gsId} &middot; ${w.discoveries.length} update${w.discoveries.length !== 1 ? 's' : ''}</div>
      ${w.discoveries.slice(0, 5).map(d => `
        <div style="padding:6px 0;border-top:1px solid #e5e5e5;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${severityColor[d.severity] || '#6b7280'};margin-right:6px;"></span>
          <strong style="font-size:12px;">${d.title}</strong>
          <div style="font-size:11px;color:#6b6b6b;margin-top:2px;">${d.description?.slice(0, 150) || ''}</div>
        </div>
      `).join('')}
      ${w.discoveries.length > 5 ? `<div style="font-size:11px;color:#6b6b6b;padding-top:4px;">+ ${w.discoveries.length - 5} more</div>` : ''}
    </div>
  `).join('');

  const alertHtml = opts.civicAlerts.length > 0 ? `
    <div style="margin-top:24px;">
      <h2 style="font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#6b6b6b;margin-bottom:12px;">Platform Alerts</h2>
      ${opts.civicAlerts.map(a => `
        <div style="padding:6px 0;border-top:1px solid #e5e5e5;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${severityColor[a.severity] || '#6b7280'};margin-right:6px;"></span>
          <strong style="font-size:12px;">${a.title}</strong>
          <div style="font-size:11px;color:#6b6b6b;margin-top:2px;">${a.summary?.slice(0, 150) || ''}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  return `
    <div style="max-width:600px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#141414;">
      <div style="background:#141414;padding:16px 20px;margin-bottom:24px;">
        <div style="color:#f2ce1e;font-weight:900;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">CivicGraph Weekly Digest</div>
      </div>

      <div style="padding:0 20px;">
        <p style="font-size:14px;margin-bottom:16px;">
          Hi ${opts.userName},
        </p>
        <p style="font-size:14px;margin-bottom:24px;">
          Here's what changed across your <strong>${opts.totalWatches} watched entities</strong> this week.
        </p>

        ${opts.watchSummaries.length > 0 ? `
          <h2 style="font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#6b6b6b;margin-bottom:12px;border-bottom:3px solid #141414;padding-bottom:8px;">
            Entity Updates (${opts.watchSummaries.reduce((sum, w) => sum + w.discoveries.length, 0)})
          </h2>
          ${watchHtml}
        ` : '<p style="font-size:14px;color:#6b6b6b;">No changes detected for your watched entities this week.</p>'}

        ${alertHtml}

        <div style="margin-top:32px;padding-top:16px;border-top:3px solid #141414;">
          <a href="https://civicgraph.au/home/watchlist" style="display:inline-block;padding:10px 20px;background:#141414;color:white;text-decoration:none;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;">
            View Full Watchlist
          </a>
        </div>

        <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e5e5;font-size:10px;color:#6b6b6b;">
          Period: ${new Date(opts.periodStart).toLocaleDateString('en-AU')} - ${new Date(opts.periodEnd).toLocaleDateString('en-AU')}<br/>
          CivicGraph — Decision Infrastructure for Government & Social Sector
        </div>
      </div>
    </div>
  `;
}
