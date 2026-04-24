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
  PowerIndex,
  RevolvingDoor,
  RelationshipSummary,
  FundingDesert,
  BoardMember,
  DonorCrosslink,
  FoundationFunder,
  OrgProjectFoundationPortfolioRow,
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

function latestCuratedUpdateLabel(items: Array<{ updated_at: string | null | undefined }>) {
  const timestamps = items
    .map((item) => item.updated_at)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;

  return new Date(Math.max(...timestamps)).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function latestCuratedUpdateTime(items: Array<{ updated_at: string | null | undefined }>) {
  const timestamps = items
    .map((item) => item.updated_at)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;
  return Math.max(...timestamps);
}

function curatedHealthMeta(items: Array<{ updated_at: string | null | undefined }>) {
  const latest = latestCuratedUpdateTime(items);
  if (!latest) return null;

  const ageDays = Math.floor((Date.now() - latest) / (24 * 60 * 60 * 1000));
  if (ageDays <= 45) {
    return {
      label: 'Curated and current',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }
  if (ageDays <= 120) {
    return {
      label: 'Curated; review soon',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }
  return {
    label: 'Curated but stale',
    className: 'border-bauhaus-red/20 bg-bauhaus-red/5 text-bauhaus-red',
  };
}

function CuratedHealthLine({ items }: { items: Array<{ updated_at: string | null | undefined }> }) {
  const updatedLabel = latestCuratedUpdateLabel(items);
  const health = curatedHealthMeta(items);

  if (!updatedLabel || !health) return null;

  return (
    <div className="mb-4 -mt-2 flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${health.className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current inline-block" />
        {health.label}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-gray-400">
        Last updated {updatedLabel}
      </span>
    </div>
  );
}

function SectionTrustLine({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'auto' | 'heuristic' | 'warning';
}) {
  const styles = {
    neutral: 'border-gray-200 bg-gray-50 text-gray-600',
    auto: 'border-green-200 bg-green-50 text-green-700',
    heuristic: 'border-amber-200 bg-amber-50 text-amber-700',
    warning: 'border-bauhaus-red/20 bg-bauhaus-red/5 text-bauhaus-red',
  } as const;

  return (
    <div className="mb-4 -mt-2">
      <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${styles[tone]}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current inline-block" />
        {label}
      </span>
    </div>
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
  const hasProfileMeta =
    Boolean(profile.team_size) ||
    Boolean(profile.annual_revenue) ||
    Boolean(entity?.remoteness) ||
    Boolean(entity?.seifa_irsd_decile);
  const profileUpdatedLabel = profile.updated_at
    ? new Date(profile.updated_at).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

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
      {hasProfileMeta && (
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Organisation Profile Inputs
              </p>
              {profileUpdatedLabel && (
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-400">
                  Last updated {profileUpdatedLabel}
                </p>
              )}
            </div>
            <Link href="/profile" className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue underline underline-offset-4">
              Edit profile
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {profile.team_size && (
              <StatCard label="Staff" value={String(profile.team_size)} sub="Curated profile field" />
            )}
            {profile.annual_revenue && (
              <StatCard label="Annual Turnover" value={money(profile.annual_revenue)} sub="Curated profile field" />
            )}
            {entity?.remoteness && (
              <StatCard label="Location" value={entity.lga_name || entity.postcode} sub={entity.remoteness} />
            )}
            {entity?.seifa_irsd_decile && (
              <StatCard label="SEIFA IRSD" value={`Decile ${entity.seifa_irsd_decile}`} sub="Socio-economic index" />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Power Score Badge
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SYSTEM_LABELS: Record<string, { label: string; color: string }> = {
  in_procurement: { label: 'Procurement', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  in_justice_funding: { label: 'Justice Funding', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  in_political_donations: { label: 'Donations', color: 'bg-red-100 text-red-800 border-red-300' },
  in_charity_registry: { label: 'Charity', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  in_foundation: { label: 'Foundation', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  in_alma_evidence: { label: 'ALMA', color: 'bg-pink-100 text-pink-800 border-pink-300' },
  in_ato_transparency: { label: 'ATO', color: 'bg-teal-100 text-teal-800 border-teal-300' },
};

function PowerScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = Math.min((score / maxScore) * 100, 100);
  const tier = pct >= 80 ? 'bg-bauhaus-red' : pct >= 50 ? 'bg-amber-500' : pct >= 20 ? 'bg-bauhaus-blue' : 'bg-gray-400';
  return (
    <div className="w-full h-3 bg-gray-100 rounded-sm overflow-hidden">
      <div className={`h-full rounded-sm transition-all ${tier}`} style={{ width: `${Math.max(pct, 2)}%` }} />
    </div>
  );
}

export function PowerScoreSection({ powerIndex, slug }: { powerIndex: PowerIndex | null; slug: string }) {
  if (!powerIndex) return null;

  const activeSystems = Object.entries(SYSTEM_LABELS).filter(
    ([key]) => powerIndex[key as keyof PowerIndex] && Number(powerIndex[key as keyof PowerIndex]) > 0
  );

  // System presence as a simple horizontal bar chart
  const systemEntries: Array<{ key: string; label: string; color: string; dollars: number }> = [
    { key: 'in_procurement', label: 'Procurement', color: 'bg-blue-500', dollars: Number(powerIndex.procurement_dollars) },
    { key: 'in_justice_funding', label: 'Justice Funding', color: 'bg-emerald-500', dollars: Number(powerIndex.justice_dollars) },
    { key: 'in_political_donations', label: 'Donations', color: 'bg-red-500', dollars: Number(powerIndex.donation_dollars) },
    { key: 'in_charity_registry', label: 'Charity', color: 'bg-purple-500', dollars: 0 },
    { key: 'in_foundation', label: 'Foundation', color: 'bg-amber-500', dollars: Number(powerIndex.foundation_giving) },
    { key: 'in_alma_evidence', label: 'ALMA', color: 'bg-pink-500', dollars: 0 },
    { key: 'in_ato_transparency', label: 'ATO', color: 'bg-teal-500', dollars: Number(powerIndex.ato_income) },
  ];

  const activeEntries = systemEntries.filter(
    s => powerIndex[s.key as keyof PowerIndex] && Number(powerIndex[s.key as keyof PowerIndex]) > 0
  );
  const looksThin =
    Number(powerIndex.system_count) <= 1 ||
    Number(powerIndex.total_dollar_flow) === 0;

  return (
    <Section title="Linked CivicGraph Entity Signals">
      <DataSource label="Auto-computed from ABN-linked CivicGraph records" />
      <SectionTrustLine label="Linked external entity snapshot" tone={looksThin ? 'warning' : 'auto'} />
      <p className="text-xs text-gray-400 mb-4 -mt-2">
        This card only reflects what CivicGraph has linked to the organisation&apos;s ABN in external datasets. It does not
        include curated project strategy, internal pipeline work, or portfolio notes shown elsewhere on this page.
      </p>
      <div className="bg-white border-2 border-bauhaus-black rounded-sm shadow-sm overflow-hidden">
        {/* Header row with score */}
        <div className="p-5 border-b-2 border-bauhaus-black bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Power Score
              </p>
              <p className="text-4xl font-black text-bauhaus-black">{Number(powerIndex.power_score).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Systems Present
              </p>
              <p className="text-4xl font-black text-bauhaus-black">
                {powerIndex.system_count}<span className="text-lg text-gray-400">/7</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Total Dollar Flow
              </p>
              <p className="text-2xl font-black text-green-700">{money(Number(powerIndex.total_dollar_flow))}</p>
            </div>
          </div>
          <PowerScoreBar score={Number(powerIndex.power_score)} maxScore={100} />
        </div>

        {/* System presence badges */}
        <div className="p-5">
          {looksThin && (
            <div className="mb-4 border-2 border-bauhaus-red/25 bg-bauhaus-red/5 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
                Read this as a linked-entity snapshot
              </p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-gray-600">
                This organisation&apos;s curated portfolio may be much richer than its current ABN-linked CivicGraph footprint.
                Use this section as a data-linking signal, not as the main read on organisational strength.
              </p>
            </div>
          )}
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
            Active Systems
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {activeSystems.map(([key, { label, color }]) => (
              <span key={key} className={`text-xs px-3 py-1.5 font-bold border rounded-sm ${color}`}>
                {label}
              </span>
            ))}
          </div>

          {/* System breakdown bars */}
          {activeEntries.length > 0 && (
            <div className="space-y-2 mt-4">
              {activeEntries.map(s => {
                const maxDollars = Math.max(...activeEntries.map(e => e.dollars), 1);
                const pct = s.dollars > 0 ? Math.max((s.dollars / maxDollars) * 100, 4) : 4;
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className="w-28 text-xs font-bold text-gray-500 shrink-0 text-right">{s.label}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-sm overflow-hidden">
                      <div className={`h-full rounded-sm ${s.color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-20 text-xs font-mono font-bold text-gray-600 shrink-0 text-right">
                      {s.dollars > 0 ? money(s.dollars) : '--'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Key counts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-gray-100">
            {Number(powerIndex.contract_count) > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Contracts</p>
                <p className="text-lg font-black">{Number(powerIndex.contract_count).toLocaleString()}</p>
              </div>
            )}
            {Number(powerIndex.justice_record_count) > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Justice Records</p>
                <p className="text-lg font-black">{Number(powerIndex.justice_record_count).toLocaleString()}</p>
              </div>
            )}
            {Number(powerIndex.donation_count) > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Donations</p>
                <p className="text-lg font-black">{Number(powerIndex.donation_count).toLocaleString()}</p>
              </div>
            )}
            {Number(powerIndex.board_connections) > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Board Links</p>
                <p className="text-lg font-black">{Number(powerIndex.board_connections).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Link to graph */}
        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex justify-end">
          <Link
            href={`/graph?entity=${slug}&mode=hubs`}
            className="text-xs px-3 py-1.5 bg-bauhaus-black text-white font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors rounded-sm"
          >
            View in Network Graph
          </Link>
        </div>
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Revolving Door Warning
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VECTOR_LABELS: Record<string, { label: string; icon: string }> = {
  lobbies: { label: 'Lobbying', icon: '!' },
  donates: { label: 'Political Donations', icon: '$' },
  contracts: { label: 'Government Contracts', icon: '#' },
  receives_funding: { label: 'Receives Government Funding', icon: '>' },
};

export function RevolvingDoorSection({ revolvingDoor }: { revolvingDoor: RevolvingDoor | null }) {
  if (!revolvingDoor) return null;

  const vectors = Object.entries(VECTOR_LABELS).filter(
    ([key]) => revolvingDoor[key as keyof RevolvingDoor] === true
  );

  return (
    <section>
      <div className="bg-white border-2 border-orange-400 rounded-sm shadow-sm overflow-hidden">
        <div className="border-l-4 border-orange-500">
          {/* Header */}
          <div className="px-5 py-4 bg-orange-50 border-b border-orange-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-black text-sm">!</span>
                <div>
                  <h3 className="font-black uppercase tracking-widest text-sm text-orange-900">
                    Revolving Door Entity
                  </h3>
                  <p className="text-xs text-orange-700 mt-0.5">
                    This entity operates across {revolvingDoor.influence_vectors} influence vectors
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Score</p>
                <p className="text-2xl font-black text-orange-800">{revolvingDoor.revolving_door_score}</p>
              </div>
            </div>
          </div>

          {/* Influence vectors */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
              Influence Vectors
            </p>
            <div className="grid grid-cols-2 gap-3">
              {vectors.map(([key, { label }]) => {
                let amount: number | null = null;
                if (key === 'donates') amount = Number(revolvingDoor.total_donated);
                if (key === 'contracts') amount = Number(revolvingDoor.total_contracts);
                if (key === 'receives_funding') amount = Number(revolvingDoor.total_funded);

                return (
                  <div key={key} className="flex items-center gap-3 p-3 bg-orange-50/50 border border-orange-100 rounded-sm">
                    <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-gray-700">{label}</p>
                      {amount != null && amount > 0 && (
                        <p className="text-xs font-mono text-gray-500">{money(amount)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Parties funded */}
            {revolvingDoor.parties_funded && revolvingDoor.parties_funded.length > 0 && (
              <div className="mt-4 pt-3 border-t border-orange-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Parties Funded
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {revolvingDoor.parties_funded.map(party => (
                    <span key={party} className="text-[10px] px-2 py-1 bg-red-50 text-red-700 border border-red-200 font-bold rounded-sm">
                      {party}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Relationship Summary
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const REL_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  grant: { label: 'Funding Relationships', color: 'border-l-emerald-500' },
  contract: { label: 'Contract Relationships', color: 'border-l-blue-500' },
  donation: { label: 'Political Donation Connections', color: 'border-l-red-500' },
  lobbies_for: { label: 'Lobbying Connections', color: 'border-l-amber-500' },
  member_of: { label: 'Membership Links', color: 'border-l-purple-500' },
  directorship: { label: 'Directorship Links', color: 'border-l-indigo-500' },
  partners_with: { label: 'Partnership Links', color: 'border-l-teal-500' },
  subsidiary_of: { label: 'Subsidiary Links', color: 'border-l-gray-500' },
};

export function RelationshipSummarySection({
  relationships,
  slug,
}: {
  relationships: RelationshipSummary[];
  slug: string;
}) {
  if (relationships.length === 0) return null;

  const totalRels = relationships.reduce((s, r) => s + r.count, 0);

  return (
    <Section title="Relationship Network">
      <DataSource label="Auto-discovered from CivicGraph" />
      <SectionTrustLine label="Linked external relationship graph" tone="auto" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {relationships.map(r => {
          const meta = REL_TYPE_LABELS[r.relationship_type] ?? {
            label: r.relationship_type,
            color: 'border-l-gray-400',
          };
          return (
            <Link
              key={r.relationship_type}
              href={`/graph?entity=${slug}&mode=hubs`}
              className={`bg-white border border-gray-200 border-l-4 ${meta.color} rounded-sm shadow-sm p-4 hover:shadow-md transition-shadow`}
            >
              <p className="text-2xl font-black text-bauhaus-black">{r.count.toLocaleString()}</p>
              <p className="text-xs font-bold text-gray-500 mt-1">{meta.label}</p>
            </Link>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {totalRels.toLocaleString()} total connections across {relationships.length} types
        </p>
        <Link
          href={`/graph?entity=${slug}&mode=hubs`}
          className="text-xs text-bauhaus-blue font-bold hover:underline"
        >
          Explore in Network Graph
        </Link>
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Funding Desert Context
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function FundingDesertSection({ fundingDesert }: { fundingDesert: FundingDesert | null }) {
  if (!fundingDesert) return null;

  // Only show if it's meaningfully a desert (e.g., top 50% of desert scores)
  const desertScore = Number(fundingDesert.desert_score);
  if (desertScore <= 0) return null;

  const severity =
    desertScore >= 80 ? { label: 'Severe', bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-800', dot: 'bg-red-500' }
    : desertScore >= 50 ? { label: 'Significant', bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-800', dot: 'bg-orange-500' }
    : { label: 'Moderate', bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-800', dot: 'bg-yellow-500' };

  return (
    <section>
      <div className={`${severity.bg} border-2 ${severity.border} rounded-sm p-5`}>
        <div className="flex items-start gap-4">
          <span className={`w-3 h-3 rounded-full ${severity.dot} shrink-0 mt-1`} />
          <div className="flex-1">
            <h3 className={`font-black uppercase tracking-widest text-sm ${severity.text}`}>
              Funding Desert — {severity.label}
            </h3>
            <p className={`text-sm mt-1 ${severity.text}`}>
              Located in <strong>{fundingDesert.lga_name}</strong> ({fundingDesert.state})
              {fundingDesert.desert_rank > 0 && (
                <> — ranked <strong>#{fundingDesert.desert_rank}</strong> funding desert</>
              )}
            </p>
            <div className="flex items-center gap-6 mt-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Desert Score</p>
                <p className={`text-lg font-black ${severity.text}`}>{desertScore.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Remoteness</p>
                <p className="text-sm font-bold text-gray-600">{fundingDesert.remoteness}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Avg IRSD Decile</p>
                <p className="text-sm font-bold text-gray-600">{Number(fundingDesert.avg_irsd_decile).toFixed(1)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Flow</p>
                <p className="text-sm font-bold text-gray-600">{money(Number(fundingDesert.total_dollar_flow))}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Entities</p>
                <p className="text-sm font-bold text-gray-600">{Number(fundingDesert.indexed_entities).toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-3">
              <Link
                href="/reports/power-concentration"
                className="text-xs text-bauhaus-blue font-bold hover:underline"
              >
                View Funding Deserts Report
              </Link>
            </div>
          </div>
        </div>
      </div>
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
      <CuratedHealthLine items={leadership} />
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
// Board Members (auto-discovered)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function formatPersonName(normalised: string): string {
  return normalised
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function BoardMembersSection({ boardMembers }: { boardMembers: BoardMember[] }) {
  if (boardMembers.length === 0) return null;
  return (
    <Section title="Board & Officers">
      <DataSource label="Auto-discovered from ACNC, ORIC, Parliament, ABR" />
      <SectionTrustLine label="Auto-linked registry records" tone="auto" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={THEAD}>
            <tr>
              <th className={TH}>Name</th>
              <th className={TH}>Roles</th>
              <th className={TH}>Sources</th>
              <th className={TH_R}>Contracts</th>
              <th className={TH_R}>Justice $</th>
              <th className={TH_R}>Donations</th>
            </tr>
          </thead>
          <tbody>
            {boardMembers.map((m, i) => {
              const totalFlow = Number(m.contract_dollars) + Number(m.justice_dollars) + Number(m.donation_dollars);
              return (
                <tr key={m.person_name_normalised} className={ROW(i)}>
                  <td className={`${TD} font-bold`}>{formatPersonName(m.person_name_normalised)}</td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-1">
                      {(m.roles ?? []).slice(0, 3).map(r => (
                        <span key={r} className="text-[10px] px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded-sm font-bold uppercase tracking-wider">
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-1">
                      {(m.role_sources ?? []).map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded-sm text-blue-700 font-bold">
                          {s.replace('_register', '').replace('_', ' ').toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={TD_R}>{Number(m.contract_dollars) > 0 ? money(Number(m.contract_dollars)) : '--'}</td>
                  <td className={TD_R}>{Number(m.justice_dollars) > 0 ? money(Number(m.justice_dollars)) : '--'}</td>
                  <td className={TD_R}>{Number(m.donation_dollars) > 0 ? money(Number(m.donation_dollars)) : '--'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Donor→Board Crosslinks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function DonorCrosslinksSection({ donorCrosslinks }: { donorCrosslinks: DonorCrosslink[] }) {
  if (donorCrosslinks.length === 0) return null;
  return (
    <Section title="Political Donor Connections">
      <DataSource label="Cross-referenced: political donations + board positions" />
      <p className="text-xs text-gray-500 mb-4">
        People connected to this organisation who also appear as individual political donors.
      </p>
      <div className="space-y-3">
        {donorCrosslinks.map(d => (
          <div key={d.donor_name} className="bg-white border-2 border-gray-200 rounded-sm p-4 hover:border-bauhaus-black transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-black text-sm">{d.donor_name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  {d.is_politician && (
                    <span className="text-[10px] px-2 py-0.5 bg-red-100 border border-red-300 rounded-sm text-red-700 font-bold uppercase tracking-wider">
                      Politician
                    </span>
                  )}
                  {d.is_foundation_trustee && (
                    <span className="text-[10px] px-2 py-0.5 bg-amber-100 border border-amber-300 rounded-sm text-amber-700 font-bold uppercase tracking-wider">
                      Foundation Trustee
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 font-bold">
                    Power Score: {d.power_score}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-red-700">{money(Number(d.total_donated))}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  {d.donation_count} donation{d.donation_count !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(d.parties ?? []).map(p => (
                <span key={p} className="text-[10px] px-2 py-0.5 bg-gray-100 border border-gray-200 rounded-sm font-bold">
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Foundation Funders
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ScorePill({ score, label }: { score: number | null; label: string }) {
  if (score == null) return null;
  const bg = score >= 50 ? 'bg-green-100 text-green-800' : score >= 20 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${bg}`} title={label}>
      {label[0]}: {score}
    </span>
  );
}

export function FoundationFundersSection({ foundationFunders }: { foundationFunders: FoundationFunder[] }) {
  if (foundationFunders.length === 0) return null;
  const hasScores = foundationFunders.some(f => f.foundation_score != null);
  return (
    <Section title="Foundation Funders">
      <DataSource label="Cross-referenced: foundation grants + entity registry + foundation scores" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={THEAD}>
            <tr>
              <th className={TH}>Foundation</th>
              <th className={TH_R}>Annual Giving</th>
              <th className={TH_R}>Grants</th>
              <th className={TH_R}>Value</th>
              {hasScores && <th className={TH}>Score</th>}
              <th className={TH}>Years</th>
            </tr>
          </thead>
          <tbody>
            {foundationFunders.map((f, i) => (
              <tr key={f.foundation_abn ?? f.foundation_name} className={ROW(i)}>
                <td className={`${TD} font-bold`}>
                  {f.foundation_name}
                  {Number(f.overlapping_trustees) > 0 && (
                    <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded" title="Foundation trustees sit on this org's board">
                      BOARD OVERLAP
                    </span>
                  )}
                </td>
                <td className={TD_R}>{Number(f.total_giving_annual) > 0 ? money(Number(f.total_giving_annual)) : '--'}</td>
                <td className={TD_R}>{f.grant_count}</td>
                <td className={TD_R}>{Number(f.total_grant_amount) > 0 ? money(Number(f.total_grant_amount)) : '--'}</td>
                {hasScores && (
                  <td className={TD}>
                    <div className="flex flex-wrap gap-1">
                      {f.foundation_score != null && (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-black bg-bauhaus-black text-white rounded">
                          {f.foundation_score}
                        </span>
                      )}
                      <ScorePill score={f.transparency_score ?? null} label="Transparency" />
                      <ScorePill score={f.need_alignment_score ?? null} label="Need" />
                      <ScorePill score={f.evidence_score ?? null} label="Evidence" />
                    </div>
                  </td>
                )}
                <td className={TD}>
                  <div className="flex flex-wrap gap-1">
                    {(f.grant_years ?? []).sort().map(y => (
                      <span key={y} className="text-[10px] px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded-sm font-mono">
                        {y}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasScores && (
        <div className="mt-3 text-right">
          <Link href="/reports/philanthropy" className="text-[10px] font-black text-bauhaus-blue uppercase tracking-widest hover:text-bauhaus-red">
            Foundation Intelligence Report &rarr;
          </Link>
        </div>
      )}
    </Section>
  );
}

function portfolioReadiness(item: OrgProjectFoundationPortfolioRow) {
  const statuses = [
    item.research?.fit_status ?? 'missing',
    item.research?.proof_status ?? 'missing',
    item.research?.applicant_status ?? 'missing',
    item.research?.relationship_status ?? 'missing',
    item.research?.ask_status ?? 'missing',
  ];
  const readyCount = statuses.filter((status) => status === 'ready').length;
  const missingCount = statuses.filter((status) => status === 'missing').length;

  if (readyCount >= 4 && missingCount === 0) return 'Outreach ready' as const;
  if (readyCount >= 2 && missingCount <= 2) return 'Build before outreach' as const;
  return 'Discovery brief' as const;
}

function engagementLabel(status: OrgProjectFoundationPortfolioRow['engagement_status']) {
  return {
    researching: 'Researching',
    ready_to_approach: 'Ready To Approach',
    approached: 'Approached',
    meeting: 'Meeting',
    proposal: 'Proposal',
    won: 'Won',
    lost: 'Lost',
    parked: 'Parked',
  }[status];
}

function shortNames(rows: OrgProjectFoundationPortfolioRow[]) {
  return rows.slice(0, 3).map((row) => row.foundation.name).join(' · ');
}

function shortPipelineNames(rows: OrgPipelineItemWithEntity[]) {
  return rows.slice(0, 3).map((row) => row.name).join(' · ');
}

function bestLeadProject(rows: OrgProjectFoundationPortfolioRow[]) {
  return [...rows].sort((left, right) => {
    const readinessDelta =
      (portfolioReadiness(right) === 'Outreach ready' ? 2 : portfolioReadiness(right) === 'Build before outreach' ? 1 : 0) -
      (portfolioReadiness(left) === 'Outreach ready' ? 2 : portfolioReadiness(left) === 'Build before outreach' ? 1 : 0);
    if (readinessDelta !== 0) return readinessDelta;
    return (right.fit_score ?? -1) - (left.fit_score ?? -1);
  })[0] ?? null;
}

function portfolioNextTouchState(row: OrgProjectFoundationPortfolioRow) {
  if (!row.next_touch_at) return 'none' as const;
  const now = Date.now();
  const touchAt = new Date(row.next_touch_at).getTime();
  if (touchAt <= now) return 'due' as const;
  if (touchAt <= now + 14 * 24 * 60 * 60 * 1000) return 'upcoming' as const;
  return 'scheduled' as const;
}

function portfolioRelationshipStale(row: OrgProjectFoundationPortfolioRow) {
  if (!['approached', 'meeting', 'proposal'].includes(row.engagement_status)) return false;
  if (!row.last_interaction_at) return true;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return new Date(row.last_interaction_at).getTime() < thirtyDaysAgo;
}

function pipelineNeedsAttention(row: OrgPipelineItemWithEntity) {
  return !['submitted', 'awarded', 'rejected'].includes(row.status);
}

function pipelineDeadlineSoon(row: OrgPipelineItemWithEntity) {
  if (!row.deadline || !pipelineNeedsAttention(row)) return false;
  const deadlineAt = new Date(row.deadline).getTime();
  if (!Number.isFinite(deadlineAt)) return false;
  const now = Date.now();
  const daysUntil = Math.ceil((deadlineAt - now) / (24 * 60 * 60 * 1000));
  return daysUntil >= 0 && daysUntil <= 21;
}

function pipelineDeadlineLabel(row: OrgPipelineItemWithEntity) {
  if (!row.deadline) return 'No deadline';
  return new Date(row.deadline).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });
}

function highestFitRow(rows: OrgProjectFoundationPortfolioRow[]) {
  return [...rows].sort((left, right) => (right.fit_score ?? -1) - (left.fit_score ?? -1))[0] ?? null;
}

function earliestNextTouchRow(rows: OrgProjectFoundationPortfolioRow[]) {
  return [...rows].sort((left, right) => {
    const leftTime = left.next_touch_at ? new Date(left.next_touch_at).getTime() : Number.POSITIVE_INFINITY;
    const rightTime = right.next_touch_at ? new Date(right.next_touch_at).getTime() : Number.POSITIVE_INFINITY;
    return leftTime - rightTime;
  })[0] ?? null;
}

export function ActionFocusSection({
  slug,
  fundingWorkspaceHref,
  portfolio,
  pipeline,
}: {
  slug: string;
  fundingWorkspaceHref: string;
  portfolio: OrgProjectFoundationPortfolioRow[];
  pipeline: OrgPipelineItemWithEntity[];
}) {
  const dueFollowUps = portfolio.filter((row) => portfolioNextTouchState(row) === 'due');
  const readyToApproach = portfolio.filter((row) => row.engagement_status === 'ready_to_approach');
  const needsProof = portfolio.filter((row) => (row.research?.proof_status ?? 'missing') !== 'ready');
  const deadlineWindow = pipeline
    .filter((row) => pipelineDeadlineSoon(row))
    .sort((left, right) => {
      if (!left.deadline || !right.deadline) return 0;
      return new Date(left.deadline).getTime() - new Date(right.deadline).getTime();
    });
  const dueLead = earliestNextTouchRow(dueFollowUps);
  const readyLead = highestFitRow(readyToApproach);
  const proofLead = highestFitRow(needsProof);
  const deadlineLead = deadlineWindow[0] ?? null;
  const topPriority = dueLead
    ? {
        key: 'due',
        kicker: 'Top priority',
        title: `${dueLead.project.name} follow-up is due now`,
        body:
          dueLead.next_step ||
          `Re-open ${dueLead.foundation.name} for ${dueLead.project.name} and move the next touch forward now.`,
        href: dueLead.project.slug ? `/org/${slug}/${dueLead.project.slug}` : '#curated-philanthropy',
        cta: dueLead.project.slug ? `Open ${dueLead.project.name}` : 'Open philanthropy',
        detailHref: `/foundations/${dueLead.foundation.id}`,
        detailLabel: `Open ${dueLead.foundation.name}`,
        signals: [
          portfolioReadiness(dueLead),
          engagementLabel(dueLead.engagement_status),
          dueLead.fit_score != null ? `Fit ${dueLead.fit_score}` : null,
          dueLead.applicant_entity ? `Via ${dueLead.applicant_entity.name}` : null,
        ].filter((value): value is string => Boolean(value)),
        meta: dueLead.next_touch_at
          ? `Due ${new Date(dueLead.next_touch_at).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
            })}`
          : 'Due now',
        tone: 'border-bauhaus-red bg-bauhaus-red text-white',
      }
    : deadlineLead
      ? {
          key: 'deadlines',
          kicker: 'Top priority',
          title: `${deadlineLead.name} is in the deadline window`,
          body: `${deadlineLead.funder || 'Funder'} · ${deadlineLead.amount_display || 'Amount not set'} · move this from watching into drafting now.`,
          href: '#curated-pipeline',
          cta: 'Open pipeline',
          detailHref:
            deadlineLead.grant_opportunity_id
              ? `/grants/${deadlineLead.grant_opportunity_id}`
              : deadlineLead.grant_url || null,
          detailLabel: deadlineLead.grant_url || deadlineLead.grant_opportunity_id ? 'Open grant' : null,
          detailExternal: Boolean(deadlineLead.grant_url && !deadlineLead.grant_opportunity_id),
          signals: [
            deadlineLead.status.replace(/_/g, ' '),
            deadlineLead.funder_type ? `${deadlineLead.funder_type} funder` : null,
            deadlineLead.amount_display || null,
          ].filter((value): value is string => Boolean(value)),
          meta: `Closes ${pipelineDeadlineLabel(deadlineLead)}`,
          tone: 'border-bauhaus-blue bg-bauhaus-blue text-white',
        }
      : readyLead
        ? {
            key: 'ready',
            kicker: 'Top priority',
            title: `${readyLead.project.name} has a ready outreach lead`,
            body:
              readyLead.message_alignment ||
              `Open ${readyLead.foundation.name} and turn the current fit into a live outreach move.`,
            href: readyLead.project.slug ? `/org/${slug}/${readyLead.project.slug}` : '#curated-philanthropy',
            cta: readyLead.project.slug ? `Open ${readyLead.project.name}` : 'Review ready funders',
            detailHref: `/foundations/${readyLead.foundation.id}`,
            detailLabel: `Open ${readyLead.foundation.name}`,
            signals: [
              portfolioReadiness(readyLead),
              engagementLabel(readyLead.engagement_status),
              readyLead.fit_score != null ? `Fit ${readyLead.fit_score}` : null,
              readyLead.applicant_entity ? `Via ${readyLead.applicant_entity.name}` : null,
            ].filter((value): value is string => Boolean(value)),
            meta: `Fit ${readyLead.fit_score ?? '—'}`,
            tone: 'border-money bg-money text-white',
          }
        : proofLead
          ? {
              key: 'proof',
              kicker: 'Top priority',
              title: `${proofLead.project.name} needs stronger proof before outreach`,
              body:
                proofLead.fit_summary ||
                `Tighten the evidence case for ${proofLead.foundation.name} before pushing this any further.`,
              href: proofLead.project.slug
                ? `${fundingWorkspaceHref}&project=${encodeURIComponent(proofLead.project.slug)}`
                : fundingWorkspaceHref,
              cta: proofLead.project.slug ? `Open ${proofLead.project.name} matches` : 'Open funding matches',
              detailHref: `/foundations/${proofLead.foundation.id}`,
              detailLabel: `Open ${proofLead.foundation.name}`,
              signals: [
                portfolioReadiness(proofLead),
                proofLead.research?.missing_items?.length
                  ? `${proofLead.research.missing_items.length} missing`
                  : null,
                proofLead.fit_score != null ? `Fit ${proofLead.fit_score}` : null,
                proofLead.applicant_entity ? `Via ${proofLead.applicant_entity.name}` : null,
              ].filter((value): value is string => Boolean(value)),
              meta: proofLead.foundation.name,
              tone: 'border-bauhaus-black bg-bauhaus-black text-white',
            }
          : null;

  const focusCards = [
    {
      key: 'due',
      kicker: 'Due now',
      count: dueFollowUps.length,
      tone: 'border-bauhaus-red/25 bg-bauhaus-red/5 text-bauhaus-red',
      lead:
        dueLead && dueLead.project.slug
          ? `${dueLead.project.name} · ${dueLead.foundation.name}`
          : null,
      body:
        dueFollowUps.length > 0
          ? dueLead?.next_step || `${shortNames(dueFollowUps)}`
          : 'No philanthropy follow-ups are due right now.',
      href: dueLead?.project.slug ? `/org/${slug}/${dueLead.project.slug}` : '#curated-philanthropy',
      cta: dueLead?.project.slug ? `Open ${dueLead.project.name}` : 'Open philanthropy',
      detailHref: dueLead ? `/foundations/${dueLead.foundation.id}` : null,
      detailLabel: dueLead ? `Open ${dueLead.foundation.name}` : null,
      signals: dueLead
        ? [
            portfolioReadiness(dueLead),
            engagementLabel(dueLead.engagement_status),
            dueLead.fit_score != null ? `Fit ${dueLead.fit_score}` : null,
          ].filter((value): value is string => Boolean(value))
        : [],
    },
    {
      key: 'ready',
      kicker: 'Ready to approach',
      count: readyToApproach.length,
      tone: 'border-money bg-money-light text-money',
      lead:
        readyLead && readyLead.project.slug
          ? `${readyLead.project.name} · ${readyLead.foundation.name}`
          : null,
      body:
        readyToApproach.length > 0
          ? readyLead?.message_alignment || `${shortNames(readyToApproach)}`
          : 'No foundations are fully ready for outreach yet.',
      href: readyLead?.project.slug ? `/org/${slug}/${readyLead.project.slug}` : '#curated-philanthropy',
      cta: readyLead?.project.slug ? `Open ${readyLead.project.name}` : 'Review ready funders',
      detailHref: readyLead ? `/foundations/${readyLead.foundation.id}` : null,
      detailLabel: readyLead ? `Open ${readyLead.foundation.name}` : null,
      signals: readyLead
        ? [
            portfolioReadiness(readyLead),
            engagementLabel(readyLead.engagement_status),
            readyLead.fit_score != null ? `Fit ${readyLead.fit_score}` : null,
          ].filter((value): value is string => Boolean(value))
        : [],
    },
    {
      key: 'deadlines',
      kicker: 'Deadline window',
      count: deadlineWindow.length,
      tone: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
      lead: deadlineLead?.name ?? null,
      body:
        deadlineWindow.length > 0
          ? `${deadlineLead?.funder || 'Funder'} · ${shortPipelineNames(deadlineWindow)}`
          : 'No grant deadlines land in the next three weeks.',
      meta:
        deadlineLead
          ? `Next: ${pipelineDeadlineLabel(deadlineLead)}`
          : undefined,
      href: '#curated-pipeline',
      cta: 'Open pipeline',
      detailHref:
        deadlineLead?.grant_opportunity_id
          ? `/grants/${deadlineLead.grant_opportunity_id}`
          : deadlineLead?.grant_url || null,
      detailLabel: deadlineLead?.grant_opportunity_id || deadlineLead?.grant_url ? 'Open grant' : null,
      detailExternal: Boolean(deadlineLead?.grant_url && !deadlineLead?.grant_opportunity_id),
      signals: deadlineLead
        ? [
            deadlineLead.status.replace(/_/g, ' '),
            deadlineLead.funder_type ? `${deadlineLead.funder_type} funder` : null,
            deadlineLead.amount_display || null,
          ].filter((value): value is string => Boolean(value))
        : [],
    },
    {
      key: 'proof',
      kicker: 'Proof to build',
      count: needsProof.length,
      tone: 'border-bauhaus-black/10 bg-gray-50 text-bauhaus-black',
      lead:
        proofLead && proofLead.project.slug
          ? `${proofLead.project.name} · ${proofLead.foundation.name}`
          : null,
      body:
        needsProof.length > 0
          ? proofLead?.fit_summary || `${shortNames(needsProof)}`
          : 'Proof looks in good shape across the current funder set.',
      href:
        proofLead?.project.slug
          ? `${fundingWorkspaceHref}&project=${encodeURIComponent(proofLead.project.slug)}`
          : fundingWorkspaceHref,
      cta:
        proofLead?.project.slug
          ? `Open ${proofLead.project.name} matches`
          : 'Open funding matches',
      detailHref: proofLead ? `/foundations/${proofLead.foundation.id}` : null,
      detailLabel: proofLead ? `Open ${proofLead.foundation.name}` : null,
      signals: proofLead
        ? [
            portfolioReadiness(proofLead),
            proofLead.research?.missing_items?.length
              ? `${proofLead.research.missing_items.length} missing`
              : null,
            proofLead.fit_score != null ? `Fit ${proofLead.fit_score}` : null,
          ].filter((value): value is string => Boolean(value))
        : [],
    },
  ];
  const nextMoves = focusCards
    .filter((card) => card.count > 0)
    .filter((card) => card.key !== topPriority?.key)
    .slice(0, 2);

  if (focusCards.every((card) => card.count === 0)) return null;

  return (
    <Section title="Action Focus">
      <CuratedSource label="Curated operating priorities" />
      <p className="mb-4 -mt-2 max-w-3xl text-sm font-medium leading-relaxed text-gray-600">
        Start here before the rest of the dashboard. This is the short ranked queue for what ACT should do next.
      </p>
      {topPriority ? (
        <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="border-2 border-bauhaus-black bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className={`inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${topPriority.tone}`}>
                {topPriority.kicker}
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
                {topPriority.meta}
              </div>
            </div>
            <h3 className="mt-3 text-xl font-black uppercase tracking-tight text-bauhaus-black">
              {topPriority.title}
            </h3>
            <p className="mt-2 max-w-4xl text-sm font-medium leading-relaxed text-gray-600 line-clamp-3">
              {topPriority.body}
            </p>
            {topPriority.signals.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {topPriority.signals.map((signal) => (
                  <span
                    key={signal}
                    className="border border-bauhaus-black/15 bg-gray-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500"
                  >
                    {signal}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href={topPriority.href}
                className="inline-flex border-2 border-bauhaus-black bg-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-white hover:text-bauhaus-black"
              >
                {topPriority.cta}
              </a>
              {topPriority.detailHref && topPriority.detailLabel ? (
                <a
                  href={topPriority.detailHref}
                  target={topPriority.detailExternal ? '_blank' : undefined}
                  rel={topPriority.detailExternal ? 'noreferrer' : undefined}
                  className="inline-flex border-2 border-bauhaus-black/15 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black transition-colors hover:border-bauhaus-black"
                >
                  {topPriority.detailLabel}
                </a>
              ) : null}
            </div>
          </div>
          {nextMoves.length > 0 ? (
            <div className="border-2 border-bauhaus-black bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Next moves</div>
              <div className="mt-3 space-y-3">
                {nextMoves.map((card, index) => (
                  <div key={`next-${card.key}`} className="border-2 border-bauhaus-black/10 bg-gray-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                          #{index + 2} {card.kicker}
                        </div>
                        {card.lead ? (
                          <div className="mt-1 text-sm font-black leading-snug text-bauhaus-black">
                            {card.lead}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-lg font-black text-bauhaus-black">{card.count}</div>
                    </div>
                    {card.signals.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {card.signals.slice(0, 2).map((signal) => (
                          <span
                            key={`next-${card.key}-${signal}`}
                            className="border border-bauhaus-black/15 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500"
                          >
                            {signal}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <a
                        href={card.href}
                        className="inline-flex border-2 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
                      >
                        {card.cta}
                      </a>
                      {card.detailHref && card.detailLabel ? (
                        <a
                          href={card.detailHref}
                          target={card.detailExternal ? '_blank' : undefined}
                          rel={card.detailExternal ? 'noreferrer' : undefined}
                          className="inline-flex border-2 border-bauhaus-black/15 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black transition-colors hover:border-bauhaus-black"
                        >
                          {card.detailLabel}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}

export function PhilanthropyPortfolioSection({
  portfolio,
  slug,
}: {
  portfolio: OrgProjectFoundationPortfolioRow[];
  slug: string;
}) {
  if (portfolio.length === 0) return null;

  const byProject = new Map<string, { name: string; slug: string; rows: OrgProjectFoundationPortfolioRow[] }>();
  for (const row of portfolio) {
    const existing = byProject.get(row.project.id);
    if (existing) {
      existing.rows.push(row);
    } else {
      byProject.set(row.project.id, {
        name: row.project.name,
        slug: row.project.slug,
        rows: [row],
      });
    }
  }

  const projectSummaries = Array.from(byProject.values())
    .map((project) => {
      const outreachReady = project.rows.filter((row) => portfolioReadiness(row) === 'Outreach ready').length;
      const buildBeforeOutreach = project.rows.filter((row) => portfolioReadiness(row) === 'Build before outreach').length;
      const discoveryBrief = project.rows.filter((row) => portfolioReadiness(row) === 'Discovery brief').length;
      const avgFit =
        project.rows.filter((row) => row.fit_score != null).reduce((sum, row) => sum + Number(row.fit_score), 0) /
        Math.max(project.rows.filter((row) => row.fit_score != null).length, 1);
      return {
        ...project,
        outreachReady,
        buildBeforeOutreach,
        discoveryBrief,
        avgFit,
      };
    })
    .sort((left, right) => {
      if (right.outreachReady !== left.outreachReady) return right.outreachReady - left.outreachReady;
      if (right.buildBeforeOutreach !== left.buildBeforeOutreach) return right.buildBeforeOutreach - left.buildBeforeOutreach;
      return right.avgFit - left.avgFit;
    });

  const recurringFoundations = Array.from(
    portfolio.reduce((map, row) => {
      const existing = map.get(row.foundation.id);
      if (existing) {
        existing.projects.push(row.project.name);
        existing.rows.push(row);
        existing.count += 1;
      } else {
        map.set(row.foundation.id, {
          foundationId: row.foundation.id,
          name: row.foundation.name,
          totalGivingAnnual: row.foundation.total_giving_annual,
          projects: [row.project.name],
          rows: [row],
          count: 1,
        });
      }
      return map;
    }, new Map<string, { foundationId: string; name: string; totalGivingAnnual: number | null; projects: string[]; rows: OrgProjectFoundationPortfolioRow[]; count: number }>())
  )
    .map(([, value]) => value)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return (right.totalGivingAnnual ?? 0) - (left.totalGivingAnnual ?? 0);
    });

  const needsProof = portfolio.filter((row) => (row.research?.proof_status ?? 'missing') !== 'ready');
  const needsRelationship = portfolio.filter((row) => (row.research?.relationship_status ?? 'missing') !== 'ready');
  const needsApplicant = portfolio.filter((row) => (row.research?.applicant_status ?? 'missing') !== 'ready');
  const readyToApproach = portfolio.filter((row) => row.engagement_status === 'ready_to_approach');
  const activeOutreach = portfolio.filter((row) =>
    ['approached', 'meeting', 'proposal'].includes(row.engagement_status),
  );
  const won = portfolio.filter((row) => row.engagement_status === 'won');
  const dueNow = portfolio.filter((row) => portfolioNextTouchState(row) === 'due');
  const upcoming = portfolio.filter((row) => portfolioNextTouchState(row) === 'upcoming');
  const stale = portfolio.filter((row) => portfolioRelationshipStale(row));

  return (
    <Section title="Philanthropy Portfolio">
      <CuratedSource label="Curated project-foundation strategy workspace" />
      <CuratedHealthLine items={portfolio} />
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="border-2 border-bauhaus-black bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
                Cross-project pipeline
              </div>
              <h3 className="mt-2 text-2xl font-black uppercase tracking-tight text-bauhaus-black">
                Where ACT should focus next
              </h3>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-gray-600">
                This rollup shows which projects have the strongest philanthropic path right now, which foundations recur
                across projects, and where proof, relationship, or applicant work is still thin.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="border-2 border-money bg-money-light px-3 py-2 text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-money">Outreach ready</div>
                <div className="mt-1 text-2xl font-black text-money">
                  {portfolio.filter((row) => portfolioReadiness(row) === 'Outreach ready').length}
                </div>
              </div>
              <div className="border-2 border-bauhaus-blue bg-link-light px-3 py-2 text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">Build</div>
                <div className="mt-1 text-2xl font-black text-bauhaus-blue">
                  {portfolio.filter((row) => portfolioReadiness(row) === 'Build before outreach').length}
                </div>
              </div>
              <div className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 px-3 py-2 text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Discovery</div>
                <div className="mt-1 text-2xl font-black text-bauhaus-red">
                  {portfolio.filter((row) => portfolioReadiness(row) === 'Discovery brief').length}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="border-2 border-bauhaus-black/10 bg-gray-50 px-3 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Ready to approach</div>
              <div className="mt-1 text-2xl font-black text-bauhaus-black">{readyToApproach.length}</div>
            </div>
            <div className="border-2 border-bauhaus-black/10 bg-gray-50 px-3 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Active outreach</div>
              <div className="mt-1 text-2xl font-black text-bauhaus-black">{activeOutreach.length}</div>
            </div>
            <div className="border-2 border-bauhaus-black/10 bg-gray-50 px-3 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Won</div>
              <div className="mt-1 text-2xl font-black text-bauhaus-black">{won.length}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 px-3 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Due now</div>
              <div className="mt-1 text-2xl font-black text-bauhaus-red">{dueNow.length}</div>
            </div>
            <div className="border-2 border-bauhaus-blue bg-link-light px-3 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">Upcoming</div>
              <div className="mt-1 text-2xl font-black text-bauhaus-blue">{upcoming.length}</div>
            </div>
            <div className="border-2 border-bauhaus-black/10 bg-gray-50 px-3 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Stale</div>
              <div className="mt-1 text-2xl font-black text-bauhaus-black">{stale.length}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {projectSummaries.map((project) => (
              <div key={project.slug} className="border-2 border-bauhaus-black/10 bg-gray-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/org/${slug}/${project.slug}`} className="text-lg font-black text-bauhaus-black hover:underline">
                      {project.name}
                    </Link>
                    <p className="mt-1 text-sm font-medium text-gray-600">
                      {project.rows.length} saved foundations · average fit {Number.isFinite(project.avgFit) ? Math.round(project.avgFit) : '—'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="border-2 border-money bg-money-light px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-money">
                      Ready {project.outreachReady}
                    </span>
                    <span className="border-2 border-bauhaus-blue bg-link-light px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">
                      Build {project.buildBeforeOutreach}
                    </span>
                    <span className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
                      Discovery {project.discoveryBrief}
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-sm font-medium leading-relaxed text-gray-600">
                  {shortNames(project.rows)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-2 border-bauhaus-black bg-white p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
              Recurring foundations
            </div>
            <div className="mt-4 space-y-3">
              {recurringFoundations.slice(0, 6).map((foundation) => {
                const leadProject = bestLeadProject(foundation.rows);
                return (
                  <details key={foundation.foundationId} className="border-2 border-bauhaus-black/10 bg-gray-50 p-3">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                      <div>
                        <div className="font-black text-bauhaus-black">{foundation.name}</div>
                        <div className="mt-1 text-xs font-medium text-gray-500">
                          {foundation.projects.join(' · ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Projects</div>
                        <div className="mt-1 text-xl font-black text-bauhaus-black">{foundation.count}</div>
                      </div>
                    </summary>

                    <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
                      <div className="border-2 border-bauhaus-black/10 bg-white p-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                          Recommended lead project
                        </div>
                        {leadProject ? (
                          <div className="mt-2">
                            <Link
                              href={`/org/${slug}/${leadProject.project.slug}`}
                              className="font-black text-bauhaus-black hover:underline"
                            >
                              {leadProject.project.name}
                            </Link>
                            <div className="mt-1 text-xs font-medium text-gray-500">
                              {portfolioReadiness(leadProject)} · fit {leadProject.fit_score ?? '—'}
                              {' · '}
                              {engagementLabel(leadProject.engagement_status)}
                              {leadProject.next_touch_at ? ` · next ${new Date(leadProject.next_touch_at).toLocaleDateString('en-AU')}` : ''}
                              {leadProject.applicant_entity ? ` · via ${leadProject.applicant_entity.name}` : ''}
                            </div>
                            {leadProject.next_step ? (
                              <p className="mt-2 text-sm font-medium leading-relaxed text-gray-600">
                                {leadProject.next_step}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm font-medium text-gray-600">No lead project identified yet.</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        {foundation.rows
                          .sort((left, right) => (right.fit_score ?? -1) - (left.fit_score ?? -1))
                          .map((row) => (
                            <div key={row.id} className="border-2 border-bauhaus-black/10 bg-white p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <Link
                                    href={`/org/${slug}/${row.project.slug}`}
                                    className="font-black text-bauhaus-black hover:underline"
                                  >
                                    {row.project.name}
                                  </Link>
                                  <div className="mt-1 flex flex-wrap gap-2">
                                    <span className="border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                                      {portfolioReadiness(row)}
                                    </span>
                                    <span className="border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                                      {engagementLabel(row.engagement_status)}
                                    </span>
                                    {row.next_touch_at ? (
                                      <span className={`border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] ${
                                        portfolioNextTouchState(row) === 'due'
                                          ? 'border-bauhaus-red/20 bg-bauhaus-red/5 text-bauhaus-red'
                                          : 'border-gray-200 bg-gray-50 text-gray-500'
                                      }`}>
                                        Next {new Date(row.next_touch_at).toLocaleDateString('en-AU')}
                                      </span>
                                    ) : null}
                                    <span className="border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                                      Fit {row.fit_score ?? '—'}
                                    </span>
                                    {row.applicant_entity ? (
                                      <span className="border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                                        Via {row.applicant_entity.name}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                                    Annual giving
                                  </div>
                                  <div className="mt-1 text-sm font-black text-bauhaus-black">
                                    {row.foundation.total_giving_annual ? money(Number(row.foundation.total_giving_annual)) : '—'}
                                  </div>
                                </div>
                              </div>
                              {row.fit_summary ? (
                                <p className="mt-2 text-sm font-medium leading-relaxed text-gray-600">{row.fit_summary}</p>
                              ) : null}
                              <div className="mt-2 grid gap-2 md:grid-cols-2">
                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Lead with</div>
                                  <p className="mt-1 text-sm font-medium leading-relaxed text-gray-600">
                                    {row.message_alignment || 'No message alignment written yet.'}
                                  </p>
                                </div>
                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Next move</div>
                                  <p className="mt-1 text-sm font-medium leading-relaxed text-gray-600">
                                    {row.next_step || 'No next move recorded yet.'}
                                  </p>
                                </div>
                              </div>
                              {(row.next_touch_note || row.last_interaction_at || portfolioRelationshipStale(row)) ? (
                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                  <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Follow-up rhythm</div>
                                    <p className="mt-1 text-sm font-medium leading-relaxed text-gray-600">
                                      {portfolioNextTouchState(row) === 'due'
                                        ? 'Follow-up is due now.'
                                        : portfolioNextTouchState(row) === 'upcoming'
                                          ? 'Follow-up is scheduled soon.'
                                          : portfolioRelationshipStale(row)
                                            ? 'Relationship is stale and needs attention.'
                                            : 'No active follow-up risk flagged.'}
                                    </p>
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Last touch</div>
                                    <p className="mt-1 text-sm font-medium leading-relaxed text-gray-600">
                                      {row.last_interaction_at
                                        ? new Date(row.last_interaction_at).toLocaleString('en-AU')
                                        : 'No interaction recorded yet.'}
                                    </p>
                                  </div>
                                </div>
                              ) : null}
                              {row.next_touch_note ? (
                                <div className="mt-2">
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Next touch note</div>
                                  <p className="mt-1 text-sm font-medium leading-relaxed text-gray-600">
                                    {row.next_touch_note}
                                  </p>
                                </div>
                              ) : null}
                              {row.research?.missing_items?.length ? (
                                <div className="mt-2">
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                                    Missing before outreach
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    {row.research.missing_items.slice(0, 4).map((item) => (
                                      <span
                                        key={`${row.id}-${item}`}
                                        className="border border-bauhaus-red/20 bg-bauhaus-red/5 px-2 py-0.5 text-[10px] font-bold text-bauhaus-red"
                                      >
                                        {item}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ))}
                      </div>
                    </div>
                  </details>
                );
              })}
        </div>
      </div>
      </div>

      <div className="mt-4 border-2 border-bauhaus-black bg-white p-5">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
          Org-wide gaps
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="border-2 border-bauhaus-black/10 bg-gray-50 p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Needs proof</div>
            <div className="mt-1 text-2xl font-black text-bauhaus-black">{needsProof.length}</div>
            <div className="mt-2 text-sm font-medium text-gray-600">{shortNames(needsProof)}</div>
          </div>
          <div className="border-2 border-bauhaus-black/10 bg-gray-50 p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Needs relationship path</div>
            <div className="mt-1 text-2xl font-black text-bauhaus-black">{needsRelationship.length}</div>
            <div className="mt-2 text-sm font-medium text-gray-600">{shortNames(needsRelationship)}</div>
          </div>
          <div className="border-2 border-bauhaus-black/10 bg-gray-50 p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Needs applicant clarity</div>
            <div className="mt-1 text-2xl font-black text-bauhaus-black">{needsApplicant.length}</div>
            <div className="mt-2 text-sm font-medium text-gray-600">{shortNames(needsApplicant)}</div>
          </div>
          <div className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">Due follow-ups</div>
            <div className="mt-1 text-2xl font-black text-bauhaus-red">{dueNow.length}</div>
            <div className="mt-2 text-sm font-medium text-gray-600">{shortNames(dueNow)}</div>
          </div>
          <div className="border-2 border-bauhaus-black/10 bg-gray-50 p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Stale relationships</div>
            <div className="mt-1 text-2xl font-black text-bauhaus-black">{stale.length}</div>
            <div className="mt-2 text-sm font-medium text-gray-600">{shortNames(stale)}</div>
          </div>
        </div>
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
      <SectionTrustLine label="Auto-linked public funding records" tone="auto" />
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
      <SectionTrustLine label="Auto-linked public funding records" tone="auto" />
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
      <CuratedHealthLine items={programs} />
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
      <SectionTrustLine label="External evidence registry view" tone="auto" />
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
      <CuratedHealthLine items={pipeline} />
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
    <Section title="Broad Opportunity Feed">
      <DataSource label="Auto-ranked from CivicGraph grants and your org project signals" />
      <SectionTrustLine label="Heuristic triage feed" tone="heuristic" />
      <p className="text-xs text-gray-400 mb-4 -mt-2">
        Upcoming opportunities that are not already in your pipeline. Ranked using your current projects, funding tags,
        and org type, but still intended as a triage queue rather than a final recommendation set.
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
    <Section title="Strategic Network">
      <CuratedSource label="Curated" />
      <CuratedHealthLine items={contacts} />
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
              {(c.linkedin_url || c.email) && (
                <div className="mt-2 flex items-center gap-2">
                  {c.linkedin_url && (
                    <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#0077B5] text-white rounded-sm hover:bg-[#005885] transition-colors">
                      LinkedIn
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-gray-300 text-gray-600 rounded-sm hover:bg-gray-50 transition-colors">
                      Email
                    </a>
                  )}
                  {c.person_id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" title="Linked to person record" />
                  )}
                </div>
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
