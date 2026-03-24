import Link from 'next/link';
import { notFound } from 'next/navigation';
import { money, fmt } from '@/lib/services/report-service';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';

export const revalidate = 3600;

type OrgRow = {
  recipient_name: string;
  recipient_abn: string | null;
  gs_id: string | null;
  is_community_controlled: boolean | null;
  total: number | null;
  grants: number;
  min_year: string | null;
  max_year: string | null;
};

type LeaderRow = {
  abn: string;
  canonical_name: string;
  person_name: string;
  role: string | null;
  source: string | null;
};

type ProgramStats = {
  program_name: string;
  total: number | null;
  grants: number;
  orgs: number;
  min_year: string | null;
  max_year: string | null;
};

async function getProgramDetail(state: string, programSlug: string) {
  const supabase = getServiceSupabase();
  const programName = decodeURIComponent(programSlug).replace(/-/g, ' ');

  // Find exact program name (case-insensitive fuzzy match on slug)
  const programLookup = await safe(supabase.rpc('exec_sql', {
    query: `SELECT DISTINCT program_name FROM justice_funding
       WHERE state = '${state}'
         AND LOWER(REPLACE(program_name, ' ', '-')) = LOWER('${programSlug.replace(/'/g, "''")}')
       LIMIT 1`,
  })) as Array<{ program_name: string }> | null;

  const exactName = programLookup?.[0]?.program_name;
  if (!exactName) return null;

  // Get program stats
  const statsResult = await safe(supabase.rpc('exec_sql', {
    query: `SELECT program_name,
              SUM(amount_dollars)::bigint as total,
              COUNT(*)::int as grants,
              COUNT(DISTINCT recipient_name)::int as orgs,
              MIN(financial_year) as min_year,
              MAX(financial_year) as max_year
       FROM justice_funding
       WHERE state = '${state}'
         AND program_name = '${exactName.replace(/'/g, "''")}'
         AND recipient_name NOT LIKE 'Department of%'
         AND recipient_name NOT LIKE 'Total%'
         AND recipient_name NOT LIKE 'Youth Justice -%'
       GROUP BY program_name`,
  })) as ProgramStats[] | null;

  const stats = statsResult?.[0] ?? null;

  // Get all orgs under this program
  const orgs = await safe(supabase.rpc('exec_sql', {
    query: `SELECT jf.recipient_name, jf.recipient_abn,
              e.gs_id, e.is_community_controlled,
              SUM(jf.amount_dollars)::bigint as total,
              COUNT(*)::int as grants,
              MIN(jf.financial_year) as min_year,
              MAX(jf.financial_year) as max_year
       FROM justice_funding jf
       LEFT JOIN gs_entities e ON e.abn = jf.recipient_abn AND jf.recipient_abn IS NOT NULL
       WHERE jf.state = '${state}'
         AND jf.program_name = '${exactName.replace(/'/g, "''")}'
         AND jf.recipient_name NOT LIKE 'Department of%'
         AND jf.recipient_name NOT LIKE 'Total%'
         AND jf.recipient_name NOT LIKE 'Youth Justice -%'
       GROUP BY jf.recipient_name, jf.recipient_abn, e.gs_id, e.is_community_controlled
       ORDER BY total DESC NULLS LAST, jf.recipient_name
       LIMIT 500`,
  })) as OrgRow[] | null;

  // Get leadership for orgs with ABNs
  const abns = (orgs ?? []).map(o => o.recipient_abn).filter(Boolean);
  let leadership: LeaderRow[] = [];
  if (abns.length > 0) {
    const abnList = abns.map(a => `'${a}'`).join(',');
    leadership = (await safe(supabase.rpc('exec_sql', {
      query: `SELECT e.abn, e.canonical_name,
                pr.person_name, pr.role_type as role, pr.source
         FROM gs_entities e
         JOIN person_roles pr ON pr.entity_id = e.id
         WHERE e.abn IN (${abnList})
         ORDER BY e.canonical_name, pr.role_type, pr.person_name
         LIMIT 500`,
    })) ?? []) as LeaderRow[];
  }

  // Group leadership by ABN
  const leadersByAbn: Record<string, LeaderRow[]> = {};
  for (const l of leadership) {
    if (!leadersByAbn[l.abn]) leadersByAbn[l.abn] = [];
    leadersByAbn[l.abn].push(l);
  }

  return { stats, orgs: orgs ?? [], exactName, leadersByAbn };
}

function OrgLink({ name, gsId, abn }: { name: string; gsId: string | null; abn: string | null }) {
  if (gsId) {
    return <Link href={`/entity/${gsId}`} className="font-medium text-bauhaus-blue hover:underline">{name}</Link>;
  }
  if (abn) {
    return <Link href={`/entity/AU-ABN-${abn}`} className="font-medium text-bauhaus-blue hover:underline">{name}</Link>;
  }
  return <Link href={`/search?q=${encodeURIComponent(name)}`} className="font-medium text-bauhaus-blue hover:underline">{name}</Link>;
}

const STATE_NAMES: Record<string, string> = {
  QLD: 'Queensland', NSW: 'New South Wales', VIC: 'Victoria', WA: 'Western Australia',
  SA: 'South Australia', NT: 'Northern Territory', TAS: 'Tasmania', ACT: 'Australian Capital Territory',
};

export default async function ProgramDetailPage({ params }: { params: Promise<{ state: string; programSlug: string }> }) {
  const { state, programSlug } = await params;
  const stateCode = state.toUpperCase();
  const stateName = STATE_NAMES[stateCode];
  if (!stateName) notFound();

  const result = await getProgramDetail(stateCode, programSlug);
  if (!result) notFound();

  const { stats, orgs, exactName, leadersByAbn } = result;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-black text-bauhaus-muted uppercase tracking-widest">
        <Link href={`/reports/youth-justice/${state}`} className="hover:text-bauhaus-black">{stateName} Youth Justice</Link>
        <span>/</span>
        <Link href={`/reports/youth-justice/${state}/tracker`} className="hover:text-bauhaus-black">Tracker</Link>
      </div>

      <div className="mt-4 mb-1 flex items-center gap-3">
        <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">Program</span>
        <span className="text-[10px] font-bold text-white bg-bauhaus-black px-2 py-0.5 rounded-sm uppercase tracking-wider">{stateCode}</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black mb-6">
        {exactName}
      </h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
            <div className="text-2xl font-black text-red-600">{stats.total ? money(stats.total) : '—'}</div>
            <div className="text-xs text-gray-500 mt-1">Total Funding</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
            <div className="text-2xl font-black text-blue-600">{fmt(stats.orgs)}</div>
            <div className="text-xs text-gray-500 mt-1">Organisations</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
            <div className="text-2xl font-black text-gray-800">{fmt(stats.grants)}</div>
            <div className="text-xs text-gray-500 mt-1">Grants</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
            <div className="text-sm font-black text-gray-800">
              {stats.min_year && stats.max_year ? `${stats.min_year} – ${stats.max_year}` : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Period</div>
          </div>
        </div>
      )}

      {/* Delivery Partners */}
      <section>
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
          Delivery Partners ({orgs.length})
        </h2>
        <div className="space-y-4">
          {orgs.map((o, i) => {
            const leaders = o.recipient_abn ? (leadersByAbn[o.recipient_abn] ?? []) : [];
            return (
              <div key={i} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <OrgLink name={o.recipient_name} gsId={o.gs_id} abn={o.recipient_abn} />
                    {o.is_community_controlled && (
                      <span className="ml-1.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded uppercase">ACCO</span>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="font-black text-bauhaus-black">{o.total ? money(o.total) : '—'}</div>
                    <div className="text-xs text-gray-500">{fmt(o.grants)} grants &middot; {o.min_year && o.max_year ? `${o.min_year}–${o.max_year}` : '—'}</div>
                  </div>
                </div>
                {leaders.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {leaders.slice(0, 10).map((l, j) => (
                      <span key={j} className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {l.person_name}{l.role ? ` (${l.role})` : ''}
                      </span>
                    ))}
                    {leaders.length > 10 && <span className="text-[11px] text-gray-400">+{leaders.length - 10} more</span>}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic mt-1">No leadership data available</div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
