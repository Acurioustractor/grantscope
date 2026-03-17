import Link from 'next/link';
import type {
  OrgProfile,
  FundingByProgram,
  FundingByYear,
  Contract,
  AlmaIntervention,
  OrgProgram,
  OrgContactWithEntity,
  OrgLeader,
  LocalEcosystemResult,
  GsEntity,
  PeerOrg,
  MatchedGrant,
  OrgPipelineItemWithEntity,
} from '@/lib/services/org-dashboard-service';
import { money } from '@/lib/services/org-dashboard-service';
import { Section, StatCard, SystemBadge, ContactTypeBadge } from './ui';
import { PipelineTable } from './pipeline-filter';
import { MatchedGrantsTable } from './matched-grants';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Table styling constants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TH = 'text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400';
const TH_R = 'text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400';
const TD = 'py-3 pr-4';
const TD_R = 'py-3 pr-4 text-right';
const THEAD = 'border-b-2 border-gray-200 bg-gray-50/50';
const TFOOT = 'border-t-2 border-bauhaus-black bg-gray-50';
const ROW = (i: number) =>
  `border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`;

function DataSource({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
      {label}
    </span>
  );
}

function CuratedSource({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
      {label}
    </span>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Stat cards
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function KeyStats({
  totalFunding,
  recentFunding,
  totalContracts,
  contractCount,
  almaCount,
  profile,
  entity,
}: {
  totalFunding: number;
  recentFunding: number;
  totalContracts: number;
  contractCount: number;
  almaCount: number;
  profile: OrgProfile;
  entity: GsEntity | null;
}) {
  return (
    <section>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {totalFunding > 0 && (
          <StatCard label="Total Tracked Funding" value={money(totalFunding)} sub="All years" />
        )}
        {recentFunding > 0 && (
          <StatCard label="Recent Funding (2021+)" value={money(recentFunding)} sub="Active programs" />
        )}
        {totalContracts > 0 && (
          <StatCard label="Federal Contracts" value={money(totalContracts)} sub={`${contractCount} contracts`} />
        )}
        {almaCount > 0 && (
          <StatCard label="ALMA Programs" value={String(almaCount)} sub="Registered interventions" />
        )}
      </div>
      {(profile.team_size || profile.annual_revenue) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {profile.team_size && (
            <StatCard label="Staff" value={String(profile.team_size)} sub="Team size" />
          )}
          {profile.annual_revenue && (
            <StatCard label="Annual Turnover" value={money(profile.annual_revenue)} sub="Latest year" />
          )}
          {entity?.remoteness && (
            <StatCard label="Location" value={entity.lga_name || entity.postcode} sub={entity.remoteness} />
          )}
          {entity?.seifa_irsd_decile && (
            <StatCard label="SEIFA IRSD" value={`Decile ${entity.seifa_irsd_decile}`} sub="Socio-economic index" />
          )}
        </div>
      )}
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Leadership section
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function LeadershipSection({ leadership }: { leadership: OrgLeader[] }) {
  if (leadership.length === 0) return null;
  return (
    <Section title="Governance & Leadership">
      <CuratedSource label="Curated" />
      <div className="grid md:grid-cols-2 gap-4">
        {leadership.map((leader) => (
          <div key={leader.id} className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
            <div className="border-l-4 border-bauhaus-black p-5">
              <h3 className="font-black text-sm mb-1">{leader.name}</h3>
              {leader.title && <p className="text-xs font-bold uppercase tracking-wider text-bauhaus-red mb-2">{leader.title}</p>}
              {leader.bio && <p className="text-sm text-gray-600 mb-3">{leader.bio}</p>}
              {leader.external_roles.length > 0 && (
                <div className="space-y-1.5">
                  {leader.external_roles.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-1 h-1 rounded-full bg-bauhaus-red shrink-0" />
                      <span className="font-bold">{r.org}</span>
                      <span className="text-gray-400">{r.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Funding by program
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function FundingSection({
  fundingByProgram,
  totalFunding,
  fundingYears,
  fundingYearFilter,
  slug,
}: {
  fundingByProgram: FundingByProgram[] | null;
  totalFunding: number;
  fundingYears: string[];
  fundingYearFilter: string | undefined;
  slug: string;
}) {
  if (!fundingByProgram || fundingByProgram.length === 0) return null;
  return (
    <Section title="Government Funding by Program">
      <div id="funding" className="flex items-center justify-between mb-3">
        <DataSource label="Auto-discovered from CivicGraph" />
        {fundingYears.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1">Filter:</span>
            <a
              href={`/org/${slug}#funding`}
              className={`text-[10px] px-2.5 py-1 rounded-sm border font-bold uppercase tracking-wider transition-colors ${
                !fundingYearFilter
                  ? 'bg-bauhaus-black text-white border-bauhaus-black'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
            >
              All years
            </a>
            {fundingYears.map(fy => (
              <a
                key={fy}
                href={`/org/${slug}?fy=${fy}#funding`}
                className={`text-[10px] px-2.5 py-1 rounded-sm border font-bold tracking-wider transition-colors ${
                  fundingYearFilter === fy
                    ? 'bg-bauhaus-black text-white border-bauhaus-black'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                {fy}
              </a>
            ))}
          </div>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className={THEAD}>
                <th className={`${TH} pl-4`}>Program</th>
                <th className={TH_R}>Total</th>
                <th className={TH_R}>Grants</th>
                <th className={`${TH} last:pr-4`}>Period</th>
              </tr>
            </thead>
            <tbody>
              {fundingByProgram.map((p, i) => (
                <tr key={i} className={ROW(i)}>
                  <td className={`${TD} pl-4 font-medium max-w-xs truncate`}>{p.program_name}</td>
                  <td className={`${TD_R} font-mono font-bold text-green-700`}>{money(Number(p.total))}</td>
                  <td className={`${TD_R} text-gray-500`}>{p.records}</td>
                  <td className={`${TD} text-gray-400 text-xs`}>{p.from_fy} – {p.to_fy}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={TFOOT}>
                <td className={`${TD} pl-4 font-black`}>TOTAL</td>
                <td className={`${TD_R} font-mono font-black text-green-700`}>{money(totalFunding)}</td>
                <td className={`${TD_R} font-bold text-gray-500`}>{fundingByProgram.reduce((s, r) => s + r.records, 0)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Funding timeline
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function FundingTimelineSection({ fundingByYear }: { fundingByYear: FundingByYear[] | null }) {
  if (!fundingByYear || fundingByYear.length === 0) return null;
  const maxVal = Math.max(...fundingByYear.map(r => Number(r.total)));
  return (
    <Section title="Funding by Financial Year">
      <DataSource label="Auto-discovered from CivicGraph" />
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100">
          {fundingByYear.map((y, i) => {
            const val = Number(y.total);
            const pct = Math.max((val / maxVal) * 100, 1);
            const isRecent = y.financial_year >= '2021-22';
            return (
              <div key={i} className={`flex items-center gap-4 px-5 py-3 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-blue-50/30 transition-colors`}>
                <span className="w-16 text-xs font-bold text-gray-500 shrink-0">{y.financial_year}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded-sm overflow-hidden">
                  <div
                    className={`h-full rounded-sm ${isRecent ? 'bg-bauhaus-red' : 'bg-gray-300'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-20 text-right font-mono text-sm font-bold text-green-700 shrink-0">{money(val)}</span>
                <span className="w-16 text-right text-[10px] text-gray-400 shrink-0">{y.grants} grants</span>
              </div>
            );
          })}
        </div>
        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-bauhaus-red inline-block" /> Recent (2021+)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gray-300 inline-block" /> Historical</span>
          </div>
          <span className="text-xs font-bold text-gray-500">{fundingByYear.length} years</span>
        </div>
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Programs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function ProgramsSection({ programs }: { programs: OrgProgram[] }) {
  if (programs.length === 0) return null;
  return (
    <Section title="Programs & Reporting Schedule">
      <CuratedSource label="Curated" />
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className={THEAD}>
                <th className={`${TH} pl-4`}>Program</th>
                <th className={TH}>System</th>
                <th className={TH}>Source</th>
                <th className={TH_R}>Annual</th>
                <th className={TH}>Reporting</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p, i) => (
                <tr key={p.id} className={ROW(i)}>
                  <td className={`${TD} pl-4 font-medium`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-1 h-6 rounded-full shrink-0 ${p.status === 'active' ? 'bg-green-400' : p.status === 'planned' ? 'bg-yellow-400' : 'bg-gray-300'}`} />
                      {p.name}
                    </div>
                  </td>
                  <td className={TD}>{p.system && <SystemBadge system={p.system} />}</td>
                  <td className={`${TD} text-gray-500 text-xs`}>{p.funding_source}</td>
                  <td className={`${TD_R} font-mono font-medium`}>{p.annual_amount_display}</td>
                  <td className={`${TD} text-gray-400 text-xs`}>{p.reporting_cycle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ALMA interventions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function AlmaSection({ interventions }: { interventions: AlmaIntervention[] | null }) {
  if (!interventions || interventions.length === 0) return null;
  return (
    <Section title="ALMA Registered Interventions">
      <DataSource label="Auto-discovered from CivicGraph" />
      <div className="grid md:grid-cols-2 gap-4">
        {interventions.map((a, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
            <div className="border-l-4 border-bauhaus-red p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-black text-sm">{a.name}</h3>
                <span className="text-[10px] px-2 py-1 bg-bauhaus-black text-white font-bold uppercase tracking-wider rounded-sm shrink-0 ml-2">
                  {a.type}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{a.description}</p>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-sm">{a.evidence_level}</span>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-sm truncate max-w-48">{a.target_cohort}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pipeline
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function PipelineSection({
  pipeline,
  orgSlug,
  orgProfileId,
}: {
  pipeline: OrgPipelineItemWithEntity[];
  orgSlug: string;
  orgProfileId: string;
}) {
  if (pipeline.length === 0) return null;
  return (
    <Section title="Grant Pipeline">
      <CuratedSource label="Curated" />
      <PipelineTable orgSlug={orgSlug} orgProfileId={orgProfileId} items={pipeline.map(g => ({
        id: g.id,
        name: g.name,
        amount_display: g.amount_display,
        funder: g.funder,
        funder_type: g.funder_type,
        funder_entity_gs_id: g.funder_entity_gs_id,
        funder_entity_name: g.funder_entity_name,
        deadline: g.deadline,
        status: g.status,
        notes: g.notes,
        grant_opportunity_id: g.grant_opportunity_id,
        grant_url: g.grant_url,
        grant_name: g.grant_name,
        grant_provider: g.grant_provider,
      }))} />
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Matched grants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function MatchedGrantsSection({
  matchedGrants,
  orgProfileId,
}: {
  matchedGrants: MatchedGrant[] | null;
  orgProfileId: string;
}) {
  if (!matchedGrants || matchedGrants.length === 0) return null;
  return (
    <Section title="Suggested Grant Opportunities">
      <DataSource label="Auto-matched from CivicGraph" />
      <p className="text-xs text-gray-400 mb-4 -mt-2">
        Upcoming grants that may be relevant. Grants already in your pipeline are excluded.
      </p>
      <MatchedGrantsTable grants={matchedGrants} orgProfileId={orgProfileId} />
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Contacts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function ContactsSection({ contacts }: { contacts: OrgContactWithEntity[] }) {
  if (contacts.length === 0) return null;
  return (
    <Section title="Partner Network">
      <CuratedSource label="Curated" />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {contacts.map((c) => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="border-l-4 border-bauhaus-blue p-4">
              <div className="flex items-center justify-between mb-1">
                {c.linked_entity_gs_id ? (
                  <Link href={`/entity/${encodeURIComponent(c.linked_entity_gs_id)}`} className="font-black text-sm text-bauhaus-blue hover:underline">
                    {c.name}
                  </Link>
                ) : (
                  <h4 className="font-black text-sm">{c.name}</h4>
                )}
                <ContactTypeBadge type={c.contact_type} />
              </div>
              <p className="text-xs text-gray-500">{c.role}</p>
              {c.organisation && c.organisation !== c.name && (
                <p className="text-[10px] text-gray-400 mt-1">{c.organisation}</p>
              )}
              {c.linked_entity_gs_id && (
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  <span className="text-[10px] text-gray-400">
                    Linked to CivicGraph
                    {c.linked_entity_type && <> &middot; {c.linked_entity_type}</>}
                    {c.linked_entity_abn && <> &middot; ABN {c.linked_entity_abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')}</>}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Contracts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function ContractsSection({ contracts }: { contracts: Contract[] | null }) {
  if (!contracts || contracts.length === 0) return null;
  const totalContracts = contracts.reduce((s, r) => s + Number(r.value), 0);
  return (
    <Section title="Federal Contracts">
      <DataSource label="Auto-discovered from AusTender" />
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className={THEAD}>
                <th className={`${TH} pl-4`}>Title</th>
                <th className={TH_R}>Value</th>
                <th className={TH}>Buyer</th>
                <th className={TH}>Period</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c, i) => (
                <tr key={i} className={ROW(i)}>
                  <td className={`${TD} pl-4 font-medium max-w-sm truncate`}>{c.title}</td>
                  <td className={`${TD_R} font-mono font-bold text-green-700`}>{money(Number(c.value))}</td>
                  <td className={`${TD} text-gray-500`}>{c.buyer_name}</td>
                  <td className={`${TD} text-gray-400 text-xs whitespace-nowrap`}>
                    {c.contract_start?.split('T')[0]}
                    {c.contract_end && ` – ${c.contract_end.split('T')[0]}`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={TFOOT}>
                <td className={`${TD} pl-4 font-black`}>TOTAL</td>
                <td className={`${TD_R} font-mono font-black text-green-700`}>{money(totalContracts)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Local ecosystem
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function EcosystemSection({
  localEcosystem,
  entity,
  slug,
}: {
  localEcosystem: LocalEcosystemResult | null;
  entity: GsEntity | null;
  slug: string;
}) {
  if (!localEcosystem || localEcosystem.entities.length === 0) return null;
  return (
    <Section title={`Local Ecosystem — ${entity?.lga_name || entity?.postcode || 'Area'}`}>
      <DataSource label="Auto-discovered from CivicGraph" />
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className={`${THEAD} bg-gray-50`}>
                <th className={`${TH} pl-4`}>Entity</th>
                <th className={TH}>Type</th>
                <th className={TH}>Sector</th>
                <th className={TH}>ABN</th>
              </tr>
            </thead>
            <tbody>
              {localEcosystem.entities.map((e, i) => (
                <tr key={i} className={ROW(i)}>
                  <td className={`${TD} pl-4 font-medium`}>
                    <Link href={`/entity/${encodeURIComponent(e.gs_id)}`} className="text-bauhaus-blue hover:underline">
                      {e.canonical_name}
                    </Link>
                  </td>
                  <td className={TD}>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-sm">{e.entity_type}</span>
                  </td>
                  <td className={`${TD} text-gray-500 text-xs`}>{e.sector}</td>
                  <td className={`${TD} text-gray-400 font-mono text-xs`}>
                    <Link href={`/entity/${encodeURIComponent(e.gs_id)}`} className="hover:text-bauhaus-blue hover:underline">
                      {e.abn?.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {localEcosystem.total > localEcosystem.entities.length && (
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Showing {localEcosystem.entities.length} of {localEcosystem.total.toLocaleString()} entities in {entity?.lga_name || entity?.postcode}
            </p>
            <Link
              href={`/org/${slug}/ecosystem`}
              className="text-xs px-3 py-1.5 bg-bauhaus-black text-white font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors rounded-sm"
            >
              View all {localEcosystem.total.toLocaleString()} entities
            </Link>
          </div>
        )}
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Peer orgs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function PeerOrgsSection({ peerOrgs }: { peerOrgs: PeerOrg[] }) {
  if (peerOrgs.length === 0) return null;
  return (
    <Section title="Peer Organisations">
      <DataSource label="Auto-discovered from ALMA" />
      <p className="text-xs text-gray-400 mb-4 -mt-2">
        Organisations running similar programs — potential collaborators, knowledge-sharing partners, or consortium members.
      </p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {peerOrgs.map((org) => (
          <Link
            key={org.gs_id}
            href={`/entity/${encodeURIComponent(org.gs_id)}`}
            className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden hover:shadow-md hover:border-bauhaus-blue transition-all"
          >
            <div className="border-l-4 border-bauhaus-red p-4">
              <h4 className="font-black text-sm mb-1">{org.canonical_name}</h4>
              <p className="text-xs text-gray-500 mb-2">
                {org.state}{org.lga_name ? ` — ${org.lga_name}` : ''}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 bg-bauhaus-red/10 text-bauhaus-red font-bold rounded-sm">
                  {org.alma_programs} ALMA program{org.alma_programs !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 line-clamp-1">{org.program_types}</p>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Footer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function DashboardFooter({ profileName }: { profileName: string }) {
  return (
    <footer className="border-t border-gray-200 pt-6 pb-8">
      <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Auto-discovered data</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Curated by {profileName}</span>
      </div>
      <p className="text-xs text-gray-400">
        Sources: justice_funding, austender_contracts, alma_interventions, gs_entities.
        Generated {new Date().toISOString().split('T')[0]}.
      </p>
      <p className="mt-2 text-xs">
        <Link href="/home" className="text-gray-400 underline hover:text-bauhaus-red">Home</Link>
        {' '}&middot;{' '}
        <Link href="/mission-control" className="text-gray-400 underline hover:text-bauhaus-red">Mission Control</Link>
      </p>
    </footer>
  );
}
