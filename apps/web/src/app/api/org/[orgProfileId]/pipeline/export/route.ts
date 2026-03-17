import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAccess } from '../../../_lib/auth';

type Params = { params: Promise<{ orgProfileId: string }> };

/**
 * GET /api/org/:orgProfileId/pipeline/export?id=<pipelineItemId>
 * Returns a printable HTML one-pager combining org data with the grant opportunity.
 * Designed for Cmd+P → PDF export.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const pipelineId = req.nextUrl.searchParams.get('id');
  if (!pipelineId) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
  }

  const db = auth.serviceDb;

  // Fetch pipeline item
  const { data: pipelineItem } = await db
    .from('org_pipeline')
    .select('*')
    .eq('id', pipelineId)
    .eq('org_profile_id', orgProfileId)
    .single();

  if (!pipelineItem) {
    return NextResponse.json({ error: 'Pipeline item not found' }, { status: 404 });
  }

  // Fetch org profile
  const { data: profile } = await db
    .from('org_profiles')
    .select('name, abn, description, org_type, team_size, annual_revenue')
    .eq('id', orgProfileId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Org not found' }, { status: 404 });
  }

  // Fetch org's ALMA programs count and funding history in parallel
  const [almaResult, fundingResult, programsResult] = await Promise.all([
    profile.abn
      ? db.rpc('exec_sql', {
          query: `SELECT COUNT(*)::int as n FROM alma_interventions a JOIN gs_entities e ON e.id = a.gs_entity_id WHERE e.abn = '${profile.abn}'`,
        })
      : Promise.resolve({ data: null }),
    profile.abn
      ? db.rpc('exec_sql', {
          query: `SELECT SUM(amount_dollars)::bigint as total, COUNT(*)::int as grants FROM justice_funding WHERE recipient_abn = '${profile.abn}'`,
        })
      : Promise.resolve({ data: null }),
    db
      .from('org_programs')
      .select('name, system, status')
      .eq('org_profile_id', orgProfileId)
      .eq('status', 'active')
      .order('sort_order'),
  ]);

  const almaCount = (almaResult.data as Array<{ n: number }> | null)?.[0]?.n ?? 0;
  const fundingTotal = (fundingResult.data as Array<{ total: number; grants: number }> | null)?.[0];
  const activePrograms = programsResult.data ?? [];

  // Fetch grant opportunity details if linked
  let grantDetails: { name: string; description: string | null; categories: string[]; url: string | null } | null = null;
  if (pipelineItem.grant_opportunity_id) {
    const { data } = await db
      .from('grant_opportunities')
      .select('name, description, categories, url')
      .eq('id', pipelineItem.grant_opportunity_id)
      .single();
    grantDetails = data;
  }

  function money(n: number): string {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${profile.name} — ${pipelineItem.name} Application Brief</title>
  <style>
    @page { margin: 1.5cm; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.5; }
    .header { border-bottom: 4px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; }
    .header .sub { font-size: 12px; color: #666; margin-top: 4px; }
    .grant-target { background: #f0fdf4; border: 2px solid #16a34a; padding: 12px 16px; margin-bottom: 16px; }
    .grant-target h2 { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #16a34a; margin-bottom: 6px; }
    .grant-target .detail { display: flex; gap: 24px; flex-wrap: wrap; }
    .grant-target .detail span { font-size: 11px; }
    .grant-target .detail strong { font-weight: 700; }
    .section { margin-bottom: 14px; }
    .section h3 { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #666; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .stat { background: #f9fafb; border: 1px solid #e5e7eb; padding: 8px 12px; }
    .stat .label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; }
    .stat .value { font-size: 16px; font-weight: 900; margin-top: 2px; }
    .programs-list { list-style: none; }
    .programs-list li { padding: 3px 0; border-bottom: 1px solid #f3f4f6; display: flex; gap: 8px; align-items: center; }
    .programs-list li::before { content: ''; width: 6px; height: 6px; background: #16a34a; border-radius: 50%; flex-shrink: 0; }
    .badge { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 6px; background: #eff6ff; color: #2563eb; border-radius: 2px; }
    .notes { background: #fffbeb; border: 1px solid #f59e0b; padding: 10px 14px; font-size: 11px; }
    .notes h4 { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #d97706; margin-bottom: 4px; }
    .footer { margin-top: 20px; padding-top: 10px; border-top: 2px solid #e5e7eb; font-size: 9px; color: #9ca3af; display: flex; justify-content: space-between; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(profile.name)}</h1>
    <div class="sub">
      ${profile.abn ? `ABN ${profile.abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')} &middot; ` : ''}
      ${profile.org_type || 'Organisation'}
      ${profile.description ? ` &middot; ${escapeHtml(profile.description)}` : ''}
    </div>
  </div>

  <div class="grant-target">
    <h2>Application Target: ${escapeHtml(pipelineItem.name)}</h2>
    <div class="detail">
      ${pipelineItem.amount_display ? `<span><strong>Amount:</strong> ${escapeHtml(pipelineItem.amount_display)}</span>` : ''}
      ${pipelineItem.funder ? `<span><strong>Funder:</strong> ${escapeHtml(pipelineItem.funder)}</span>` : ''}
      ${pipelineItem.deadline ? `<span><strong>Deadline:</strong> ${escapeHtml(pipelineItem.deadline)}</span>` : ''}
      <span><strong>Status:</strong> ${escapeHtml(pipelineItem.status)}</span>
    </div>
    ${grantDetails?.description ? `<p style="margin-top: 8px; color: #374151;">${escapeHtml(grantDetails.description).slice(0, 300)}</p>` : ''}
  </div>

  <div class="section">
    <h3>Organisation Profile</h3>
    <div class="grid-2">
      ${profile.team_size ? `<div class="stat"><div class="label">Team Size</div><div class="value">${profile.team_size}</div></div>` : ''}
      ${profile.annual_revenue ? `<div class="stat"><div class="label">Annual Revenue</div><div class="value">${money(profile.annual_revenue)}</div></div>` : ''}
      ${fundingTotal?.total ? `<div class="stat"><div class="label">Tracked Govt Funding</div><div class="value">${money(Number(fundingTotal.total))}</div></div>` : ''}
      ${fundingTotal?.grants ? `<div class="stat"><div class="label">Grant History</div><div class="value">${fundingTotal.grants} grants</div></div>` : ''}
      ${almaCount > 0 ? `<div class="stat"><div class="label">Evidence-Based Programs (ALMA)</div><div class="value">${almaCount}</div></div>` : ''}
    </div>
  </div>

  ${activePrograms.length > 0 ? `
  <div class="section">
    <h3>Active Programs (${activePrograms.length})</h3>
    <ul class="programs-list">
      ${(activePrograms as Array<{ name: string; system: string | null }>).map(p =>
        `<li>${escapeHtml(p.name)}${p.system ? ` <span class="badge">${escapeHtml(p.system)}</span>` : ''}</li>`
      ).join('')}
    </ul>
  </div>
  ` : ''}

  ${pipelineItem.notes ? `
  <div class="notes">
    <h4>Strategic Notes</h4>
    <p>${escapeHtml(pipelineItem.notes)}</p>
  </div>
  ` : ''}

  ${grantDetails?.categories?.length ? `
  <div class="section">
    <h3>Grant Categories</h3>
    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
      ${grantDetails.categories.map(c => `<span class="badge">${escapeHtml(c)}</span>`).join('')}
    </div>
  </div>
  ` : ''}

  <div class="footer">
    <span>Generated by CivicGraph &middot; ${new Date().toISOString().split('T')[0]}</span>
    <span>Application Brief &middot; ${escapeHtml(pipelineItem.name)}</span>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
