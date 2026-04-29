import Link from 'next/link';
import { FundingTable } from './funding-table';
import { ProgramsTable } from './programs-table';
import {
  getPiccFundingByProgram,
  getPiccFundingByYear,
  getPiccContracts,
  getPiccAlmaInterventions,
  getPiccEntity,
  getPiccProgramDefinitions,
  getPalmIslandEntities,
  getPiccLeadership,
  getPiccMatchedGrants,
  getPiccPipeline,
  getPiccPeerOrgs,
  money,
  fmt,
} from '@/lib/services/report-service';

export const revalidate = 3600;

export const metadata = {
  title: 'PICC Workspace — CivicGraph',
  description: 'Palm Island Community Company: programs, funding, grants, evidence, partnerships',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Static Data (to be migrated to DB)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STATION_STREAMS = [
  { stream: '1. Goods Manufacturing', activities: 'Recycled-plastic bed bases, washing machine refurbishment', partner: 'A Curious Tractor', status: 'REAL EOI submitted' },
  { stream: '2. Hospitality & Cultural', activities: 'Commercial kitchen, catering training, cultural production', partner: 'Elders program', status: 'Kitchen activation pending' },
  { stream: '3. On-Country Construction', activities: 'Modular tiny homes, infrastructure, creek/orchard revival', partner: 'Construction TBD', status: 'Site cleanup phase' },
  { stream: '4. Cross-Community Exchange', activities: 'Inter-community visits, parallel programs, short-stay accommodation', partner: 'Oonchiumpa, Brodie Germaine', status: 'Partnership active' },
];

const KEY_PARTNERS = [
  { name: 'SNAICC', role: 'Peak body — Rachel is Board Director', type: 'Governance' },
  { name: 'QLD First Children & Families Board', role: 'Rachel is Co-Chair', type: 'Policy' },
  { name: 'Family Matters QLD', role: 'Rachel is Co-Chair', type: 'Campaign' },
  { name: 'Commissioner Natalie Lewis (QFCC)', role: 'Aligned DSS recommendations', type: 'Advocacy' },
  { name: 'A Curious Tractor', role: 'Consortium partner — REAL EOI + Goods manufacturing', type: 'Innovation' },
  { name: 'Oonchiumpa', role: 'Cross-community exchange, shared services, Empathy Ledger', type: 'Community' },
  { name: 'Brodie Germaine Fitness Aboriginal Corp', role: 'Mt Isa/Lower Gulf exchange partner', type: 'Community' },
  { name: 'Diagrama', role: 'International youth justice partner', type: 'Justice' },
  { name: 'Tranby College', role: 'Mukurtu digital archive, community projects', type: 'Data Sovereignty' },
  { name: 'NIAA', role: '$4.8M Safety & Wellbeing funder', type: 'Federal' },
  { name: 'QLD DCSSDS', role: 'Child protection, families, DFV funding', type: 'State' },
  { name: 'QLD DCYJMA', role: 'Youth justice funding, referral pathways', type: 'State' },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Page Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default async function PiccDashboard() {
  const [
    fundingByProgram,
    fundingByYear,
    contracts,
    almaInterventions,
    entity,
    programDefinitions,
    palmIslandEntities,
    leadership,
    matchedGrants,
    pipeline,
    peerOrgs,
  ] = await Promise.all([
    getPiccFundingByProgram(),
    getPiccFundingByYear(),
    getPiccContracts(),
    getPiccAlmaInterventions(),
    getPiccEntity(),
    getPiccProgramDefinitions(),
    getPalmIslandEntities(),
    getPiccLeadership(),
    getPiccMatchedGrants(),
    getPiccPipeline(),
    getPiccPeerOrgs(),
  ]);

  const ORG_LINKS: Record<string, string> = {
    'SNAICC': '/entity/AU-ABN-42513562148',
    'Family Matters QLD': '/entity/AU-ABN-98240660855',
    'A Curious Tractor': '/entity/AU-ABN-88671625498',
    'Oonchiumpa': '/entity/AU-ABN-53658668627',
    'Brodie Germaine Fitness Aboriginal Corp': '/entity/AU-ABN-94770726134',
    'Tranby College': '/entity/AU-ABN-82479284570',
    'Movember Foundation': '/entity/AU-ABN-48894537905',
    'Palm Island Community Company': '/entity/AU-ABN-14640793728',
    'James Cook University': '/entity/AU-ABN-46253211955',
  };

  const totalFunding = fundingByProgram?.reduce((s, r) => s + Number(r.total), 0) ?? 0;
  const totalContracts = contracts?.reduce((s, r) => s + Number(r.value), 0) ?? 0;
  const recentFunding = fundingByYear
    ?.filter(r => r.financial_year >= '2021-22')
    .reduce((s, r) => s + Number(r.total), 0) ?? 0;

  const pipelineSubmitted = pipeline?.filter(p => p.status === 'submitted') ?? [];
  const pipelineUpcoming = pipeline?.filter(p => p.status === 'upcoming') ?? [];
  const pipelineProspects = pipeline?.filter(p => p.status === 'prospect') ?? [];
  const pipelineTotal = pipeline?.reduce((s, p) => s + (Number(p.amount_numeric) || 0), 0) ?? 0;

  return (
    <main className="min-h-screen bg-white text-bauhaus-black">
      {/* ━━━ Header ━━━ */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red mb-1">
                CivicGraph Workspace
              </p>
              <h1 className="text-3xl font-black uppercase tracking-wider">
                Palm Island Community Company
              </h1>
              <p className="mt-2 text-lg text-gray-300">
                ABN 14 640 793 728 &middot; 100% Aboriginal & Torres Strait Islander community-controlled
              </p>
            </div>
            <div className="text-right text-sm text-gray-400 space-y-1">
              <Link href="/reports/youth-justice" className="block hover:text-white underline">
                Youth Justice Report &rarr;
              </Link>
              <Link href="/mission-control" className="block hover:text-white underline">
                Mission Control &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ━━━ Section Nav ━━━ */}
      <nav className="sticky top-0 z-10 border-b-2 border-bauhaus-black bg-white">
        <div className="mx-auto max-w-7xl px-4 overflow-x-auto">
          <div className="flex gap-0 text-[10px] font-bold uppercase tracking-widest">
            {[
              ['story', 'Our Story'],
              ['pipeline', 'Pipeline'],
              ['opportunities', 'Opportunities'],
              ['funding', 'Funding'],
              ['programs', 'Programs'],
              ['gaps', 'Gaps'],
              ['alma', 'Evidence'],
              ['peers', 'Peer Orgs'],
              ['station', 'Station Precinct'],
              ['partners', 'Partners'],
              ['ecosystem', 'Ecosystem'],
              ['sovereignty', 'Sovereignty'],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="px-3 py-2.5 whitespace-nowrap hover:bg-bauhaus-black hover:text-white transition-colors border-r border-gray-200 last:border-r-0"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8 space-y-12">

        {/* ━━━ 1. Org Story + Key Stats ━━━ */}
        <section id="story">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-4">
                Our Story
              </h2>
              <div className="text-sm space-y-3 text-gray-800 leading-relaxed">
                <p>
                  <strong>Palm Island Community Company (PICC)</strong> is a 100% Aboriginal and Torres Strait Islander
                  community-controlled organisation delivering 11 programs across health, child protection, youth justice,
                  family services, and social enterprise on Palm Island — one of Australia&apos;s most remote communities.
                </p>
                <p>
                  Led by CEO Rachel Atkinson (Yorta Yorta) for 18 years, PICC has grown from 1 staff member to 208
                  (94% Aboriginal & Torres Strait Islander), turning over $29M annually. In 2021, PICC achieved
                  full community control — transferring governance from external management to an all-Indigenous board
                  chaired by Luella Bligh.
                </p>
                <p>
                  PICC is now building <strong>The Centre at Station Precinct</strong> — a community manufacturing
                  and justice reintegration hub that will create 60&ndash;80 jobs and provide pathways for young
                  people exiting the justice system. The $1.2M REAL Innovation Fund application (submitted March 2026)
                  would fund 4 years of this work in consortium with A Curious Tractor.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <StatCard label="Annual Turnover" value="$29M" sub="2025-26" accent />
              <StatCard label="Staff" value="208" sub="195 Aboriginal/TSI (94%)" />
              <StatCard label="Health Clients" value="2,283" sub="17,488 service episodes/yr" />
              <StatCard label="Community Control" value="2021" sub="Full community governance" />
            </div>
          </div>

          {/* Readiness scorecard */}
          <div className="mt-6 border-4 border-bauhaus-black p-4">
            <h3 className="font-black uppercase tracking-widest text-xs mb-3">Grant Readiness</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
              <ReadinessItem label="ABN Linked" done />
              <ReadinessItem label="Programs Documented" done />
              <ReadinessItem label="Leadership Listed" done />
              <ReadinessItem label="ALMA Evidence" done count={almaInterventions?.length ?? 0} />
              <ReadinessItem label="Pipeline Active" done count={pipeline?.length ?? 0} />
              <ReadinessItem label="Peer Benchmark" done={!!peerOrgs && peerOrgs.length > 0} />
            </div>
          </div>
        </section>

        {/* ━━━ 2. Grant Pipeline (DB-driven) ━━━ */}
        <Section id="pipeline" title="Grant Pipeline">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="In Pipeline" value={String(pipeline?.length ?? 0)} sub="Total opportunities" />
            <StatCard label="Submitted" value={String(pipelineSubmitted.length)} sub="Awaiting outcome" accent />
            <StatCard label="Upcoming" value={String(pipelineUpcoming.length)} sub="Deadlines this month" />
            <StatCard label="Pipeline Value" value={pipelineTotal > 0 ? money(pipelineTotal) : '—'} sub="If all succeed" />
          </div>

          {pipelineSubmitted.length > 0 && (
            <div className="mb-6">
              <h3 className="font-black uppercase tracking-widest text-xs mb-3 text-green-800">Submitted — Awaiting Outcome</h3>
              <div className="grid md:grid-cols-2 gap-3">
                {pipelineSubmitted.map((p, i) => (
                  <div key={i} className="border-4 border-green-600 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-black text-sm">
                        {p.grant_opportunity_id ? (
                          <Link href={`/grants/${p.grant_opportunity_id}`} className="underline hover:text-green-700">{p.name}</Link>
                        ) : p.name}
                      </h4>
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 font-bold uppercase">Submitted</span>
                    </div>
                    <p className="text-sm font-mono font-bold mb-1">{p.amount_display}</p>
                    <p className="text-xs text-gray-600 mb-2">
                      {p.foundation_id ? (
                        <Link href={`/foundations/${p.foundation_id}`} className="underline hover:text-bauhaus-red">{p.funder}</Link>
                      ) : p.funder}
                      {' '}&middot; Deadline: {p.deadline}
                    </p>
                    {p.notes && <p className="text-xs text-gray-500 line-clamp-2">{p.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pipelineUpcoming.length > 0 && (
            <div className="mb-6">
              <h3 className="font-black uppercase tracking-widest text-xs mb-3 text-yellow-800">Upcoming Deadlines</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-4 border-bauhaus-black">
                      <th className="text-left py-2 pr-4 font-black uppercase tracking-widest text-xs">Opportunity</th>
                      <th className="text-right py-2 px-4 font-black uppercase tracking-widest text-xs whitespace-nowrap">Amount</th>
                      <th className="text-left py-2 px-4 font-black uppercase tracking-widest text-xs">Funder</th>
                      <th className="text-left py-2 px-4 font-black uppercase tracking-widest text-xs whitespace-nowrap">Deadline</th>
                      <th className="text-left py-2 pl-4 font-black uppercase tracking-widest text-xs">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineUpcoming.map((p, i) => (
                      <tr key={i} className="border-b border-gray-200 hover:bg-yellow-50">
                        <td className="py-2 pr-4 font-bold">
                          {p.grant_opportunity_id ? (
                            <Link href={`/grants/${p.grant_opportunity_id}`} className="underline hover:text-bauhaus-red">{p.name}</Link>
                          ) : p.name}
                        </td>
                        <td className="py-2 px-4 text-right font-mono whitespace-nowrap">{p.amount_display}</td>
                        <td className="py-2 px-4 text-gray-600">
                          {p.foundation_id ? (
                            <Link href={`/foundations/${p.foundation_id}`} className="underline hover:text-bauhaus-red">{p.funder}</Link>
                          ) : p.funder}
                        </td>
                        <td className="py-2 px-4 font-bold text-yellow-800 whitespace-nowrap">{p.deadline}</td>
                        <td className="py-2">
                          <FunderTypeBadge type={p.funder_type} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pipelineProspects.length > 0 && (
            <div>
              <h3 className="font-black uppercase tracking-widest text-xs mb-3 text-gray-500">Prospects — Relationship Building</h3>
              <div className="grid md:grid-cols-2 gap-3">
                {pipelineProspects.map((p, i) => (
                  <div key={i} className="border-2 border-gray-300 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-sm">
                        {p.foundation_id ? (
                          <Link href={`/foundations/${p.foundation_id}`} className="underline hover:text-bauhaus-red">{p.name}</Link>
                        ) : p.grant_opportunity_id ? (
                          <Link href={`/grants/${p.grant_opportunity_id}`} className="underline hover:text-bauhaus-red">{p.name}</Link>
                        ) : p.name}
                      </h4>
                      <FunderTypeBadge type={p.funder_type} />
                    </div>
                    <p className="text-sm font-mono mb-1">{p.amount_display}</p>
                    {p.notes && <p className="text-xs text-gray-500 line-clamp-2">{p.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ━━━ 3. Matched Grant Opportunities ━━━ */}
        <Section id="opportunities" title="Matched Grant Opportunities">
          <p className="text-sm text-gray-600 mb-4">
            Auto-matched from CivicGraph&apos;s 18,000+ grant opportunities database. Filtered for indigenous,
            health, community, and youth categories with upcoming deadlines.
          </p>
          {matchedGrants && matchedGrants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-4 border-bauhaus-black">
                    <th className="text-left py-2 pr-4 font-black uppercase tracking-widest text-xs">Opportunity</th>
                    <th className="text-right py-2 px-4 font-black uppercase tracking-widest text-xs whitespace-nowrap">Up To</th>
                    <th className="text-left py-2 px-4 font-black uppercase tracking-widest text-xs whitespace-nowrap">Deadline</th>
                    <th className="text-left py-2 pl-4 font-black uppercase tracking-widest text-xs">Categories</th>
                  </tr>
                </thead>
                <tbody>
                  {matchedGrants.map((g, i) => (
                    <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 pr-4 max-w-sm">
                        <Link href={`/grants/${g.id}`} className="underline hover:text-bauhaus-red">
                          {g.name?.length > 80 ? g.name.slice(0, 80) + '...' : g.name}
                        </Link>
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-bold whitespace-nowrap">
                        {g.amount_max ? money(g.amount_max) : g.amount_min ? money(g.amount_min) + '+' : '—'}
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap">{g.deadline}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {g.categories?.slice(0, 4).map((c, j) => (
                            <span key={j} className="text-[10px] px-1.5 py-0.5 bg-gray-100 font-bold uppercase">
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No matched grants found</p>
          )}
        </Section>

        {/* ━━━ 4. Funding Overview ━━━ */}
        <Section id="funding" title="Funding Overview">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Total Tracked Funding" value={money(totalFunding)} sub="All years" />
            <StatCard label="Recent (2021–25)" value={money(recentFunding)} sub="Active programs" accent />
            <StatCard label="Federal Contracts" value={money(totalContracts)} sub={`${contracts?.length ?? 0} contracts`} />
            <StatCard label="ALMA Programs" value={String(almaInterventions?.length ?? 0)} sub="Evidence-registered" />
          </div>

          {/* Funding by Program */}
          {fundingByProgram && fundingByProgram.length > 0 && (
            <div className="mb-8">
              <h3 className="font-black uppercase tracking-widest text-xs mb-3">Government Funding by Program</h3>
              <FundingTable data={fundingByProgram} />
            </div>
          )}

          {/* Funding Timeline */}
          {fundingByYear && fundingByYear.length > 0 && (() => {
            const maxVal = Math.max(...fundingByYear.map(r => Number(r.total)));
            return (
              <div>
                <h3 className="font-black uppercase tracking-widest text-xs mb-3">Funding by Financial Year</h3>
                <div className="flex items-end gap-2 h-64 border-b-2 border-bauhaus-black px-1">
                  {fundingByYear.map((y, i) => {
                    const val = Number(y.total);
                    const pct = (val / maxVal) * 100;
                    const isRecent = y.financial_year >= '2021-22';
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono font-bold mb-1 whitespace-nowrap">
                          {money(val)}
                        </div>
                        <div
                          className={`w-full rounded-t ${isRecent ? 'bg-bauhaus-red' : 'bg-bauhaus-black'} transition-all group-hover:opacity-80`}
                          style={{ height: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-1 px-1">
                  {fundingByYear.map((y, i) => (
                    <div key={i} className="flex-1 text-center text-[10px] text-gray-500">
                      {y.financial_year.replace('20', "'")}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  <span className="inline-block w-3 h-3 bg-bauhaus-red mr-1 align-middle" /> Recent (2021+)
                  <span className="inline-block w-3 h-3 bg-bauhaus-black mr-1 ml-3 align-middle" /> Historical
                </p>
              </div>
            );
          })()}
        </Section>

        {/* ━━━ 5. Programs — Unified View ━━━ */}
        <Section id="programs" title="Programs — Unified View">
          <p className="text-sm text-gray-600 mb-4">
            All PICC programs with linked government funding, ALMA evidence, contracts, and grant pipeline.
            Click a row to expand details.
          </p>
          <ProgramsTable
            programs={programDefinitions ?? []}
            funding={fundingByProgram}
            alma={almaInterventions}
            contracts={contracts}
            pipeline={pipeline ?? []}
          />
        </Section>

        {/* ━━━ 6. Funding Gaps ━━━ */}
        <Section id="gaps" title="Funding Gaps & Risks">
          <p className="text-sm text-gray-600 mb-4">
            Programs with single-funder dependency or no diversified funding. Priority targets for new grant applications.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border-4 border-bauhaus-red p-4">
              <h3 className="font-black uppercase tracking-widest text-xs text-bauhaus-red mb-3">Single-Funder Risk</h3>
              <ul className="text-sm space-y-3">
                <li>
                  <strong>Young Offender Support</strong> — $340K from QLD DCYJMA only.
                  <span className="block text-xs text-gray-500 mt-0.5">Risk: State budget cuts eliminate entire program. Station Precinct REAL bid ($1.2M) would diversify.</span>
                </li>
                <li>
                  <strong>Making Decisions in Our Way</strong> — $211K from QLD DCSSDS only.
                  <span className="block text-xs text-gray-500 mt-0.5">Risk: Delegated authority model requires ongoing state support. No federal backup.</span>
                </li>
                <li>
                  <strong>DFV Services</strong> — ~$1M from QLD DCSSDS only.
                  <span className="block text-xs text-gray-500 mt-0.5">Risk: Critical community safety program on single state funding stream.</span>
                </li>
              </ul>
            </div>
            <div className="border-4 border-bauhaus-black p-4">
              <h3 className="font-black uppercase tracking-widest text-xs mb-3">Diversification Opportunities</h3>
              <ul className="text-sm space-y-3">
                <li>
                  <strong>Social Enterprise Revenue</strong> — Bakery, fuel, mechanics generating self-sustaining income.
                  <span className="block text-xs text-gray-500 mt-0.5">Station Precinct goods manufacturing would add a 4th enterprise stream.</span>
                </li>
                <li>
                  <strong>Philanthropy Pipeline</strong> — Paul Ramsay ($500K–$2M) and Tim Fairfax ($100K–$500K) in prospect stage.
                  <span className="block text-xs text-gray-500 mt-0.5">Would reduce government dependency from ~90% to ~75% of revenue.</span>
                </li>
                <li>
                  <strong>University Partnerships</strong> — JCU contracts ($107K). Could grow via research funding.
                  <span className="block text-xs text-gray-500 mt-0.5">Environmental Research ($350K) deadline 30 March — potential JCU collaboration.</span>
                </li>
              </ul>
            </div>
          </div>
        </Section>

        {/* ━━━ 7. Evidence & ALMA ━━━ */}
        <Section id="alma" title="Evidence Base — ALMA Registered Interventions">
          <p className="text-sm text-gray-600 mb-4">
            Programs registered in the Australian Living Map of Alternatives (ALMA) — JusticeHub&apos;s national
            evidence database of what works in justice, child protection, and community safety.
          </p>
          {almaInterventions && almaInterventions.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
              {almaInterventions.map((a, i) => (
                <div key={i} className="border-4 border-bauhaus-black p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-black text-sm">{a.name}</h3>
                    <span className="text-xs px-2 py-1 bg-bauhaus-black text-white font-bold uppercase tracking-wider">
                      {a.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2 line-clamp-3">{a.description}</p>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-0.5 border border-gray-400">{a.evidence_level}</span>
                    <span className="px-2 py-0.5 border border-gray-400 truncate max-w-48">{a.target_cohort}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No ALMA interventions found</p>
          )}
        </Section>

        {/* ━━━ 8. Peer Orgs ━━━ */}
        <Section id="peers" title="Peer Organisations — Similar Work Across Australia">
          <p className="text-sm text-gray-600 mb-4">
            Community-controlled organisations running similar programs (Cultural Connection, Community-Led,
            Wraparound Support, Diversion, Family Strengthening) registered in ALMA.
          </p>
          {peerOrgs && peerOrgs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-4 border-bauhaus-black">
                    <th className="text-left py-2 font-black uppercase tracking-widest text-xs">Organisation</th>
                    <th className="text-left py-2 font-black uppercase tracking-widest text-xs">State</th>
                    <th className="text-left py-2 font-black uppercase tracking-widest text-xs">LGA</th>
                    <th className="text-center py-2 font-black uppercase tracking-widest text-xs">ALMA Programs</th>
                    <th className="text-left py-2 font-black uppercase tracking-widest text-xs">Program Types</th>
                  </tr>
                </thead>
                <tbody>
                  {peerOrgs.map((org, i) => (
                    <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 font-bold">
                        {org.abn ? (
                          <Link href={`/entity/AU-ABN-${org.abn}`} className="underline hover:text-bauhaus-red">
                            {org.canonical_name}
                          </Link>
                        ) : org.canonical_name}
                      </td>
                      <td className="py-2">{org.state}</td>
                      <td className="py-2 text-gray-600">{org.lga_name ?? '—'}</td>
                      <td className="py-2 text-center font-bold">{org.alma_programs}</td>
                      <td className="py-2 text-xs text-gray-600">{org.program_types}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No peer organisations found</p>
          )}
        </Section>

        {/* ━━━ 9. Station Precinct ━━━ */}
        <Section id="station" title="The Centre — Station Precinct Innovation">
          <div className="border-4 border-bauhaus-red p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 bg-bauhaus-red text-white font-black uppercase tracking-widest text-xs">
                Innovation
              </span>
              <h3 className="font-black">REAL Innovation Fund EOI — $1.2M / 4 years</h3>
            </div>
            <p className="text-sm text-gray-700">
              Station Precinct Employment Pathways: Community Manufacturing and Justice Reintegration.
              Consortium: PICC (lead) + A Curious Tractor (ACT). 60&ndash;80 participants, 30&ndash;40 into employment.
              Jul 2026 &ndash; Jun 2030. <strong>Status: Submitted 2 March 2026 &mdash; awaiting outcome.</strong>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-4 border-bauhaus-black">
                  <th className="text-left py-2 font-black uppercase tracking-widest text-xs">Stream</th>
                  <th className="text-left py-2 font-black uppercase tracking-widest text-xs">Activities</th>
                  <th className="text-left py-2 font-black uppercase tracking-widest text-xs">Partner</th>
                  <th className="text-left py-2 font-black uppercase tracking-widest text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {STATION_STREAMS.map((s, i) => (
                  <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 font-bold">{s.stream}</td>
                    <td className="py-2 text-gray-700">{s.activities}</td>
                    <td className="py-2 text-gray-600">{s.partner}</td>
                    <td className="py-2">
                      <span className="text-xs px-2 py-0.5 border border-bauhaus-black">{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 border-4 border-bauhaus-black p-4">
            <h3 className="font-black uppercase tracking-widest text-sm mb-3">Kitchen Activation — Food & Hospitality Pathway</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-bold mb-1">Phase 1: Activation (M1&ndash;6)</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Kitchen inspection & compliance</li>
                  <li>Catering coordinator hired</li>
                  <li>TAFE NQ Cert II/III pathways</li>
                  <li>Initial cohort: 6&ndash;8 participants</li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-1">Phase 2: Production (M7&ndash;18)</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Community catering for PICC events</li>
                  <li>Cultural food with Elders</li>
                  <li>Apprenticeship partnerships</li>
                  <li>Meal prep for Precinct workers</li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-1">Phase 3: Enterprise (M19&ndash;48)</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Self-sustaining catering enterprise</li>
                  <li>Supply contract to Palm Island</li>
                  <li>Cultural food tourism product</li>
                  <li>Graduate self-managed business</li>
                </ul>
              </div>
            </div>
          </div>
        </Section>

        {/* ━━━ 10. Partners & Governance ━━━ */}
        <Section id="partners" title="Partners & Governance">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* CEO */}
            {leadership?.filter(l => l.title === 'CEO').map((ceo, i) => (
              <div key={i} className="border-4 border-bauhaus-black p-4">
                <h3 className="font-black uppercase tracking-widest text-sm mb-3">CEO {ceo.name}</h3>
                <p className="text-sm text-gray-700 mb-3">{ceo.bio}</p>
                {ceo.external_roles && ceo.external_roles.length > 0 && (
                  <table className="w-full text-sm">
                    <tbody>
                      {ceo.external_roles.map((r: { org: string; role: string }, j: number) => (
                        <tr key={j} className={j < ceo.external_roles.length - 1 ? 'border-b' : ''}>
                          <td className="py-1 font-bold">
                            {ORG_LINKS[r.org] ? (
                              <Link href={ORG_LINKS[r.org]} className="underline hover:text-bauhaus-red">{r.org}</Link>
                            ) : r.org}
                          </td>
                          <td>{r.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
            {/* Board */}
            {leadership && leadership.length > 0 && (
              <div className="border-4 border-bauhaus-black p-4">
                <h3 className="font-black uppercase tracking-widest text-sm mb-3">Board & Officers</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {leadership.filter(l => l.title !== 'CEO').map((m, i, arr) => (
                      <tr key={i} className={i < arr.length - 1 ? 'border-b' : ''}>
                        <td className="py-1 font-bold">{m.name}</td>
                        <td className="py-1 text-gray-700">{m.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Partner Network */}
          <h3 className="font-black uppercase tracking-widest text-xs mb-3">Partner Network</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {KEY_PARTNERS.map((p, i) => (
              <div key={i} className="border-2 border-bauhaus-black p-3 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-black text-sm">
                    {ORG_LINKS[p.name] ? (
                      <Link href={ORG_LINKS[p.name]} className="underline hover:text-bauhaus-red">{p.name}</Link>
                    ) : p.name}
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 font-bold uppercase tracking-wider">
                    {p.type}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{p.role}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ━━━ 11. Palm Island Ecosystem ━━━ */}
        {palmIslandEntities && palmIslandEntities.length > 0 && (
          <Section id="ecosystem" title="Palm Island Ecosystem">
            <p className="text-sm text-gray-600 mb-4">
              All registered organisations on Palm Island. These are PICC&apos;s neighbours — potential
              collaborators, referral partners, and co-applicants for place-based funding.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-4 border-bauhaus-black">
                    <th className="text-left py-2 font-black uppercase tracking-widest text-xs">Entity</th>
                    <th className="text-left py-2 font-black uppercase tracking-widest text-xs">Type</th>
                    <th className="text-left py-2 font-black uppercase tracking-widest text-xs">Sector</th>
                    <th className="text-left py-2 font-black uppercase tracking-widest text-xs">ABN</th>
                  </tr>
                </thead>
                <tbody>
                  {palmIslandEntities.map((e, i) => (
                    <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 font-bold">
                        {e.abn ? (
                          <Link href={`/entity/AU-ABN-${e.abn}`} className="underline hover:text-bauhaus-red">
                            {e.canonical_name}
                          </Link>
                        ) : e.canonical_name}
                      </td>
                      <td className="py-2">{e.entity_type}</td>
                      <td className="py-2 text-gray-600">{e.sector}</td>
                      <td className="py-2 text-gray-500 font-mono text-xs">{e.abn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* ━━━ 12. Data Sovereignty ━━━ */}
        <Section id="sovereignty" title="Elders, Storytelling & Data Sovereignty">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border-4 border-bauhaus-black p-4">
              <h3 className="font-black uppercase tracking-widest text-sm mb-3">Cultural Assets</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b"><td className="py-1 font-bold">Elder interviews</td><td>34 filmed (8+ Elders)</td></tr>
                  <tr className="border-b"><td className="py-1 font-bold">Story segments</td><td>2,000+</td></tr>
                  <tr className="border-b"><td className="py-1 font-bold">Manbarra language</td><td>Vocabulary, place names, phrases</td></tr>
                  <tr className="border-b"><td className="py-1 font-bold">Photo collections</td><td>18 years archived</td></tr>
                  <tr><td className="py-1 font-bold">2025 Mission Beach</td><td>12 filmed, presented at SNAICC</td></tr>
                </tbody>
              </table>
            </div>
            <div className="border-4 border-bauhaus-black p-4">
              <h3 className="font-black uppercase tracking-widest text-sm mb-3">ILA &ldquo;Voices on Country&rdquo;</h3>
              <p className="text-sm text-gray-700 mb-2">
                36-month Elder-led cultural knowledge journeys, language conservation, and photographic exhibition.
                Major project (up to $200K/yr, 3 years). Submitted 16 March 2026.
              </p>
              <ul className="text-xs space-y-1 text-gray-600">
                <li>Y1: Atherton Tablelands return-to-Country journey</li>
                <li>Y2: Central Australia journey (with Oonchiumpa)</li>
                <li>Y3: Mukurtu digital archive + major combined exhibition</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 border-4 border-bauhaus-black p-4">
            <h3 className="font-black uppercase tracking-widest text-sm mb-3">Story Architecture: Elder Knowledge &rarr; Sovereign Archive</h3>
            <div className="grid md:grid-cols-5 gap-2 text-xs text-center">
              <div className="bg-bauhaus-black text-white p-3">
                <p className="font-bold">Elder Knowledge</p>
                <p className="text-gray-300">18 years, 57+ nations</p>
              </div>
              <div className="bg-bauhaus-red text-white p-3">
                <p className="font-bold">Voices on Country</p>
                <p className="text-gray-200">ILA-funded journeys</p>
              </div>
              <div className="bg-gray-800 text-white p-3">
                <p className="font-bold">Empathy Ledger</p>
                <p className="text-gray-300">Oonchiumpa platform</p>
              </div>
              <div className="bg-bauhaus-blue text-white p-3">
                <p className="font-bold">Mukurtu Archive</p>
                <p className="text-gray-200">Tranby partnership</p>
              </div>
              <div className="bg-bauhaus-black text-white p-3">
                <p className="font-bold">Outputs</p>
                <p className="text-gray-300">Language, Exhibition, Film</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ━━━ Footer ━━━ */}
        <footer className="border-t-4 border-bauhaus-black pt-4 text-xs text-gray-500">
          <p>
            Data sourced from CivicGraph (justice_funding, austender_contracts, alma_interventions, org_pipeline, gs_entities).
            Auto-matched grants from grant_opportunities database.
            Generated {new Date().toISOString().split('T')[0]}.
          </p>
          <p className="mt-1">
            <Link href="/reports/youth-justice" className="underline hover:text-bauhaus-red">Youth Justice Report</Link>
            {' '}&middot;{' '}
            <Link href="/mission-control" className="underline hover:text-bauhaus-red">Mission Control</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16">
      <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`border-4 p-4 ${accent ? 'border-bauhaus-red' : 'border-bauhaus-black'}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

function ReadinessItem({ label, done, count }: { label: string; done: boolean; count?: number }) {
  return (
    <div className={`flex items-center gap-2 p-2 ${done ? 'bg-green-50' : 'bg-red-50'}`}>
      <span className={`text-lg ${done ? 'text-green-600' : 'text-red-400'}`}>{done ? '\u2713' : '\u2717'}</span>
      <div>
        <p className="font-bold text-[10px] uppercase tracking-wider">{label}</p>
        {count !== undefined && <p className="text-[10px] text-gray-500">{count} linked</p>}
      </div>
    </div>
  );
}

function FunderTypeBadge({ type }: { type: string | null }) {
  const styles: Record<string, string> = {
    government: 'bg-blue-100 text-blue-800',
    foundation: 'bg-purple-100 text-purple-800',
    corporate: 'bg-teal-100 text-teal-800',
  };
  return (
    <span className={`text-xs px-2 py-0.5 font-bold uppercase ${styles[type ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
      {type ?? 'other'}
    </span>
  );
}
