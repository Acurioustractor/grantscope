import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceSupabase } from '@/lib/supabase';
import { safe, esc } from '@/lib/sql';
import { money } from '@/lib/format';
import { TH, TH_R, TD, TD_R, THEAD, ROW } from '@/lib/table-styles';

export const revalidate = 3600;

// One disambiguated identity under a (possibly shared) name — from mv_person_identity_influence.
interface Identity {
  identity_key: string;
  person_name: string;
  board_count: number;
  acco_boards: number;
  entity_types: string[];
  total_procurement: number;
  total_contracts: number;
  total_justice: number;
  total_donations: number;
  influence_score: number;
  financial_system_count: number;
  is_nominee_block: boolean;
}

// An entity belonging to one identity — from mv_person_identity_network. Used to
// make the picker cards distinguishable (same name, different orgs).
interface IdentityEntity {
  identity_key: string;
  entity_name: string;
  entity_type: string;
  is_community_controlled: boolean;
  justice_dollars: number;
  procurement_dollars: number;
  donation_dollars: number;
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

const entMoney = (e: IdentityEntity) =>
  Number(e.justice_dollars || 0) + Number(e.procurement_dollars || 0) + Number(e.donation_dollars || 0);

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decoded = decodeURIComponent(name).replace(/-/g, ' ');
  return {
    title: `${decoded} — CivicGraph Person Profile`,
  };
}

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { name } = await params;
  const { id } = await searchParams;
  const decoded = decodeURIComponent(name);
  const normalised = decoded.replace(/-/g, ' ').toUpperCase();
  const displayName = decoded.replace(/-/g, ' ');

  const supabase = getServiceSupabase();

  // All disambiguated identities sharing this name. Real identities first, nominee
  // blocks last, then by cross-system breadth + influence.
  const identities = (await safe(supabase.rpc('exec_sql', {
    query: `SELECT identity_key, person_name, board_count, acco_boards, entity_types,
              total_procurement, total_contracts, total_justice, total_donations,
              influence_score, financial_system_count, is_nominee_block
       FROM mv_person_identity_influence
       WHERE person_name_normalised = '${esc(normalised)}'
       ORDER BY is_nominee_block ASC, financial_system_count DESC NULLS LAST, influence_score DESC NULLS LAST`,
  }))) as Identity[] | null;

  const ids = identities ?? [];
  if (ids.length === 0) notFound();

  // Selected identity: explicit ?id, else the only one, else null → show picker.
  const selected = id ? ids.find((i) => i.identity_key === id) : ids.length === 1 ? ids[0] : null;

  // ---- PICKER: a shared name resolving to multiple identities ----
  if (!selected) {
    const entities = (await safe(supabase.rpc('exec_sql', {
      query: `SELECT identity_key, entity_name, entity_type, is_community_controlled,
                justice_dollars, procurement_dollars, donation_dollars
         FROM mv_person_identity_network
         WHERE person_name_normalised = '${esc(normalised)}'`,
    }))) as IdentityEntity[] | null;

    const entByIdentity = new Map<string, IdentityEntity[]>();
    for (const e of entities ?? []) {
      if (!entByIdentity.has(e.identity_key)) entByIdentity.set(e.identity_key, []);
      entByIdentity.get(e.identity_key)!.push(e);
    }

    return (
      <main className="min-h-screen bg-gray-50 text-bauhaus-black">
        <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
          <div className="mx-auto max-w-5xl px-4 py-8">
            <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red">CivicGraph Person Disambiguation</p>
            <h1 className="text-3xl font-black uppercase tracking-wider mt-2">{displayName}</h1>
            <p className="text-gray-300 text-sm mt-2 max-w-2xl">
              This name maps to <strong>{ids.length}</strong> distinct identities in the record. Board memberships
              were split by a co-director graph; trustee/nominee blocks (one firm&apos;s officers listed across many
              administered charities) are flagged and kept out of individual rankings. Pick an identity to view.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-8 space-y-4">
          {ids.map((iden) => {
            const ents = (entByIdentity.get(iden.identity_key) ?? []).sort((a, b) => entMoney(b) - entMoney(a));
            const topOrgs = ents.slice(0, 3);
            const totalMoney =
              Number(iden.total_procurement || 0) + Number(iden.total_justice || 0) + Number(iden.total_donations || 0);
            return (
              <Link
                key={iden.identity_key}
                href={`/person/${encodeURIComponent(name)}?id=${encodeURIComponent(iden.identity_key)}`}
                className={`block border-2 p-5 transition-colors ${
                  iden.is_nominee_block
                    ? 'border-gray-300 bg-gray-100 hover:bg-gray-200'
                    : 'border-bauhaus-black bg-white hover:bg-blue-50/40'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black uppercase tracking-wide">{displayName}</span>
                      {iden.is_nominee_block ? (
                        <span className="text-[9px] px-1.5 py-0.5 bg-gray-400 text-white rounded-sm font-bold uppercase tracking-wider">
                          Trustee / nominee block
                        </span>
                      ) : iden.financial_system_count > 0 ? (
                        <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-sm font-bold">
                          {iden.financial_system_count} fin. sys
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {topOrgs.map((o) => o.entity_name).join(' · ') || 'No linked organisations'}
                      {ents.length > 3 && <span className="text-gray-400"> +{ents.length - 3} more</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-black text-lg leading-none">{iden.board_count}</p>
                    <p className="text-[9px] uppercase tracking-widest text-gray-400 mt-0.5">boards</p>
                    {totalMoney > 0 && (
                      <p className="font-mono text-xs text-green-700 mt-1">{money(totalMoney)}</p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    );
  }

  // ---- PROFILE: a single chosen identity ----
  const positions = (await safe(supabase.rpc('exec_sql', {
    query: `SELECT pen.person_name_display, pen.entity_name, pen.entity_abn, pen.entity_type,
              pen.is_community_controlled, pen.role_type, pen.source,
              pen.appointment_date, pen.board_count,
              pen.procurement_dollars, pen.contract_count,
              pen.justice_dollars, pen.justice_count,
              pen.donation_dollars, pen.donation_count,
              pen.influence_score, ge.gs_id
       FROM mv_person_identity_network pin
       JOIN mv_person_entity_network pen
         ON pen.person_name_normalised = pin.person_name_normalised AND pen.entity_id = pin.entity_id
       JOIN gs_entities ge ON ge.id = pin.entity_id
       WHERE pin.identity_key = '${esc(selected.identity_key)}'
       ORDER BY pen.influence_score DESC NULLS LAST`,
  }))) as Position[] | null;

  const positionList = (positions as Position[] | null) ?? [];
  const totalFinancial =
    Number(selected.total_procurement) + Number(selected.total_justice) + Number(selected.total_donations);
  const communityControlled = positionList.filter((p) => p.is_community_controlled);
  const entityTypes = new Set((selected.entity_types ?? []).filter(Boolean));
  const dataSources = [...new Set(positionList.map((p) => p.source).filter(Boolean))];

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
          {/* Disambiguation breadcrumb — only when the name has siblings */}
          {ids.length > 1 && (
            <Link
              href={`/person/${encodeURIComponent(name)}`}
              className="inline-block mb-2 text-[11px] text-gray-400 hover:text-white underline"
            >
              &larr; 1 of {ids.length} identities under &ldquo;{displayName}&rdquo; — view all
            </Link>
          )}
          <h1 className="text-3xl font-black uppercase tracking-wider">{selected.person_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-300">
            <span className="text-[10px] px-2 py-0.5 bg-white/10 border border-white/20 rounded-sm font-bold uppercase tracking-wider">
              Person
            </span>
            {selected.board_count > 0 && (
              <span className="text-gray-400">{selected.board_count} board seats</span>
            )}
            {selected.financial_system_count > 0 && (
              <span className="text-gray-400">{selected.financial_system_count} financial systems</span>
            )}
          </div>
          {/* Entity type badges */}
          {entityTypes.size > 0 && (
            <div className="mt-3 flex gap-1.5">
              {[...entityTypes].map((t) => (
                <span key={t} className="text-[9px] px-2 py-1 bg-white/5 border border-white/20 text-gray-400 font-bold uppercase tracking-wider rounded-sm">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Nominee-block notice */}
        {selected.is_nominee_block && (
          <section className="bg-gray-100 border-2 border-gray-400 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">&#9888;</span>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-700">
                  Trustee / Nominee Block — Not an Individual
                </h2>
                <p className="text-xs text-gray-600 mt-1">
                  This cluster of {selected.board_count} board seats is a trustee firm&apos;s officers listed as
                  responsible persons across many administered charities, not a single person. It is excluded from
                  individual influence rankings.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border-2 border-bauhaus-black shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Influence Score</p>
            <p className="text-3xl font-black mt-1">{Number(selected.influence_score).toFixed(0)}</p>
          </div>
          <div className="bg-white border border-gray-200 shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Board Seats</p>
            <p className="text-2xl font-black mt-1">{selected.board_count}</p>
            {selected.acco_boards > 0 && <p className="text-xs text-gray-400 mt-1">{selected.acco_boards} community-controlled</p>}
          </div>
          {Number(selected.total_procurement) > 0 && (
            <div className="bg-white border border-gray-200 shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Procurement $</p>
              <p className="text-2xl font-black mt-1 text-green-700">{money(Number(selected.total_procurement))}</p>
              <p className="text-xs text-gray-400 mt-1">{Number(selected.total_contracts)} contracts</p>
            </div>
          )}
          {Number(selected.total_justice) > 0 && (
            <div className="bg-white border border-gray-200 shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Justice $</p>
              <p className="text-2xl font-black mt-1 text-green-700">{money(Number(selected.total_justice))}</p>
            </div>
          )}
          {Number(selected.total_donations) > 0 && (
            <div className="bg-white border border-gray-200 shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Political Donations</p>
              <p className="text-2xl font-black mt-1 text-bauhaus-red">{money(Number(selected.total_donations))}</p>
            </div>
          )}
        </div>

        {/* Interlock alert */}
        {!selected.is_nominee_block && selected.board_count > 3 && (
          <section className="bg-amber-50 border-2 border-amber-400 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">&#9888;</span>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-amber-800">
                  Board Interlock — {selected.board_count} Seats
                </h2>
                <p className="text-xs text-amber-700 mt-1">
                  This person holds positions across {selected.board_count} organisations
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
                {positionList.length} positions
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
            {dataSources.map((s: string) => (
              <span key={s} className="text-[10px] px-2 py-1 bg-green-100 text-green-700 border border-green-200 font-bold uppercase tracking-wider rounded-sm">
                {s}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Sources: mv_person_identity_influence, mv_person_identity_network, mv_person_entity_network, person_roles, gs_entities.
          </p>
          <p className="mt-2 text-xs flex gap-4">
            <Link href="/person" className="text-gray-400 underline hover:text-bauhaus-red">All People</Link>
            <Link href="/entity" className="text-gray-400 underline hover:text-bauhaus-red">Entity Search</Link>
            <Link href="/entity/top" className="text-gray-400 underline hover:text-bauhaus-red">Power Index</Link>
            <Link href="/graph" className="text-gray-400 underline hover:text-bauhaus-red">Graph</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
