import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Snow Foundation Demo | CivicGraph',
  description: 'Public demo route for the Snow Foundation portfolio intelligence and evidence walkthrough.',
};

const SNOW_FOUNDATION_ID = 'd242967e-0e68-4367-9785-06cf0ec7485e';
const SNOW_ORGANISATION_ID = '4a1c31e8-89b7-476d-a74b-0c8b37efc850';
const PRF_FOUNDATION_ID = '4ee5baca-c898-4318-ae2b-d79b95379cc7';
const MINDEROO_FOUNDATION_ID = '8f8704be-d6e8-40f3-b561-ac6630ce5b36';
const IAN_POTTER_FOUNDATION_ID = 'b9e090e5-1672-48ff-815a-2a6314ebe033';

interface SnowFoundationRow {
  id: string;
  name: string;
  acnc_abn: string;
  description: string | null;
  website: string | null;
  total_giving_annual: number | null;
  profile_confidence: string;
  thematic_focus: string[] | null;
  geographic_focus: string[] | null;
  giving_philosophy: string | null;
  gs_entity_id: string | null;
}

interface PowerProfileRow {
  openness_score: number | null;
  approachability_score: number | null;
  gatekeeping_score: number | null;
  capital_holder_class: string | null;
  capital_source_class: string | null;
}

interface FoundationGranteeRow {
  grantee_name: string;
  grant_amount: number | null;
}

interface BoardRoleRow {
  person_name: string;
  role_type: string | null;
  person_entity_id: string | null;
  source: string | null;
}

interface ProgramYearRow {
  id: string;
  report_year: number | null;
  fiscal_year: string | null;
  summary: string | null;
  reported_amount: number | null;
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

function formatMoney(value: number | null | undefined): string {
  if (value == null) return 'Unknown';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}

function formatDecimal(value: number | null | undefined): string {
  if (value == null) return 'Unknown';
  return value.toFixed(2);
}

function labelise(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  return value.replace(/_/g, ' ');
}

function getProgramYearFoundationProgram(row: ProgramYearRow) {
  if (Array.isArray(row.foundation_programs)) return row.foundation_programs[0] ?? null;
  return row.foundation_programs ?? null;
}

function getEmpathyLedgerBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_EMPATHY_LEDGER_URL ||
    process.env.VITE_EMPATHY_LEDGER_URL ||
    'http://127.0.0.1:3030';

  return base.replace(/\/$/, '');
}

function StatCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="border-4 border-bauhaus-black bg-white p-5">
      <div className="text-xs font-black uppercase tracking-[0.25em] text-bauhaus-muted">{label}</div>
      <div className="mt-2 text-3xl font-black text-bauhaus-black">{value}</div>
      {subtext ? <div className="mt-2 text-sm font-medium text-bauhaus-muted">{subtext}</div> : null}
    </div>
  );
}

function ScreenCard({
  step,
  title,
  href,
  platform,
  description,
  transition,
}: {
  step: string;
  title: string;
  href: string;
  platform: string;
  description: string;
  transition?: string;
}) {
  const isInternal = href.startsWith('/');

  return (
    <div className="border-4 border-bauhaus-black bg-white">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-yellow px-4 py-3">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-black">{step}</div>
        <div className="mt-1 text-xl font-black text-bauhaus-black">{title}</div>
      </div>
      <div className="space-y-4 p-4">
        <div className="inline-flex items-center gap-2 border-2 border-bauhaus-black px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
          <span>{platform}</span>
        </div>
        <p className="text-sm font-medium leading-relaxed text-bauhaus-muted">{description}</p>
        {transition ? (
          <div className="border-l-4 border-bauhaus-red pl-3 text-sm font-bold text-bauhaus-black">
            {transition}
          </div>
        ) : null}
        {isInternal ? (
          <Link
            href={href}
            className="inline-flex items-center border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
          >
            Open screen
          </Link>
        ) : (
          <a
            href={href}
            className="inline-flex items-center border-2 border-bauhaus-black px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
          >
            Open screen
          </a>
        )}
      </div>
    </div>
  );
}

export default async function SnowFoundationDemoPage() {
  const supabase = getServiceSupabase();
  const empathyBaseUrl = getEmpathyLedgerBaseUrl();

  const { data: foundation } = await supabase
    .from('foundations')
    .select('id, name, acnc_abn, description, website, total_giving_annual, profile_confidence, thematic_focus, geographic_focus, giving_philosophy, gs_entity_id')
    .eq('id', SNOW_FOUNDATION_ID)
    .single<SnowFoundationRow>();

  if (!foundation) {
    return (
      <div className="border-4 border-bauhaus-red bg-danger-light p-6">
        <div className="text-sm font-black uppercase tracking-[0.3em] text-bauhaus-red">Snow demo unavailable</div>
        <p className="mt-3 text-sm font-medium text-bauhaus-red">
          The Snow Foundation record did not resolve from the current CivicGraph database.
        </p>
      </div>
    );
  }

  const [powerProfileResult, programCountResult, openProgramCountResult, granteeRowsResult, boardRolesResult, foundationPeopleResult, programYearsResult] = await Promise.all([
    supabase
      .from('foundation_power_profiles')
      .select('openness_score, approachability_score, gatekeeping_score, capital_holder_class, capital_source_class')
      .eq('foundation_id', foundation.id)
      .maybeSingle<PowerProfileRow>(),
    supabase
      .from('foundation_programs')
      .select('id', { count: 'exact', head: true })
      .eq('foundation_id', foundation.id)
      .in('status', ['open', 'closed']),
    supabase
      .from('foundation_programs')
      .select('id', { count: 'exact', head: true })
      .eq('foundation_id', foundation.id)
      .eq('status', 'open'),
    supabase
      .from('foundation_grantees')
      .select('grantee_name, grant_amount')
      .eq('foundation_id', foundation.id)
      .eq('grant_year', 2024)
      .order('grant_amount', { ascending: false, nullsFirst: false }),
    supabase
      .from('person_roles')
      .select('person_name, role_type, person_entity_id, source')
      .eq('company_abn', foundation.acnc_abn)
      .is('cessation_date', null)
      .order('role_type', { ascending: true })
      .order('person_name', { ascending: true }),
    supabase
      .from('foundation_people')
      .select('id', { count: 'exact', head: true })
      .eq('foundation_id', foundation.id),
    supabase
      .from('foundation_program_years')
      .select('id, report_year, fiscal_year, summary, reported_amount, partners, places, foundation_programs(name, program_type)')
      .eq('foundation_id', foundation.id)
      .order('report_year', { ascending: false, nullsFirst: false }),
  ]);

  const powerProfile = powerProfileResult.data;
  const granteeRows = (granteeRowsResult.data || []) as FoundationGranteeRow[];
  const boardRoles = ((boardRolesResult.data || []) as BoardRoleRow[]).sort((a, b) => {
    const order = (value: string | null) => {
      if (value === 'chair') return 0;
      if (value === 'director') return 1;
      return 2;
    };
    const rank = order(a.role_type) - order(b.role_type);
    return rank !== 0 ? rank : a.person_name.localeCompare(b.person_name);
  });
  const verifiedValue = granteeRows.reduce((sum, row) => sum + Number(row.grant_amount || 0), 0);
  const topGrantees = granteeRows.slice(0, 3);
  const linkedBoardProfiles = boardRoles.filter((row) => row.person_entity_id).length;
  const foundationPeopleCount = foundationPeopleResult.count || 0;
  const programYears = (programYearsResult.data || []) as ProgramYearRow[];

  const routeCards = [
    {
      step: 'Screen 1',
      title: 'Snow Foundation detail',
      href: `/foundations/${foundation.id}`,
      platform: 'CivicGraph',
      description:
        'Start with the repaired Snow profile. This anchors the walkthrough on a single public capital holder, with annual giving, ABN, program surface, and profile quality in one place.',
      transition: 'This is Snow on its own. The next view places Snow inside the wider funding landscape.',
    },
    {
      step: 'Screen 2',
      title: 'Snow in the funder search',
      href: '/foundations?q=Snow%20Foundation',
      platform: 'CivicGraph',
      description:
        'Move from the isolated card to the wider capital map. This shows Snow as one node in a broader philanthropic field rather than a standalone profile.',
      transition: 'The question is not just who Snow is. The question is what signal path and action path this portfolio can support.',
    },
    {
      step: 'Screen 3',
      title: 'Clarity handoff for Deadly Hearts Trek',
      href: '/insights?subject=Deadly%20Hearts%20Trek&state=NT&output=story-handoff&lanes=clarity,entity,place',
      platform: 'CivicGraph',
      description:
        'This is the public accountability layer between capital and story. It shows the narrative handoff with the active evidence lanes visible instead of implied.',
      transition: 'Now we move from the portfolio map into the community evidence layer.',
    },
    {
      step: 'Screen 4',
      title: 'Snow dashboard',
      href: `${empathyBaseUrl}/organisations/${SNOW_ORGANISATION_ID}/dashboard`,
      platform: 'Empathy Ledger',
      description:
        'Open only the curated dashboard. The point is to show that a real Snow tenant and real project layer exist, not to wander the tenant.',
      transition: 'The dashboard proves the tenant exists. The transcript layer is where the real texture lives.',
    },
    {
      step: 'Screen 5',
      title: 'Snow transcripts',
      href: `${empathyBaseUrl}/organisations/${SNOW_ORGANISATION_ID}/transcripts`,
      platform: 'Empathy Ledger',
      description:
        'This is the strongest live evidence surface. It gives the portfolio view community texture instead of stopping at grant metadata and foundation description.',
      transition: 'The final move is from transcript material into structured project understanding.',
    },
    {
      step: 'Screen 6',
      title: 'Snow analysis view',
      href: `${empathyBaseUrl}/organisations/${SNOW_ORGANISATION_ID}/analysis`,
      platform: 'Empathy Ledger',
      description:
        'Close on the structured interpretation layer. This is where the project evidence becomes an intelligible outcomes frame rather than raw transcript material.',
    },
  ];

  return (
    <div className="pb-16">
      <section className="border-b-4 border-bauhaus-black pb-10">
        <div className="text-xs font-black uppercase tracking-[0.35em] text-bauhaus-red">Public demo route</div>
        <h1 className="mt-4 text-4xl font-black leading-[0.9] text-bauhaus-black sm:text-6xl">
          Snow Foundation
          <br />
          Portfolio demo
        </h1>
        <p className="mt-5 max-w-3xl text-lg font-medium leading-relaxed text-bauhaus-muted">
          This is the public Snow walkthrough for CivicGraph and Empathy Ledger. It strips out the internal
          composer surfaces and keeps only the verified path from capital holder, to evidence chain, to
          community transcript, to structured analysis.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.25em]">
          <span className="border-2 border-bauhaus-black px-3 py-2 text-bauhaus-black">External-safe route</span>
          <span className="border-2 border-bauhaus-blue bg-link-light px-3 py-2 text-bauhaus-blue">No login required on CivicGraph</span>
          <span className="border-2 border-bauhaus-red bg-bauhaus-red/5 px-3 py-2 text-bauhaus-red">Curated, not exploratory</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.22em]">
          <Link
            href={`/foundations/compare?left=${SNOW_FOUNDATION_ID}&right=${PRF_FOUNDATION_ID}`}
            className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
          >
            Compare Snow with PRF
          </Link>
          <Link
            href={`/foundations/compare?left=${SNOW_FOUNDATION_ID}&right=${MINDEROO_FOUNDATION_ID}`}
            className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
          >
            Compare Snow with Minderoo
          </Link>
          <Link
            href={`/foundations/compare?left=${SNOW_FOUNDATION_ID}&right=${IAN_POTTER_FOUNDATION_ID}`}
            className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
          >
            Compare Snow with Ian Potter
          </Link>
          <Link
            href="/foundations/compare"
            className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
          >
            Open compare surface
          </Link>
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-0 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Annual giving"
          value={formatMoney(foundation.total_giving_annual)}
          subtext="Repaired to the Snow annual report baseline."
        />
        <StatCard
          label="Verified 2024 grants"
          value={String(granteeRows.length)}
          subtext={`${formatMoney(verifiedValue)} extracted into the public grant layer.`}
        />
        <StatCard
          label="Open programs"
          value={String(openProgramCountResult.count || 0)}
          subtext={`${programCountResult.count || 0} tracked program records on the profile.`}
        />
        <StatCard
          label="Power posture"
          value={formatDecimal(powerProfile?.openness_score)}
          subtext={`Approachability ${formatDecimal(powerProfile?.approachability_score)} · Gatekeeping ${formatDecimal(powerProfile?.gatekeeping_score)}`}
        />
      </section>

      <section id="governance-graph" className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="border-b-4 border-bauhaus-black bg-bauhaus-blue px-6 py-4">
            <div className="text-xs font-black uppercase tracking-[0.28em] text-white">Governance graph</div>
            <h2 className="mt-2 text-2xl font-black text-white">Structured Snow board roles</h2>
          </div>
          <div className="p-6">
            <div className="mb-4 grid grid-cols-3 gap-0 border-4 border-bauhaus-black">
              <StatCard label="Board roles" value={String(boardRoles.length)} subtext="Active ACNC-linked roles on the Snow entity." />
              <StatCard label="Person links" value={String(linkedBoardProfiles)} subtext="Canonical person entities currently linked." />
              <StatCard label="Foundation people" value={String(foundationPeopleCount)} subtext="Rows in the Snow-specific extraction table." />
            </div>
            <div className="space-y-3">
              {boardRoles.map((member) => (
                <div key={`${member.person_name}-${member.role_type || 'unknown'}`} className="flex items-start justify-between gap-4 border-b-2 border-bauhaus-black/10 pb-3 last:border-b-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/person/${encodeURIComponent(member.person_name)}`} className="text-sm font-black text-bauhaus-black hover:text-bauhaus-blue">
                      {member.person_name}
                    </Link>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                      {(member.role_type || 'role').replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div className="shrink-0 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-muted">
                    {member.source === 'acnc_register' ? 'ACNC register' : member.source || 'Linked'}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-l-4 border-bauhaus-red pl-3 text-sm font-bold text-bauhaus-black">
              {linkedBoardProfiles === 0
                ? 'Snow already has board roles in CivicGraph, but none of the visible roles are attached to canonical person entities yet.'
                : linkedBoardProfiles === boardRoles.length
                  ? 'All visible Snow board roles now resolve to canonical person entities in CivicGraph, but the richer Snow-specific people table is still thin.'
                  : `${linkedBoardProfiles} of ${boardRoles.length} visible Snow board roles now resolve to canonical person entities in CivicGraph, with the remainder still needing cleanup.`}
            </div>
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white">
          <div className="border-b-4 border-bauhaus-black bg-bauhaus-red px-6 py-4">
            <div className="text-xs font-black uppercase tracking-[0.28em] text-white">What is missing</div>
            <h2 className="mt-2 text-2xl font-black text-white">To make Snow fully legible</h2>
          </div>
          <div className="space-y-4 p-6 text-sm font-medium leading-relaxed text-bauhaus-muted">
            <p>
              CivicGraph already has the funder shell, the grant/program layer, ACNC financial history, and structured board
              roles. The weak points are the person entity layer, the Snow-specific people extraction layer, and the bridge into
              the story/project system.
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div className="border-2 border-bauhaus-black p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Missing in CivicGraph</div>
                <div className="mt-2 text-bauhaus-black">Canonical person entities for Snow board members, executive/staff roles, and explicit project or service links to funded work like RHD.</div>
              </div>
              <div className="border-2 border-bauhaus-black p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Missing in Empathy Ledger</div>
                <div className="mt-2 text-bauhaus-black">Contact-grade staff/leadership records and annual report records. The story/project layer exists, but the people/portfolio layer is still thin.</div>
              </div>
              <div className="border-2 border-bauhaus-black p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Missing in the bridge</div>
                <div className="mt-2 text-bauhaus-black">A clean mapping from funder → project → supported service → storyteller, so Snow can see not just who it funded, but who can speak from that work.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="border-4 border-bauhaus-black bg-white p-6">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">What this page proves</div>
          <div className="mt-4 space-y-4 text-sm font-medium leading-relaxed text-bauhaus-muted">
            <p>
              Snow is not being pitched here as a generic funder record. This is a working portfolio case:
              funder profile, public program surface, verified 2024 grant layer, explicit story handoff, and a
              paired evidence tenant.
            </p>
            <p>
              The internal briefing and report-builder pages still matter, but they are operator tools. This page
              exists so the external walkthrough can stay public, simple, and accountable to surfaces that are
              actually demo-safe.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
            <span className="border-2 border-bauhaus-black px-2 py-1 text-bauhaus-black">
              {labelise(powerProfile?.capital_holder_class)}
            </span>
            <span className="border-2 border-bauhaus-black px-2 py-1 text-bauhaus-black">
              {labelise(powerProfile?.capital_source_class)}
            </span>
            {(foundation.thematic_focus || []).slice(0, 4).map((focus) => (
              <span key={focus} className="border-2 border-bauhaus-black/20 px-2 py-1 text-bauhaus-muted">
                {focus}
              </span>
            ))}
            {(foundation.geographic_focus || []).slice(0, 3).map((focus) => (
              <span key={focus} className="border-2 border-bauhaus-blue/30 px-2 py-1 text-bauhaus-blue">
                {focus}
              </span>
            ))}
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-6">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-black">Operator notes</div>
          <ul className="mt-4 space-y-3 text-sm font-medium leading-relaxed text-bauhaus-black">
            <li>Do not open the raw story list or unfinished admin views.</li>
            <li>Do not use the Snow member layer as contact-grade data.</li>
            <li>Keep the narrative on portfolio intelligence plus community evidence, not on dashboard novelty.</li>
            <li>Use this page as the starting screen instead of the internal briefing or report-builder routes.</li>
          </ul>
        </div>
      </section>

      <section className="mt-10 border-4 border-bauhaus-black bg-white">
        <div className="border-b-4 border-bauhaus-black bg-bauhaus-black px-6 py-5">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-yellow">Live Snow baseline</div>
          <h2 className="mt-2 text-2xl font-black text-white">Verified portfolio signals in CivicGraph</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3 text-sm font-medium leading-relaxed text-bauhaus-muted">
            <p>
              <span className="font-black text-bauhaus-black">{foundation.name}</span> is anchored here as ABN{' '}
              <span className="font-black text-bauhaus-black">{foundation.acnc_abn}</span> with{' '}
              <span className="font-black text-bauhaus-black">{formatMoney(foundation.total_giving_annual)}</span> in annual
              giving and <span className="font-black text-bauhaus-black">{openProgramCountResult.count || 0}</span> open
              programs currently visible.
            </p>
            <p>
              The 2024 verified grantee layer currently holds{' '}
              <span className="font-black text-bauhaus-black">{granteeRows.length}</span> rows worth{' '}
              <span className="font-black text-bauhaus-black">{formatMoney(verifiedValue)}</span> from Snow&apos;s
              annual-report-backed 2024 giving. That is the verified capital layer this walkthrough stands on before
              it moves into Clarity and then into the Empathy Ledger evidence surfaces.
            </p>
            {foundation.giving_philosophy ? (
              <p className="border-l-4 border-bauhaus-red pl-3 text-bauhaus-black">
                {foundation.giving_philosophy}
              </p>
            ) : null}
          </div>
          <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-4">
            <div className="text-xs font-black uppercase tracking-[0.25em] text-bauhaus-muted">Top verified 2024 grantees</div>
            <div className="mt-4 space-y-3">
              {topGrantees.map((row) => (
                <div key={row.grantee_name} className="flex items-start justify-between gap-4 border-b-2 border-bauhaus-black/10 pb-3">
                  <div className="text-sm font-black leading-tight text-bauhaus-black">{row.grantee_name}</div>
                  <div className="shrink-0 text-sm font-black text-bauhaus-blue">{formatMoney(row.grant_amount)}</div>
                </div>
              ))}
              {topGrantees.length === 0 ? (
                <div className="text-sm font-medium text-bauhaus-muted">No verified 2024 grantee rows available.</div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section id="year-memory" className="mt-10 border-4 border-bauhaus-black bg-white">
        <div className="border-b-4 border-bauhaus-black bg-bauhaus-blue px-6 py-5">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-white">Cross-system year memory</div>
          <h2 className="mt-2 text-2xl font-black text-white">Snow program strands now persist by year</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-2">
          {programYears.map((row) => {
            const foundationProgram = getProgramYearFoundationProgram(row);
            const partnerLabel = (row.partners || []).map((partner) => partner.name).filter(Boolean).join(', ');
            const placeLabel = (row.places || []).map((place) => place.name).filter(Boolean).join(', ');

            return (
              <div key={row.id} className="border-4 border-bauhaus-black bg-bauhaus-canvas p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                      {row.fiscal_year || row.report_year || 'Program year'}
                    </div>
                    <h3 className="mt-1 text-lg font-black text-bauhaus-black">
                      {foundationProgram?.name || 'Unnamed program'}
                    </h3>
                  </div>
                  {row.reported_amount != null ? (
                    <span className="border-2 border-money bg-money-light px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-money">
                      {formatMoney(row.reported_amount)}
                    </span>
                  ) : null}
                </div>
                {row.summary ? (
                  <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">
                    {row.summary}
                  </p>
                ) : null}
                <div className="mt-3 space-y-1 text-xs font-bold text-bauhaus-muted">
                  {partnerLabel ? <p>Partners: {partnerLabel}</p> : null}
                  {placeLabel ? <p>Places: {placeLabel}</p> : null}
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t-4 border-bauhaus-black bg-bauhaus-yellow px-6 py-4 text-sm font-bold leading-relaxed text-bauhaus-black">
          This is the first real proof that Snow is no longer just a funder card plus a story tenant. The recurring program layer now exists in both CivicGraph and Empathy Ledger, with shared 2023-24 memory for the same five portfolio strands.
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="border-4 border-bauhaus-black bg-white p-6">
          <div className="text-xs font-black uppercase tracking-[0.28em] text-bauhaus-red">How this helps Snow-like orgs</div>
          <div className="mt-4 space-y-4 text-sm font-medium leading-relaxed text-bauhaus-muted">
            <p>
              For funders like Snow, the value is not another dashboard. The value is one chain: who holds capital, who governs
              it, where it goes, which places and projects it touches, and which people can speak to what changed.
            </p>
            <p>
              Once that chain exists, the same system helps other foundations, place-based funders, and program teams do board
              reporting, partner mapping, procurement and grant opportunity scanning, and community evidence handoff from one base
              record.
            </p>
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-6">
          <div className="text-xs font-black uppercase tracking-[0.28em] text-bauhaus-black">Best operating model</div>
          <div className="mt-4 space-y-3 text-sm font-medium leading-relaxed text-bauhaus-black">
            <p><span className="font-black">Organization</span>: Snow as the capital holder and reporting shell.</p>
            <p><span className="font-black">Contacts</span>: board, staff, leadership, partner reps, and key grantee relationships.</p>
            <p><span className="font-black">Projects</span>: RHD, South Coast, women and justice, or any specific portfolio strand.</p>
            <p><span className="font-black">Storytellers</span>: people attached to projects, not only to the parent org.</p>
            <p><span className="font-black">Annual reports</span>: import the portfolio facts once, then attach funded services and projects explicitly.</p>
            <p><span className="font-black">Bridge</span>: each funded service or project should be linkable to transcripts, analysis, and board-ready memos.</p>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">Demo sequence</div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {routeCards.map((card) => (
            <ScreenCard key={card.step} {...card} />
          ))}
        </div>
      </section>
    </div>
  );
}
