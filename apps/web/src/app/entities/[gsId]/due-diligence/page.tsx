import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createSupabaseServer } from '@/lib/supabase-server';
import { assembleDueDiligencePack } from '@/lib/services/due-diligence-service';
import type { DueDiligencePack, ContractRecord, AlmaInterventionSummary } from '@/lib/services/due-diligence-service';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ gsId: string }> }): Promise<Metadata> {
  const { gsId } = await params;
  return {
    title: `Due Diligence Pack — ${gsId} | CivicGraph`,
    description: 'Entity due diligence pack with financials, funding, contracts, political connections, and evidence alignment.',
  };
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '\u2014';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border-2 border-bauhaus-black p-3">
      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">{label}</div>
      <div className={`text-2xl font-black ${color || 'text-bauhaus-black'}`}>{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest border-b-2 border-bauhaus-black/10 pb-1 mb-3 mt-8">
      {children}
    </div>
  );
}

function Tip({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <span className="relative group/tip cursor-help border-b border-dotted border-bauhaus-muted">
      {term}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-bauhaus-black text-white text-xs rounded shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none w-56 text-center z-10">
        {children}
      </span>
    </span>
  );
}

function generateInsights(pack: DueDiligencePack): string[] {
  const insights: string[] = [];

  // Financial health
  if (pack.financials.length > 0) {
    const latest = pack.financials[0];
    const surplus = latest.net_surplus_deficit;
    if (surplus != null && surplus > 0) {
      insights.push(`Reported a ${fmtMoney(surplus)} surplus in ${latest.ais_year} — financially healthy.`);
    } else if (surplus != null && surplus < 0) {
      insights.push(`Reported a ${fmtMoney(Math.abs(surplus))} deficit in ${latest.ais_year} — monitor financial sustainability.`);
    }
  }

  // Funding profile
  const totalFunding = pack.funding.total + pack.contracts.total;
  if (totalFunding > 0) {
    insights.push(`Receives ${fmtMoney(totalFunding)} in tracked government funding and contracts.`);
  }

  // Integrity
  if (pack.integrity_flags.donations_and_contracts_overlap) {
    insights.push('Flagged: has both political donations and government contracts — cross-reference recommended.');
  } else if (!pack.integrity_flags.has_donations) {
    insights.push('Clean political record — no political donations on file.');
  }

  // Evidence alignment
  if (pack.alma_interventions.length > 0) {
    insights.push(`Linked to ${pack.alma_interventions.length} evidence-backed program${pack.alma_interventions.length > 1 ? 's' : ''} in the Australian Living Map of Alternatives.`);
  }

  // Community
  if (pack.entity.is_community_controlled) {
    insights.push('Community-controlled organisation — eligible for priority funding pathways.');
  }

  if (pack.integrity_flags.low_seifa) {
    insights.push('Serves a high-disadvantage area (SEIFA decile 1-3).');
  }

  return insights.slice(0, 3);
}

function IntegrityFlag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`text-sm font-black ${ok ? 'text-green-600' : 'text-red-600'}`}>
        {ok ? '\u2713' : '\u2717'}
      </span>
      <span className="text-sm">{label}</span>
    </div>
  );
}

export default async function DueDiligencePreviewPage({
  params,
}: {
  params: Promise<{ gsId: string }>;
}) {
  const { gsId } = await params;

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  const pack = await assembleDueDiligencePack(gsId);
  if (!pack) notFound();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 print:px-0 print:py-0">
      {/* Action bar */}
      <div className="flex items-center justify-between mb-6 no-print">
        <Link href={`/entities/${gsId}`} className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Back to Entity
        </Link>
        {isAuthenticated ? (
          <div className="flex gap-2">
            <a
              href={`/api/entities/${gsId}/due-diligence?format=pdf`}
              className="text-[11px] font-black px-3 py-1.5 border-2 border-bauhaus-black bg-bauhaus-black text-white uppercase tracking-widest hover:bg-bauhaus-red hover:border-bauhaus-red transition-colors"
            >
              Download PDF
            </a>
            <a
              href={`/api/entities/${gsId}/due-diligence?format=json`}
              className="text-[11px] font-black px-3 py-1.5 border-2 border-bauhaus-black text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Download JSON
            </a>
          </div>
        ) : (
          <a
            href={`/register?redirect=/entities/${gsId}/due-diligence`}
            className="text-[11px] font-black px-3 py-1.5 border-2 border-bauhaus-black bg-bauhaus-black text-white uppercase tracking-widest hover:bg-bauhaus-red hover:border-bauhaus-red transition-colors"
          >
            Sign Up to Download PDF
          </a>
        )}
      </div>

      {/* Header */}
      <div className="border-b-4 border-bauhaus-black pb-4 mb-8">
        <div className="text-[11px] font-black text-bauhaus-muted uppercase tracking-[0.2em]">
          CivicGraph — Due Diligence Pack
        </div>
        <h1 className="text-3xl font-black text-bauhaus-black uppercase tracking-wide mt-1">
          {pack.entity.canonical_name}
        </h1>
        <div className="text-xs text-bauhaus-muted mt-2">
          ABN {pack.entity.abn || 'Not registered'} &bull; {pack.entity.entity_type} &bull; Generated {pack.generated_at.split('T')[0]}
        </div>
      </div>

      {/* Auto-Insights */}
      {(() => {
        const insights = generateInsights(pack);
        return insights.length > 0 ? (
          <div className="border-2 border-bauhaus-blue bg-blue-50/50 p-4 mb-8">
            <div className="text-[10px] font-black text-bauhaus-blue uppercase tracking-widest mb-2">Executive Summary</div>
            <ul className="space-y-1">
              {insights.map((insight, i) => (
                <li key={i} className="text-sm text-bauhaus-black flex gap-2">
                  <span className="text-bauhaus-blue font-black">&bull;</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        ) : null;
      })()}

      {/* Entity Profile */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
        <StatCard label="Entity Type" value={pack.entity.entity_type} />
        <StatCard label="State" value={pack.entity.state || '\u2014'} />
        <div className="border-2 border-bauhaus-black p-3">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest"><Tip term="SEIFA Decile">Socio-Economic Indexes for Areas — decile 1 is most disadvantaged, 10 is least</Tip></div>
          <div className="text-2xl font-black text-bauhaus-black">{pack.entity.seifa_irsd_decile != null ? String(pack.entity.seifa_irsd_decile) : '\u2014'}</div>
        </div>
        <StatCard label="Community Ctrl" value={pack.entity.is_community_controlled ? 'Yes' : 'No'} color={pack.entity.is_community_controlled ? 'text-green-600' : undefined} />
        <StatCard label="Remoteness" value={pack.entity.remoteness || '\u2014'} />
        <StatCard label="LGA" value={pack.entity.lga_name || '\u2014'} />
      </div>

      {/* Integrity alert */}
      {pack.integrity_flags.donations_and_contracts_overlap && (
        <div className="border-2 border-bauhaus-red bg-red-50 p-3 mb-6">
          <strong className="text-bauhaus-red text-xs font-black uppercase tracking-widest">Integrity Flag:</strong>
          <span className="text-sm ml-2">This entity has both political donation records and government contract records. Cross-reference recommended.</span>
        </div>
      )}

      {/* Charity info */}
      {pack.charity && (
        <div className="text-xs text-bauhaus-muted mb-6">
          {[
            pack.charity.charity_size ? `Size: ${pack.charity.charity_size}` : null,
            pack.charity.pbi ? 'PBI (Public Benevolent Institution — tax-deductible donations)' : null,
            pack.charity.hpc ? 'HPC (Health Promotion Charity — tax-deductible donations)' : null,
            pack.charity.purposes?.length ? `Purposes: ${pack.charity.purposes.join(', ')}` : null,
          ].filter(Boolean).join(' \u2022 ')}
        </div>
      )}

      {/* Financial Summary */}
      <SectionTitle>Financial Summary</SectionTitle>
      {pack.financials.length > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Latest Revenue" value={fmtMoney(pack.financials[0].total_revenue)} />
            <StatCard label="Latest Expenses" value={fmtMoney(pack.financials[0].total_expenses)} />
            <StatCard label="Total Assets" value={fmtMoney(pack.financials[0].total_assets)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Year</th>
                  <th className="text-right text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Revenue</th>
                  <th className="text-right text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Expenses</th>
                  <th className="text-right text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Assets</th>
                  <th className="text-right text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Surplus</th>
                  <th className="text-right text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Gov Rev</th>
                  <th className="text-right text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">FTE</th>
                </tr>
              </thead>
              <tbody>
                {pack.financials.map((f) => (
                  <tr key={f.ais_year} className="border-b border-bauhaus-black/10">
                    <td className="py-1.5 px-2 font-bold">{f.ais_year}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(f.total_revenue)}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(f.total_expenses)}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(f.total_assets)}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(f.net_surplus_deficit)}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(f.revenue_from_government)}</td>
                    <td className="py-1.5 px-2 text-right">{f.staff_fte != null ? Math.round(f.staff_fte) : '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-bauhaus-muted">No ACNC financial data on file — this entity may not be a registered charity, or financials have not yet been lodged.</p>
      )}

      {/* Funding */}
      <SectionTitle>Government Funding</SectionTitle>
      {pack.funding.total > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Total Funding" value={fmtMoney(pack.funding.total)} color="text-bauhaus-red" />
            <StatCard label="Records" value={String(pack.funding.record_count)} />
            <StatCard label="Programs" value={String(Object.keys(pack.funding.by_program).length)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Program</th>
                  <th className="text-right text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(pack.funding.by_program).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([prog, total]) => (
                  <tr key={prog} className="border-b border-bauhaus-black/10">
                    <td className="py-1.5 px-2">{prog}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-bauhaus-muted">No government funding records found — clean record in tracked datasets.</p>
      )}

      {/* Contracts */}
      <SectionTitle>Government Contracts</SectionTitle>
      {pack.contracts.total > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard label="Total Value" value={fmtMoney(pack.contracts.total)} />
            <StatCard label="Contracts" value={String(pack.contracts.record_count)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Title</th>
                  <th className="text-right text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Value</th>
                  <th className="text-left text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Buyer</th>
                  <th className="text-left text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Start</th>
                </tr>
              </thead>
              <tbody>
                {pack.contracts.recent.map((c: ContractRecord, i: number) => (
                  <tr key={i} className="border-b border-bauhaus-black/10">
                    <td className="py-1.5 px-2 max-w-[200px] truncate">{c.title}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(c.contract_value)}</td>
                    <td className="py-1.5 px-2">{c.buyer_name}</td>
                    <td className="py-1.5 px-2 text-xs">{fmtDate(c.contract_start)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-bauhaus-muted">No AusTender contracts on record — clean procurement record.</p>
      )}

      {/* Political Donations */}
      <SectionTitle>Political Connections</SectionTitle>
      {pack.donations.total > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard label="Total Donations" value={fmtMoney(pack.donations.total)} color="text-bauhaus-red" />
            <StatCard label="Records" value={String(pack.donations.record_count)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Party / Recipient</th>
                  <th className="text-right text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(pack.donations.by_party).sort((a, b) => b[1] - a[1]).map(([party, total]) => (
                  <tr key={party} className="border-b border-bauhaus-black/10">
                    <td className="py-1.5 px-2">{party}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{fmtMoney(total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-bauhaus-muted">No political donation records — clean political record.</p>
      )}

      {/* ALMA Evidence */}
      <SectionTitle>Evidence Alignment (<Tip term="ALMA">Australian Living Map of Alternatives — JusticeHub&apos;s evidence database of what works</Tip>)</SectionTitle>
      {pack.alma_interventions.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard label="ALMA Interventions" value={String(pack.alma_interventions.length)} color="text-green-600" />
            <StatCard label="Youth Justice" value={String(pack.alma_interventions.filter((a: AlmaInterventionSummary) => a.serves_youth_justice).length)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="text-left text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Intervention</th>
                  <th className="text-left text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Type</th>
                  <th className="text-left text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Evidence</th>
                  <th className="text-left text-[10px] font-black text-bauhaus-muted uppercase tracking-widest py-2 px-2">Cohort</th>
                </tr>
              </thead>
              <tbody>
                {pack.alma_interventions.map((a: AlmaInterventionSummary) => (
                  <tr key={a.name} className="border-b border-bauhaus-black/10">
                    <td className="py-1.5 px-2 font-medium">{a.name}</td>
                    <td className="py-1.5 px-2">{a.type || '\u2014'}</td>
                    <td className="py-1.5 px-2">{a.evidence_level || '\u2014'}</td>
                    <td className="py-1.5 px-2">{a.target_cohort || '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-bauhaus-muted">No evidence-backed programs (ALMA) linked yet — this entity may operate programs not yet catalogued in the Australian Living Map of Alternatives.</p>
      )}

      {/* Geographic Context */}
      {pack.place && (
        <>
          <SectionTitle>Geographic Context</SectionTitle>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Locality" value={pack.place.locality || '\u2014'} />
            <StatCard label="Remoteness" value={pack.place.remoteness || '\u2014'} />
            <StatCard label="Local Ecosystem" value={`${pack.place.local_entity_count} orgs`} />
          </div>
        </>
      )}

      {/* Relationship Summary */}
      {pack.stats && (
        <>
          <SectionTitle>Relationship Summary</SectionTitle>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Relationships" value={String(pack.stats.total_relationships)} />
            <StatCard label="Inbound Value" value={fmtMoney(pack.stats.total_inbound_amount)} />
            <StatCard label="Outbound Value" value={fmtMoney(pack.stats.total_outbound_amount)} />
          </div>
        </>
      )}

      {/* Integrity Assessment */}
      <SectionTitle>Integrity Assessment</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 mb-6">
        <IntegrityFlag label="ABN registered" ok={!pack.integrity_flags.missing_abn} />
        <IntegrityFlag label="ACNC financials available" ok={!pack.integrity_flags.missing_financials} />
        <IntegrityFlag label="Evidence-backed programs (ALMA)" ok={pack.integrity_flags.has_alma_interventions} />
        <IntegrityFlag label="Government funding received" ok={pack.integrity_flags.has_justice_funding} />
        <IntegrityFlag label="Government contracts held" ok={pack.integrity_flags.has_contracts} />
        <IntegrityFlag label="No political donations" ok={!pack.integrity_flags.has_donations} />
        <IntegrityFlag label="No donations + contracts overlap" ok={!pack.integrity_flags.donations_and_contracts_overlap} />
        <IntegrityFlag label="Serves disadvantaged area" ok={pack.integrity_flags.low_seifa} />
      </div>

      {/* Data Sources */}
      <SectionTitle>Data Sources &amp; Citation</SectionTitle>
      <ul className="text-xs text-bauhaus-muted mb-4 space-y-1">
        {pack.data_sources.map((src) => (
          <li key={src}>&bull; {src}</li>
        ))}
      </ul>
      <div className="bg-bauhaus-muted/5 border border-bauhaus-black/10 p-3 text-xs text-bauhaus-muted mb-8">
        {pack.citation}
      </div>

      {/* Footer */}
      <div className="border-t-4 border-bauhaus-black pt-4 mt-8">
        <div className="text-[11px] font-black text-bauhaus-black uppercase tracking-[0.15em]">
          CivicGraph — Decision Infrastructure for Government &amp; Social Sector
        </div>
        <p className="text-[10px] text-bauhaus-muted mt-1">
          This due diligence pack is auto-generated from public data sources. Verify critical claims against primary sources before inclusion in formal submissions.
        </p>
      </div>
    </div>
  );
}
