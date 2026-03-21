import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceSupabase } from '@/lib/supabase';

export const revalidate = 3600;

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

function money(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

interface Influence {
  person_name: string;
  person_name_normalised: string;
  board_count: number;
  acco_boards: number;
  entity_types: string[];
  data_sources: string[];
  total_procurement: number;
  total_contracts: number;
  total_justice: number;
  total_donations: number;
  max_influence_score: number;
  financial_system_count: number;
}

interface Position {
  person_name_display: string;
  entity_name: string;
  entity_abn: string | null;
  entity_type: string;
  is_community_controlled: boolean;
  role_type: string;
  source: string;
  appointment_date: string | null;
  board_count: number;
  procurement_dollars: number;
  contract_count: number;
  justice_dollars: number;
  justice_count: number;
  donation_dollars: number;
  donation_count: number;
  influence_score: number;
  gs_id: string;
}

const TH = 'text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400';
const TH_R = 'text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400';
const TD = 'py-3 pr-4';
const TD_R = 'py-3 pr-4 text-right';
const THEAD = 'border-b-2 border-gray-200 bg-gray-50/50';
const ROW = (i: number) =>
  `border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`;

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decoded = decodeURIComponent(name).replace(/-/g, ' ');
  return {
    title: `${decoded} — CivicGraph Person Profile`,
  };
}

export default async function PersonPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const normalised = decoded.replace(/-/g, ' ').toUpperCase();

  const supabase = getServiceSupabase();

  const [influence, positions] = await Promise.all([
    safe(supabase.rpc('exec_sql', {
      query: `SELECT * FROM mv_person_influence WHERE person_name_normalised = '${normalised.replace(/'/g, "''")}'`,
    })) as Promise<Influence[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT pen.person_name_display, pen.entity_name, pen.entity_abn, pen.entity_type,
                pen.is_community_controlled, pen.role_type, pen.source,
                pen.appointment_date, pen.board_count,
                pen.procurement_dollars, pen.contract_count,
                pen.justice_dollars, pen.justice_count,
                pen.donation_dollars, pen.donation_count,
                pen.influence_score,
                ge.gs_id
         FROM mv_person_entity_network pen
         JOIN gs_entities ge ON ge.id = pen.entity_id
         WHERE pen.person_name_normalised = '${normalised.replace(/'/g, "''")}'
         ORDER BY pen.influence_score DESC NULLS LAST`,
    })) as Promise<Position[] | null>,
  ]);

  const inf = (influence as Influence[] | null)?.[0];
  if (!inf) notFound();

  const totalFinancial = Number(inf.total_procurement) + Number(inf.total_justice) + Number(inf.total_donations);
  const positionList = (positions as Position[] | null) ?? [];
  const communityControlled = positionList.filter(p => p.is_community_controlled);
  const entityTypes = new Set(positionList.map(p => p.entity_type));

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red">CivicGraph Person Profile</p>
            <div className="flex gap-2">
              <Link href="/entity" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">
                Entity Search
              </Link>
              <Link href="/entity/top" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">
                Power Index
              </Link>
            </div>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-wider">{inf.person_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-300">
            <span className="text-[10px] px-2 py-0.5 bg-white/10 border border-white/20 rounded-sm font-bold uppercase tracking-wider">
              Person
            </span>
            {inf.board_count > 0 && (
              <span className="text-gray-400">{inf.board_count} board seats</span>
            )}
            {inf.financial_system_count > 0 && (
              <span className="text-gray-400">{inf.financial_system_count} financial systems</span>
            )}
          </div>
          {/* Entity type badges */}
          {entityTypes.size > 0 && (
            <div className="mt-3 flex gap-1.5">
              {[...entityTypes].map(t => (
                <span key={t} className="text-[9px] px-2 py-1 bg-white/5 border border-white/20 text-gray-400 font-bold uppercase tracking-wider rounded-sm">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border-2 border-bauhaus-black shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Influence Score</p>
            <p className="text-3xl font-black mt-1">{Number(inf.max_influence_score).toFixed(0)}</p>
          </div>
          <div className="bg-white border border-gray-200 shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Board Seats</p>
            <p className="text-2xl font-black mt-1">{inf.board_count}</p>
            {inf.acco_boards > 0 && <p className="text-xs text-gray-400 mt-1">{inf.acco_boards} unique orgs</p>}
          </div>
          {Number(inf.total_procurement) > 0 && (
            <div className="bg-white border border-gray-200 shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Procurement $</p>
              <p className="text-2xl font-black mt-1 text-green-700">{money(Number(inf.total_procurement))}</p>
              <p className="text-xs text-gray-400 mt-1">{Number(inf.total_contracts)} contracts</p>
            </div>
          )}
          {Number(inf.total_justice) > 0 && (
            <div className="bg-white border border-gray-200 shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Justice $</p>
              <p className="text-2xl font-black mt-1 text-green-700">{money(Number(inf.total_justice))}</p>
            </div>
          )}
          {Number(inf.total_donations) > 0 && (
            <div className="bg-white border border-gray-200 shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Political Donations</p>
              <p className="text-2xl font-black mt-1 text-bauhaus-red">{money(Number(inf.total_donations))}</p>
            </div>
          )}
        </div>

        {/* Interlock alert */}
        {inf.board_count > 3 && (
          <section className="bg-amber-50 border-2 border-amber-400 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">&#9888;</span>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-amber-800">
                  Board Interlock — {inf.board_count} Seats
                </h2>
                <p className="text-xs text-amber-700 mt-1">
                  This person holds positions across {inf.acco_boards} organisations
                  {communityControlled.length > 0 && ` including ${communityControlled.length} community-controlled`}.
                  {totalFinancial > 0 && ` Combined financial footprint: ${money(totalFinancial)}.`}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Positions table */}
        {positionList.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">
              Board Positions
              <span className="text-xs font-normal text-gray-400 ml-2 normal-case tracking-normal">
                {positionList.length} positions across {inf.acco_boards} organisations
              </span>
            </h2>
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className={THEAD}>
                    <th className={`${TH} pl-4`}>Organisation</th>
                    <th className={TH}>Type</th>
                    <th className={TH}>Role</th>
                    <th className={TH_R}>Procurement $</th>
                    <th className={TH_R}>Justice $</th>
                    <th className={TH_R}>Donations $</th>
                    <th className={TH_R}>Influence</th>
                  </tr>
                </thead>
                <tbody>
                  {positionList.map((p, i) => (
                    <tr key={`${p.entity_name}-${i}`} className={ROW(i)}>
                      <td className={`${TD} pl-4`}>
                        <Link href={`/entity/${encodeURIComponent(p.gs_id)}`} className="font-medium text-bauhaus-blue hover:underline">
                          {p.entity_name}
                        </Link>
                        {p.is_community_controlled && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 bg-bauhaus-red/10 text-bauhaus-red rounded-sm font-bold">CC</span>
                        )}
                      </td>
                      <td className={TD}>
                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-sm border border-gray-200">
                          {p.entity_type}
                        </span>
                      </td>
                      <td className={`${TD} text-xs text-gray-500`}>{p.role_type}</td>
                      <td className={`${TD_R} font-mono`}>
                        {Number(p.procurement_dollars) > 0 ? money(Number(p.procurement_dollars)) : '—'}
                      </td>
                      <td className={`${TD_R} font-mono`}>
                        {Number(p.justice_dollars) > 0 ? money(Number(p.justice_dollars)) : '—'}
                      </td>
                      <td className={`${TD_R} font-mono`}>
                        {Number(p.donation_dollars) > 0 ? (
                          <span className="text-bauhaus-red">{money(Number(p.donation_dollars))}</span>
                        ) : '—'}
                      </td>
                      <td className={`${TD_R} font-mono font-bold`}>
                        {Number(p.influence_score).toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Data Sources */}
        <footer className="border-t-2 border-bauhaus-black pt-6 pb-8">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Data Sources</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {(inf.data_sources || []).map((s: string) => (
              <span key={s} className="text-[10px] px-2 py-1 bg-green-100 text-green-700 border border-green-200 font-bold uppercase tracking-wider rounded-sm">
                {s}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Sources: mv_person_influence, mv_person_entity_network, person_roles, gs_entities.
          </p>
          <p className="mt-2 text-xs flex gap-4">
            <Link href="/entity" className="text-gray-400 underline hover:text-bauhaus-red">Entity Search</Link>
            <Link href="/entity/top" className="text-gray-400 underline hover:text-bauhaus-red">Power Index</Link>
            <Link href="/map" className="text-gray-400 underline hover:text-bauhaus-red">Funding Map</Link>
            <Link href="/graph" className="text-gray-400 underline hover:text-bauhaus-red">Graph</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
