import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';

const FOUNDATION_LABELS: Record<string, string> = {
  'd242967e-0e68-4367-9785-06cf0ec7485e': 'Snow',
  '4ee5baca-c898-4318-ae2b-d79b95379cc7': 'PRF',
  '8f8704be-d6e8-40f3-b561-ac6630ce5b36': 'Minderoo',
  'b9e090e5-1672-48ff-815a-2a6314ebe033': 'Ian Potter',
};

interface PublicReviewRouteProps {
  foundationId: string;
  heroTitle: string;
  heroDescription: string;
  compareTargets: Array<{ id: string; label: string }>;
  backHref?: string;
}

interface FoundationRow {
  id: string;
  name: string;
  acnc_abn: string;
  description: string | null;
  website: string | null;
  total_giving_annual: number | null;
  profile_confidence: string;
  geographic_focus: string[] | null;
  thematic_focus: string[] | null;
}

interface ProgramYearRow {
  id: string;
  report_year: number | null;
  fiscal_year: string | null;
  summary: string | null;
  reported_amount: number | null;
  source_report_url: string | null;
  metadata: Record<string, unknown> | null;
  partners: Array<{ name?: string; role?: string }> | null;
  places: Array<{ name?: string; type?: string }> | null;
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

interface BoardRoleRow {
  person_name: string;
  role_type: string | null;
  person_entity_id: string | null;
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}

function labelise(value: string | null | undefined): string {
  if (!value) return 'Program';
  return value.replace(/_/g, ' ');
}

function sourceLabel(value: string | null | undefined) {
  if (!value) return 'Unknown source';
  return value.replace(/_/g, ' ');
}

function getProgramYearFoundationProgram(row: ProgramYearRow) {
  if (Array.isArray(row.foundation_programs)) return row.foundation_programs[0] ?? null;
  return row.foundation_programs ?? null;
}

function reviewStatus({
  boardRoleCount,
  verifiedGrantCount,
  yearMemoryCount,
  verifiedSourceBackedCount,
}: {
  boardRoleCount: number;
  verifiedGrantCount: number;
  yearMemoryCount: number;
  verifiedSourceBackedCount: number;
}) {
  const completed = [
    boardRoleCount > 0,
    verifiedGrantCount > 0,
    yearMemoryCount > 0,
    verifiedSourceBackedCount > 0,
  ].filter(Boolean).length;

  if (completed === 4) {
    return {
      label: 'Stable review',
      detail: 'Governance, grant layer, recurring year memory, and verified source-backed memory are all live.',
    };
  }

  if (completed >= 2) {
    return {
      label: 'Developing review',
      detail: 'This route is reviewable, but at least one major layer is still thin or absent.',
    };
  }

  return {
    label: 'Early review',
    detail: 'This route is still too thin for stable review and should be treated as a scouting surface only.',
  };
}

function StatCard({ label, value, subtext }: { label: string; value: string; subtext: string }) {
  return (
    <div className="border-4 border-bauhaus-black bg-white p-5">
      <div className="text-xs font-black uppercase tracking-[0.25em] text-bauhaus-muted">{label}</div>
      <div className="mt-2 text-3xl font-black text-bauhaus-black">{value}</div>
      <div className="mt-2 text-sm font-medium text-bauhaus-muted">{subtext}</div>
    </div>
  );
}

export async function PublicFoundationReviewRoute({
  foundationId,
  heroTitle,
  heroDescription,
  compareTargets,
  backHref = '/foundations',
}: PublicReviewRouteProps) {
  const supabase = getServiceSupabase();

  const { data: foundation } = await supabase
    .from('foundations')
    .select('id, name, acnc_abn, description, website, total_giving_annual, profile_confidence, geographic_focus, thematic_focus')
    .eq('id', foundationId)
    .single<FoundationRow>();

  if (!foundation) {
    return (
      <div className="border-4 border-bauhaus-red bg-danger-light p-6">
        <div className="text-sm font-black uppercase tracking-[0.3em] text-bauhaus-red">Foundation route unavailable</div>
        <p className="mt-3 text-sm font-medium text-bauhaus-red">
          The selected foundation did not resolve from the current CivicGraph database.
        </p>
      </div>
    );
  }

  const [
    { data: programYears },
    { data: boardRoles },
    openProgramsResult,
    allProgramsResult,
    foundationGranteeTableResult,
    { data: verifiedGrantRows },
  ] = await Promise.all([
    supabase
      .from('foundation_program_years')
      .select('id, report_year, fiscal_year, summary, reported_amount, source_report_url, metadata, partners, places, foundation_programs(name, program_type)')
      .eq('foundation_id', foundationId)
      .order('report_year', { ascending: false, nullsFirst: false })
      .order('fiscal_year', { ascending: false, nullsFirst: false }),
    (() => {
      const query = supabase
        .from('person_roles')
        .select('person_name, role_type, person_entity_id')
        .is('cessation_date', null)
        .order('role_type', { ascending: true })
        .order('person_name', { ascending: true });
      return foundation.acnc_abn
        ? query.eq('company_abn', foundation.acnc_abn)
        : query.eq('company_name', foundation.name);
    })(),
    supabase
      .from('foundation_programs')
      .select('id', { count: 'exact', head: true })
      .eq('foundation_id', foundationId)
      .eq('status', 'open'),
    supabase
      .from('foundation_programs')
      .select('id', { count: 'exact', head: true })
      .eq('foundation_id', foundationId)
      .in('status', ['open', 'closed', 'ongoing']),
    supabase
      .from('foundation_grantees')
      .select('id', { count: 'exact', head: true })
      .eq('foundation_id', foundationId),
    supabase.rpc('exec_sql', {
      query: `SELECT COUNT(*)::int AS count
              FROM gs_relationships r
              JOIN gs_entities s ON s.id = r.source_entity_id
              WHERE s.abn = '${foundation.acnc_abn}'
                AND r.relationship_type = 'grant'
                AND r.dataset = 'foundation_grantees'`,
    }),
  ]);

  const yearMemoryRows = (programYears || []) as ProgramYearRow[];
  const roleRows = (boardRoles || []) as BoardRoleRow[];
  const relationshipGrantCount = Number(((verifiedGrantRows as Array<{ count: number }> | null)?.[0]?.count) || 0);
  const verifiedGrantCount = Math.max(foundationGranteeTableResult.count || 0, relationshipGrantCount);
  const verifiedSourceBackedCount = yearMemoryRows.filter((row) => {
    const source = typeof row.metadata?.source === 'string' ? row.metadata.source : null;
    return !!source && !source.includes('inferred');
  }).length;
  const status = reviewStatus({
    boardRoleCount: roleRows.length,
    verifiedGrantCount,
    yearMemoryCount: yearMemoryRows.length,
    verifiedSourceBackedCount,
  });

  const themeLine = foundation.thematic_focus?.length ? foundation.thematic_focus.join(' • ') : 'No theme tags yet';
  const geographyLine = foundation.geographic_focus?.length ? foundation.geographic_focus.join(' • ') : 'No geography tags yet';
  const topRoles = roleRows.slice(0, 8);
  const latestPrograms = yearMemoryRows.slice(0, 8);

  return (
    <div className="pb-16">
      <section className="border-b-4 border-bauhaus-black pb-10">
        <Link
          href={backHref}
          className="text-xs font-black uppercase tracking-[0.35em] text-bauhaus-muted transition-colors hover:text-bauhaus-black"
        >
          ← Back
        </Link>
        <div className="mt-4 text-xs font-black uppercase tracking-[0.35em] text-bauhaus-red">Public review route</div>
        <h1 className="mt-4 text-4xl font-black leading-[0.9] text-bauhaus-black sm:text-6xl">
          {heroTitle}
        </h1>
        <p className="mt-5 max-w-3xl text-lg font-medium leading-relaxed text-bauhaus-muted">
          {heroDescription}
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.25em]">
          <span className="border-2 border-bauhaus-black px-3 py-2 text-bauhaus-black">{status.label}</span>
          <span className="border-2 border-bauhaus-blue bg-link-light px-3 py-2 text-bauhaus-blue">
            {foundation.name}
          </span>
          <span className="border-2 border-bauhaus-red bg-bauhaus-red/5 px-3 py-2 text-bauhaus-red">
            ABN {foundation.acnc_abn}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.22em]">
          {compareTargets.map((target) => (
            <Link
              key={target.id}
              href={`/foundations/compare?left=${foundationId}&right=${target.id}`}
              className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
            >
              {target.label}
            </Link>
          ))}
          <Link
            href={`/foundations/${foundationId}`}
            className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
          >
            Open foundation detail
          </Link>
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-0 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Annual giving"
          value={formatMoney(foundation.total_giving_annual)}
          subtext={themeLine}
        />
        <StatCard
          label="Governance roles"
          value={String(roleRows.length)}
          subtext={geographyLine}
        />
        <StatCard
          label="Year memory"
          value={String(yearMemoryRows.length)}
          subtext={`${verifiedSourceBackedCount} source-backed rows`}
        />
        <StatCard
          label="Open programs"
          value={String(openProgramsResult.count || 0)}
          subtext={`${allProgramsResult.count || 0} total tracked programs`}
        />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="border-4 border-bauhaus-black bg-white p-6">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">Review status</div>
          <div className="mt-3 text-3xl font-black text-bauhaus-black">{status.label}</div>
          <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{status.detail}</p>
          <div className="mt-5 space-y-3 text-sm font-medium text-bauhaus-muted">
            <div><span className="font-black text-bauhaus-black">Grant layer:</span> {verifiedGrantCount} verified grant rows.</div>
            <div><span className="font-black text-bauhaus-black">Year-memory layer:</span> {verifiedSourceBackedCount}/{yearMemoryRows.length} rows are source-backed.</div>
            <div><span className="font-black text-bauhaus-black">Website:</span> {foundation.website || 'No website on profile yet.'}</div>
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white p-6">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-blue">What this route proves</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="border-2 border-bauhaus-black p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">People layer</div>
              <div className="mt-2 text-lg font-black text-bauhaus-black">{roleRows.length} visible governance roles</div>
              <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                This foundation is legible at the governance layer and can be compared on board visibility, not just funding totals.
              </p>
            </div>
            <div className="border-2 border-bauhaus-black p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Program memory</div>
              <div className="mt-2 text-lg font-black text-bauhaus-black">{verifiedSourceBackedCount} verified source-backed rows</div>
              <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                Current recurring strands are now tied to visible sources, so the route reads as evidence-backed rather than inferred.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="border-b-4 border-bauhaus-black bg-bauhaus-yellow px-6 py-4">
            <div className="text-xs font-black uppercase tracking-[0.28em] text-bauhaus-black">Governance layer</div>
          </div>
          <div className="space-y-3 p-6">
            {topRoles.length === 0 ? (
              <div className="text-sm font-medium text-bauhaus-muted">No visible board or leadership roles are linked yet.</div>
            ) : (
              topRoles.map((role) => (
                <div key={`${role.person_name}-${role.role_type || 'role'}`} className="border-2 border-bauhaus-black/15 px-4 py-3">
                  <div className="text-sm font-black text-bauhaus-black">{role.person_name}</div>
                  <div className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                    {labelise(role.role_type)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white">
          <div className="border-b-4 border-bauhaus-black bg-bauhaus-blue px-6 py-4">
            <div className="text-xs font-black uppercase tracking-[0.28em] text-white">Latest program year memory</div>
          </div>
          <div className="space-y-4 p-6">
            {latestPrograms.length === 0 ? (
              <div className="text-sm font-medium text-bauhaus-muted">No recurring program year-memory has been added yet.</div>
            ) : (
              latestPrograms.map((row) => {
                const program = getProgramYearFoundationProgram(row);
                const source = typeof row.metadata?.source === 'string' ? row.metadata.source : null;
                return (
                  <div key={row.id} className="border-2 border-bauhaus-black/15 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black text-bauhaus-black">{program?.name || 'Unnamed program'}</div>
                        <div className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                          {row.fiscal_year || row.report_year || 'Unknown year'} · {labelise(program?.program_type)}
                        </div>
                      </div>
                      <div className="text-sm font-black text-bauhaus-red">{formatMoney(row.reported_amount)}</div>
                    </div>
                    <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">
                      {row.summary || 'No narrative summary is attached to this year-memory row yet.'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                      <span className="border-2 border-bauhaus-black px-2 py-1 text-bauhaus-black">
                        Source: {sourceLabel(source)}
                      </span>
                      {row.source_report_url ? (
                        <a
                          href={row.source_report_url}
                          className="border-2 border-bauhaus-blue/25 bg-link-light px-2 py-1 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                        >
                          Evidence: open source
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="mt-10 border-4 border-bauhaus-black bg-white p-6">
        <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">Next moves</div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Link
            href={`/foundations/compare?left=${foundationId}&right=d242967e-0e68-4367-9785-06cf0ec7485e`}
            className="border-2 border-bauhaus-black p-4 transition-colors hover:bg-bauhaus-black hover:text-white"
          >
            <div className="text-lg font-black">Compare with Snow</div>
            <p className="mt-2 text-sm font-medium opacity-80">Use Snow as the strong verified benchmark for portfolio-style review.</p>
          </Link>
          <Link
            href={`/foundations/compare?left=${foundationId}&right=4ee5baca-c898-4318-ae2b-d79b95379cc7`}
            className="border-2 border-bauhaus-black p-4 transition-colors hover:bg-bauhaus-black hover:text-white"
          >
            <div className="text-lg font-black">Compare with PRF</div>
            <p className="mt-2 text-sm font-medium opacity-80">Contrast source-backed year-memory with a stronger verified grant layer.</p>
          </Link>
          <Link
            href="/foundations/compare"
            className="border-2 border-bauhaus-black p-4 transition-colors hover:bg-bauhaus-black hover:text-white"
          >
            <div className="text-lg font-black">Open compare surface</div>
            <p className="mt-2 text-sm font-medium opacity-80">Pivot across the four-foundation review set without leaving the public route.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
