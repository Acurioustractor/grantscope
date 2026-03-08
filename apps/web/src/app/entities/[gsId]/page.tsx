import { getServiceSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Entity {
  id: string;
  gs_id: string;
  entity_type: string;
  canonical_name: string;
  abn: string | null;
  acn: string | null;
  description: string | null;
  website: string | null;
  state: string | null;
  postcode: string | null;
  sector: string | null;
  sub_sector: string | null;
  tags: string[];
  source_datasets: string[];
  source_count: number;
  confidence: string;
  latest_revenue: number | null;
  latest_assets: number | null;
  latest_tax_payable: number | null;
  financial_year: string | null;
}

interface Relationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  amount: number | null;
  year: number | null;
  dataset: string;
  confidence: string;
  properties: Record<string, string | null>;
  start_date: string | null;
  end_date: string | null;
}

interface ConnectedEntity {
  id: string;
  gs_id: string;
  canonical_name: string;
  entity_type: string;
}

function formatMoney(amount: number | null): string {
  if (!amount) return '\u2014';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function entityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    charity: 'Charity',
    foundation: 'Foundation',
    company: 'Company',
    government_body: 'Government Body',
    indigenous_corp: 'Indigenous Corporation',
    political_party: 'Political Party',
    social_enterprise: 'Social Enterprise',
    trust: 'Trust',
    person: 'Person',
    unknown: 'Unknown',
  };
  return labels[type] || type;
}

function entityTypeBadge(type: string) {
  const styles: Record<string, string> = {
    charity: 'border-money bg-money-light text-money',
    foundation: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
    company: 'border-bauhaus-black/30 bg-bauhaus-canvas text-bauhaus-black',
    government_body: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black',
    indigenous_corp: 'border-bauhaus-red bg-error-light text-bauhaus-red',
    political_party: 'border-bauhaus-red bg-error-light text-bauhaus-red',
    social_enterprise: 'border-money bg-money-light text-money',
  };
  return styles[type] || 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
}

function confidenceBadge(c: string) {
  if (c === 'registry') return { cls: 'border-money bg-money-light text-money', label: 'Registry' };
  if (c === 'verified') return { cls: 'border-bauhaus-blue bg-link-light text-bauhaus-blue', label: 'Verified' };
  if (c === 'reported') return { cls: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black', label: 'Reported' };
  return { cls: 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted', label: c };
}

function relTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    donation: 'Political Donation',
    contract: 'Government Contract',
    grant: 'Grant',
    subsidiary_of: 'Subsidiary Of',
    charity_link: 'Charity Link',
    registered_as: 'Registered As',
  };
  return labels[type] || type.replace(/_/g, ' ');
}

function datasetLabel(ds: string): string {
  const labels: Record<string, string> = {
    acnc: 'ACNC',
    foundations: 'Foundations',
    oric: 'ORIC',
    austender: 'AusTender',
    aec_donations: 'AEC Donations',
    ato_tax: 'ATO Tax',
    asx: 'ASX',
    social_enterprises: 'Social Enterprises',
  };
  return labels[ds] || ds;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function EntityDossierPage({ params }: { params: Promise<{ gsId: string }> }) {
  const { gsId } = await params;
  const supabase = getServiceSupabase();

  const { data: entity } = await supabase
    .from('gs_entities')
    .select('*')
    .eq('gs_id', gsId)
    .single();

  if (!entity) notFound();
  const e = entity as Entity;

  // Fetch relationships, ACNC financials, and grants in parallel
  const [{ data: outbound }, { data: inbound }, { data: acncData }, { data: grantData }] = await Promise.all([
    supabase
      .from('gs_relationships')
      .select('*')
      .eq('source_entity_id', e.id)
      .order('amount', { ascending: false, nullsFirst: false }),
    supabase
      .from('gs_relationships')
      .select('*')
      .eq('target_entity_id', e.id)
      .order('amount', { ascending: false, nullsFirst: false }),
    // ACNC Annual Information Statements (if entity has ABN)
    e.abn
      ? supabase
          .from('acnc_ais')
          .select('ais_year, total_revenue, total_expenses, total_assets, net_surplus_deficit, donations_and_bequests, grants_donations_au, grants_donations_intl, employee_expenses, staff_fte, staff_volunteers, charity_size, revenue_from_government')
          .eq('abn', e.abn)
          .order('ais_year', { ascending: false })
      : Promise.resolve({ data: [] }),
    // Grant opportunities offered by this entity (if foundation)
    e.abn
      ? supabase
          .from('gs_relationships')
          .select('id, amount, properties')
          .eq('source_entity_id', e.id)
          .eq('relationship_type', 'grant')
          .order('amount', { ascending: false, nullsFirst: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  // Deduplicate ACNC financials by year (keep richest record)
  interface AcncYear {
    ais_year: number;
    total_revenue: number | null;
    total_expenses: number | null;
    total_assets: number | null;
    net_surplus_deficit: number | null;
    donations_and_bequests: number | null;
    grants_donations_au: number | null;
    grants_donations_intl: number | null;
    employee_expenses: number | null;
    staff_fte: number | null;
    staff_volunteers: number | null;
    charity_size: string | null;
    revenue_from_government: number | null;
  }
  const acncByYear = new Map<number, AcncYear>();
  for (const row of (acncData || []) as AcncYear[]) {
    const existing = acncByYear.get(row.ais_year);
    if (!existing || (Number(row.total_assets) || 0) > (Number(existing.total_assets) || 0)) {
      acncByYear.set(row.ais_year, row);
    }
  }
  const financialYears = Array.from(acncByYear.values()).sort((a, b) => b.ais_year - a.ais_year);
  const grants = (grantData || []) as Relationship[];

  const allRels = [...(outbound || []), ...(inbound || [])] as Relationship[];

  // Collect all connected entity IDs and fetch their names
  const connectedIds = new Set<string>();
  for (const r of allRels) {
    connectedIds.add(r.source_entity_id);
    connectedIds.add(r.target_entity_id);
  }
  connectedIds.delete(e.id);

  const connectedMap = new Map<string, ConnectedEntity>();
  if (connectedIds.size > 0) {
    const ids = Array.from(connectedIds);
    // Fetch in batches of 100
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { data } = await supabase
        .from('gs_entities')
        .select('id, gs_id, canonical_name, entity_type')
        .in('id', chunk);
      for (const ce of (data || [])) {
        connectedMap.set(ce.id, ce as ConnectedEntity);
      }
    }
  }

  // Group relationships by type
  const donations = allRels.filter(r => r.relationship_type === 'donation');
  const contracts = allRels.filter(r => r.relationship_type === 'contract');
  const otherRels = allRels.filter(r => !['donation', 'contract'].includes(r.relationship_type));

  const totalDonated = donations.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalContractValue = contracts.reduce((sum, r) => sum + (r.amount || 0), 0);
  const isDonorContractor = donations.length > 0 && contracts.length > 0;

  // Get connected entity name helper
  const getName = (id: string) => connectedMap.get(id)?.canonical_name || 'Unknown';
  const getGsId = (id: string) => connectedMap.get(id)?.gs_id || '';

  const badge = confidenceBadge(e.confidence);

  return (
    <div className="max-w-5xl">
      <Link href="/entities" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Entity Graph
      </Link>

      {/* Header */}
      <div className="mt-4 mb-6">
        <div className="flex items-start gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black">{e.canonical_name}</h1>
          {isDonorContractor && (
            <span className="text-[11px] font-black px-2.5 py-1 border-2 border-bauhaus-red bg-error-light text-bauhaus-red uppercase tracking-widest whitespace-nowrap">
              Donor-Contractor
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${entityTypeBadge(e.entity_type)}`}>
            {entityTypeLabel(e.entity_type)}
          </span>
          <span className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${badge.cls}`}>
            {badge.label}
          </span>
          {e.abn && (
            <span className="text-xs font-bold text-bauhaus-muted">ABN {e.abn}</span>
          )}
          {e.state && (
            <span className="text-xs font-bold text-bauhaus-muted">{e.state}</span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-8 border-4 border-bauhaus-black">
        <div className="p-4 border-r-2 border-b-2 sm:border-b-0 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Relationships</div>
          <div className="text-2xl font-black text-bauhaus-black">{allRels.length.toLocaleString()}</div>
        </div>
        <div className="p-4 border-b-2 sm:border-b-0 sm:border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Data Sources</div>
          <div className="text-2xl font-black text-bauhaus-black">{e.source_count}</div>
        </div>
        <div className="p-4 border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">
            {donations.length > 0 ? 'Political Donations' : 'Revenue'}
          </div>
          <div className="text-2xl font-black text-bauhaus-black">
            {donations.length > 0 ? formatMoney(totalDonated) : formatMoney(e.latest_revenue)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">
            {contracts.length > 0 ? 'Contract Value' : 'Tax Payable'}
          </div>
          <div className="text-2xl font-black text-bauhaus-black">
            {contracts.length > 0 ? formatMoney(totalContractValue) : formatMoney(e.latest_tax_payable)}
          </div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2">
          {/* Description */}
          {e.description && (
            <Section title="About">
              <p className="text-bauhaus-muted leading-relaxed font-medium">{e.description}</p>
            </Section>
          )}

          {/* Political Donations */}
          {donations.length > 0 && (
            <Section title={`Political Donations (${donations.length})`}>
              <div className="space-y-0">
                {/* Aggregate by party */}
                {(() => {
                  const byParty = new Map<string, { name: string; gsId: string; total: number; count: number; years: Set<number> }>();
                  for (const d of donations) {
                    const otherId = d.source_entity_id === e.id ? d.target_entity_id : d.source_entity_id;
                    const name = getName(otherId);
                    const existing = byParty.get(name) || { name, gsId: getGsId(otherId), total: 0, count: 0, years: new Set() };
                    existing.total += d.amount || 0;
                    existing.count++;
                    if (d.year) existing.years.add(d.year);
                    byParty.set(name, existing);
                  }
                  const sorted = Array.from(byParty.values()).sort((a, b) => b.total - a.total);
                  return sorted.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                      <div>
                        {p.gsId ? (
                          <Link href={`/entities/${p.gsId}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue">
                            {p.name}
                          </Link>
                        ) : (
                          <span className="font-bold text-bauhaus-black">{p.name}</span>
                        )}
                        <div className="text-[11px] text-bauhaus-muted font-medium">
                          {p.count} donation{p.count !== 1 ? 's' : ''} &middot; {Array.from(p.years).sort().join(', ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-bauhaus-black">{formatMoney(p.total)}</div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </Section>
          )}

          {/* Government Contracts */}
          {contracts.length > 0 && (
            <Section title={`Government Contracts (${contracts.length})`}>
              <div className="space-y-0">
                {contracts.slice(0, 20).map((c, i) => {
                  const otherId = c.source_entity_id === e.id ? c.target_entity_id : c.source_entity_id;
                  return (
                    <div key={i} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                      <div className="flex-1 min-w-0">
                        {getGsId(otherId) ? (
                          <Link href={`/entities/${getGsId(otherId)}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue truncate block">
                            {c.properties?.buyer_name || c.properties?.supplier_name || getName(otherId)}
                          </Link>
                        ) : (
                          <span className="font-bold text-bauhaus-black truncate block">
                            {c.properties?.buyer_name || c.properties?.supplier_name || getName(otherId)}
                          </span>
                        )}
                        <div className="text-[11px] text-bauhaus-muted font-medium">
                          {c.properties?.category && <span>{c.properties.category} &middot; </span>}
                          {c.year && <span>{c.year}</span>}
                          {c.properties?.procurement_method && <span> &middot; {c.properties.procurement_method}</span>}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-black text-bauhaus-black">{formatMoney(c.amount)}</div>
                      </div>
                    </div>
                  );
                })}
                {contracts.length > 20 && (
                  <div className="text-xs font-bold text-bauhaus-muted mt-3">
                    + {contracts.length - 20} more contracts
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Grant Programs */}
          {grants.length > 0 && (
            <Section title={`Grant Programs (${grants.length})`}>
              <div className="space-y-0">
                {grants.map((g, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-bauhaus-black truncate">
                        {g.properties?.grant_name || 'Unnamed Program'}
                      </div>
                      <div className="text-[11px] text-bauhaus-muted font-medium">
                        {g.properties?.categories && <span>{g.properties.categories} &middot; </span>}
                        {g.properties?.closes_at && <span>Closes {g.properties.closes_at}</span>}
                      </div>
                    </div>
                    {g.amount && (
                      <div className="text-right ml-4">
                        <div className="font-black text-bauhaus-black">{formatMoney(g.amount)}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ACNC Financial History */}
          {financialYears.length > 0 && (
            <Section title={`Financial History (${financialYears.length} years)`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-4 border-bauhaus-black">
                      <th className="text-left py-2 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Year</th>
                      <th className="text-right py-2 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Revenue</th>
                      <th className="text-right py-2 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Expenses</th>
                      <th className="text-right py-2 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Assets</th>
                      <th className="text-right py-2 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Surplus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialYears.slice(0, 8).map((fy, i) => (
                      <tr key={i} className="border-b border-bauhaus-black/5">
                        <td className="py-2 font-black text-bauhaus-black">{fy.ais_year}</td>
                        <td className="py-2 text-right font-bold text-bauhaus-black">{formatMoney(Number(fy.total_revenue))}</td>
                        <td className="py-2 text-right font-bold text-bauhaus-muted">{formatMoney(Number(fy.total_expenses))}</td>
                        <td className="py-2 text-right font-bold text-bauhaus-black">{formatMoney(Number(fy.total_assets))}</td>
                        <td className={`py-2 text-right font-black ${Number(fy.net_surplus_deficit) >= 0 ? 'text-money' : 'text-bauhaus-red'}`}>
                          {formatMoney(Number(fy.net_surplus_deficit))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Key metrics from latest year */}
              {financialYears[0] && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {financialYears[0].revenue_from_government && Number(financialYears[0].revenue_from_government) > 0 && (
                    <div className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Govt Revenue</div>
                      <div className="text-lg font-black text-bauhaus-black">{formatMoney(Number(financialYears[0].revenue_from_government))}</div>
                    </div>
                  )}
                  {financialYears[0].grants_donations_au && Number(financialYears[0].grants_donations_au) > 0 && (
                    <div className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Grants Given (AU)</div>
                      <div className="text-lg font-black text-bauhaus-black">{formatMoney(Number(financialYears[0].grants_donations_au))}</div>
                    </div>
                  )}
                  {financialYears[0].staff_fte && Number(financialYears[0].staff_fte) > 0 && (
                    <div className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Staff (FTE)</div>
                      <div className="text-lg font-black text-bauhaus-black">{Number(financialYears[0].staff_fte).toLocaleString()}</div>
                    </div>
                  )}
                  {financialYears[0].staff_volunteers && Number(financialYears[0].staff_volunteers) > 0 && (
                    <div className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Volunteers</div>
                      <div className="text-lg font-black text-bauhaus-black">{Number(financialYears[0].staff_volunteers).toLocaleString()}</div>
                    </div>
                  )}
                  {financialYears[0].donations_and_bequests && Number(financialYears[0].donations_and_bequests) > 0 && (
                    <div className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Donations Received</div>
                      <div className="text-lg font-black text-bauhaus-black">{formatMoney(Number(financialYears[0].donations_and_bequests))}</div>
                    </div>
                  )}
                </div>
              )}
            </Section>
          )}

          {/* Other Relationships */}
          {otherRels.length > 0 && (
            <Section title={`Other Connections (${otherRels.length})`}>
              <div className="space-y-0">
                {otherRels.slice(0, 10).map((r, i) => {
                  const otherId = r.source_entity_id === e.id ? r.target_entity_id : r.source_entity_id;
                  const direction = r.source_entity_id === e.id ? 'to' : 'from';
                  return (
                    <div key={i} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                      <div>
                        <span className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest mr-2">
                          {relTypeLabel(r.relationship_type)}
                        </span>
                        <span className="text-xs text-bauhaus-muted mr-1">{direction}</span>
                        {getGsId(otherId) ? (
                          <Link href={`/entities/${getGsId(otherId)}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue">
                            {getName(otherId)}
                          </Link>
                        ) : (
                          <span className="font-bold text-bauhaus-black">{getName(otherId)}</span>
                        )}
                      </div>
                      {r.amount && (
                        <div className="font-black text-bauhaus-black">{formatMoney(r.amount)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Identity */}
          <div className="bg-white border-4 border-bauhaus-black p-4">
            <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
              Identity
            </h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">GS ID</dt>
                <dd className="text-sm font-mono font-bold text-bauhaus-black">{e.gs_id}</dd>
              </div>
              {e.abn && (
                <div>
                  <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">ABN</dt>
                  <dd className="text-sm font-bold text-bauhaus-black">{e.abn}</dd>
                </div>
              )}
              {e.acn && (
                <div>
                  <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">ACN</dt>
                  <dd className="text-sm font-bold text-bauhaus-black">{e.acn}</dd>
                </div>
              )}
              {e.sector && (
                <div>
                  <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Sector</dt>
                  <dd className="text-sm font-bold text-bauhaus-black">{e.sector}</dd>
                </div>
              )}
              {e.website && (
                <div>
                  <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Website</dt>
                  <dd>
                    <a href={e.website.startsWith('http') ? e.website : `https://${e.website}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-sm font-bold text-bauhaus-blue hover:underline truncate block">
                      {e.website.replace(/^https?:\/\//, '')}
                    </a>
                  </dd>
                </div>
              )}
              {e.financial_year && (
                <div>
                  <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Financial Year</dt>
                  <dd className="text-sm font-bold text-bauhaus-black">{e.financial_year}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Financials (if available) */}
          {(e.latest_revenue || e.latest_assets || e.latest_tax_payable) && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
                Financials
              </h3>
              <dl className="space-y-2">
                {e.latest_revenue && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Revenue</dt>
                    <dd className="text-sm font-black text-bauhaus-black">{formatMoney(e.latest_revenue)}</dd>
                  </div>
                )}
                {e.latest_assets && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Assets</dt>
                    <dd className="text-sm font-black text-bauhaus-black">{formatMoney(e.latest_assets)}</dd>
                  </div>
                )}
                {e.latest_tax_payable && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Tax Payable</dt>
                    <dd className="text-sm font-black text-bauhaus-black">{formatMoney(e.latest_tax_payable)}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Method & Confidence */}
          <div className="bg-white border-4 border-bauhaus-black p-4">
            <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
              Method
            </h3>
            <dl className="space-y-2.5">
              <div className="flex justify-between">
                <dt className="text-xs font-bold text-bauhaus-muted">Match Confidence</dt>
                <dd className={`text-xs font-black uppercase tracking-widest ${
                  e.confidence === 'exact' ? 'text-green-700' :
                  e.confidence === 'high' ? 'text-bauhaus-blue' :
                  e.confidence === 'inferred' ? 'text-orange-600' : 'text-bauhaus-muted'
                }`}>
                  {e.confidence || 'exact'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs font-bold text-bauhaus-muted">Cross-references</dt>
                <dd className="text-sm font-black text-bauhaus-black">{e.source_count} dataset{e.source_count !== 1 ? 's' : ''}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs font-bold text-bauhaus-muted">Match Key</dt>
                <dd className="text-xs font-mono text-bauhaus-muted">{e.gs_id.startsWith('AU-ABN-') ? 'ABN' : e.gs_id.startsWith('AU-ACN-') ? 'ACN' : e.gs_id.startsWith('AU-ORIC-') ? 'ICN' : 'Name hash'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs font-bold text-bauhaus-muted">Relationships</dt>
                <dd className="text-sm font-black text-bauhaus-black">{(outbound?.length || 0) + (inbound?.length || 0)}</dd>
              </div>
            </dl>
            <div className="mt-3 pt-3 border-t border-bauhaus-black/10">
              <p className="text-[10px] text-bauhaus-muted leading-relaxed">
                {e.gs_id.startsWith('AU-ABN-')
                  ? 'Matched by Australian Business Number (ABN) — high confidence. This entity was found across multiple government datasets using the same ABN.'
                  : e.gs_id.startsWith('AU-NAME-')
                  ? 'Matched by normalised name — moderate confidence. No ABN was available, so this entity was matched by exact or fuzzy name comparison. Some matches may be incorrect.'
                  : 'Matched by registration number — high confidence.'}
              </p>
            </div>
          </div>

          {/* Data Sources */}
          <div className="bg-white border-4 border-bauhaus-black p-4">
            <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
              Data Sources
            </h3>
            <div className="flex flex-wrap gap-2">
              {e.source_datasets.map((ds, i) => (
                <span key={i} className="text-[11px] font-black px-2.5 py-1 border-2 border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black uppercase tracking-widest">
                  {datasetLabel(ds)}
                </span>
              ))}
            </div>
          </div>

          {/* Donor-Contractor Alert */}
          {isDonorContractor && (
            <div className="bg-error-light border-4 border-bauhaus-red p-4">
              <h3 className="text-sm font-black text-bauhaus-red mb-2 uppercase tracking-widest">
                Donor-Contractor
              </h3>
              <p className="text-xs font-medium text-bauhaus-black leading-relaxed">
                This entity has both donated to political parties ({donations.length} donation{donations.length !== 1 ? 's' : ''} totalling {formatMoney(totalDonated)}) and holds government contracts ({contracts.length} contract{contracts.length !== 1 ? 's' : ''} worth {formatMoney(totalContractValue)}).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
