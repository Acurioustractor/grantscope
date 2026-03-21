import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceSupabase } from '@/lib/supabase';
import { EntityNetworkGraph } from './network-graph';
import { safe, esc } from '@/lib/sql';
import { money } from '@/lib/format';
import { TH, TH_R, TD, TD_R, THEAD, ROW } from '@/lib/table-styles';

export const revalidate = 3600;

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
       FROM gs_entities WHERE gs_id = '${esc(gsId)}'`,
  })) as Entity[] | null;
  return rows?.[0] ?? null;
}

interface FundingRow { program_name: string; total: number; records: number; from_fy: string; to_fy: string }
interface ContractRow { title: string; value: number; buyer_name: string; contract_start: string; contract_end: string | null }
interface DonationRow { donation_to: string; total: number; count: number }
interface RelRow { partner_name: string; relationship_type: string; amount: number | null; year: string | null; dataset: string | null; partner_gs_id: string }
interface AlmaRow { name: string; type: string; evidence_level: string; target_cohort: string; description: string }
interface AcncRow { charity_size: string; purposes: string[]; beneficiaries: string[]; state: string; postcode: string }
interface PowerRow {
  power_score: number; system_count: number;
  in_procurement: number; in_justice_funding: number; in_political_donations: number;
  in_charity_registry: number; in_foundation: number; in_alma_evidence: number; in_ato_transparency: number;
  procurement_dollars: number; justice_dollars: number; donation_dollars: number;
  total_dollar_flow: number; distinct_govt_buyers: number; distinct_parties_funded: number;
}
interface AtoRow { total_income: number; taxable_income: number; tax_payable: number; effective_tax_rate: number; report_year: string; industry: string }
interface BoardRow { person_name: string; role_type: string; appointment_date: string | null; cessation_date: string | null; source: string }
interface RevolvingDoorRow {
  lobbies: boolean; donates: boolean; contracts: boolean; receives_funding: boolean;
  influence_vectors: number; revolving_door_score: number;
  total_donated: number; donation_count: number; parties_funded: number;
  total_contracts: number; contract_count: number; distinct_buyers: number;
  total_funded: number; funding_count: number;
}

export async function generateMetadata({ params }: { params: Promise<{ gsId: string }> }) {
  const { gsId } = await params;
  const entity = await getEntity(decodeURIComponent(gsId));
  if (!entity) return { title: 'Not Found' };
  return { title: `${entity.canonical_name} — CivicGraph` };
}

const SYSTEMS = [
  { key: 'in_procurement', label: 'Procurement', color: 'bg-blue-500' },
  { key: 'in_justice_funding', label: 'Justice', color: 'bg-amber-500' },
  { key: 'in_political_donations', label: 'Donations', color: 'bg-red-500' },
  { key: 'in_charity_registry', label: 'Charity', color: 'bg-green-500' },
  { key: 'in_foundation', label: 'Foundation', color: 'bg-purple-500' },
  { key: 'in_alma_evidence', label: 'Evidence', color: 'bg-teal-500' },
  { key: 'in_ato_transparency', label: 'ATO', color: 'bg-gray-500' },
] as const;

export default async function EntityPage({ params }: { params: Promise<{ gsId: string }> }) {
  const { gsId } = await params;
  const entity = await getEntity(decodeURIComponent(gsId));
  if (!entity) notFound();

  const supabase = getServiceSupabase();

  const [funding, contracts, donations, relationships, alma, acnc, power, ato, board, revolvingDoor] = await Promise.all([
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
    // Power index
    safe(supabase.rpc('exec_sql', {
      query: `SELECT power_score, system_count,
                in_procurement, in_justice_funding, in_political_donations,
                in_charity_registry, in_foundation, in_alma_evidence, in_ato_transparency,
                procurement_dollars, justice_dollars, donation_dollars,
                total_dollar_flow, distinct_govt_buyers, distinct_parties_funded
         FROM mv_entity_power_index WHERE id = '${entity.id}' LIMIT 1`,
    })) as Promise<PowerRow[] | null>,
    // ATO Tax Transparency
    entity.abn ? safe(supabase.rpc('exec_sql', {
      query: `SELECT total_income::bigint, taxable_income::bigint, tax_payable::bigint,
                effective_tax_rate, report_year, industry
         FROM ato_tax_transparency WHERE abn = '${entity.abn}'
         ORDER BY report_year DESC LIMIT 5`,
    })) as Promise<AtoRow[] | null> : null,
    // Board members
    entity.abn ? safe(supabase.rpc('exec_sql', {
      query: `SELECT person_name, role_type, appointment_date, cessation_date, source
         FROM person_roles WHERE company_abn = '${entity.abn}'
         ORDER BY cessation_date IS NULL DESC, appointment_date DESC NULLS LAST LIMIT 30`,
    })) as Promise<BoardRow[] | null> : null,
    // Revolving door
    safe(supabase.rpc('exec_sql', {
      query: `SELECT lobbies, donates, contracts, receives_funding,
                influence_vectors, revolving_door_score,
                total_donated, donation_count, parties_funded,
                total_contracts, contract_count, distinct_buyers,
                total_funded, funding_count
         FROM mv_revolving_door WHERE id = '${entity.id}' LIMIT 1`,
    })) as Promise<RevolvingDoorRow[] | null>,
  ]);

  const totalFunding = funding?.reduce((s, r) => s + Number(r.total), 0) ?? 0;
  const totalContracts = contracts?.reduce((s, r) => s + Number(r.value), 0) ?? 0;
  const totalDonations = donations?.reduce((s, r) => s + Number(r.total), 0) ?? 0;
  const acncData = acnc?.[0] ?? null;
  const powerData = (power as PowerRow[] | null)?.[0] ?? null;
  const totalDollarFlow = powerData ? Number(powerData.total_dollar_flow) : 0;
  const activeBoardMembers = board?.filter(b => !b.cessation_date) ?? [];
  const formerBoardMembers = board?.filter(b => b.cessation_date) ?? [];
  const rdData = (revolvingDoor as RevolvingDoorRow[] | null)?.[0] ?? null;
  const hasRevolvingDoor = rdData && Number(rdData.influence_vectors) >= 2;

  // Count sections with data for the "data coverage" display
  const sections = [
    { name: 'Procurement', has: totalContracts > 0 },
    { name: 'Justice Funding', has: totalFunding > 0 },
    { name: 'Political Donations', has: totalDonations > 0 },
    { name: 'ACNC', has: !!acncData },
    { name: 'ALMA Evidence', has: (alma?.length ?? 0) > 0 },
    { name: 'ATO', has: (ato?.length ?? 0) > 0 },
    { name: 'Board/Governance', has: (board?.length ?? 0) > 0 },
  ];

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red">
              CivicGraph Entity Profile
            </p>
            <Link href={`/entity/${encodeURIComponent(entity.gs_id)}/investigate`} className="text-xs font-bold text-bauhaus-red hover:text-white transition-colors border border-bauhaus-red px-3 py-1">
              Investigate
            </Link>
            <Link href={`/entity/${encodeURIComponent(entity.gs_id)}/print`} className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">
              Print / PDF
            </Link>
            <Link href="/entity" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">
              Search
            </Link>
            <Link href="/entity/top" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">
              Power Index
            </Link>
            <Link href="/map" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-600 px-3 py-1">
              Map
            </Link>
          </div>
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

          {/* Cross-System Presence */}
          {powerData && (
            <div className="mt-4 flex items-center gap-1.5">
              {SYSTEMS.map(s => {
                const active = Number(powerData[s.key as keyof PowerRow]) > 0;
                return (
                  <span
                    key={s.key}
                    className={`text-[9px] px-2 py-1 font-bold uppercase tracking-wider rounded-sm transition-all ${
                      active
                        ? `${s.color} text-white`
                        : 'bg-white/5 text-gray-600 border border-gray-700'
                    }`}
                  >
                    {s.label}
                  </span>
                );
              })}
              <span className="ml-2 text-xs text-gray-500">
                {powerData.system_count} of 7 systems
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {powerData && (
            <div className="bg-white border-2 border-bauhaus-black shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Power Score</p>
              <p className="text-3xl font-black mt-1">{Number(powerData.power_score).toFixed(1)}</p>
              <p className="text-xs text-gray-400 mt-1">{powerData.system_count} systems</p>
            </div>
          )}
          {totalDollarFlow > 0 && (
            <div className="bg-white border border-gray-200 shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Dollar Flow</p>
              <p className="text-2xl font-black mt-1 text-green-700">{money(totalDollarFlow)}</p>
              <p className="text-xs text-gray-400 mt-1">All sources</p>
            </div>
          )}
          {totalContracts > 0 && (
            <div className="bg-white border border-gray-200 shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Contracts</p>
              <p className="text-2xl font-black mt-1 text-green-700">{money(totalContracts)}</p>
              <p className="text-xs text-gray-400 mt-1">{contracts?.length} contracts</p>
            </div>
          )}
          {totalFunding > 0 && (
            <div className="bg-white border border-gray-200 shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Justice Funding</p>
              <p className="text-2xl font-black mt-1 text-green-700">{money(totalFunding)}</p>
              <p className="text-xs text-gray-400 mt-1">{funding?.length} programs</p>
            </div>
          )}
          {totalDonations > 0 && (
            <div className="bg-white border border-gray-200 shadow-sm p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Political Donations</p>
              <p className="text-2xl font-black mt-1 text-bauhaus-red">{money(totalDonations)}</p>
              <p className="text-xs text-gray-400 mt-1">{donations?.length} parties</p>
            </div>
          )}
        </div>

        {/* Revolving Door Alert */}
        {hasRevolvingDoor && rdData && (
          <section className="bg-amber-50 border-2 border-amber-400 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">&#9888;</span>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-amber-800">
                  Revolving Door — {rdData.influence_vectors} Influence Vectors
                </h2>
                <p className="text-xs text-amber-700 mt-1">
                  This entity operates across multiple influence channels simultaneously.
                  Score: <strong>{Number(rdData.revolving_door_score).toFixed(1)}</strong>
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {rdData.lobbies && (
                    <span className="text-[10px] px-2 py-1 bg-amber-200 text-amber-800 font-bold uppercase tracking-wider rounded-sm">
                      Lobbies Government
                    </span>
                  )}
                  {rdData.donates && (
                    <span className="text-[10px] px-2 py-1 bg-red-200 text-red-800 font-bold uppercase tracking-wider rounded-sm">
                      Political Donor — {money(Number(rdData.total_donated))} to {rdData.parties_funded} parties
                    </span>
                  )}
                  {rdData.contracts && (
                    <span className="text-[10px] px-2 py-1 bg-blue-200 text-blue-800 font-bold uppercase tracking-wider rounded-sm">
                      Govt Contractor — {money(Number(rdData.total_contracts))} across {rdData.distinct_buyers} buyers
                    </span>
                  )}
                  {rdData.receives_funding && (
                    <span className="text-[10px] px-2 py-1 bg-green-200 text-green-800 font-bold uppercase tracking-wider rounded-sm">
                      Receives Funding — {money(Number(rdData.total_funded))}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Power breakdown */}
        {powerData && (Number(powerData.distinct_govt_buyers) > 0 || Number(powerData.distinct_parties_funded) > 0) && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">Power Profile</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Number(powerData.procurement_dollars) > 0 && (
                <div className="bg-white border border-gray-200 shadow-sm p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Procurement</p>
                  <p className="text-xl font-black text-green-700 mt-1">{money(Number(powerData.procurement_dollars))}</p>
                  <p className="text-xs text-gray-400 mt-1">{powerData.distinct_govt_buyers} govt buyers</p>
                </div>
              )}
              {Number(powerData.justice_dollars) > 0 && (
                <div className="bg-white border border-gray-200 shadow-sm p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Justice Funding</p>
                  <p className="text-xl font-black text-green-700 mt-1">{money(Number(powerData.justice_dollars))}</p>
                </div>
              )}
              {Number(powerData.donation_dollars) > 0 && (
                <div className="bg-white border border-gray-200 shadow-sm p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Donations Made</p>
                  <p className="text-xl font-black text-bauhaus-red mt-1">{money(Number(powerData.donation_dollars))}</p>
                  <p className="text-xs text-gray-400 mt-1">{powerData.distinct_parties_funded} parties</p>
                </div>
              )}
              <div className="bg-white border border-gray-200 shadow-sm p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Relationships</p>
                <p className="text-xl font-black mt-1">{relationships?.length ?? 0}</p>
                <p className="text-xs text-gray-400 mt-1">Connected entities</p>
              </div>
            </div>
          </section>
        )}

        {/* Network Graph */}
        <EntityNetworkGraph entityId={entity.id} entityName={entity.canonical_name} />

        {/* Board Members */}
        {board && board.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">
              Board & Governance
              <span className="text-xs font-normal text-gray-400 ml-2 normal-case tracking-normal">
                {activeBoardMembers.length} current, {formerBoardMembers.length} former
              </span>
            </h2>
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className={THEAD}>
                    <th className={`${TH} pl-4`}>Name</th>
                    <th className={TH}>Role</th>
                    <th className={TH}>Appointed</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {board.map((b, i) => (
                    <tr key={i} className={ROW(i)}>
                      <td className={`${TD} pl-4 font-medium`}>
                        <Link href={`/person/${encodeURIComponent(b.person_name.replace(/\s+/g, '-'))}`} className="text-bauhaus-blue hover:underline">
                          {b.person_name}
                        </Link>
                      </td>
                      <td className={TD}>
                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-sm border border-gray-200">
                          {b.role_type}
                        </span>
                      </td>
                      <td className={`${TD} text-gray-400 text-xs`}>
                        {b.appointment_date?.split('T')[0] ?? '—'}
                      </td>
                      <td className={TD}>
                        {b.cessation_date ? (
                          <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-sm">
                            Ended {b.cessation_date.split('T')[0]}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-sm font-bold">
                            Active
                          </span>
                        )}
                      </td>
                      <td className={`${TD} text-gray-400 text-xs`}>{b.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ATO Tax Transparency */}
        {ato && ato.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">Tax Transparency</h2>
            <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className={THEAD}>
                    <th className={`${TH} pl-4`}>Year</th>
                    <th className={TH_R}>Total Income</th>
                    <th className={TH_R}>Taxable Income</th>
                    <th className={TH_R}>Tax Payable</th>
                    <th className={TH_R}>Effective Rate</th>
                    <th className={TH}>Industry</th>
                  </tr>
                </thead>
                <tbody>
                  {ato.map((a, i) => (
                    <tr key={i} className={ROW(i)}>
                      <td className={`${TD} pl-4 font-medium`}>{a.report_year}</td>
                      <td className={`${TD_R} font-mono`}>{money(Number(a.total_income))}</td>
                      <td className={`${TD_R} font-mono`}>{money(Number(a.taxable_income))}</td>
                      <td className={`${TD_R} font-mono font-bold`}>{money(Number(a.tax_payable))}</td>
                      <td className={`${TD_R} font-mono`}>
                        {a.effective_tax_rate ? `${Number(a.effective_tax_rate).toFixed(1)}%` : '—'}
                      </td>
                      <td className={`${TD} text-gray-400 text-xs truncate max-w-40`}>{a.industry ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

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

        {/* ALMA Interventions */}
        {alma && alma.length > 0 && (
          <section>
            <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">ALMA Evidence-Linked Interventions</h2>
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

        {/* Data Coverage Footer */}
        <footer className="border-t-2 border-bauhaus-black pt-6 pb-8">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Data Coverage</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {sections.map(s => (
              <span
                key={s.name}
                className={`text-[10px] px-2 py-1 font-bold uppercase tracking-wider rounded-sm ${
                  s.has
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-gray-100 text-gray-400 border border-gray-200'
                }`}
              >
                {s.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Sources: gs_entities, mv_entity_power_index, justice_funding, austender_contracts, political_donations,
            ato_tax_transparency, person_roles, gs_relationships, acnc_charities, alma_interventions.
          </p>
          <p className="mt-2 text-xs flex gap-4">
            <Link href="/entity" className="text-gray-400 underline hover:text-bauhaus-red">Search</Link>
            <Link href="/map" className="text-gray-400 underline hover:text-bauhaus-red">Funding Map</Link>
            <Link href="/graph" className="text-gray-400 underline hover:text-bauhaus-red">Graph</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
