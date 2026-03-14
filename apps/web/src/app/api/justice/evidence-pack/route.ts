import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireModule } from '@/lib/api-auth';

/**
 * GET /api/justice/evidence-pack
 *
 * Generates an exportable evidence pack for board papers / cabinet submissions.
 * Returns structured data for a specific intervention, entity, or state-level summary.
 *
 * Query params:
 *   intervention_id — single intervention deep-dive
 *   entity_id       — entity + all its interventions/funding
 *   state           — state-level summary pack
 *   format          — "json" (default) or "html" (branded printable page)
 */
export async function GET(request: NextRequest) {
  const auth = await requireModule('allocation');
  if (auth.error) return auth.error;

  const params = request.nextUrl.searchParams;
  const interventionId = params.get('intervention_id');
  const entityId = params.get('entity_id');
  const state = params.get('state');
  const format = params.get('format') || 'json';

  const supabase = getServiceSupabase();

  if (interventionId) {
    return buildInterventionPack(supabase, interventionId, format);
  } else if (entityId) {
    return buildEntityPack(supabase, entityId, format);
  } else if (state) {
    return buildStatePack(supabase, state, format);
  }

  return NextResponse.json({ error: 'Provide intervention_id, entity_id, or state parameter' }, { status: 400 });
}

async function buildInterventionPack(supabase: ReturnType<typeof getServiceSupabase>, id: string, format: string) {
  const { data: intervention } = await supabase
    .from('alma_interventions')
    .select('*')
    .eq('id', id)
    .single();

  if (!intervention) return NextResponse.json({ error: 'Intervention not found' }, { status: 404 });

  // Evidence records
  const { data: evidence } = await supabase
    .from('alma_evidence')
    .select('*')
    .eq('intervention_id', id);

  // Outcomes
  const { data: outcomes } = await supabase
    .from('alma_outcomes')
    .select('*')
    .eq('intervention_id', id);

  // Linked entity
  let entity = null;
  if (intervention.gs_entity_id) {
    const { data: e } = await supabase
      .from('gs_entities')
      .select('gs_id, canonical_name, abn, entity_type, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name')
      .eq('id', intervention.gs_entity_id)
      .single();
    entity = e;
  }

  // Justice funding linked to this intervention
  const { data: funding } = await supabase
    .from('justice_funding')
    .select('recipient_name, program_name, amount_dollars, state, financial_year')
    .eq('alma_intervention_id', id);

  const totalFunding = (funding || []).reduce((s, r) => s + ((r.amount_dollars as number) || 0), 0);

  const pack = {
    type: 'intervention_evidence_pack',
    generated_at: new Date().toISOString(),
    generated_by: 'CivicGraph — Allocation Intelligence',
    intervention: {
      name: intervention.name,
      type: intervention.type,
      description: intervention.description,
      target_cohort: intervention.target_cohort,
      geography: intervention.geography,
      evidence_level: intervention.evidence_level,
      cultural_authority: intervention.cultural_authority,
      implementation_cost: intervention.implementation_cost,
      cost_per_young_person: intervention.cost_per_young_person,
      scalability: intervention.scalability,
      replication_readiness: intervention.replication_readiness,
      years_operating: intervention.years_operating,
      serves_youth_justice: intervention.serves_youth_justice,
      portfolio_score: intervention.portfolio_score,
      signals: {
        evidence_strength: intervention.evidence_strength_signal,
        community_authority: intervention.community_authority_signal,
      },
    },
    delivery_organisation: entity ? {
      name: entity.canonical_name,
      gs_id: entity.gs_id,
      abn: entity.abn,
      type: entity.entity_type,
      state: entity.state,
      postcode: entity.postcode,
      remoteness: entity.remoteness,
      seifa_decile: entity.seifa_irsd_decile,
      community_controlled: entity.is_community_controlled,
      lga: entity.lga_name,
    } : null,
    evidence: (evidence || []).map(e => ({
      title: e.title,
      type: e.evidence_type,
      methodology: e.methodology,
      sample_size: e.sample_size,
      effect_size: e.effect_size,
      timeframe: e.timeframe,
      findings: e.findings,
      author: e.author,
      organization: e.organization,
      publication_date: e.publication_date,
    })),
    outcomes: (outcomes || []).map(o => ({
      name: o.name,
      type: o.outcome_type,
      description: o.description,
      measurement_method: o.measurement_method,
      indicators: o.indicators,
      time_horizon: o.time_horizon,
      beneficiary: o.beneficiary,
    })),
    justice_funding: {
      total: totalFunding,
      records: (funding || []).length,
      by_program: groupBy(funding || [], 'program_name', 'amount_dollars'),
      by_state: groupBy(funding || [], 'state', 'amount_dollars'),
    },
    data_sources: [
      'Australian Living Map of Alternatives (ALMA) — JusticeHub evidence database',
      'CivicGraph Entity Graph — 143K organisations, ABN-verified',
      'Justice Funding Database — Federal & state funding records',
      'SEIFA 2021 — ABS Socio-Economic Indexes for Areas',
    ],
    citation: `CivicGraph Evidence Pack: ${intervention.name}. Generated ${new Date().toISOString().split('T')[0]}. Data sources: Australian Living Map of Alternatives (ALMA), CivicGraph Entity Graph, Justice Funding Database.`,
  };

  if (format === 'html') {
    return new Response(renderInterventionHTML(pack), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return NextResponse.json(pack);
}

async function buildEntityPack(supabase: ReturnType<typeof getServiceSupabase>, entityId: string, format: string) {
  // Look up by gs_id or UUID
  const isUUID = entityId.includes('-');
  const entityQuery = isUUID
    ? supabase.from('gs_entities').select('*').eq('id', entityId).single()
    : supabase.from('gs_entities').select('*').eq('gs_id', entityId).single();

  const { data: entity } = await entityQuery;
  if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 404 });

  // ALMA interventions delivered by this entity
  const { data: interventions } = await supabase
    .from('alma_interventions')
    .select('id, name, type, evidence_level, target_cohort, geography, portfolio_score, serves_youth_justice')
    .eq('gs_entity_id', entity.id);

  // Justice funding to this entity
  const { data: funding } = await supabase
    .from('justice_funding')
    .select('program_name, amount_dollars, state, financial_year, sector')
    .eq('recipient_abn', entity.abn)
    .limit(500);

  const totalFunding = (funding || []).reduce((s, r) => s + ((r.amount_dollars as number) || 0), 0);

  // Government contracts
  const { data: contracts } = await supabase
    .from('austender_contracts')
    .select('title, contract_value, buyer_name, contract_start, contract_end')
    .eq('supplier_abn', entity.abn)
    .order('contract_start', { ascending: false })
    .limit(20);

  const totalContracts = (contracts || []).reduce((s, r) => s + ((r.contract_value as number) || 0), 0);

  // Political donations
  const { data: donations } = await supabase
    .from('political_donations')
    .select('donation_to, amount, financial_year')
    .eq('donor_abn', entity.abn)
    .limit(100);

  const totalDonations = (donations || []).reduce((s, r) => s + ((r.amount as number) || 0), 0);

  const pack = {
    type: 'entity_evidence_pack',
    generated_at: new Date().toISOString(),
    generated_by: 'CivicGraph — Allocation Intelligence',
    entity: {
      name: entity.canonical_name,
      gs_id: entity.gs_id,
      abn: entity.abn,
      type: entity.entity_type,
      state: entity.state,
      postcode: entity.postcode,
      remoteness: entity.remoteness,
      seifa_decile: entity.seifa_irsd_decile,
      community_controlled: entity.is_community_controlled,
      lga: entity.lga_name,
    },
    alma_interventions: (interventions || []).map(i => ({
      name: i.name,
      type: i.type,
      evidence_level: i.evidence_level,
      target_cohort: i.target_cohort,
      geography: i.geography,
      portfolio_score: i.portfolio_score,
      serves_youth_justice: i.serves_youth_justice,
    })),
    justice_funding: {
      total: totalFunding,
      records: (funding || []).length,
      by_program: groupBy(funding || [], 'program_name', 'amount_dollars'),
      by_year: groupBy(funding || [], 'financial_year', 'amount_dollars'),
    },
    government_contracts: {
      total: totalContracts,
      records: (contracts || []).length,
      recent: (contracts || []).slice(0, 10).map(c => ({
        title: c.title,
        value: c.contract_value,
        buyer: c.buyer_name,
        start: c.contract_start,
        end: c.contract_end,
      })),
    },
    political_donations: {
      total: totalDonations,
      records: (donations || []).length,
      by_party: groupBy(donations || [], 'donation_to', 'amount'),
    },
    integrity_flags: {
      has_interventions: (interventions || []).length > 0,
      has_justice_funding: totalFunding > 0,
      has_contracts: totalContracts > 0,
      has_donations: totalDonations > 0,
      donations_and_contracts: totalDonations > 0 && totalContracts > 0,
    },
    data_sources: [
      'Australian Living Map of Alternatives (ALMA) — JusticeHub evidence database',
      'CivicGraph Entity Graph — 143K organisations, ABN-verified',
      'Justice Funding Database — Federal & state funding records',
      'AusTender — Federal procurement contracts',
      'AEC/State ECQs — Political donation disclosures',
      'SEIFA 2021 — ABS Socio-Economic Indexes for Areas',
    ],
    citation: `CivicGraph Entity Evidence Pack: ${entity.canonical_name} (ABN ${entity.abn}). Generated ${new Date().toISOString().split('T')[0]}.`,
  };

  if (format === 'html') {
    return new Response(renderEntityHTML(pack), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return NextResponse.json(pack);
}

async function buildStatePack(supabase: ReturnType<typeof getServiceSupabase>, state: string, format: string) {
  // Indigenous entities
  const { count: indigenousCount } = await supabase
    .from('gs_entities')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', 'indigenous_corp')
    .eq('state', state);

  // Community controlled
  const { count: ccCount } = await supabase
    .from('gs_entities')
    .select('id', { count: 'exact', head: true })
    .eq('is_community_controlled', true)
    .eq('state', state);

  // Justice funding
  const { data: fundingData } = await supabase
    .from('justice_funding')
    .select('program_name, amount_dollars, sector, financial_year')
    .eq('state', state)
    .limit(5000);

  const totalFunding = (fundingData || []).reduce((s, r) => s + ((r.amount_dollars as number) || 0), 0);

  // ALMA interventions in this state
  const { data: almaData } = await supabase
    .from('alma_interventions')
    .select('id, name, type, evidence_level, gs_entity_id, serves_youth_justice')
    .contains('geography', [state]);

  const jrInterventions = (almaData || []).filter(a => a.type === 'Justice Reinvestment');
  const linkedInterventions = (almaData || []).filter(a => a.gs_entity_id);
  const yjInterventions = (almaData || []).filter(a => a.serves_youth_justice);

  // Evidence breakdown
  const evidenceBreakdown: Record<string, number> = {};
  for (const a of almaData || []) {
    const level = a.evidence_level || 'Unknown';
    evidenceBreakdown[level] = (evidenceBreakdown[level] || 0) + 1;
  }

  // Type breakdown
  const typeBreakdown: Record<string, number> = {};
  for (const a of almaData || []) {
    typeBreakdown[a.type] = (typeBreakdown[a.type] || 0) + 1;
  }

  const pack = {
    type: 'state_evidence_pack',
    generated_at: new Date().toISOString(),
    generated_by: 'CivicGraph — Allocation Intelligence',
    state,
    summary: {
      indigenous_organisations: indigenousCount || 0,
      community_controlled: ccCount || 0,
      total_justice_funding: totalFunding,
      alma_interventions: (almaData || []).length,
      jr_interventions: jrInterventions.length,
      yj_interventions: yjInterventions.length,
      linked_to_entities: linkedInterventions.length,
      linkage_rate: (almaData || []).length > 0
        ? Math.round((linkedInterventions.length / (almaData || []).length) * 100)
        : 0,
    },
    interventions_by_type: typeBreakdown,
    interventions_by_evidence: evidenceBreakdown,
    justice_funding: {
      total: totalFunding,
      records: (fundingData || []).length,
      by_program: groupBy(fundingData || [], 'program_name', 'amount_dollars'),
      by_sector: groupBy(fundingData || [], 'sector', 'amount_dollars'),
    },
    closing_the_gap: {
      target_11: {
        baseline_rate: 31.9,
        target_rate: 22.33,
        target_year: 2031,
        reduction_required: '30%',
        status: 'off_track',
      },
    },
    top_interventions: (almaData || [])
      .sort((a, b) => (b.serves_youth_justice ? 1 : 0) - (a.serves_youth_justice ? 1 : 0))
      .slice(0, 20)
      .map(a => ({
        name: a.name,
        type: a.type,
        evidence_level: a.evidence_level,
        linked: !!a.gs_entity_id,
        serves_youth_justice: a.serves_youth_justice,
      })),
    data_sources: [
      'Australian Living Map of Alternatives (ALMA) — JusticeHub evidence database',
      'CivicGraph Entity Graph — 143K organisations, ABN-verified',
      'Justice Funding Database — Federal & state funding records',
      'Closing the Gap — Productivity Commission reporting',
      'SEIFA 2021 — ABS Socio-Economic Indexes for Areas',
    ],
    citation: `CivicGraph State Evidence Pack: ${state}. Generated ${new Date().toISOString().split('T')[0]}. Data sources: Australian Living Map of Alternatives (ALMA), CivicGraph Entity Graph, Justice Funding Database.`,
  };

  if (format === 'html') {
    return new Response(renderStateHTML(pack), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return NextResponse.json(pack);
}

// Helper: group and sum
function groupBy(items: Record<string, unknown>[], key: string, valueKey: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const k = (item[key] as string) || 'Unknown';
    result[k] = (result[k] || 0) + ((item[valueKey] as number) || 0);
  }
  return result;
}

// HTML renderers for print-to-PDF

function formatMoney(amount: number): string {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function htmlShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title} — CivicGraph Evidence Pack</title>
<style>
  @page { margin: 2cm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a; line-height: 1.5; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
  .header { border-bottom: 4px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 32px; }
  .header h1 { font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
  .header .subtitle { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em; color: #888; margin-top: 4px; }
  .header .date { font-size: 11px; color: #888; margin-top: 8px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; color: #888; border-bottom: 2px solid #e5e5e5; padding-bottom: 4px; margin-bottom: 12px; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
  .stat { border: 2px solid #1a1a1a; padding: 12px; }
  .stat-value { font-size: 24px; font-weight: 900; }
  .stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #888; }
  .stat-value.red { color: #c0392b; }
  .stat-value.green { color: #27ae60; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
  th { text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #888; border-bottom: 2px solid #1a1a1a; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; }
  td.money { font-family: 'SF Mono', 'Consolas', monospace; text-align: right; }
  .tag { display: inline-block; padding: 2px 6px; font-size: 10px; font-weight: 700; border: 1px solid; margin-right: 4px; }
  .tag-red { color: #c0392b; border-color: #c0392b; background: #fdf2f0; }
  .tag-green { color: #27ae60; border-color: #27ae60; background: #f0fdf4; }
  .tag-blue { color: #2980b9; border-color: #2980b9; background: #f0f7fd; }
  .evidence-card { border: 2px solid #e5e5e5; padding: 16px; margin-bottom: 12px; }
  .evidence-card h3 { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
  .evidence-card .meta { font-size: 11px; color: #888; margin-bottom: 8px; }
  .evidence-card p { font-size: 13px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 4px solid #1a1a1a; font-size: 10px; color: #888; }
  .footer .brand { font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; color: #1a1a1a; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>
${body}
<div class="footer">
  <div class="brand">CivicGraph — Decision Infrastructure for Government &amp; Social Sector</div>
  <p style="margin-top:4px">Data sources: Australian Living Map of Alternatives (ALMA), CivicGraph Entity Graph, Justice Funding Database, SEIFA 2021.</p>
  <p>This evidence pack is auto-generated. Verify critical claims against primary sources before inclusion in formal submissions.</p>
</div>
</body>
</html>`;
}

function renderInterventionHTML(pack: Record<string, unknown>): string {
  const i = pack.intervention as Record<string, unknown>;
  const entity = pack.delivery_organisation as Record<string, unknown> | null;
  const evidence = pack.evidence as Record<string, unknown>[];
  const outcomes = pack.outcomes as Record<string, unknown>[];
  const funding = pack.justice_funding as Record<string, unknown>;

  let body = `
<div class="header">
  <div class="subtitle">CivicGraph — Intervention Evidence Pack</div>
  <h1>${i.name}</h1>
  <div class="date">Generated ${(pack.generated_at as string).split('T')[0]}</div>
</div>

<div class="stat-grid">
  <div class="stat"><div class="stat-label">Type</div><div class="stat-value" style="font-size:16px">${i.type}</div></div>
  <div class="stat"><div class="stat-label">Evidence Level</div><div class="stat-value" style="font-size:16px">${i.evidence_level || 'Not rated'}</div></div>
  <div class="stat"><div class="stat-label">Portfolio Score</div><div class="stat-value">${i.portfolio_score || '—'}</div></div>
  <div class="stat"><div class="stat-label">Cultural Authority</div><div class="stat-value" style="font-size:16px">${i.cultural_authority || '—'}</div></div>
  <div class="stat"><div class="stat-label">Years Operating</div><div class="stat-value">${i.years_operating || '—'}</div></div>
  <div class="stat"><div class="stat-label">Justice Funding</div><div class="stat-value red">${formatMoney(funding.total as number)}</div></div>
</div>

<div class="section">
  <div class="section-title">Description</div>
  <p style="font-size:14px">${i.description || 'No description available.'}</p>
</div>

<div class="section">
  <div class="section-title">Target &amp; Reach</div>
  <table><tr><th>Cohort</th><th>Geography</th><th>Cost/Person</th><th>Scalability</th><th>Replication</th></tr>
  <tr><td>${i.target_cohort || '—'}</td><td>${Array.isArray(i.geography) ? (i.geography as string[]).join(', ') : (i.geography || '—')}</td><td>${i.cost_per_young_person || '—'}</td><td>${i.scalability || '—'}</td><td>${i.replication_readiness || '—'}</td></tr></table>
</div>`;

  if (entity) {
    body += `
<div class="section">
  <div class="section-title">Delivery Organisation</div>
  <table><tr><th>Name</th><th>ABN</th><th>Type</th><th>State</th><th>LGA</th><th>SEIFA</th><th>Community Ctrl</th></tr>
  <tr><td><strong>${entity.name}</strong></td><td style="font-family:monospace">${entity.abn || '—'}</td><td>${entity.type}</td><td>${entity.state}</td><td>${entity.lga || '—'}</td><td>${entity.seifa_decile || '—'}</td><td>${entity.community_controlled ? '<span class="tag tag-green">YES</span>' : 'No'}</td></tr></table>
</div>`;
  }

  if (evidence.length > 0) {
    body += `<div class="section"><div class="section-title">Evidence Records (${evidence.length})</div>`;
    for (const e of evidence) {
      body += `<div class="evidence-card">
        <h3>${e.title || 'Untitled'}</h3>
        <div class="meta"><span class="tag tag-blue">${e.type}</span> ${e.methodology || ''} ${e.sample_size ? `· n=${e.sample_size}` : ''} ${e.effect_size ? `· effect: ${e.effect_size}` : ''}</div>
        <p>${e.findings || 'No findings summary available.'}</p>
        ${e.author ? `<div class="meta" style="margin-top:8px">${e.author}${e.organization ? `, ${e.organization}` : ''}${e.publication_date ? ` (${e.publication_date})` : ''}</div>` : ''}
      </div>`;
    }
    body += '</div>';
  }

  if (outcomes.length > 0) {
    body += `<div class="section"><div class="section-title">Measured Outcomes (${outcomes.length})</div><table><tr><th>Outcome</th><th>Type</th><th>Measurement</th><th>Indicators</th></tr>`;
    for (const o of outcomes) {
      body += `<tr><td><strong>${o.name}</strong></td><td>${o.type || '—'}</td><td>${o.measurement_method || '—'}</td><td style="font-size:11px">${Array.isArray(o.indicators) ? (o.indicators as string[]).join(', ') : (o.indicators || '—')}</td></tr>`;
    }
    body += '</table></div>';
  }

  return htmlShell(i.name as string, body);
}

function renderEntityHTML(pack: Record<string, unknown>): string {
  const e = pack.entity as Record<string, unknown>;
  const interventions = pack.alma_interventions as Record<string, unknown>[];
  const funding = pack.justice_funding as Record<string, unknown>;
  const contracts = pack.government_contracts as Record<string, unknown>;
  const donations = pack.political_donations as Record<string, unknown>;
  const flags = pack.integrity_flags as Record<string, boolean>;

  let body = `
<div class="header">
  <div class="subtitle">CivicGraph — Entity Evidence Pack</div>
  <h1>${e.name}</h1>
  <div class="date">ABN ${e.abn || 'Not registered'} · ${e.type} · Generated ${(pack.generated_at as string).split('T')[0]}</div>
</div>

<div class="stat-grid">
  <div class="stat"><div class="stat-label">ALMA Interventions</div><div class="stat-value">${interventions.length}</div></div>
  <div class="stat"><div class="stat-label">Justice Funding</div><div class="stat-value red">${formatMoney(funding.total as number)}</div></div>
  <div class="stat"><div class="stat-label">Gov Contracts</div><div class="stat-value">${formatMoney(contracts.total as number)}</div></div>
  <div class="stat"><div class="stat-label">Political Donations</div><div class="stat-value${(donations.total as number) > 0 ? ' red' : ''}">${formatMoney(donations.total as number)}</div></div>
  <div class="stat"><div class="stat-label">Location</div><div class="stat-value" style="font-size:14px">${e.lga || e.state || '—'}</div></div>
  <div class="stat"><div class="stat-label">SEIFA Decile</div><div class="stat-value">${e.seifa_decile || '—'}</div></div>
</div>`;

  if (flags.donations_and_contracts) {
    body += `<div class="section" style="border:2px solid #c0392b;padding:12px;margin-bottom:24px"><strong style="color:#c0392b">INTEGRITY FLAG:</strong> This entity has both political donation records and government contract records. Cross-reference recommended.</div>`;
  }

  if (interventions.length > 0) {
    body += `<div class="section"><div class="section-title">Australian Living Map of Alternatives (ALMA) Interventions</div><table><tr><th>Name</th><th>Type</th><th>Evidence</th><th>Youth Justice</th><th>Score</th></tr>`;
    for (const i of interventions) {
      body += `<tr><td>${i.name}</td><td>${i.type}</td><td>${i.evidence_level || '—'}</td><td>${i.serves_youth_justice ? '<span class="tag tag-green">YES</span>' : '—'}</td><td>${i.portfolio_score || '—'}</td></tr>`;
    }
    body += '</table></div>';
  }

  const recentContracts = (contracts as Record<string, unknown>).recent as Record<string, unknown>[];
  if (recentContracts && recentContracts.length > 0) {
    body += `<div class="section"><div class="section-title">Recent Government Contracts</div><table><tr><th>Title</th><th>Value</th><th>Buyer</th><th>Period</th></tr>`;
    for (const c of recentContracts) {
      body += `<tr><td>${c.title}</td><td class="money">${formatMoney(c.value as number)}</td><td>${c.buyer}</td><td style="font-size:11px">${c.start || ''} — ${c.end || ''}</td></tr>`;
    }
    body += '</table></div>';
  }

  return htmlShell(e.name as string, body);
}

function renderStateHTML(pack: Record<string, unknown>): string {
  const s = pack.summary as Record<string, unknown>;
  const byType = pack.interventions_by_type as Record<string, number>;
  const byEvidence = pack.interventions_by_evidence as Record<string, number>;
  const topInterventions = pack.top_interventions as Record<string, unknown>[];

  let body = `
<div class="header">
  <div class="subtitle">CivicGraph — State Evidence Pack</div>
  <h1>${pack.state} — Justice &amp; Allocation Intelligence</h1>
  <div class="date">Generated ${(pack.generated_at as string).split('T')[0]}</div>
</div>

<div class="stat-grid">
  <div class="stat"><div class="stat-label">Indigenous Organisations</div><div class="stat-value">${s.indigenous_organisations}</div></div>
  <div class="stat"><div class="stat-label">Community Controlled</div><div class="stat-value">${s.community_controlled}</div></div>
  <div class="stat"><div class="stat-label">Justice Funding</div><div class="stat-value red">${formatMoney(s.total_justice_funding as number)}</div></div>
  <div class="stat"><div class="stat-label">ALMA Interventions</div><div class="stat-value">${s.alma_interventions}</div></div>
  <div class="stat"><div class="stat-label">Justice Reinvestment</div><div class="stat-value">${s.jr_interventions}</div></div>
  <div class="stat"><div class="stat-label">Entity Linkage</div><div class="stat-value green">${s.linkage_rate}%</div></div>
</div>

<div class="section">
  <div class="section-title">Closing the Gap — Target 11</div>
  <p style="font-size:14px;margin-bottom:12px">Reduce the rate of First Nations young people (10-17) in detention by <strong>30% by 2031</strong>. Baseline: 31.9 per 10,000 (2018-19). Target: 22.3 per 10,000. Status: <span class="tag tag-red">OFF TRACK</span></p>
  <p style="font-size:13px;color:#888">15 of 19 Closing the Gap targets are currently off-track (Productivity Commission 2024).</p>
</div>

<div class="section">
  <div class="section-title">Interventions by Type</div>
  <table><tr><th>Type</th><th style="text-align:right">Count</th></tr>`;

  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    body += `<tr><td>${type}</td><td style="text-align:right;font-weight:700">${count}</td></tr>`;
  }
  body += '</table></div>';

  body += `<div class="section"><div class="section-title">By Evidence Level</div><table><tr><th>Level</th><th style="text-align:right">Count</th></tr>`;
  for (const [level, count] of Object.entries(byEvidence).sort((a, b) => b[1] - a[1])) {
    body += `<tr><td>${level}</td><td style="text-align:right;font-weight:700">${count}</td></tr>`;
  }
  body += '</table></div>';

  if (topInterventions.length > 0) {
    body += `<div class="section"><div class="section-title">Top Interventions</div><table><tr><th>Name</th><th>Type</th><th>Evidence</th><th>Linked</th><th>Youth Justice</th></tr>`;
    for (const i of topInterventions) {
      body += `<tr><td>${i.name}</td><td>${i.type}</td><td>${i.evidence_level || '—'}</td><td>${i.linked ? '<span class="tag tag-green">YES</span>' : '—'}</td><td>${i.serves_youth_justice ? '<span class="tag tag-green">YES</span>' : '—'}</td></tr>`;
    }
    body += '</table></div>';
  }

  return htmlShell(`${pack.state}`, body);
}
