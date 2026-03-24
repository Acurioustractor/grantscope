import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { safe, esc } from '@/lib/sql';
import { money } from '@/lib/format';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ gsId: string }> }) {
  const { gsId } = await params;
  return { title: `Funding Flow — ${decodeURIComponent(gsId)}` };
}

export default async function FundingFlowPage({ params }: { params: Promise<{ gsId: string }> }) {
  const { gsId: rawId } = await params;
  const gsId = decodeURIComponent(rawId);
  const supabase = getServiceSupabase();

  // Entity lookup
  const entity = await safe(supabase.rpc('exec_sql', {
    query: `SELECT id, gs_id, canonical_name, abn, entity_type, sector, state, postcode,
                   remoteness, is_community_controlled, lga_name
       FROM gs_entities WHERE gs_id = '${esc(gsId)}'`,
  }));

  if (!entity?.[0]) notFound();
  const e = entity[0] as {
    id: string; gs_id: string; canonical_name: string; abn: string | null;
    entity_type: string; sector: string; state: string; postcode: string;
    remoteness: string; is_community_controlled: boolean; lga_name: string;
  };

  // Parallel data fetches
  const [grants, contracts, almaInterventions, inboundRels, outboundRels] = await Promise.all([
    // Grants received (justice_funding)
    e.abn ? safe(supabase.rpc('exec_sql', {
      query: `SELECT program_name, SUM(amount_dollars)::bigint as total, COUNT(*)::int as records,
                     MIN(financial_year) as first_year, MAX(financial_year) as last_year
         FROM justice_funding WHERE recipient_abn = '${e.abn}'
         GROUP BY program_name ORDER BY total DESC NULLS LAST LIMIT 20`,
    })) : null,

    // Contracts (from austender)
    e.abn ? safe(supabase.rpc('exec_sql', {
      query: `SELECT title, contract_value::bigint as value, buyer_name, contract_start, contract_end
         FROM austender_contracts WHERE supplier_abn = '${e.abn}'
         ORDER BY contract_value DESC NULLS LAST LIMIT 20`,
    })) : null,

    // ALMA interventions
    safe(supabase.rpc('exec_sql', {
      query: `SELECT name, type, evidence_level, target_cohort, description
         FROM alma_interventions WHERE gs_entity_id = '${e.id}'
         ORDER BY type`,
    })),

    // Inbound relationships (money/support flowing TO this entity)
    safe(supabase.rpc('exec_sql', {
      query: `SELECT s.canonical_name as source_name, s.entity_type as source_type,
                     r.relationship_type, r.amount::bigint, r.dataset
         FROM gs_relationships r
         JOIN gs_entities s ON s.id = r.source_entity_id
         WHERE r.target_entity_id = '${e.id}'
         ORDER BY r.amount DESC NULLS LAST LIMIT 30`,
    })),

    // Outbound relationships (this entity → others)
    safe(supabase.rpc('exec_sql', {
      query: `SELECT t.canonical_name as target_name, t.entity_type as target_type,
                     r.relationship_type, r.amount::bigint, r.dataset
         FROM gs_relationships r
         JOIN gs_entities t ON t.id = r.target_entity_id
         WHERE r.source_entity_id = '${e.id}'
         ORDER BY r.amount DESC NULLS LAST LIMIT 30`,
    })),
  ]);

  type GrantRow = { program_name: string; total: number; records: number; first_year: string; last_year: string };
  type ContractRow = { title: string; value: number; buyer_name: string; contract_start: string; contract_end: string };
  type AlmaRow = { name: string; type: string; evidence_level: string; target_cohort: string; description: string };
  type RelRow = { source_name?: string; target_name?: string; source_type?: string; target_type?: string; relationship_type: string; amount: number | null; dataset: string };

  const grantRows = (grants || []) as GrantRow[];
  const contractRows = (contracts || []) as ContractRow[];
  const almaRows = (almaInterventions || []) as AlmaRow[];
  const inbound = (inboundRels || []) as RelRow[];
  const outbound = (outboundRels || []) as RelRow[];

  // Deduplicate contracts by title
  const uniqueContracts = contractRows.filter((c, i, arr) =>
    arr.findIndex(x => x.title === c.title && x.buyer_name === c.buyer_name) === i
  );

  const totalGrantFunding = grantRows.reduce((s, g) => s + (Number(g.total) || 0), 0);
  const totalContractValue = uniqueContracts.reduce((s, c) => s + (Number(c.value) || 0), 0);
  const totalInbound = inbound.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  // Evidence quality
  const evidenceLevels = almaRows.map(a => a.evidence_level).filter(Boolean);
  const hasStrongEvidence = evidenceLevels.some(l => l.toLowerCase().includes('effective') || l.toLowerCase().includes('strong'));

  return (
    <div className="min-h-screen bg-white text-bauhaus-black print:bg-white">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-widest">{e.canonical_name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              {e.abn && <span>ABN {e.abn}</span>}
              <span>{e.entity_type.replace(/_/g, ' ')}</span>
              {e.state && <span>{e.state}</span>}
              {e.is_community_controlled && (
                <span className="px-2 py-0.5 bg-bauhaus-red text-white text-xs font-bold uppercase">
                  Community Controlled
                </span>
              )}
            </div>
          </div>
          <div className="text-right print:hidden">
            <Link href={`/entity/${e.gs_id}`} className="text-sm text-bauhaus-blue hover:underline">
              ← Entity Profile
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">
        {/* Funding Summary */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-4">
            Funding Overview
          </h2>
          <div className="grid grid-cols-3 gap-6">
            <div className="border-4 border-bauhaus-black p-4">
              <div className="text-3xl font-black">{money(totalInbound || totalGrantFunding + totalContractValue)}</div>
              <div className="text-sm text-gray-600 mt-1">Total Known Funding</div>
            </div>
            <div className="border-4 border-bauhaus-black p-4">
              <div className="text-3xl font-black">{almaRows.length}</div>
              <div className="text-sm text-gray-600 mt-1">ALMA Interventions</div>
            </div>
            <div className="border-4 border-bauhaus-black p-4">
              <div className="text-3xl font-black">{inbound.length + outbound.length}</div>
              <div className="text-sm text-gray-600 mt-1">Network Connections</div>
            </div>
          </div>
        </section>

        {/* Funding Sources (Inbound Flow) */}
        {inbound.length > 0 && (
          <section>
            <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-4">
              Funding Sources
            </h2>
            <div className="space-y-3">
              {inbound.map((r, i) => (
                <div key={i} className="flex items-center gap-4 border-l-4 border-bauhaus-blue pl-4 py-2">
                  <div className="flex-1">
                    <div className="font-bold">{r.source_name}</div>
                    <div className="text-sm text-gray-500">
                      {r.relationship_type.replace(/_/g, ' ')} · {r.dataset}
                    </div>
                  </div>
                  {r.amount && r.amount > 0 && (
                    <div className="text-lg font-black">{money(Number(r.amount))}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Grant Programs */}
        {grantRows.length > 0 && (
          <section>
            <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-4">
              Grant Programs
            </h2>
            <div className="space-y-3">
              {grantRows.map((g, i) => (
                <div key={i} className="flex items-center gap-4 border-l-4 border-bauhaus-red pl-4 py-2">
                  <div className="flex-1">
                    <div className="font-bold">{g.program_name}</div>
                    <div className="text-sm text-gray-500">
                      {g.records} record{g.records > 1 ? 's' : ''} · {g.first_year}–{g.last_year}
                    </div>
                  </div>
                  {g.total > 0 && (
                    <div className="text-lg font-black">{money(Number(g.total))}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Contracts */}
        {uniqueContracts.length > 0 && (
          <section>
            <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-4">
              Government Contracts
            </h2>
            <div className="space-y-3">
              {uniqueContracts.map((c, i) => (
                <div key={i} className="flex items-center gap-4 border-l-4 border-bauhaus-blue pl-4 py-2">
                  <div className="flex-1">
                    <div className="font-bold">{c.title}</div>
                    <div className="text-sm text-gray-500">
                      {c.buyer_name} · {c.contract_start?.slice(0, 10)}
                    </div>
                  </div>
                  {c.value > 0 && (
                    <div className="text-lg font-black">{money(Number(c.value))}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ALMA Evidence */}
        {almaRows.length > 0 && (
          <section>
            <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-4">
              Evidence Base (ALMA)
            </h2>
            {hasStrongEvidence && (
              <div className="bg-green-50 border-2 border-green-600 px-4 py-2 mb-4 text-sm text-green-800">
                This organization has programs with strong evidence of effectiveness.
              </div>
            )}
            <div className="grid gap-4">
              {almaRows.map((a, i) => (
                <div key={i} className="border-2 border-bauhaus-black p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{a.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-bauhaus-black text-white text-xs font-bold uppercase">
                          {a.type}
                        </span>
                        <span className="text-sm text-gray-600">{a.evidence_level}</span>
                      </div>
                    </div>
                  </div>
                  {a.target_cohort && (
                    <div className="text-sm text-gray-500 mt-2">
                      Cohort: {a.target_cohort.replace(/,/g, ', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Partnerships (Outbound) */}
        {outbound.length > 0 && (
          <section>
            <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-4">
              Partnerships & Connections
            </h2>
            <div className="space-y-3">
              {outbound.map((r, i) => (
                <div key={i} className="flex items-center gap-4 border-l-4 border-gray-300 pl-4 py-2">
                  <div className="flex-1">
                    <div className="font-bold">{r.target_name}</div>
                    <div className="text-sm text-gray-500">
                      {r.relationship_type.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t-2 border-bauhaus-black pt-4 text-sm text-gray-500">
          <p>Data sourced from CivicGraph — Decision Infrastructure for Government & Social Sector</p>
          <p>Generated {new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </footer>
      </div>
    </div>
  );
}
