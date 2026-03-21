import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { safe, esc } from '@/lib/sql';
import { money } from '@/lib/format';
import { PrintButton } from './print-button';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ gsId: string }> }) {
  const { gsId } = await params;
  return { title: `Print — ${decodeURIComponent(gsId)}` };
}

export default async function PrintEntityPage({ params }: { params: Promise<{ gsId: string }> }) {
  const { gsId: rawId } = await params;
  const gsId = decodeURIComponent(rawId);
  const supabase = getServiceSupabase();

  const entity = await safe(supabase.rpc('exec_sql', {
    query: `SELECT id, gs_id, canonical_name, abn, entity_type, sector, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name
       FROM gs_entities WHERE gs_id = '${esc(gsId)}'`,
  }));

  if (!entity?.[0]) notFound();
  const e = entity[0] as { id: string; gs_id: string; canonical_name: string; abn: string | null; entity_type: string; sector: string; state: string; postcode: string; remoteness: string; seifa_irsd_decile: number; is_community_controlled: boolean; lga_name: string };

  const [power, funding, contracts, donations, board, revDoor] = await Promise.all([
    safe(supabase.rpc('exec_sql', {
      query: `SELECT power_score, system_count, total_dollar_flow, procurement_dollars, justice_dollars, donation_dollars, distinct_govt_buyers, distinct_parties_funded
         FROM mv_entity_power_index WHERE id = '${e.id}' LIMIT 1`,
    })),
    e.abn ? safe(supabase.rpc('exec_sql', {
      query: `SELECT program_name, SUM(amount_dollars)::bigint as total, COUNT(*)::int as records
         FROM justice_funding WHERE recipient_abn = '${e.abn}'
         GROUP BY program_name ORDER BY total DESC LIMIT 10`,
    })) : null,
    e.abn ? safe(supabase.rpc('exec_sql', {
      query: `SELECT title, contract_value::bigint as value, buyer_name, contract_start
         FROM austender_contracts WHERE supplier_abn = '${e.abn}'
         ORDER BY contract_value DESC LIMIT 10`,
    })) : null,
    e.abn ? safe(supabase.rpc('exec_sql', {
      query: `SELECT donation_to, SUM(amount)::bigint as total, COUNT(*)::int as count
         FROM political_donations WHERE donor_abn = '${e.abn}'
         GROUP BY donation_to ORDER BY total DESC LIMIT 10`,
    })) : null,
    e.abn ? safe(supabase.rpc('exec_sql', {
      query: `SELECT person_name, role_type, appointment_date, cessation_date
         FROM person_roles WHERE company_abn = '${e.abn}' AND cessation_date IS NULL
         ORDER BY appointment_date DESC NULLS LAST LIMIT 20`,
    })) : null,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT influence_vectors, revolving_door_score, lobbies, donates, contracts, receives_funding
         FROM mv_revolving_door WHERE id = '${e.id}' LIMIT 1`,
    })),
  ]);

  type PowerRow = { power_score: number; system_count: number; total_dollar_flow: number; procurement_dollars: number; justice_dollars: number; donation_dollars: number; distinct_govt_buyers: number; distinct_parties_funded: number };
  type RevDoorRow = { influence_vectors: number; revolving_door_score: number; lobbies: boolean; donates: boolean; contracts: boolean; receives_funding: boolean };

  const p = (power as PowerRow[] | null)?.[0] ?? null;
  const rd = (revDoor as RevDoorRow[] | null)?.[0] ?? null;

  return (
    <main className="max-w-4xl mx-auto p-8 bg-white text-black print:p-4">
      {/* Print button (hidden in print) */}
      <div className="print:hidden mb-6 flex items-center gap-4">
        <PrintButton />
        <Link href={`/entity/${encodeURIComponent(gsId)}`} className="text-sm text-gray-400 underline">Back to profile</Link>
      </div>

      {/* Header */}
      <div className="border-b-4 border-black pb-4 mb-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">CivicGraph Entity Report</p>
          <p className="text-xs text-gray-400">Generated {new Date().toISOString().split('T')[0]}</p>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-wider mt-2">{e.canonical_name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          {e.abn && <span className="font-mono">ABN {e.abn}</span>}
          <span className="font-bold uppercase text-xs">{e.entity_type}</span>
          {e.sector && <span>{e.sector}</span>}
          {e.state && <span>{e.state}</span>}
          {e.lga_name && <span>{e.lga_name}</span>}
          {e.is_community_controlled && <span className="text-red-600 font-bold text-xs uppercase">Community Controlled</span>}
        </div>
      </div>

      {/* Power Summary */}
      {p && (
        <section className="mb-6">
          <h2 className="text-lg font-black uppercase tracking-widest border-b-2 border-black pb-1 mb-3">Power Index</h2>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-3xl font-black">{Number(p.power_score).toFixed(1)}</p>
              <p className="text-[10px] font-bold uppercase text-gray-400">Score</p>
            </div>
            <div>
              <p className="text-3xl font-black">{p.system_count}/7</p>
              <p className="text-[10px] font-bold uppercase text-gray-400">Systems</p>
            </div>
            <div>
              <p className="text-2xl font-black text-green-700">{money(Number(p.total_dollar_flow))}</p>
              <p className="text-[10px] font-bold uppercase text-gray-400">Total Flow</p>
            </div>
            <div>
              <p className="text-2xl font-black">{p.distinct_govt_buyers}</p>
              <p className="text-[10px] font-bold uppercase text-gray-400">Govt Buyers</p>
            </div>
          </div>
        </section>
      )}

      {/* Revolving Door */}
      {rd && Number(rd.influence_vectors) >= 2 && (
        <section className="mb-6 border-2 border-amber-400 bg-amber-50 p-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-amber-800">
            Revolving Door Alert — {rd.influence_vectors} Influence Vectors
          </h2>
          <p className="text-xs text-amber-700 mt-1">
            Score: {Number(rd.revolving_door_score).toFixed(1)}.
            Active in: {[rd.lobbies && 'lobbying', rd.donates && 'donations', rd.contracts && 'contracts', rd.receives_funding && 'funding'].filter(Boolean).join(', ')}.
          </p>
        </section>
      )}

      {/* Board */}
      {board && (board as Array<{ person_name: string; role_type: string; appointment_date: string }>).length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-black uppercase tracking-widest border-b-2 border-black pb-1 mb-3">Board & Governance</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-1 text-xs font-bold uppercase text-gray-400">Name</th>
                <th className="text-left py-1 text-xs font-bold uppercase text-gray-400">Role</th>
                <th className="text-left py-1 text-xs font-bold uppercase text-gray-400">Appointed</th>
              </tr>
            </thead>
            <tbody>
              {(board as Array<{ person_name: string; role_type: string; appointment_date: string }>).map((b, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1 text-xs font-medium">{b.person_name}</td>
                  <td className="py-1 text-xs text-gray-500">{b.role_type}</td>
                  <td className="py-1 text-xs text-gray-400">{b.appointment_date?.split('T')[0] ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Funding */}
      {funding && (funding as Array<{ program_name: string; total: number; records: number }>).length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-black uppercase tracking-widest border-b-2 border-black pb-1 mb-3">Government Funding</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-1 text-xs font-bold uppercase text-gray-400">Program</th>
                <th className="text-right py-1 text-xs font-bold uppercase text-gray-400">Total</th>
                <th className="text-right py-1 text-xs font-bold uppercase text-gray-400">Grants</th>
              </tr>
            </thead>
            <tbody>
              {(funding as Array<{ program_name: string; total: number; records: number }>).map((f, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1 text-xs">{f.program_name}</td>
                  <td className="py-1 text-xs text-right font-mono font-bold text-green-700">{money(Number(f.total))}</td>
                  <td className="py-1 text-xs text-right text-gray-400">{f.records}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Contracts */}
      {contracts && (contracts as Array<{ title: string; value: number; buyer_name: string; contract_start: string }>).length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-black uppercase tracking-widest border-b-2 border-black pb-1 mb-3">Federal Contracts</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-1 text-xs font-bold uppercase text-gray-400 w-2/5">Title</th>
                <th className="text-right py-1 text-xs font-bold uppercase text-gray-400 w-1/5">Value</th>
                <th className="text-left py-1 text-xs font-bold uppercase text-gray-400 pl-4 w-2/5">Buyer</th>
              </tr>
            </thead>
            <tbody>
              {(contracts as Array<{ title: string; value: number; buyer_name: string; contract_start: string }>).map((c, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1 text-xs truncate max-w-xs">{c.title}</td>
                  <td className="py-1 text-xs text-right font-mono font-bold text-green-700">{money(Number(c.value))}</td>
                  <td className="py-1 text-xs text-gray-500 pl-4">{c.buyer_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Donations */}
      {donations && (donations as Array<{ donation_to: string; total: number; count: number }>).length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-black uppercase tracking-widest border-b-2 border-black pb-1 mb-3">Political Donations</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-1 text-xs font-bold uppercase text-gray-400">Recipient</th>
                <th className="text-right py-1 text-xs font-bold uppercase text-gray-400">Total</th>
                <th className="text-right py-1 text-xs font-bold uppercase text-gray-400">Count</th>
              </tr>
            </thead>
            <tbody>
              {(donations as Array<{ donation_to: string; total: number; count: number }>).map((d, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1 text-xs">{d.donation_to}</td>
                  <td className="py-1 text-xs text-right font-mono font-bold">{money(Number(d.total))}</td>
                  <td className="py-1 text-xs text-right text-gray-400">{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t-2 border-black pt-4 mt-8">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider">
          CivicGraph Entity Report — {e.canonical_name} — {new Date().toISOString().split('T')[0]}
        </p>
        <p className="text-[10px] text-gray-400 mt-1">
          Sources: gs_entities, mv_entity_power_index, justice_funding, austender_contracts, political_donations, person_roles, mv_revolving_door
        </p>
      </footer>
    </main>
  );
}
