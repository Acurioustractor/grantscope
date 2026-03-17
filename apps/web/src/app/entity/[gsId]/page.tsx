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

interface Entity {
  id: string;
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string;
  sector: string | null;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  is_community_controlled: boolean;
  lga_name: string | null;
}

async function getEntity(gsId: string): Promise<Entity | null> {
  const supabase = getServiceSupabase();
  const rows = await safe(supabase.rpc('exec_sql', {
    query: `SELECT id, gs_id, canonical_name, abn, entity_type, sector, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name
       FROM gs_entities WHERE gs_id = '${gsId}'`,
  })) as Entity[] | null;
  return rows?.[0] ?? null;
}

interface FundingRow { program_name: string; total: number; records: number; from_fy: string; to_fy: string }
interface ContractRow { title: string; value: number; buyer_name: string; contract_start: string; contract_end: string | null }
interface DonationRow { donation_to: string; total: number; count: number }
interface RelRow { partner_name: string; relationship_type: string; amount: number | null; year: string | null; dataset: string | null; partner_gs_id: string }
interface AlmaRow { name: string; type: string; evidence_level: string; target_cohort: string; description: string }
interface AcncRow { charity_size: string; purposes: string[]; beneficiaries: string[]; state: string; postcode: string }

export async function generateMetadata({ params }: { params: Promise<{ gsId: string }> }) {
  const { gsId } = await params;
  const entity = await getEntity(decodeURIComponent(gsId));
  if (!entity) return { title: 'Not Found' };
  return { title: `${entity.canonical_name} — CivicGraph` };
}

const TH = 'text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400';
const TH_R = 'text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400';
const TD = 'py-3 pr-4';
const TD_R = 'py-3 pr-4 text-right';
const THEAD = 'border-b-2 border-gray-200 bg-gray-50/50';
const ROW = (i: number) =>
  `border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`;

export default async function EntityPage({ params }: { params: Promise<{ gsId: string }> }) {
  const { gsId } = await params;
  const entity = await getEntity(decodeURIComponent(gsId));
  if (!entity) notFound();

  const supabase = getServiceSupabase();

  const [funding, contracts, donations, relationships, alma, acnc] = await Promise.all([
    entity.abn ? safe(supabase.rpc('exec_sql', {
      query: `SELECT program_name, SUM(amount_dollars)::bigint as total, COUNT(*)::int as records,
                MIN(financial_year) as from_fy, MAX(financial_year) as to_fy
         FROM justice_funding WHERE recipient_abn = '${entity.abn}'
         GROUP BY program_name ORDER BY total DESC`,
    })) as Promise<FundingRow[] | null> : null,
    entity.abn ? safe(supabase.rpc('exec_sql', {
      query: `SELECT title, contract_value::bigint as value, buyer_name, contract_start, contract_end
         FROM austender_contracts WHERE supplier_abn = '${entity.abn}'
         ORDER BY contract_value DESC LIMIT 20`,
    })) as Promise<ContractRow[] | null> : null,
    entity.abn ? safe(supabase.rpc('exec_sql', {
      query: `SELECT donation_to, SUM(amount)::bigint as total, COUNT(*)::int as count
         FROM political_donations WHERE donor_abn = '${entity.abn}'
         GROUP BY donation_to ORDER BY total DESC LIMIT 20`,
    })) as Promise<DonationRow[] | null> : null,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT
                CASE WHEN r.source_entity_id = '${entity.id}' THEN t.canonical_name ELSE s.canonical_name END as partner_name,
                CASE WHEN r.source_entity_id = '${entity.id}' THEN t.gs_id ELSE s.gs_id END as partner_gs_id,
                r.relationship_type, r.amount::bigint, r.year, r.dataset
         FROM gs_relationships r
         JOIN gs_entities s ON s.id = r.source_entity_id
         JOIN gs_entities t ON t.id = r.target_entity_id
         WHERE r.source_entity_id = '${entity.id}' OR r.target_entity_id = '${entity.id}'
         ORDER BY r.amount DESC NULLS LAST LIMIT 30`,
    })) as Promise<RelRow[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT ai.name, ai.type, ai.evidence_level, ai.target_cohort, ai.description
         FROM alma_interventions ai
         JOIN gs_entities ge ON ge.id = ai.gs_entity_id
         WHERE ge.id = '${entity.id}' ORDER BY ai.name`,
    })) as Promise<AlmaRow[] | null>,
    entity.abn ? safe(supabase.rpc('exec_sql', {
      query: `SELECT charity_size, purposes, beneficiaries, state, postcode
         FROM acnc_charities WHERE abn = '${entity.abn}' LIMIT 1`,
    })) as Promise<AcncRow[] | null> : null,
  ]);

  const totalFunding = funding?.reduce((s, r) => s + Number(r.total), 0) ?? 0;
  const totalContracts = contracts?.reduce((s, r) => s + Number(r.value), 0) ?? 0;
  const acncData = acnc?.[0] ?? null;

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red mb-1">
            CivicGraph Entity Profile
          </p>
          <h1 className="text-3xl font-black uppercase tracking-wider">
            {entity.canonical_name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-300">
            {entity.abn && (
              <span className="font-mono">ABN {entity.abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')}</span>
            )}
            <span className="text-[10px] px-2 py-0.5 bg-white/10 border border-white/20 rounded-sm font-bold uppercase tracking-wider">
              {entity.entity_type}
            </span>
            {entity.sector && (
              <span className="text-gray-400">{entity.sector}</span>
            )}
            {entity.is_community_controlled && (
              <span className="text-[10px] px-2 py-0.5 bg-bauhaus-red/20 border border-bauhaus-red/30 rounded-sm font-bold uppercase tracking-wider text-bauhaus-red">
                Community Controlled
              </span>
            )}
          </div>
          {(entity.lga_name || entity.state) && (
            <div className="mt-2 flex items-center gap-3 text-sm text-gray-400">
              {entity.lga_name && <span>{entity.lga_name}</span>}
              {entity.state && <span>{entity.state}</span>}
              {entity.postcode && <span className="font-mono">{entity.postcode}</span>}
              {entity.remoteness && <span>{entity.remoteness}</span>}
              {entity.seifa_irsd_decile && <span>SEIFA Decile {entity.seifa_irsd_decile}</span>}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {totalFunding > 0 && (
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Justice Funding</p>
              <p className="text-2xl font-black mt-1 text-green-700">{money(totalFunding)}</p>
              <p className="text-xs text-gray-400 mt-1">{funding?.length} programs</p>
            </div>
          )}
          {totalContracts > 0 && (
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Federal Contracts</p>
              <p className="text-2xl font-black mt-1 text-green-700">{money(totalContracts)}</p>
              <p className="text-xs text-gray-400 mt-1">{contracts?.length} contracts</p>
            </div>
          )}
          {relationships && relationships.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Relationships</p>
              <p className="text-2xl font-black mt-1">{relationships.length}</p>
              <p className="text-xs text-gray-400 mt-1">Connected entities</p>
            </div>
          )}
          {acncData && (
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">ACNC Registered</p>
              <p className="text-2xl font-black mt-1">{acncData.charity_size || '—'}</p>
              <p className="text-xs text-gray-400 mt-1">Charity size</p>
            </div>
          )}
        </div>

        {/* ACNC Details */}
        {acncData && (acncData.purposes?.length > 0 || acncData.beneficiaries?.length > 0) && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">Charity Details</h2>
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-5">
              {acncData.purposes?.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Purposes</p>
                  <div className="flex flex-wrap gap-2">
                    {acncData.purposes.map((p, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-sm border border-gray-200">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {acncData.beneficiaries?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Beneficiaries</p>
                  <div className="flex flex-wrap gap-2">
                    {acncData.beneficiaries.map((b, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-sm border border-blue-200">{b}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Funding */}
        {funding && funding.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">Government Funding</h2>
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className={THEAD}>
                    <th className={`${TH} pl-4`}>Program</th>
                    <th className={TH_R}>Total</th>
                    <th className={TH_R}>Grants</th>
                    <th className={TH}>Period</th>
                  </tr>
                </thead>
                <tbody>
                  {funding.map((f, i) => (
                    <tr key={i} className={ROW(i)}>
                      <td className={`${TD} pl-4 font-medium max-w-xs truncate`}>{f.program_name}</td>
                      <td className={`${TD_R} font-mono font-bold text-green-700`}>{money(Number(f.total))}</td>
                      <td className={`${TD_R} text-gray-500`}>{f.records}</td>
                      <td className={`${TD} text-gray-400 text-xs`}>{f.from_fy} – {f.to_fy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Contracts */}
        {contracts && contracts.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">Federal Contracts</h2>
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
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
              </table>
            </div>
          </section>
        )}

        {/* Political Donations */}
        {donations && donations.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">Political Donations</h2>
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className={THEAD}>
                    <th className={`${TH} pl-4`}>Recipient</th>
                    <th className={TH_R}>Total</th>
                    <th className={TH_R}>Donations</th>
                  </tr>
                </thead>
                <tbody>
                  {donations.map((d, i) => (
                    <tr key={i} className={ROW(i)}>
                      <td className={`${TD} pl-4 font-medium`}>{d.donation_to}</td>
                      <td className={`${TD_R} font-mono font-bold`}>{money(Number(d.total))}</td>
                      <td className={`${TD_R} text-gray-500`}>{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Relationships */}
        {relationships && relationships.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">Relationships</h2>
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className={THEAD}>
                    <th className={`${TH} pl-4`}>Entity</th>
                    <th className={TH}>Type</th>
                    <th className={TH_R}>Amount</th>
                    <th className={TH}>Year</th>
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
                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-sm border border-gray-200">
                          {r.relationship_type}
                        </span>
                      </td>
                      <td className={`${TD_R} font-mono`}>{r.amount ? money(Number(r.amount)) : '—'}</td>
                      <td className={`${TD} text-gray-400 text-xs`}>{r.year ?? '—'}</td>
                      <td className={`${TD} text-gray-400 text-xs`}>{r.dataset ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ALMA Interventions */}
        {alma && alma.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">ALMA Interventions</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {alma.map((a, i) => (
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
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-gray-200 pt-6 pb-8">
          <p className="text-xs text-gray-400">
            Sources: gs_entities, justice_funding, austender_contracts, political_donations, gs_relationships, acnc_charities, alma_interventions.
          </p>
          <p className="mt-2 text-xs">
            <Link href="/home" className="text-gray-400 underline hover:text-bauhaus-red">Home</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
