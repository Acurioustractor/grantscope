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

  return { stats, orgs: orgs ?? [], exactName };
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

  const { stats, orgs, exactName } = result;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <Link href={`/reports/youth-justice/${state}`} className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; {stateName} Youth Justice
      </Link>

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

      {/* Orgs table */}
      <section>
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-4 border-b-4 border-bauhaus-black pb-2">
          Delivery Partners ({orgs.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-bauhaus-black">
                <th className="text-left py-2 font-black uppercase tracking-wider text-xs">Organisation</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Grants</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Total</th>
                <th className="text-right py-2 font-black uppercase tracking-wider text-xs">Period</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o, i) => (
                <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-2">
                    <OrgLink name={o.recipient_name} gsId={o.gs_id} abn={o.recipient_abn} />
                    {o.is_community_controlled && (
                      <span className="ml-1.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded uppercase">ACCO</span>
                    )}
                  </td>
                  <td className="py-2 text-right text-gray-600">{fmt(o.grants)}</td>
                  <td className="py-2 text-right font-bold">{o.total ? money(o.total) : '—'}</td>
                  <td className="py-2 text-right text-gray-500 text-xs">
                    {o.min_year && o.max_year ? `${o.min_year}–${o.max_year}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
