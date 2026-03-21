import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceSupabase } from '@/lib/supabase';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { money, fmt } from '@/lib/format';

export const revalidate = 1800;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safe<T = any>(p: PromiseLike<{ data: T; error: any }>): Promise<T | null> {
  try {
    const result = await p;
    if (result.error) return null;
    return result.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getOrgProfileBySlug(slug);
  if (!profile) return { title: 'Not Found' };
  return { title: `${profile.name} Command Center — CivicGraph` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface HealthRow {
  temperature: number;
  lcaa_stage: string;
  days_since_contact: number;
  temperature_trend: string;
  total_touchpoints: number;
  ghl_contact_id: string;
}
interface ContactRow {
  full_name: string;
  email: string;
  company_name: string;
  tags: string[];
  ghl_id: string;
}
interface PartnerRow {
  partner_name: string;
  partner_gs_id: string;
  relationship_type: string;
  amount: number | null;
  dataset: string | null;
}
interface TagCount { tag: string; count: number }
interface PlatformStats {
  entity_count: number;
  intervention_count: number;
  justice_funding_total: number;
  evidence_count: number;
  relationship_count: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Component styles
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CARD = 'bg-white border border-gray-200 rounded-sm shadow-sm p-4';
const CARD_HOVER = `${CARD} hover:shadow-md transition-shadow`;
const TH = 'text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400';
const TD = 'py-3 pr-4';
const THEAD = 'border-b-2 border-gray-200 bg-gray-50/50';
const ROW = (i: number) =>
  `border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`;

const LCAA_COLORS: Record<string, string> = {
  listen: 'bg-blue-100 text-blue-800 border-blue-300',
  connect: 'bg-green-100 text-green-800 border-green-300',
  amplify: 'bg-purple-100 text-purple-800 border-purple-300',
  act: 'bg-red-100 text-red-800 border-red-300',
};

const TEMP_COLOR = (t: number) =>
  t >= 70 ? 'text-green-600' : t >= 40 ? 'text-amber-600' : 'text-red-600';

const TEMP_BAR = (t: number) =>
  t >= 70 ? 'bg-green-500' : t >= 40 ? 'bg-amber-500' : 'bg-red-500';

export default async function IntelligencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const db = getServiceSupabase();
  const entityId = profile.linked_gs_entity_id;

  // Fetch all data in parallel
  const [
    healthData,
    contactData,
    relationships,
    campaignTags,
    platformStats,
    goingCold,
  ] = await Promise.all([
    // Relationship health for contacts linked to this entity
    entityId ? safe(db.rpc('exec_sql', {
      query: `SELECT rh.temperature, rh.lcaa_stage, rh.days_since_contact, rh.temperature_trend,
                     rh.total_touchpoints, rh.ghl_contact_id
              FROM relationship_health rh
              JOIN ghl_contacts gc ON gc.ghl_id = rh.ghl_contact_id
              JOIN contact_entity_links cel ON cel.contact_id = gc.id
              WHERE cel.entity_id = '${entityId}'
              ORDER BY rh.temperature DESC`,
    })) as Promise<HealthRow[] | null> : null,

    // All contacts linked to this entity
    entityId ? safe(db.rpc('exec_sql', {
      query: `SELECT gc.full_name, gc.email, gc.company_name, gc.tags, gc.ghl_id
              FROM ghl_contacts gc
              JOIN contact_entity_links cel ON cel.contact_id = gc.id
              WHERE cel.entity_id = '${entityId}'
              ORDER BY gc.full_name`,
    })) as Promise<ContactRow[] | null> : null,

    // Relationships (partners, funders, etc.)
    entityId ? safe(db.rpc('exec_sql', {
      query: `SELECT
                CASE WHEN r.source_entity_id = '${entityId}' THEN t.canonical_name ELSE s.canonical_name END as partner_name,
                CASE WHEN r.source_entity_id = '${entityId}' THEN t.gs_id ELSE s.gs_id END as partner_gs_id,
                r.relationship_type, r.amount::bigint, r.dataset
              FROM gs_relationships r
              JOIN gs_entities s ON s.id = r.source_entity_id
              JOIN gs_entities t ON t.id = r.target_entity_id
              WHERE r.source_entity_id = '${entityId}' OR r.target_entity_id = '${entityId}'
              ORDER BY r.amount DESC NULLS LAST LIMIT 50`,
    })) as Promise<PartnerRow[] | null> : null,

    // Campaign tag breakdown
    entityId ? safe(db.rpc('exec_sql', {
      query: `SELECT unnest(gc.tags) as tag, COUNT(*)::int as count
              FROM ghl_contacts gc
              JOIN contact_entity_links cel ON cel.contact_id = gc.id
              WHERE cel.entity_id = '${entityId}'
              GROUP BY tag ORDER BY count DESC LIMIT 30`,
    })) as Promise<TagCount[] | null> : null,

    // Cross-system platform stats
    safe(db.rpc('exec_sql', {
      query: `SELECT
                (SELECT COUNT(*)::int FROM gs_entities) as entity_count,
                (SELECT COUNT(*)::int FROM alma_interventions) as intervention_count,
                (SELECT COALESCE(SUM(amount_dollars), 0)::bigint FROM justice_funding) as justice_funding_total,
                (SELECT COUNT(*)::int FROM alma_evidence) as evidence_count,
                (SELECT COUNT(*)::int FROM gs_relationships) as relationship_count`,
    })) as Promise<PlatformStats[] | null>,

    // Contacts going cold (days_since_contact > 60, temperature < 50)
    entityId ? safe(db.rpc('exec_sql', {
      query: `SELECT gc.full_name, gc.email, gc.company_name, rh.temperature, rh.days_since_contact,
                     rh.lcaa_stage, rh.temperature_trend, rh.suggested_actions
              FROM relationship_health rh
              JOIN ghl_contacts gc ON gc.ghl_id = rh.ghl_contact_id
              JOIN contact_entity_links cel ON cel.contact_id = gc.id
              WHERE cel.entity_id = '${entityId}'
                AND (rh.days_since_contact > 60 OR rh.temperature < 30)
              ORDER BY rh.temperature ASC
              LIMIT 30`,
    })) as Promise<Array<ContactRow & HealthRow & { suggested_actions: string[] }> | null> : null,
  ]);

  // Compute aggregates
  const totalContacts = contactData?.length ?? 0;
  const healthRows = healthData ?? [];
  const avgTemp = healthRows.length > 0
    ? Math.round(healthRows.reduce((s, r) => s + r.temperature, 0) / healthRows.length)
    : 0;
  const coldCount = healthRows.filter(r => r.days_since_contact > 60).length;

  // LCAA stage breakdown
  const lcaaBreakdown = healthRows.reduce((acc, r) => {
    if (r.lcaa_stage) acc[r.lcaa_stage] = (acc[r.lcaa_stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Temperature distribution
  const tempBuckets = { hot: 0, warm: 0, cold: 0, frozen: 0 };
  for (const r of healthRows) {
    if (r.temperature >= 70) tempBuckets.hot++;
    else if (r.temperature >= 40) tempBuckets.warm++;
    else if (r.temperature >= 15) tempBuckets.cold++;
    else tempBuckets.frozen++;
  }

  // Campaign-specific tags
  const campaignTagList = campaignTags ?? [];
  const containedTags = campaignTagList.filter(t =>
    t.tag.toLowerCase().includes('contained') || t.tag.toLowerCase().includes('container')
  );

  const stats = platformStats?.[0] ?? null;

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red mb-1">
                Command Center
              </p>
              <h1 className="text-3xl font-black uppercase tracking-wider">
                {profile.name}
              </h1>
              <p className="mt-2 text-gray-400">
                Relationship intelligence, campaign tracking, and warm path discovery.
              </p>
            </div>
            <Link href={`/org/${slug}`} className="text-sm text-gray-400 hover:text-white underline">
              &larr; Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* ━━━ Key Metrics ━━━ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className={CARD}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Contacts</p>
            <p className="text-2xl font-black mt-1">{fmt(totalContacts)}</p>
            <p className="text-xs text-gray-400 mt-1">Linked to {profile.name}</p>
          </div>
          <div className={CARD}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Avg Temperature</p>
            <p className={`text-2xl font-black mt-1 ${TEMP_COLOR(avgTemp)}`}>{avgTemp}°</p>
            <p className="text-xs text-gray-400 mt-1">{healthRows.length} with health data</p>
          </div>
          <div className={CARD}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Going Cold</p>
            <p className="text-2xl font-black mt-1 text-red-600">{coldCount}</p>
            <p className="text-xs text-gray-400 mt-1">&gt;60 days no contact</p>
          </div>
          <div className={CARD}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Partners</p>
            <p className="text-2xl font-black mt-1">{relationships?.length ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1">Entity relationships</p>
          </div>
          <div className={CARD}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">LCAA Stages</p>
            <p className="text-2xl font-black mt-1">{Object.keys(lcaaBreakdown).length}</p>
            <p className="text-xs text-gray-400 mt-1">{healthRows.length} scored</p>
          </div>
        </div>

        {/* ━━━ LCAA Pipeline ━━━ */}
        {Object.keys(lcaaBreakdown).length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">
              LCAA Pipeline
            </h2>
            <div className="grid grid-cols-4 gap-4">
              {(['listen', 'connect', 'amplify', 'act'] as const).map(stage => (
                <div key={stage} className={CARD_HOVER}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider border rounded-sm ${LCAA_COLORS[stage] ?? ''}`}>
                      {stage}
                    </span>
                    <span className="text-2xl font-black">{lcaaBreakdown[stage] ?? 0}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${stage === 'listen' ? 'bg-blue-500' : stage === 'connect' ? 'bg-green-500' : stage === 'amplify' ? 'bg-purple-500' : 'bg-red-500'}`}
                      style={{ width: `${healthRows.length > 0 ? ((lcaaBreakdown[stage] ?? 0) / healthRows.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ━━━ Temperature Distribution ━━━ */}
        {healthRows.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">
              Temperature Distribution
            </h2>
            <div className={`${CARD} p-6`}>
              <div className="flex items-end gap-[1px] h-40 overflow-hidden">
                {healthRows.sort((a, b) => b.temperature - a.temperature).map((r, i) => (
                  <div
                    key={i}
                    className={`flex-shrink-0 rounded-t ${TEMP_BAR(r.temperature)}`}
                    style={{
                      width: `${Math.max(100 / healthRows.length, 2)}%`,
                      height: `${Math.max(r.temperature, 8)}%`,
                    }}
                    title={`${r.temperature}° — ${r.lcaa_stage ?? 'unscored'}`}
                  />
                ))}
              </div>
              <div className="flex gap-6 mt-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-green-500 rounded-sm" /> Hot ({tempBuckets.hot})
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-amber-500 rounded-sm" /> Warm ({tempBuckets.warm})
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-red-500 rounded-sm" /> Cold ({tempBuckets.cold})
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-red-900 rounded-sm" /> Frozen ({tempBuckets.frozen})
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ━━━ Going Cold — Need Re-engagement ━━━ */}
        {goingCold && goingCold.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">
              Needs Re-engagement
              <span className="ml-2 text-sm font-normal text-red-500">
                ({goingCold.length} contacts going cold)
              </span>
            </h2>
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className={THEAD}>
                    <th className={`${TH} pl-4`}>Name</th>
                    <th className={TH}>Organisation</th>
                    <th className={`${TH} text-right`}>Temp</th>
                    <th className={`${TH} text-right`}>Days Silent</th>
                    <th className={TH}>Stage</th>
                    <th className={TH}>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {goingCold.map((c, i) => (
                    <tr key={i} className={ROW(i)}>
                      <td className={`${TD} pl-4 font-medium`}>{c.full_name}</td>
                      <td className={`${TD} text-gray-500 max-w-xs truncate`}>{c.company_name || '—'}</td>
                      <td className={`${TD} text-right font-mono font-bold ${TEMP_COLOR(c.temperature)}`}>
                        {c.temperature}°
                      </td>
                      <td className={`${TD} text-right font-mono ${c.days_since_contact > 90 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                        {c.days_since_contact}d
                      </td>
                      <td className={TD}>
                        {c.lcaa_stage && (
                          <span className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider border rounded-sm ${LCAA_COLORS[c.lcaa_stage] ?? 'bg-gray-100 text-gray-600'}`}>
                            {c.lcaa_stage}
                          </span>
                        )}
                      </td>
                      <td className={`${TD} text-xs text-gray-400`}>
                        {c.temperature_trend === 'declining' ? '↓ declining' :
                         c.temperature_trend === 'rising' ? '↑ rising' :
                         c.temperature_trend === 'stable' ? '→ stable' : c.temperature_trend ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ━━━ Campaign Tracker ━━━ */}
        {containedTags.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">
              CONTAINED Campaign
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {containedTags.map((t, i) => (
                <div key={i} className={CARD_HOVER}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 truncate">{t.tag}</p>
                  <p className="text-2xl font-black mt-1">{t.count}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ━━━ Network Tags ━━━ */}
        {campaignTagList.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">
              Contact Network Tags
            </h2>
            <div className={`${CARD} p-6`}>
              <div className="flex flex-wrap gap-2">
                {campaignTagList.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-sm border border-gray-200 hover:bg-gray-200 transition-colors"
                  >
                    <span className="font-medium">{t.tag}</span>
                    <span className="font-mono text-gray-400">({t.count})</span>
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ━━━ Relationships ━━━ */}
        {relationships && relationships.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">
              Entity Relationships
            </h2>
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className={THEAD}>
                    <th className={`${TH} pl-4`}>Entity</th>
                    <th className={TH}>Type</th>
                    <th className={`${TH} text-right`}>Amount</th>
                    <th className={TH}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {relationships.map((r, i) => (
                    <tr key={i} className={ROW(i)}>
                      <td className={`${TD} pl-4 font-medium`}>
                        <Link href={`/entity/${encodeURIComponent(r.partner_gs_id)}`} className="text-bauhaus-blue hover:underline">
                          {r.partner_name}
                        </Link>
                      </td>
                      <td className={TD}>
                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-sm border border-gray-200 font-bold uppercase tracking-wider">
                          {r.relationship_type}
                        </span>
                      </td>
                      <td className={`${TD} text-right font-mono`}>{r.amount ? money(Number(r.amount)) : '—'}</td>
                      <td className={`${TD} text-gray-400 text-xs`}>{r.dataset ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ━━━ Cross-System Stats ━━━ */}
        {stats && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">
              CivicGraph Platform
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className={CARD}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Entities</p>
                <p className="text-2xl font-black mt-1">{fmt(stats.entity_count)}</p>
                <p className="text-xs text-gray-400 mt-1">Organisations tracked</p>
              </div>
              <div className={CARD}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">ALMA Interventions</p>
                <p className="text-2xl font-black mt-1">{fmt(stats.intervention_count)}</p>
                <p className="text-xs text-gray-400 mt-1">Evidence-based programs</p>
              </div>
              <div className={CARD}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Justice Funding</p>
                <p className="text-2xl font-black mt-1 text-green-700">{money(Number(stats.justice_funding_total))}</p>
                <p className="text-xs text-gray-400 mt-1">Tracked flows</p>
              </div>
              <div className={CARD}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Evidence Sources</p>
                <p className="text-2xl font-black mt-1">{fmt(stats.evidence_count)}</p>
                <p className="text-xs text-gray-400 mt-1">Research records</p>
              </div>
              <div className={CARD}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Relationships</p>
                <p className="text-2xl font-black mt-1">{fmt(stats.relationship_count)}</p>
                <p className="text-xs text-gray-400 mt-1">Funding edges</p>
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-gray-200 pt-6 pb-8 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Sources: ghl_contacts, relationship_health, contact_entity_links, gs_relationships, gs_entities, alma_interventions, justice_funding.
          </p>
          <Link href={`/org/${slug}`} className="text-xs text-gray-400 underline hover:text-bauhaus-red">
            &larr; Back to Dashboard
          </Link>
        </footer>
      </div>
    </main>
  );
}
