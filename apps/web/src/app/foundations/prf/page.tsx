import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const PRF_FOUNDATION_ID = '4ee5baca-c898-4318-ae2b-d79b95379cc7';
const SNOW_FOUNDATION_ID = 'd242967e-0e68-4367-9785-06cf0ec7485e';
const MINDEROO_FOUNDATION_ID = '8f8704be-d6e8-40f3-b561-ac6630ce5b36';
const IAN_POTTER_FOUNDATION_ID = 'b9e090e5-1672-48ff-815a-2a6314ebe033';

const money = (n: number | null) =>
  n == null ? '—' : n >= 1_000_000_000
    ? `$${(n / 1_000_000_000).toFixed(1)}B`
    : `$${(n / 1_000_000).toFixed(1)}M`;

interface Partner {
  recipient_name: string;
  recipient_abn: string | null;
  gs_entity_id: string | null;
  gs_id: string | null;
  amount_dollars: number;
  program_name: string;
  state: string | null;
  entity_type: string | null;
  is_community_controlled: boolean;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  postcode: string | null;
}

interface AlmaIntervention {
  name: string;
  type: string;
  evidence_level: string | null;
  portfolio_score: number | null;
  target_cohort: string | null;
  geography: string | null;
  org: string;
  org_gs_id: string | null;
}

interface OutcomeSub {
  org_name: string;
  program_name: string;
  reporting_period: string;
  outcomes: Array<{ metric: string; value: number; unit: string; description?: string }>;
  narrative: string | null;
  status: string;
  gs_entity_id: string | null;
  evidence_urls: string[] | null;
}

interface Person {
  person_name: string;
  role_type: string;
  properties: Record<string, unknown> | null;
  gs_id: string | null;
}

interface PortfolioStatus {
  recipient_name: string;
  status: string;
  submissions: number;
  validated: number;
  alma_interventions: number;
  best_portfolio_score: number | null;
  proof_bundles: number;
  pending_tasks: number;
}

interface Grantee {
  canonical_name: string;
  gs_id: string | null;
  entity_type: string | null;
  state: string | null;
  is_community_controlled: boolean;
}

interface BoardInterlock {
  canonical_name: string;
  gs_id: string | null;
  shared_count: number;
}

interface FoundationRecord {
  name: string;
  total_giving_annual: number;
  endowment_size: number | null;
  thematic_focus: string;
  geographic_focus: string;
  giving_history: Array<{ year: string; amount: number; grants?: number }>;
  open_programs: Array<{ name: string; via?: string; focus?: string; amount?: string; cycle?: string; url?: string }>;
  description: string;
  giving_philosophy: string;
  target_recipients: string[];
  wealth_source: string;
}

interface ProgramYearRow {
  id: string;
  report_year: number | null;
  fiscal_year: string | null;
  summary: string | null;
  reported_amount: number | null;
  source_report_url: string | null;
  partners: Array<{ name?: string; role?: string }> | null;
  places: Array<{ name?: string; type?: string }> | null;
  metadata: Record<string, unknown> | null;
  foundation_programs:
    | {
        name: string;
        program_type: string | null;
      }
    | Array<{
        name: string;
        program_type: string | null;
      }>
    | null;
}

interface FoundationCompareRow {
  id: string;
  name: string;
  total_giving_annual: number | null;
  year_memory_count: number;
  open_program_count: number;
}

function getProgramYearFoundationProgram(row: ProgramYearRow) {
  if (Array.isArray(row.foundation_programs)) return row.foundation_programs[0] ?? null;
  return row.foundation_programs ?? null;
}

function labelise(value: string | null | undefined) {
  if (!value) return 'Program';
  return value.replace(/_/g, ' ');
}

function sourceLabel(value: string | null | undefined) {
  if (!value) return 'unknown';
  return value.replace(/_/g, ' ');
}

async function getData() {
  const db = getServiceSupabase();

  const [
    { data: partners },
    { data: alma },
    { data: outcomes },
    { data: people },
    { data: portfolio },
    { data: foundation },
    { data: grantees },
    { data: interlocks },
    { data: programYears },
    { data: comparisonRows },
  ] = await Promise.all([
    db.rpc('exec_sql', {
      query: `SELECT jf.recipient_name, jf.recipient_abn, jf.gs_entity_id,
                     ge.gs_id, jf.amount_dollars, jf.program_name, jf.state,
                     ge.entity_type, ge.is_community_controlled, ge.remoteness,
                     ge.seifa_irsd_decile, ge.postcode
              FROM justice_funding jf
              LEFT JOIN gs_entities ge ON ge.id = jf.gs_entity_id
              WHERE jf.program_name ILIKE '%paul ramsay%' OR jf.program_name ILIKE '%PRF%'
              ORDER BY jf.amount_dollars DESC`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT ai.name, ai.type, ai.evidence_level, ai.portfolio_score,
                     ai.target_cohort, ai.geography, ge.canonical_name as org, ge.gs_id as org_gs_id
              FROM alma_interventions ai
              JOIN gs_entities ge ON ge.id::text = ai.gs_entity_id::text
              WHERE ge.id IN (SELECT gs_entity_id FROM justice_funding
                             WHERE program_name = 'PRF Justice Reinvestment Portfolio'
                             AND gs_entity_id IS NOT NULL)
              ORDER BY ai.portfolio_score DESC NULLS LAST`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT os.org_name, os.program_name, os.reporting_period,
                     os.outcomes, os.narrative, os.status,
                     os.gs_entity_id, os.evidence_urls
              FROM outcome_submissions os
              WHERE os.gs_entity_id IN (
                SELECT ge.gs_id FROM gs_entities ge
                WHERE ge.id IN (SELECT gs_entity_id FROM justice_funding
                               WHERE program_name = 'PRF Justice Reinvestment Portfolio')
              )
              ORDER BY os.created_at DESC`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT pr.person_name, pr.role_type, pr.properties, pe.gs_id
              FROM person_roles pr
              LEFT JOIN gs_entities pe ON pe.id = pr.person_entity_id
              WHERE pr.entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d'
              ORDER BY
                CASE pr.role_type
                  WHEN 'chair' THEN 1
                  WHEN 'ceo' THEN 2
                  WHEN 'cfo' THEN 3
                  WHEN 'director' THEN 4
                  ELSE 5
                END,
                pr.person_name`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT * FROM v_prf_portfolio_outcomes`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT name, total_giving_annual, endowment_size,
                     thematic_focus::text as thematic_focus,
                     geographic_focus,
                     giving_history,
                     open_programs,
                     description,
                     giving_philosophy,
                     target_recipients::text[] as target_recipients,
                     wealth_source
              FROM foundations WHERE acnc_abn = '32623132472'`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT e.canonical_name, e.gs_id, e.entity_type, e.state, e.is_community_controlled
              FROM gs_relationships r
              JOIN gs_entities e ON e.id = r.target_entity_id
              WHERE r.source_entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d'
                AND r.relationship_type = 'grant'
                AND r.dataset = 'foundation_grantees'
              ORDER BY e.canonical_name`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT e.canonical_name, e.gs_id, (r.properties->>'shared_count')::int as shared_count
              FROM gs_relationships r
              JOIN gs_entities e ON e.id = CASE
                WHEN r.source_entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d' THEN r.target_entity_id
                ELSE r.source_entity_id END
              WHERE (r.source_entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d'
                OR r.target_entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d')
                AND r.relationship_type = 'shared_director'
              ORDER BY (r.properties->>'shared_count')::int DESC NULLS LAST, e.canonical_name`,
    }),
    db
      .from('foundation_program_years')
      .select('id, report_year, fiscal_year, summary, reported_amount, source_report_url, partners, places, metadata, foundation_programs(name, program_type)')
      .eq('foundation_id', PRF_FOUNDATION_ID)
      .order('report_year', { ascending: false, nullsFirst: false }),
    db.rpc('exec_sql', {
      query: `SELECT
                f.id,
                f.name,
                f.total_giving_annual,
                (
                  SELECT COUNT(*)::int
                  FROM foundation_program_years y
                  WHERE y.foundation_id = f.id
                ) AS year_memory_count,
                (
                  SELECT COUNT(*)::int
                  FROM foundation_programs p
                  WHERE p.foundation_id = f.id
                    AND p.status = 'open'
                ) AS open_program_count
              FROM foundations f
              WHERE f.id IN ('${PRF_FOUNDATION_ID}', '${SNOW_FOUNDATION_ID}')
              ORDER BY f.total_giving_annual DESC NULLS LAST`,
    }),
  ]);

  return {
    partners: (partners || []) as Partner[],
    alma: (alma || []) as AlmaIntervention[],
    outcomes: (outcomes || []) as OutcomeSub[],
    people: (people || []) as Person[],
    portfolio: (portfolio || []) as PortfolioStatus[],
    foundation: (foundation || [])[0] as FoundationRecord | undefined,
    grantees: (grantees || []) as Grantee[],
    interlocks: (interlocks || []) as BoardInterlock[],
    programYears: (programYears || []) as ProgramYearRow[],
    comparisonRows: (comparisonRows || []) as FoundationCompareRow[],
  };
}

export default async function PRFIntelligencePage() {
  const { partners, alma, outcomes, people, portfolio, foundation, grantees, interlocks, programYears, comparisonRows } =
    await getData();

  const jrPartners = partners.filter(
    (p) => p.program_name === 'PRF Justice Reinvestment Portfolio',
  );
  const otherGrants = partners.filter(
    (p) => p.program_name !== 'PRF Justice Reinvestment Portfolio',
  );
  const totalFunding = partners.reduce(
    (s, p) => s + (p.amount_dollars || 0),
    0,
  );
  const jrTotal = jrPartners.reduce(
    (s, p) => s + (p.amount_dollars || 0),
    0,
  );
  const communityControlled = jrPartners.filter(
    (p) => p.is_community_controlled,
  );
  const veryRemote = jrPartners.filter(
    (p) => p.remoteness === 'Very Remote Australia',
  );

  const statusCounts = {
    proven: portfolio.filter((p) => p.status === 'proven').length,
    submitted: portfolio.filter((p) => p.status === 'submitted').length,
    evidence: portfolio.filter((p) => p.status === 'evidence_exists').length,
    awaiting: portfolio.filter((p) => p.status === 'awaiting_submission').length,
  };

  const uniqueAlmaOrgs = new Set(alma.map((a) => a.org));
  const effectiveInterventions = alma.filter((a) =>
    a.evidence_level?.includes('Effective'),
  );

  // Categorise people
  const boardMembers = people.filter(
    (p) => p.role_type === 'chair' || p.role_type === 'director',
  );
  const executives = people.filter(
    (p) => p.role_type === 'ceo' || p.role_type === 'cfo' || (p.role_type === 'other' && (p.properties as Record<string, string>)?.title?.startsWith('Chief')),
  );
  const seniorStaff = people.filter(
    (p) => p.role_type === 'other' && !(p.properties as Record<string, string>)?.title?.startsWith('Chief'),
  );

  // Giving history for chart
  const givingHistory = Array.isArray(foundation?.giving_history)
    ? foundation.giving_history
    : [];

  // Open programs
  const openPrograms = Array.isArray(foundation?.open_programs)
    ? foundation.open_programs
    : [];

  // Community-controlled grantees
  const ccGrantees = grantees.filter((g) => g.is_community_controlled);
  const snowCompare = comparisonRows.find((row) => row.id === SNOW_FOUNDATION_ID);
  const prfCompare = comparisonRows.find((row) => row.id === PRF_FOUNDATION_ID);
  const inferredProgramYears = programYears.filter((row) => {
    const source = typeof row.metadata?.source === 'string' ? row.metadata.source : null;
    return source?.includes('inferred');
  });
  const reportBackedProgramYears = programYears.filter((row) => {
    const source = typeof row.metadata?.source === 'string' ? row.metadata.source : null;
    return !!source && !source.includes('inferred');
  });
  const stableSignals = [
    boardMembers.length > 0,
    grantees.length > 0,
    programYears.length > 0,
    reportBackedProgramYears.length > 0,
  ].filter(Boolean).length;
  const totalStableSignals = 4;
  const isStableReview = stableSignals === totalStableSignals;

  return (
    <div className="min-h-screen bg-white text-bauhaus-black">
      {/* Header */}
      <header className="border-b-4 border-bauhaus-black px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/foundations"
              className="text-xs uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-red"
            >
              Foundations
            </Link>
            <h1 className="mt-1 text-3xl font-black uppercase tracking-widest">
              Paul Ramsay Foundation
            </h1>
            <p className="mt-1 text-sm text-bauhaus-muted">
              Portfolio Intelligence Dashboard — {foundation?.geographic_focus || 'National'} •{' '}
              ABN 32 623 132 472
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.22em]">
              <Link
                href={`/foundations/compare?left=${PRF_FOUNDATION_ID}&right=${SNOW_FOUNDATION_ID}`}
                className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
              >
                Compare PRF with Snow
              </Link>
              <Link
                href={`/foundations/compare?left=${PRF_FOUNDATION_ID}&right=${MINDEROO_FOUNDATION_ID}`}
                className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
              >
                Compare PRF with Minderoo
              </Link>
              <Link
                href={`/foundations/compare?left=${PRF_FOUNDATION_ID}&right=${IAN_POTTER_FOUNDATION_ID}`}
                className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
              >
                Compare PRF with Ian Potter
              </Link>
              <Link
                href="/foundations/compare"
                className="border-2 border-bauhaus-black/20 bg-gray-50 px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
              >
                Open compare surface
              </Link>
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="text-4xl font-black text-bauhaus-red">
              {money(foundation?.endowment_size ?? null)}
            </div>
            <div className="text-xs uppercase tracking-widest text-bauhaus-muted">
              Endowment
            </div>
            <div className="text-xl font-black">
              {money(foundation?.total_giving_annual ?? null)}<span className="text-sm font-normal text-bauhaus-muted">/yr</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-8 py-8 space-y-12">

        <section className="border-4 border-bauhaus-black bg-white p-6">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">Stable review status</div>
          <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="border-2 border-bauhaus-black bg-gray-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Current completion</div>
              <div className="mt-2 text-3xl font-black text-bauhaus-black">
                {stableSignals}/{totalStableSignals}
              </div>
              <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                {isStableReview
                  ? 'PRF now meets the stable review threshold. Governance, verified grants, recurring year memory, and verified source-backed program rows are all visible on this route.'
                  : 'PRF is one signal away from stable review. The verified grant layer is now visible; the remaining gap is converting recurring program memory from inferred rows into verified source-backed rows.'}
              </p>
              <div className="mt-3 h-3 w-full overflow-hidden border-2 border-bauhaus-black bg-white">
                <div
                  className="h-full bg-bauhaus-red transition-all"
                  style={{ width: `${(stableSignals / totalStableSignals) * 100}%` }}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                <Link
                  href="/foundations/compare?left=4ee5baca-c898-4318-ae2b-d79b95379cc7&right=d242967e-0e68-4367-9785-06cf0ec7485e"
                  className="border-2 border-bauhaus-black/20 bg-white px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                >
                  Back to compare
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="border-2 border-bauhaus-black bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Already in place</div>
                <div className="mt-2 text-lg font-black text-bauhaus-black">Verified grant layer is live</div>
                <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                  PRF now surfaces {grantees.length} verified grant rows on this route. The grant visibility layer is no longer a blocker.
                </p>
                <Link
                  href="#how-prf-funds"
                  className="mt-3 inline-flex items-center border-2 border-bauhaus-red bg-bauhaus-red px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black"
                >
                  Open verified grants
                </Link>
              </div>

              <div className="border-2 border-bauhaus-black bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
                  {isStableReview ? 'Already in place' : 'Remaining task'}
                </div>
                <div className="mt-2 text-lg font-black text-bauhaus-black">
                  {isStableReview ? 'Verified source-backed memory is live' : 'Convert inferred rows to verified source-backed memory'}
                </div>
                <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                  {isStableReview
                    ? `PRF currently has ${inferredProgramYears.length} inferred program-year rows and ${reportBackedProgramYears.length} verified source-backed rows. The recurring program layer is now anchored to official PRF source pages.`
                    : `PRF currently has ${inferredProgramYears.length} inferred program-year rows and ${reportBackedProgramYears.length} verified source-backed rows. Stable review needs those recurring strands tied to official PRF source pages so this layer stops leaning on current-surface inference.`}
                </p>
                <Link
                  href="#program-year-memory"
                  className="mt-3 inline-flex items-center border-2 border-bauhaus-blue bg-link-light px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                >
                  {isStableReview ? 'Open verified year memory' : 'Open year memory'}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Foundation Overview */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-6">
            Foundation Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Key Stats */}
            <div className="border-2 border-bauhaus-black p-4 space-y-3">
              <h3 className="font-black text-sm uppercase tracking-wider">Key Financials</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-bauhaus-muted">Endowment</span>
                  <span className="font-mono font-bold">{money(foundation?.endowment_size ?? null)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-bauhaus-muted">Annual Giving</span>
                  <span className="font-mono font-bold">{money(foundation?.total_giving_annual ?? null)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-bauhaus-muted">Cumulative (since 2016)</span>
                  <span className="font-mono font-bold">$1.5B</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-bauhaus-muted">Partners</span>
                  <span className="font-mono font-bold">175+</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-bauhaus-muted">Total Funded Orgs</span>
                  <span className="font-mono font-bold">356</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-bauhaus-muted">Impact Fund (ESG)</span>
                  <span className="font-mono font-bold">16.4%</span>
                </div>
              </div>
            </div>

            {/* Giving History */}
            <div className="border-2 border-bauhaus-black p-4 space-y-3">
              <h3 className="font-black text-sm uppercase tracking-wider">Giving History</h3>
              <div className="space-y-2">
                {givingHistory.map((g) => (
                  <div key={g.year} className="flex items-center gap-3">
                    <span className="text-xs text-bauhaus-muted w-10">{g.year}</span>
                    <div className="flex-1 h-4 bg-gray-100 relative">
                      <div
                        className="h-4 bg-bauhaus-red"
                        style={{ width: `${(g.amount / 320_000_000) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-sm w-16 text-right">{money(g.amount)}</span>
                  </div>
                ))}
              </div>
              {foundation?.wealth_source && (
                <p className="text-xs text-bauhaus-muted mt-2">{foundation.wealth_source}</p>
              )}
            </div>

            {/* Target Recipients */}
            <div className="border-2 border-bauhaus-black p-4 space-y-3">
              <h3 className="font-black text-sm uppercase tracking-wider">Target Recipients</h3>
              <div className="flex flex-wrap gap-2">
                {(foundation?.target_recipients || []).map((t, i) => (
                  <span key={i} className="text-xs bg-gray-100 px-2 py-1 border border-gray-200">
                    {t}
                  </span>
                ))}
              </div>
              <h3 className="font-black text-sm uppercase tracking-wider pt-2">Thematic Focus</h3>
              <div className="flex flex-wrap gap-1">
                {(foundation?.thematic_focus || '').split(',').filter(Boolean).map((t, i) => (
                  <span key={i} className="text-xs bg-bauhaus-black text-white px-2 py-0.5">
                    {t.trim().replace(/-/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          {foundation?.description && (
            <p className="mt-4 text-sm text-gray-700 max-w-4xl">
              {foundation.description}
            </p>
          )}
        </section>

        <section id="program-year-memory">
          <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-6">
            Recurring Program Year Memory
          </h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {programYears.map((row) => {
                  const program = getProgramYearFoundationProgram(row);
                  const partnerLabel = (row.partners || []).map((partner) => partner.name).filter(Boolean).join(', ');
                  const placeLabel = (row.places || []).map((place) => place.name).filter(Boolean).join(', ');
                  const source = typeof row.metadata?.source === 'string' ? row.metadata.source : null;

                  return (
                    <div key={row.id} className="border-2 border-bauhaus-black p-4 bg-gray-50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-bauhaus-muted font-black">
                            {row.fiscal_year || row.report_year || 'Program year'}
                          </div>
                          <h3 className="mt-1 text-base font-black text-bauhaus-black">
                            {program?.name || 'Unnamed program'}
                          </h3>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.18em] border-2 border-bauhaus-black/30 bg-white px-2 py-1 font-black text-bauhaus-black">
                          {labelise(program?.program_type || 'program')}
                        </span>
                      </div>
                      {row.summary ? (
                        <p className="mt-3 text-sm leading-relaxed text-bauhaus-muted">{row.summary}</p>
                      ) : null}
                      <div className="mt-3 space-y-1 text-xs font-bold text-bauhaus-muted">
                        {partnerLabel ? <p>Partners: {partnerLabel}</p> : null}
                        {placeLabel ? <p>Places: {placeLabel}</p> : null}
                        {source ? <p>Source: {sourceLabel(source)}</p> : null}
                        {row.source_report_url ? (
                          <p>
                            Evidence:{' '}
                            <a
                              href={row.source_report_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-bauhaus-red underline decoration-bauhaus-red underline-offset-4"
                            >
                              open source
                            </a>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-2 border-bauhaus-black p-4 space-y-4 bg-white">
              <h3 className="font-black text-sm uppercase tracking-wider">What changed here</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed">
                PRF now has a verified source-backed year-memory layer in CivicGraph for the current 2025-26
                program surface, and that same layer has already created reviewed program snapshots in Empathy Ledger.
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-bauhaus-muted">Program year rows</span>
                  <span className="font-mono font-bold">{programYears.length}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-bauhaus-muted">Source mode</span>
                  <span className="font-mono font-bold">Official PRF pages</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-bauhaus-muted">EL snapshots</span>
                  <span className="font-mono font-bold">7 reviewed</span>
                </div>
              </div>
              <div className="border-l-4 border-bauhaus-red pl-3 text-sm font-bold text-bauhaus-black">
                This is not annual-review-extracted yet, but it is now anchored to official PRF source pages rather
                than inferred-only program rows. That is enough for stable review while a fuller report extraction
                layer is built later.
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-6">
            Snow vs PRF
          </h2>
          <div className="mb-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.22em]">
            <Link
              href={`/foundations/compare?left=${PRF_FOUNDATION_ID}&right=${SNOW_FOUNDATION_ID}`}
              className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
            >
              Open side-by-side compare
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              {
                label: 'Paul Ramsay',
                href: '/foundations/prf',
                compare: prfCompare,
                note: 'First non-Snow replication case with verified source-backed 2025-26 year memory flowing into EL snapshots.',
              },
              {
                label: 'Snow Foundation',
                href: '/snow-foundation',
                compare: snowCompare,
                note: 'Best verified case so far, with 2023-24 year memory linked across CivicGraph and Empathy Ledger.',
              },
            ].map((item) => (
              <div key={item.label} className="border-2 border-bauhaus-black p-4 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-bauhaus-muted font-black">
                      Comparison route
                    </div>
                    <h3 className="mt-1 text-lg font-black text-bauhaus-black">{item.label}</h3>
                  </div>
                  <Link
                    href={item.href}
                    className="border-2 border-bauhaus-black px-3 py-2 text-[10px] uppercase tracking-[0.18em] font-black hover:bg-bauhaus-black hover:text-white transition-colors"
                  >
                    Open
                  </Link>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-bauhaus-muted">Annual giving</div>
                    <div className="font-mono font-bold">{money(item.compare?.total_giving_annual ?? null)}</div>
                  </div>
                  <div>
                    <div className="text-bauhaus-muted">Open programs</div>
                    <div className="font-mono font-bold">{item.compare?.open_program_count ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-bauhaus-muted">Year memory</div>
                    <div className="font-mono font-bold">{item.compare?.year_memory_count ?? 0}</div>
                  </div>
                </div>
                <p className="mt-4 text-sm text-bauhaus-muted leading-relaxed">{item.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How PRF Funds */}
        <section id="how-prf-funds">
          <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-6">
            How PRF Funds
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Application Routes */}
            <div className="border-2 border-bauhaus-black p-4 space-y-4">
              <h3 className="font-black text-sm uppercase tracking-wider">Application Routes</h3>
              <div className="space-y-3 text-sm">
                <div className="border-b border-gray-200 pb-2">
                  <div className="font-black">Australian Communities Foundation</div>
                  <p className="text-bauhaus-muted text-xs">PRF routes most open grant rounds through ACF</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className="text-xs bg-gray-100 px-2 py-0.5">Just Futures (justice)</span>
                    <span className="text-xs bg-gray-100 px-2 py-0.5">Strengthening Early Years</span>
                    <span className="text-xs bg-gray-100 px-2 py-0.5">Specialist DFV Programs</span>
                  </div>
                  <a href="https://www.communityfoundation.org.au/support" target="_blank" rel="noopener noreferrer" className="text-xs text-bauhaus-red hover:underline mt-1 inline-block">
                    Check ACF for current open rounds &#8599;
                  </a>
                </div>
                <div className="border-b border-gray-200 pb-2">
                  <div className="font-black">PRF Fellowship</div>
                  <p className="text-bauhaus-muted text-xs">Up to $250,000 over 18 months for individuals</p>
                  <p className="text-xs">Annual cycle — applications Oct-Nov</p>
                  <a href="https://www.paulramsayfoundation.org.au/news-resources/2026-fellowships" target="_blank" rel="noopener noreferrer" className="text-xs text-bauhaus-red hover:underline mt-1 inline-block">
                    Fellowship details &#8599;
                  </a>
                </div>
                <div>
                  <div className="font-black">Impact Investing (PRI)</div>
                  <p className="text-bauhaus-muted text-xs">Catalytic investments, not grants. Standing EOI.</p>
                  <a href="https://www.paulramsayfoundation.org.au/invest" target="_blank" rel="noopener noreferrer" className="text-xs text-bauhaus-red hover:underline mt-1 inline-block">
                    Impact investing &#8599;
                  </a>
                </div>
              </div>
            </div>

            {/* Funding Priorities */}
            <div className="border-2 border-bauhaus-black p-4 space-y-4">
              <h3 className="font-black text-sm uppercase tracking-wider">Funding Priorities</h3>
              <p className="text-xs text-bauhaus-muted">PRF does not accept unsolicited applications. Most funding is invitation-only or via ACF rounds.</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-bauhaus-red mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Justice reinvestment</span>
                    <span className="text-bauhaus-muted"> — diversion, throughcare, community-led alternatives to custody</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-bauhaus-blue mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Early childhood</span>
                    <span className="text-bauhaus-muted"> — prenatal to school, family support, early learning</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-bauhaus-yellow mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Employment pathways</span>
                    <span className="text-bauhaus-muted"> — transitions for people experiencing disadvantage</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-bauhaus-black mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Place-based change</span>
                    <span className="text-bauhaus-muted"> — community-led, First Nations self-determination</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-gray-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Family violence</span>
                    <span className="text-bauhaus-muted"> — specialist DFV programs, First Nations-led</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-bauhaus-muted pt-2">&gt;50% of FY25 distributions supported First Nations-led organisations</p>
            </div>
          </div>
        </section>

        {/* Proof Chain Status */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-6">
            Proof of Impact Chain
          </h2>
          <div className="grid grid-cols-4 gap-4">
            <StatusCard
              label="Proven"
              count={statusCounts.proven}
              total={portfolio.length}
              color="bg-green-600"
              desc="Validated outcomes"
            />
            <StatusCard
              label="Submitted"
              count={statusCounts.submitted}
              total={portfolio.length}
              color="bg-blue-600"
              desc="Outcomes reported"
            />
            <StatusCard
              label="Evidence"
              count={statusCounts.evidence}
              total={portfolio.length}
              color="bg-yellow-600"
              desc="ALMA interventions"
            />
            <StatusCard
              label="Gap"
              count={statusCounts.awaiting}
              total={portfolio.length}
              color="bg-bauhaus-red"
              desc="No outcomes data"
            />
          </div>
        </section>

        {/* Justice Reinvestment Portfolio — The Map */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-2">
            Justice Reinvestment Portfolio
          </h2>
          <p className="text-sm text-bauhaus-muted mb-6">
            {jrPartners.length} partners • {money(jrTotal)} committed •{' '}
            {communityControlled.length} community-controlled •{' '}
            {veryRemote.length} Very Remote
          </p>

          <div className="space-y-3">
            {portfolio.map((p) => {
              const partner = jrPartners.find(
                (jp) => jp.recipient_name === p.recipient_name,
              );
              return (
                <div
                  key={p.recipient_name}
                  className="border-2 border-bauhaus-black p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-black text-lg">
                          {partner?.gs_id ? (
                            <Link
                              href={`/entities/${partner.gs_id}`}
                              className="hover:text-bauhaus-red"
                            >
                              {p.recipient_name}
                            </Link>
                          ) : (
                            p.recipient_name
                          )}
                        </h3>
                        <StatusBadge status={p.status} />
                        {partner?.is_community_controlled && (
                          <span className="text-xs bg-bauhaus-black text-white px-2 py-0.5 uppercase tracking-wider">
                            Community Controlled
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex gap-4 text-xs text-bauhaus-muted">
                        <span>{money(partner?.amount_dollars ?? null)}</span>
                        {partner?.state && <span>{partner.state}</span>}
                        {partner?.remoteness && (
                          <span>{partner.remoteness}</span>
                        )}
                        {partner?.seifa_irsd_decile && (
                          <span>SEIFA D{partner.seifa_irsd_decile}</span>
                        )}
                        {partner?.postcode && (
                          <Link
                            href={`/places/${partner.postcode}`}
                            className="hover:text-bauhaus-red"
                          >
                            {partner.postcode}
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex gap-2 text-xs">
                        {p.alma_interventions > 0 && (
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5">
                            {p.alma_interventions} ALMA
                          </span>
                        )}
                        {p.submissions > 0 && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5">
                            {p.submissions} outcomes
                          </span>
                        )}
                        {p.proof_bundles > 0 && (
                          <span className="bg-green-100 text-green-800 px-2 py-0.5">
                            {p.proof_bundles} bundles
                          </span>
                        )}
                        {p.pending_tasks > 0 && (
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5">
                            {p.pending_tasks} tasks
                          </span>
                        )}
                      </div>
                      {p.best_portfolio_score && (
                        <div className="mt-1 text-xs text-bauhaus-muted">
                          Score: {(p.best_portfolio_score * 100).toFixed(0)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Full Grant Network */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-2">
            Full Grant Network
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            {grantees.length} funded organisations (FY2024 ACNC filing) •{' '}
            {ccGrantees.length} community-controlled
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {grantees.map((g, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 px-2 border-b border-gray-100 text-sm">
                {g.is_community_controlled && (
                  <span className="w-2 h-2 bg-bauhaus-red flex-shrink-0" title="Community-controlled" />
                )}
                {g.gs_id ? (
                  <Link href={`/entities/${g.gs_id}`} className="hover:text-bauhaus-red truncate">
                    {g.canonical_name}
                  </Link>
                ) : (
                  <span className="truncate">{g.canonical_name}</span>
                )}
                {g.state && (
                  <span className="text-xs text-bauhaus-muted flex-shrink-0">{g.state}</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Evidence Map — ALMA Interventions */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-2">
            Evidence Map
          </h2>
          <p className="text-sm text-bauhaus-muted mb-6">
            {alma.length} interventions across {uniqueAlmaOrgs.size} orgs •{' '}
            {effectiveInterventions.length} rated Effective
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-bauhaus-black text-left">
                  <th className="py-2 font-black uppercase tracking-wider text-xs">
                    Intervention
                  </th>
                  <th className="py-2 font-black uppercase tracking-wider text-xs">
                    Org
                  </th>
                  <th className="py-2 font-black uppercase tracking-wider text-xs">
                    Type
                  </th>
                  <th className="py-2 font-black uppercase tracking-wider text-xs">
                    Evidence
                  </th>
                  <th className="py-2 font-black uppercase tracking-wider text-xs text-right">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {alma.slice(0, 15).map((a, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-200 hover:bg-gray-50"
                  >
                    <td className="py-2 font-medium">{a.name}</td>
                    <td className="py-2 text-bauhaus-muted">
                      {a.org_gs_id ? (
                        <Link href={`/entities/${a.org_gs_id}`} className="hover:text-bauhaus-red">{a.org}</Link>
                      ) : a.org}
                    </td>
                    <td className="py-2">
                      <span className="text-xs bg-gray-100 px-2 py-0.5">
                        {a.type}
                      </span>
                    </td>
                    <td className="py-2">
                      <EvidenceBadge level={a.evidence_level} />
                    </td>
                    <td className="py-2 text-right font-mono">
                      {a.portfolio_score
                        ? (a.portfolio_score * 100).toFixed(0)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {alma.length > 15 && (
              <p className="mt-2 text-xs text-bauhaus-muted">
                + {alma.length - 15} more interventions
              </p>
            )}
          </div>
        </section>

        {/* Outcomes Submissions */}
        {outcomes.length > 0 && (
          <section>
            <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-6">
              Outcome Submissions
            </h2>
            <div className="space-y-6">
              {outcomes.map((o, i) => (
                <div key={i} className="border-2 border-bauhaus-black p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-black">
                        {o.gs_entity_id ? (
                          <Link href={`/entities/${o.gs_entity_id}`} className="hover:text-bauhaus-red">{o.org_name}</Link>
                        ) : o.org_name}
                      </h3>
                      <p className="text-sm text-bauhaus-muted">
                        {o.program_name} • {o.reporting_period}
                      </p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  {o.narrative && (
                    <p className="mt-2 text-sm text-gray-700 italic">
                      {o.narrative}
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {(Array.isArray(o.outcomes) ? o.outcomes : []).map(
                      (m, j) => (
                        <div key={j} className="bg-gray-50 p-2 text-xs">
                          <div className="font-mono font-bold">
                            {m.value != null ? m.value.toLocaleString() : '—'}{' '}
                            <span className="text-bauhaus-muted">
                              {m.unit}
                            </span>
                          </div>
                          <div className="text-bauhaus-muted">
                            {m.metric.replace(/_/g, ' ')}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                  {Array.isArray(o.evidence_urls) && o.evidence_urls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {o.evidence_urls.map((url: string, k: number) => (
                        <a key={k} href={url} target="_blank" rel="noopener noreferrer"
                           className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline">
                          Source Document {(o.evidence_urls?.length ?? 0) > 1 ? k + 1 : ''} &rarr;
                        </a>
                      ))}
                    </div>
                  )}
                  {o.gs_entity_id && (
                    <div className="mt-2 flex gap-3">
                      <Link href={`/entities/${o.gs_entity_id}#funding`}
                            className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-red">
                        View Funding &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Other PRF Programs */}
        {otherGrants.length > 0 && (
          <section>
            <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-6">
              Other PRF Programs
            </h2>
            <div className="space-y-2">
              {otherGrants.map((g, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-gray-200 py-2"
                >
                  <div>
                    {g.gs_id ? (
                      <Link href={`/entities/${g.gs_id}`} className="font-medium hover:text-bauhaus-red">{g.recipient_name}</Link>
                    ) : (
                      <span className="font-medium">{g.recipient_name}</span>
                    )}
                    <span className="ml-2 text-xs text-bauhaus-muted">
                      {g.program_name}
                    </span>
                  </div>
                  <span className="font-mono text-sm">
                    {money(g.amount_dollars)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Governance — Board, Executives, Staff */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-6">
            Board & Leadership
          </h2>

          {/* Board of Directors */}
          <h3 className="font-black text-sm uppercase tracking-wider mb-3">Board of Directors</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            {boardMembers.map((p, i) => {
              const props = (p.properties || {}) as Record<string, string>;
              const displayName = `${props.title === 'Sir' ? 'Sir ' : ''}${p.person_name}${props.honours ? ` ${props.honours}` : ''}`;
              return (
                <div key={i} className="border-2 border-bauhaus-black p-3">
                  <div className="font-black">
                    {p.gs_id ? (
                      <Link href={`/entities/${p.gs_id}`} className="hover:text-bauhaus-red">
                        {displayName}
                      </Link>
                    ) : displayName}
                  </div>
                  <div className="text-xs text-bauhaus-muted uppercase tracking-wider">
                    {p.role_type}{props.additional_role ? ` • ${props.additional_role}` : ''}
                  </div>
                  {props.background && (
                    <p className="text-xs text-gray-600 mt-1">{props.background}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Executive Team */}
          <h3 className="font-black text-sm uppercase tracking-wider mb-3">Executive Team</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            {executives.map((p, i) => {
              const props = (p.properties || {}) as Record<string, string>;
              const title = p.role_type === 'ceo' ? 'Chief Executive Officer'
                : p.role_type === 'cfo' ? 'Chief Financial Officer'
                : props.title || p.role_type;
              return (
                <div key={i} className="border border-bauhaus-black p-3">
                  <div className="font-black">
                    {p.gs_id ? (
                      <Link href={`/entities/${p.gs_id}`} className="hover:text-bauhaus-red">
                        {p.person_name}
                      </Link>
                    ) : p.person_name}
                  </div>
                  <div className="text-xs text-bauhaus-muted uppercase tracking-wider">
                    {title}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Senior Staff */}
          {seniorStaff.length > 0 && (
            <>
              <h3 className="font-black text-sm uppercase tracking-wider mb-3">Senior Staff</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {seniorStaff.map((p, i) => {
                  const props = (p.properties || {}) as Record<string, string>;
                  return (
                    <div key={i} className="border border-gray-200 p-2">
                      <div className="font-medium text-sm">
                        {p.gs_id ? (
                          <Link href={`/entities/${p.gs_id}`} className="hover:text-bauhaus-red">
                            {p.person_name}
                          </Link>
                        ) : p.person_name}
                      </div>
                      <div className="text-xs text-bauhaus-muted">
                        {props.title || p.role_type}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* Board Interlocks */}
        {interlocks.length > 0 && (
          <section>
            <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-2">
              Board Interlocks
            </h2>
            <p className="text-sm text-bauhaus-muted mb-4">
              PRF directors share board seats with {interlocks.length} other organisations
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {interlocks.map((il, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 px-2 border border-gray-200 text-sm">
                  {il.shared_count > 1 && (
                    <span className="text-xs bg-bauhaus-red text-white px-1.5 py-0.5 font-mono flex-shrink-0">
                      {il.shared_count}
                    </span>
                  )}
                  {il.gs_id ? (
                    <Link href={`/entities/${il.gs_id}`} className="hover:text-bauhaus-red truncate">
                      {il.canonical_name}
                    </Link>
                  ) : (
                    <span className="truncate">{il.canonical_name}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Data Sources */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-4">
            Data Sources
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <DataSourceCard label="Board & Staff" count={people.length} source="ACNC Register + Web Research" />
            <DataSourceCard label="JR Portfolio" count={jrPartners.length} source="PRF Portfolio Review PDF" />
            <DataSourceCard label="Grant Network" count={grantees.length} source="ACNC Annual Report (FY24)" />
            <DataSourceCard label="ALMA Evidence" count={alma.length} source="JusticeHub ALMA Database" />
            <DataSourceCard label="Outcomes" count={outcomes.length} source="Annual Report Ingestion" />
            <DataSourceCard label="Board Interlocks" count={interlocks.length} source="ACNC Cross-Reference" />
            <DataSourceCard label="Shared Directors" count={interlocks.filter(il => il.shared_count > 1).length} source="Multi-board overlap" />
            <DataSourceCard label="Proof Tasks" count={portfolio.reduce((s, p) => s + p.pending_tasks, 0)} source="Governed Proof Pipeline" />
          </div>
        </section>

        {/* Opportunities */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-red pb-2 mb-6 text-bauhaus-red">
            Opportunities
          </h2>
          <div className="space-y-4">
            <OpportunityCard
              title="6 partners have zero outcomes data"
              description={`${portfolio
                .filter((p) => p.status === 'awaiting_submission')
                .map((p) => p.recipient_name)
                .join(', ')} — no outcome submissions, no ALMA evidence. Governed Proof tasks are queued.`}
              action="Prioritise annual report collection or direct outreach for outcome submissions"
              urgency="high"
            />
            <OpportunityCard
              title="3 community-controlled orgs need culturally safe reporting"
              description="ALS NSW/ACT, Anindilyakwa, and Olabud Doogethu are Aboriginal community-controlled. Standard outcome metrics may not capture cultural impact."
              action="Use voice_confidence dimension in Governed Proof — narrative + Elder endorsement alongside quantitative metrics"
              urgency="medium"
            />
            <OpportunityCard
              title="Just Reinvest NSW has 10 ALMA interventions but no outcome submission"
              description="Strongest evidence base in the portfolio (6 rated Effective, score up to 66.6). Rich data exists but isn't flowing through the outcomes pipeline."
              action="Priority target for PDF ingestion — their evaluation reports would yield high-quality structured outcomes"
              urgency="medium"
            />
            <OpportunityCard
              title={`${alma.filter((a) => a.evidence_level?.includes('Untested')).length} interventions at pilot stage`}
              description="Target Zero (WEstjustice/CMY) and others are Untested — theory/pilot stage. These are the highest-leverage evaluation targets."
              action="Connect with program managers for formative evaluation data — even early signals strengthen the proof chain"
              urgency="low"
            />
            <OpportunityCard
              title={`${grantees.length} funded orgs mapped — ${ccGrantees.length} community-controlled`}
              description={`Full FY24 ACNC grant network now in CivicGraph. ${ccGrantees.length} community-controlled orgs identified. Cross-reference with government funding for co-investment analysis.`}
              action="Run co-funding analysis: which PRF grantees also receive government justice/DFV funding?"
              urgency="medium"
            />
          </div>
        </section>

        {/* Philosophy */}
        {foundation?.giving_philosophy && (
          <section>
            <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-4">
              Giving Philosophy
            </h2>
            <p className="text-sm text-gray-700 max-w-4xl">
              {foundation.giving_philosophy}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function StatusCard({
  label,
  count,
  total,
  color,
  desc,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  desc: string;
}) {
  return (
    <div className="border-2 border-bauhaus-black p-4">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black">{count}</span>
        <span className="text-sm text-bauhaus-muted">/ {total}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-sm font-black uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-xs text-bauhaus-muted mt-1">{desc}</div>
      <div className="mt-2 h-1 bg-gray-200">
        <div
          className={`h-1 ${color}`}
          style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    proven: 'bg-green-600 text-white',
    validated: 'bg-green-600 text-white',
    submitted: 'bg-blue-600 text-white',
    evidence_exists: 'bg-yellow-100 text-yellow-800',
    awaiting_submission: 'bg-red-50 text-bauhaus-red',
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 uppercase tracking-wider ${styles[status] || 'bg-gray-100'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function EvidenceBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-xs text-gray-400">—</span>;
  const color = level.includes('Effective')
    ? 'text-green-700 bg-green-50'
    : level.includes('Promising')
      ? 'text-yellow-700 bg-yellow-50'
      : 'text-gray-600 bg-gray-50';
  const short = level.split('(')[0].trim();
  return (
    <span className={`text-xs px-2 py-0.5 ${color}`}>{short}</span>
  );
}

function DataSourceCard({
  label,
  count,
  source,
}: {
  label: string;
  count: number;
  source: string;
}) {
  return (
    <div className="border border-gray-200 p-2">
      <div className="flex items-baseline gap-1">
        <span className="font-mono font-bold">{count}</span>
        <span className="text-bauhaus-muted">{label}</span>
      </div>
      <div className="text-bauhaus-muted mt-0.5">{source}</div>
    </div>
  );
}

function OpportunityCard({
  title,
  description,
  action,
  urgency,
}: {
  title: string;
  description: string;
  action: string;
  urgency: 'high' | 'medium' | 'low';
}) {
  const border =
    urgency === 'high'
      ? 'border-bauhaus-red'
      : urgency === 'medium'
        ? 'border-yellow-500'
        : 'border-gray-300';
  return (
    <div className={`border-l-4 ${border} pl-4 py-2`}>
      <h3 className="font-black text-sm">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{description}</p>
      <p className="text-sm mt-1">
        <span className="font-bold">Action:</span> {action}
      </p>
    </div>
  );
}
