import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const money = (n: number | null) =>
  n == null ? '—' : `$${(n / 1_000_000).toFixed(1)}M`;

const pct = (n: number | null, d: number) =>
  n == null || d === 0 ? '—' : `${Math.round((n / d) * 100)}%`;

interface Partner {
  recipient_name: string;
  recipient_abn: string | null;
  gs_entity_id: string | null;
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
}

interface OutcomeSub {
  org_name: string;
  program_name: string;
  reporting_period: string;
  outcomes: Array<{ metric: string; value: number; unit: string; description?: string }>;
  narrative: string | null;
  status: string;
}

interface Person {
  person_name: string;
  role_type: string;
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

async function getData() {
  const db = getServiceSupabase();

  const [
    { data: partners },
    { data: alma },
    { data: outcomes },
    { data: people },
    { data: portfolio },
    { data: foundation },
  ] = await Promise.all([
    db.rpc('exec_sql', {
      query: `SELECT jf.recipient_name, jf.recipient_abn, jf.gs_entity_id,
                     jf.amount_dollars, jf.program_name, jf.state,
                     ge.entity_type, ge.is_community_controlled, ge.remoteness,
                     ge.seifa_irsd_decile, ge.postcode
              FROM justice_funding jf
              LEFT JOIN gs_entities ge ON ge.id = jf.gs_entity_id
              WHERE jf.program_name ILIKE '%paul ramsay%' OR jf.program_name ILIKE '%PRF%'
              ORDER BY jf.amount_dollars DESC`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT ai.name, ai.type, ai.evidence_level, ai.portfolio_score,
                     ai.target_cohort, ai.geography, ge.canonical_name as org
              FROM alma_interventions ai
              JOIN gs_entities ge ON ge.id::text = ai.gs_entity_id::text
              WHERE ge.id IN (SELECT gs_entity_id FROM justice_funding
                             WHERE program_name = 'PRF Justice Reinvestment Portfolio'
                             AND gs_entity_id IS NOT NULL)
              ORDER BY ai.portfolio_score DESC NULLS LAST`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT os.org_name, os.program_name, os.reporting_period,
                     os.outcomes, os.narrative, os.status
              FROM outcome_submissions os
              WHERE os.gs_entity_id IN (
                SELECT ge.gs_id FROM gs_entities ge
                WHERE ge.id IN (SELECT gs_entity_id FROM justice_funding
                               WHERE program_name = 'PRF Justice Reinvestment Portfolio')
              )
              ORDER BY os.created_at DESC`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT pr.person_name, pr.role_type
              FROM person_roles pr
              JOIN gs_entities ge ON ge.id = pr.entity_id
              WHERE ge.abn IN ('32623132472', '30106576087')
              ORDER BY pr.role_type, pr.person_name`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT * FROM v_prf_portfolio_outcomes`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT name, total_giving_annual, thematic_focus::text as thematic_focus,
                     geographic_focus
              FROM foundations WHERE acnc_abn = '32623132472'`,
    }),
  ]);

  return {
    partners: (partners || []) as Partner[],
    alma: (alma || []) as AlmaIntervention[],
    outcomes: (outcomes || []) as OutcomeSub[],
    people: (people || []) as Person[],
    portfolio: (portfolio || []) as PortfolioStatus[],
    foundation: (foundation || [])[0] as {
      name: string;
      total_giving_annual: number;
      thematic_focus: string;
      geographic_focus: string;
    } | undefined,
  };
}

export default async function PRFIntelligencePage() {
  const { partners, alma, outcomes, people, portfolio, foundation } =
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
              {money(foundation?.total_giving_annual ?? null)}/yr
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-black text-bauhaus-red">
              {money(totalFunding)}
            </div>
            <div className="text-xs uppercase tracking-widest text-bauhaus-muted">
              Total mapped funding
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-8 py-8 space-y-12">
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
                          {partner?.gs_entity_id ? (
                            <Link
                              href={`/entities/${partner.gs_entity_id}`}
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
                    <td className="py-2 text-bauhaus-muted">{a.org}</td>
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
                      <h3 className="font-black">{o.org_name}</h3>
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
                    <span className="font-medium">{g.recipient_name}</span>
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

        {/* Governance */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-6">
            Board & Governance
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {people.map((p, i) => (
              <div key={i} className="border border-gray-200 p-3">
                <div className="font-medium">{p.person_name}</div>
                <div className="text-xs text-bauhaus-muted uppercase tracking-wider">
                  {p.role_type}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Opportunities to Dive Deeper */}
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
              title="$320M/yr foundation with deep justice reinvestment commitment"
              description="PRF is Australia's largest private foundation. The JR portfolio is their signature program. A comprehensive outcomes dashboard is the exact product they'd pay for."
              action="Send portfolio dashboard as outreach hook — 'here's what we know about your portfolio's impact, here's what's missing'"
              urgency="high"
            />
          </div>
        </section>
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
      {/* Progress bar */}
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
