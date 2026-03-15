import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import {
  getFundingByState,
  getTopPrograms,
  getTopOrgs,
  getAlmaInterventions,
  getContractStats,
  getCrossSystemOrgs,
  getFundingByLga,
  money,
  fmt,
} from '@/lib/services/report-service';

export const dynamic = 'force-dynamic';

type StateRow = { state: string; grants: number; total: number; orgs: number };
type ProgramRow = { program_name: string; state: string; grants: number; total: number };
type OrgRow = {
  recipient_name: string;
  recipient_abn: string | null;
  state: string | null;
  grants: number;
  total: number;
  gs_id: string | null;
};
type CrossSystemOrg = {
  gs_id: string;
  canonical_name: string;
  entity_type: string | null;
  state: string | null;
  systems: string[];
  total_funding: number;
};
type LgaRow = {
  lga_name: string;
  state: string;
  orgs: number;
  total_funding: number;
  seifa_decile: number | null;
};
type AlmaRow = { name: string; type: string | null; evidence_level: string | null };

async function getReport() {
  const supabase = getServiceSupabase();

  const [
    stateRows,
    programRows,
    topOrgs,
    almaRows,
    contractStatsRaw,
    crossSystem,
    lgaRows,
    countResult,
    eduResult,
    overlayResult,
  ] = await Promise.all([
    getFundingByState('child-protection'),
    getTopPrograms('child-protection'),
    getTopOrgs('child-protection'),
    getAlmaInterventions('child-protection'),
    getContractStats(['child protection', 'child safety', 'out of home care', 'foster care']),
    getCrossSystemOrgs('child-protection', ['youth-justice', 'ndis']),
    getFundingByLga('child-protection'),
    supabase
      .from('gs_entities')
      .select('id', { count: 'exact', head: true })
      .or('sector.ilike.%child%,sector.ilike.%foster%,sector.ilike.%youth%'),
    supabase
      .from('gs_entities')
      .select('id', { count: 'exact', head: true })
      .ilike('sector', '%education%'),
    supabase.from('v_ndis_youth_justice_overlay').select('*').limit(20),
  ]);

  const states = (stateRows || []) as StateRow[];
  const programs = (programRows || []) as ProgramRow[];
  const orgs = (topOrgs || []) as OrgRow[];
  const alma = (almaRows || []) as AlmaRow[];
  const contracts = ((contractStatsRaw as Array<{ contracts: number; total_value: number }> | null)?.[0] || {
    contracts: 0,
    total_value: 0,
  }) as { contracts: number; total_value: number };
  const cross = (crossSystem || []) as CrossSystemOrg[];
  const lgas = (lgaRows || []) as LgaRow[];
  const totalChildProtectionOrgs = countResult.count || 0;
  const educationEntities = eduResult.count || 0;
  const overlay = (overlayResult.data || []) as Array<{
    service_district: string;
    state: string;
    total_participants: number;
    youth_participants: number;
    total_annual_budget: number;
  }>;

  const totalFunding = states.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalGrants = states.reduce((sum, s) => sum + (s.grants || 0), 0);
  const totalOrgs = states.reduce((sum, s) => sum + (s.orgs || 0), 0);

  return {
    programs,
    states,
    orgs,
    crossSystem: cross,
    lgas,
    alma,
    contracts,
    totalFunding,
    totalGrants,
    totalOrgs,
    totalChildProtectionOrgs,
    educationEntities,
    overlay,
  };
}

export default async function ChildProtectionReportPage() {
  const report = await getReport();

  return (
    <div>
      <div className="mb-8">
        <a
          href="/reports"
          className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black"
        >
          &larr; All Reports
        </a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">
          Living Report
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Child Protection Funding and Service Coverage
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Australia spends billions on child protection, out-of-home care, and family safety services — but the money
          flow is fragmented across states, programs, and delivery organisations. This report maps where it goes,
          who receives it, and where it intersects with youth justice, disability, and education systems.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
          <Link
            href="/reports/youth-justice"
            className="px-3 py-2 border-2 border-bauhaus-red text-bauhaus-red bg-bauhaus-red/5 hover:bg-bauhaus-red hover:text-white transition-colors"
          >
            Compare youth justice
          </Link>
          <Link
            href="/reports/ndis-market"
            className="px-3 py-2 border-2 border-bauhaus-blue text-bauhaus-blue bg-link-light hover:bg-bauhaus-blue hover:text-white transition-colors"
          >
            Compare NDIS
          </Link>
          <Link
            href="/places"
            className="px-3 py-2 border-2 border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors"
          >
            Open place coverage
          </Link>
        </div>
      </div>

      {/* Hero stats */}
      <section className="mb-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">
              Total Mapped Funding
            </div>
            <div className="text-4xl font-black">{money(report.totalFunding)}</div>
            <div className="text-white/60 text-xs font-bold mt-2">
              {fmt(report.totalGrants)} grants across child protection programs
            </div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">
              Funded Organisations
            </div>
            <div className="text-4xl font-black text-bauhaus-blue">{fmt(report.totalOrgs)}</div>
            <div className="text-bauhaus-muted text-xs font-bold mt-2">
              distinct orgs receiving child protection funding
            </div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">
              Federal Contracts
            </div>
            <div className="text-4xl font-black text-bauhaus-red">{money(report.contracts.total_value)}</div>
            <div className="text-bauhaus-muted text-xs font-bold mt-2">
              {fmt(report.contracts.contracts || 0)} austender contracts
            </div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">
              Cross-System Orgs
            </div>
            <div className="text-4xl font-black">{fmt(report.crossSystem.length)}</div>
            <div className="text-white/70 text-xs font-bold mt-2">
              orgs in child protection + youth justice or NDIS
            </div>
          </div>
        </div>
      </section>

      {/* Funding by State + Top Programs */}
      <section className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">
              State Breakdown
            </p>
            <h2 className="text-2xl font-black">Where the money goes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-canvas">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Funding</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Grants</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Orgs</th>
                </tr>
              </thead>
              <tbody>
                {report.states.map((row, i) => (
                  <tr key={row.state} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{row.state || '—'}</td>
                    <td className="p-3 text-right font-mono font-black text-bauhaus-red">{money(row.total)}</td>
                    <td className="p-3 text-right font-mono">{fmt(row.grants)}</td>
                    <td className="p-3 text-right font-mono">{fmt(row.orgs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-blue text-white border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">
              Program Categories
            </p>
            <h2 className="text-2xl font-black">How the funding is structured</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-canvas">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Program</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Funding</th>
                </tr>
              </thead>
              <tbody>
                {report.programs.map((row, i) => (
                  <tr key={`${row.program_name}-${row.state}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3">
                      <span className="font-bold text-bauhaus-black">{row.program_name}</span>
                      {row.state && (
                        <span className="ml-2 text-[9px] font-black text-bauhaus-muted uppercase">{row.state}</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-black">{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Top Funded Organisations */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-yellow border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">Power Read</p>
            <h2 className="text-2xl font-black text-bauhaus-black">
              Who receives the most child protection funding
            </h2>
            <p className="text-sm text-bauhaus-black/70 font-medium mt-2 max-w-2xl">
              These are the largest recipients of child protection, out-of-home care, and child safety
              grants. High concentration in a few providers may signal market capture or genuine scale —
              the entity dossier shows which.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Organisation</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Grants</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total Funding</th>
                </tr>
              </thead>
              <tbody>
                {report.orgs.map((row, i) => (
                  <tr key={`${row.recipient_name}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3">
                      {row.gs_id ? (
                        <Link
                          href={`/entities/${row.gs_id}`}
                          className="font-bold text-bauhaus-black hover:text-bauhaus-blue"
                        >
                          {row.recipient_name}
                        </Link>
                      ) : (
                        <span className="font-bold text-bauhaus-black">{row.recipient_name}</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-bauhaus-muted">{row.state || '—'}</td>
                    <td className="p-3 text-right font-mono">{fmt(row.grants)}</td>
                    <td className="p-3 text-right font-mono font-black text-bauhaus-red">{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Cross-System Organisations */}
      {report.crossSystem.length > 0 && (
        <section className="mb-10">
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="bg-bauhaus-red text-white border-b-4 border-bauhaus-black p-5">
              <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">
                Cross-System Analysis
              </p>
              <h2 className="text-2xl font-black">
                Organisations operating across child protection, youth justice, and NDIS
              </h2>
              <p className="text-sm text-white/80 font-medium mt-2 max-w-2xl">
                These organisations appear in multiple systems — the same entity receiving child protection
                funding while also delivering youth justice or NDIS services. This is the pipeline made visible.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-canvas">
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Organisation</th>
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Systems</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total Funding</th>
                  </tr>
                </thead>
                <tbody>
                  {report.crossSystem.map((row, i) => (
                    <tr key={row.gs_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3">
                        <Link
                          href={`/entities/${row.gs_id}`}
                          className="font-bold text-bauhaus-black hover:text-bauhaus-blue"
                        >
                          {row.canonical_name}
                        </Link>
                      </td>
                      <td className="p-3 font-mono text-bauhaus-muted">{row.state || '—'}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {row.systems.map((s) => (
                            <span
                              key={s}
                              className={`text-[9px] font-black px-1.5 py-0.5 border uppercase tracking-widest ${
                                s === 'Youth Justice'
                                  ? 'border-bauhaus-red text-bauhaus-red bg-error-light'
                                  : s === 'NDIS'
                                    ? 'border-bauhaus-blue text-bauhaus-blue bg-link-light'
                                    : 'border-bauhaus-black text-bauhaus-black'
                              }`}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono font-black">{money(row.total_funding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* LGA Funding + SEIFA Overlay */}
      <section className="mb-10 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-canvas border-b-4 border-bauhaus-black p-5">
            <p className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-2">Place Analysis</p>
            <h2 className="text-2xl font-black text-bauhaus-black">
              Where child protection funding concentrates by LGA
            </h2>
            <p className="text-sm text-bauhaus-muted font-medium mt-2">
              SEIFA decile 1 = most disadvantaged. Expect high child protection funding in low-SEIFA areas.
              Where it&apos;s missing is the gap.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">LGA</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Orgs</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Funding</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">SEIFA</th>
                </tr>
              </thead>
              <tbody>
                {report.lgas.map((row, i) => (
                  <tr
                    key={`${row.lga_name}-${row.state}`}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="p-3 font-bold text-bauhaus-black">{row.lga_name}</td>
                    <td className="p-3 font-mono text-bauhaus-muted">{row.state}</td>
                    <td className="p-3 text-right font-mono">{fmt(row.orgs)}</td>
                    <td className="p-3 text-right font-mono font-black text-bauhaus-red">
                      {money(row.total_funding)}
                    </td>
                    <td className="p-3 text-right">
                      {row.seifa_decile != null ? (
                        <span
                          className={`font-mono font-black ${
                            row.seifa_decile <= 3
                              ? 'text-bauhaus-red'
                              : row.seifa_decile <= 5
                                ? 'text-bauhaus-muted'
                                : 'text-money'
                          }`}
                        >
                          {row.seifa_decile}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          {/* ALMA Evidence */}
          <div className="border-4 border-bauhaus-black bg-white p-5">
            <p className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-3">
              Evidence Base (ALMA)
            </p>
            <h3 className="text-lg font-black text-bauhaus-black mb-3">
              What works in child protection
            </h3>
            <p className="text-sm text-bauhaus-muted font-medium mb-4">
              {fmt(report.alma.length)} interventions from the Australian Living Map of Alternatives
              relate to child protection, family preservation, or out-of-home care.
            </p>
            <div className="space-y-2">
              {report.alma.slice(0, 12).map((row) => (
                <div
                  key={row.name}
                  className="flex items-start justify-between text-sm border-b border-bauhaus-black/10 pb-2"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-bauhaus-black">{row.name}</span>
                    {row.type && (
                      <span className="ml-2 text-[9px] font-black text-bauhaus-muted uppercase">
                        {row.type}
                      </span>
                    )}
                  </div>
                  {row.evidence_level && (
                    <span
                      className={`ml-2 text-[9px] font-black px-1.5 py-0.5 border uppercase tracking-widest shrink-0 ${
                        row.evidence_level === 'Strong'
                          ? 'border-money text-money'
                          : row.evidence_level === 'Promising'
                            ? 'border-bauhaus-blue text-bauhaus-blue'
                            : 'border-bauhaus-muted text-bauhaus-muted'
                      }`}
                    >
                      {row.evidence_level}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* System overlap stats */}
          <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-5">
            <p className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-3">
              The Pipeline
            </p>
            <p className="text-sm text-bauhaus-black/80 font-medium leading-relaxed">
              Children in the child protection system are massively over-represented in youth justice.
              Nationally, around 50% of young people under youth justice supervision have also had
              child protection involvement. This report makes that overlap visible at the organisational
              and funding level — not just as a statistic, but as a traceable money flow.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="border-2 border-bauhaus-black p-3 bg-white">
                <p className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
                  Education Entities
                </p>
                <p className="text-2xl font-black text-bauhaus-black mt-1">
                  {fmt(report.educationEntities)}
                </p>
              </div>
              <div className="border-2 border-bauhaus-black p-3 bg-white">
                <p className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
                  Child/Youth Entities
                </p>
                <p className="text-2xl font-black text-bauhaus-black mt-1">
                  {fmt(report.totalChildProtectionOrgs)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NDIS Youth Justice Overlay */}
      {report.overlay.length > 0 && (
        <section className="mb-10">
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="bg-bauhaus-blue text-white border-b-4 border-bauhaus-black p-5">
              <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">
                NDIS &times; Youth Justice Overlay
              </p>
              <h2 className="text-2xl font-black">
                Where disability and youth justice intersect
              </h2>
              <p className="text-sm text-white/80 font-medium mt-2 max-w-2xl">
                NDIS service districts with youth participant counts and budgets — showing where
                disability services, child protection, and youth justice funding overlap geographically.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-canvas">
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">District</th>
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">State</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                      Total Participants
                    </th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                      Youth Participants
                    </th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">
                      Annual Budget
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.overlay.map((row, i) => (
                    <tr
                      key={`${row.service_district}-${row.state}`}
                      className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="p-3 font-bold text-bauhaus-black">{row.service_district}</td>
                      <td className="p-3 font-mono text-bauhaus-muted">{row.state}</td>
                      <td className="p-3 text-right font-mono">{fmt(row.total_participants)}</td>
                      <td className="p-3 text-right font-mono font-black text-bauhaus-red">
                        {fmt(row.youth_participants)}
                      </td>
                      <td className="p-3 text-right font-mono">{money(row.total_annual_budget)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Cross-System CTA */}
      <section className="border-4 border-bauhaus-black bg-bauhaus-yellow/20 p-6">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-2">
          Cross-System Next Move
        </p>
        <h2 className="text-2xl font-black text-bauhaus-black mb-3">
          This is not just a child protection report
        </h2>
        <p className="text-sm text-bauhaus-black/80 font-medium max-w-4xl leading-relaxed">
          The value is in the connections: the same organisations appear in child protection, youth justice,
          NDIS, and education funding. The same postcodes show up as high-disadvantage, high-need,
          and low-service. CivicGraph makes these cross-system patterns visible — so that funding decisions
          can be made with the full picture, not just one silo at a time.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Link
            href="/reports/youth-justice"
            className="border-2 border-bauhaus-black bg-white p-4 hover:bg-bauhaus-black hover:text-white transition-colors group"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red group-hover:text-bauhaus-yellow">
              Youth Justice
            </p>
            <h3 className="mt-2 text-lg font-black">See the pipeline</h3>
            <p className="mt-2 text-sm font-medium text-bauhaus-muted group-hover:text-white/70">
              ~50% of youth justice kids come from child protection. See who funds both sides and where.
            </p>
          </Link>
          <Link
            href="/reports/ndis-market"
            className="border-2 border-bauhaus-black bg-white p-4 hover:bg-bauhaus-black hover:text-white transition-colors group"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue group-hover:text-bauhaus-yellow">
              NDIS Market
            </p>
            <h3 className="mt-2 text-lg font-black">Disability intersection</h3>
            <p className="mt-2 text-sm font-medium text-bauhaus-muted group-hover:text-white/70">
              Children in care have 3-4x rates of disability. See where NDIS supply is thin in high-need areas.
            </p>
          </Link>
          <Link
            href="/entities?view=search"
            className="border-2 border-bauhaus-black bg-white p-4 hover:bg-bauhaus-black hover:text-white transition-colors group"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-money group-hover:text-bauhaus-yellow">
              Entity Search
            </p>
            <h3 className="mt-2 text-lg font-black">Search any organisation</h3>
            <p className="mt-2 text-sm font-medium text-bauhaus-muted group-hover:text-white/70">
              Look up any child protection provider and see their full dossier — contracts, grants, donations,
              and network connections.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
