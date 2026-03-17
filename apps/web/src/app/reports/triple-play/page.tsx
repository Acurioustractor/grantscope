import type { Metadata } from 'next';
import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { ReportCTA } from '../_components/report-cta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Donate. Lobby. Win. Pay No Tax. | CivicGraph Investigation',
  description: 'The Triple Play: Australian entities that donate to politicians, lobby government, win contracts, and minimize tax. Cross-referenced across 5 public datasets.',
  openGraph: {
    title: 'Donate. Lobby. Win. Pay No Tax.',
    description: 'The Triple Play — cross-referencing AEC donations, AusTender contracts, lobbying registers, and ATO tax transparency data.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Donate. Lobby. Win. Pay No Tax.',
    description: 'The Triple Play — entities that donate, lobby, win contracts, and minimize tax.',
  },
};

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
function pct(n: number): string { return `${n.toFixed(1)}%`; }
function fmt(n: number): string { return n.toLocaleString(); }

interface TriplePlayEntity {
  gs_id: string;
  canonical_name: string;
  abn: string;
  entity_type: string;
  total_donated: number;
  donation_count: number;
  parties: string[];
  total_contracts: number;
  contract_count: number;
  departments: string[];
  total_income: number;
  taxable_income: number;
  tax_payable: number;
  effective_tax_rate: number;
  tax_years: number;
  is_lobbyist: boolean;
}

async function getData() {
  const supabase = getServiceSupabase();

  // Get all donor-contractors with tax data
  const { data: donorContractors } = await supabase
    .from('mv_gs_donor_contractors')
    .select('gs_id, canonical_name, abn, entity_type, total_donated, donation_count, parties_donated_to, total_contract_value, contract_count, government_buyers');

  if (!donorContractors?.length) return null;

  // Get tax data for all these ABNs — latest year per entity
  const abns = donorContractors.map(dc => dc.abn).filter(Boolean);
  const { data: taxData } = await supabase
    .from('ato_tax_transparency')
    .select('abn, total_income, taxable_income, tax_payable, report_year')
    .in('abn', abns)
    .order('report_year', { ascending: false });

  // Latest tax record per ABN
  const taxByAbn = new Map<string, { total_income: number; taxable_income: number; tax_payable: number; years: number }>();
  const taxYearCount = new Map<string, number>();
  for (const t of (taxData || [])) {
    taxYearCount.set(t.abn, (taxYearCount.get(t.abn) || 0) + 1);
    if (!taxByAbn.has(t.abn)) {
      taxByAbn.set(t.abn, {
        total_income: Number(t.total_income) || 0,
        taxable_income: Number(t.taxable_income) || 0,
        tax_payable: Number(t.tax_payable) || 0,
        years: 0,
      });
    }
  }
  for (const [abn, count] of taxYearCount) {
    const record = taxByAbn.get(abn);
    if (record) record.years = count;
  }

  // Check which are lobbying clients
  const { data: lobbyEntities } = await supabase
    .from('gs_entities')
    .select('canonical_name')
    .like('gs_id', 'AU-LOBBY%')
    .limit(1000);

  const lobbyNames = new Set((lobbyEntities || []).map(e => e.canonical_name?.toLowerCase().split(' ').slice(0, 2).join(' ')));

  // Build triple play entities
  const entities: TriplePlayEntity[] = donorContractors.map(dc => {
    const tax = taxByAbn.get(dc.abn);
    const namePrefix = dc.canonical_name?.toLowerCase().split(' ').slice(0, 2).join(' ') || '';
    const isLobbyist = lobbyNames.has(namePrefix);

    return {
      gs_id: dc.gs_id,
      canonical_name: dc.canonical_name,
      abn: dc.abn,
      entity_type: dc.entity_type,
      total_donated: Number(dc.total_donated) || 0,
      donation_count: dc.donation_count,
      parties: dc.parties_donated_to || [],
      total_contracts: Number(dc.total_contract_value) || 0,
      contract_count: dc.contract_count,
      departments: dc.government_buyers || [],
      total_income: tax?.total_income || 0,
      taxable_income: tax?.taxable_income || 0,
      tax_payable: tax?.tax_payable || 0,
      effective_tax_rate: tax && tax.total_income > 0 ? (tax.tax_payable / tax.total_income) * 100 : -1,
      tax_years: tax?.years || 0,
      is_lobbyist: isLobbyist,
    };
  });

  // Filter to entities with tax data
  const withTax = entities.filter(e => e.tax_years > 0);
  const withLobby = entities.filter(e => e.is_lobbyist);
  const triplePlay = withTax.filter(e => e.is_lobbyist);

  // Low-tax donor-contractors (effective rate < 10%)
  const lowTax = withTax
    .filter(e => e.effective_tax_rate >= 0 && e.effective_tax_rate < 10 && e.total_income > 1000000)
    .sort((a, b) => a.effective_tax_rate - b.effective_tax_rate);

  // Highest contract value with lowest tax
  const bigContractLowTax = withTax
    .filter(e => e.effective_tax_rate >= 0 && e.total_contracts > 1000000)
    .sort((a, b) => {
      // Score: high contracts + low tax rate
      const scoreA = a.total_contracts * (1 / Math.max(a.effective_tax_rate, 0.1));
      const scoreB = b.total_contracts * (1 / Math.max(b.effective_tax_rate, 0.1));
      return scoreB - scoreA;
    });

  // Aggregate stats
  const totalDonated = entities.reduce((s, e) => s + e.total_donated, 0);
  const totalContracts = entities.reduce((s, e) => s + e.total_contracts, 0);
  const avgTaxRate = withTax.filter(e => e.effective_tax_rate >= 0).reduce((s, e) => s + e.effective_tax_rate, 0) /
    (withTax.filter(e => e.effective_tax_rate >= 0).length || 1);

  return {
    all: entities,
    withTax,
    withLobby,
    triplePlay,
    lowTax,
    bigContractLowTax,
    stats: {
      totalEntities: entities.length,
      withTaxCount: withTax.length,
      withLobbyCount: withLobby.length,
      triplePlayCount: triplePlay.length,
      totalDonated,
      totalContracts,
      avgTaxRate,
      lowTaxCount: lowTax.length,
    },
  };
}

export default async function TriplePlayReport() {
  const d = await getData();
  if (!d) return <div className="p-8 text-bauhaus-muted">No data available.</div>;

  const s = d.stats;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Cross-Dataset Investigation</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Donate. Lobby. Win. Pay No Tax.
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          {s.totalEntities} entities donate to political parties AND hold government contracts.
          Of these, {s.withTaxCount} appear in ATO tax transparency data with an average effective
          tax rate of {pct(s.avgTaxRate)}. {s.lowTaxCount} pay less than 10% effective tax on income over $1M.
          {s.withLobbyCount > 0 && ` ${s.withLobbyCount} also appear in the lobbying register.`}
          {s.triplePlayCount > 0 && ` ${s.triplePlayCount} do all three: donate, lobby, and win contracts.`}
        </p>
        <div className="mt-4 text-xs text-bauhaus-muted font-bold">
          Data updated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Hero stats — four columns */}
      <section className="mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">Donated</div>
            <div className="text-3xl sm:text-4xl font-black">{money(s.totalDonated)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">to political parties</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 border-bauhaus-black p-6 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Won</div>
            <div className="text-3xl sm:text-4xl font-black">{money(s.totalContracts)}</div>
            <div className="text-white/50 text-xs font-bold mt-2">in government contracts</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-white">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Avg Tax Rate</div>
            <div className="text-3xl sm:text-4xl font-black text-bauhaus-red">{pct(s.avgTaxRate)}</div>
            <div className="text-bauhaus-muted/60 text-xs font-bold mt-2">effective rate on income</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-6 bg-bauhaus-blue text-white">
            <div className="text-xs font-black text-blue-200 uppercase tracking-widest mb-2">Low-Tax</div>
            <div className="text-3xl sm:text-4xl font-black">{s.lowTaxCount}</div>
            <div className="text-white/50 text-xs font-bold mt-2">pay &lt;10% effective tax</div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: AEC political donations × AusTender contracts × ATO tax transparency × lobbying register.
            All cross-referenced by ABN.
          </p>
        </div>
      </section>

      {/* Low-tax donor-contractors */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          Win Big, Pay Little
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Entities that donate to political parties, win government contracts worth millions,
          and pay less than 10% effective tax rate on their income. Sorted by effective tax rate.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-red text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contract Value</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Donated</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Income</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Tax Rate</th>
              </tr>
            </thead>
            <tbody>
              {d.lowTax.slice(0, 30).map((e, i) => (
                <tr key={e.gs_id} className={i % 2 === 0 ? 'bg-white' : 'bg-red-50/30'}>
                  <td className="p-3">
                    <Link href={`/entities/${e.gs_id}`} className="hover:text-bauhaus-red transition-colors">
                      <div className="font-bold text-bauhaus-black">{e.canonical_name}</div>
                      <div className="text-xs text-bauhaus-muted">
                        {e.entity_type} &middot; ABN {e.abn}
                        {e.is_lobbyist && <span className="ml-2 text-bauhaus-red font-black">LOBBY</span>}
                      </div>
                    </Link>
                  </td>
                  <td className="p-3 text-right font-mono font-black whitespace-nowrap">{money(e.total_contracts)}</td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red whitespace-nowrap">{money(e.total_donated)}</td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell whitespace-nowrap">{money(e.total_income)}</td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red whitespace-nowrap">
                    {e.effective_tax_rate >= 0 ? pct(e.effective_tax_rate) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ReportCTA reportSlug="triple-play" reportTitle="Donate. Lobby. Win. Pay No Tax." variant="inline" />

      {/* Biggest contracts, lowest tax */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">
          The Extraction Engine
        </h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          The 20 entities extracting the most public value relative to their tax contribution.
          Ranked by contract value weighted against inverse tax rate — higher contracts and lower tax rates score higher.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs w-8">#</th>
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Entity</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contracts</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Donated</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Tax Rate</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs hidden sm:table-cell">Parties</th>
              </tr>
            </thead>
            <tbody>
              {d.bigContractLowTax.slice(0, 20).map((e, i) => (
                <tr key={e.gs_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="p-3">
                    <Link href={`/entities/${e.gs_id}`} className="hover:text-bauhaus-red transition-colors">
                      <div className="font-bold text-bauhaus-black">{e.canonical_name}</div>
                      <div className="text-xs text-bauhaus-muted">
                        {e.entity_type}
                        {e.is_lobbyist && <span className="ml-2 text-bauhaus-red font-black">LOBBY</span>}
                      </div>
                    </Link>
                  </td>
                  <td className="p-3 text-right font-mono font-black whitespace-nowrap">{money(e.total_contracts)}</td>
                  <td className="p-3 text-right font-mono font-black text-bauhaus-red whitespace-nowrap hidden sm:table-cell">{money(e.total_donated)}</td>
                  <td className="p-3 text-right font-mono font-black whitespace-nowrap">
                    <span className={e.effective_tax_rate < 10 ? 'text-bauhaus-red' : ''}>
                      {pct(e.effective_tax_rate)}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono hidden sm:table-cell">{e.parties.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* The System Diagram */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white">
          <h2 className="text-lg font-black mb-6 text-bauhaus-yellow uppercase tracking-widest">How The Triple Play Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">1</div>
              <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Donate</div>
              <p className="text-sm text-white/70">
                Donate to political parties on both sides.
                {money(s.totalDonated)} across {s.totalEntities} entities.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">2</div>
              <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Lobby</div>
              <p className="text-sm text-white/70">
                Employ lobbyists to advocate for policy and procurement decisions.
                {s.withLobbyCount} donor-contractors on the lobbying register.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">3</div>
              <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Win</div>
              <p className="text-sm text-white/70">
                Win government contracts.
                {money(s.totalContracts)} in public procurement from {s.totalEntities} entities.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">4</div>
              <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Minimize</div>
              <p className="text-sm text-white/70">
                Pay minimal tax on the income.
                Average effective rate: {pct(s.avgTaxRate)}. {s.lowTaxCount} pay under 10%.
              </p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/20 text-center">
            <p className="text-sm text-white/50 max-w-2xl mx-auto">
              Each step is legal. Each dataset is public. Nobody had connected them before.
              CivicGraph cross-references AEC donations, the lobbying register, AusTender contracts,
              and ATO tax transparency — all linked by ABN — to reveal the system as a whole.
            </p>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <h2 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest">Methodology</h2>
          <div className="text-sm text-bauhaus-muted leading-relaxed space-y-3 max-w-3xl">
            <p>
              <strong>Matching:</strong> Entities are matched across datasets using Australian Business Number (ABN).
              Donation records without ABNs are resolved via exact name matching, normalized name matching
              (stripping &quot;Pty Ltd&quot;, &quot;Limited&quot;, etc.), and alias resolution.
            </p>
            <p>
              <strong>Tax rate:</strong> Effective tax rate = tax payable / total income.
              This uses the latest year available in ATO tax transparency data.
              A low effective tax rate is not inherently improper — it may reflect legitimate deductions,
              R&D credits, carry-forward losses, or offshore income structures.
            </p>
            <p>
              <strong>Lobbying:</strong> Lobbying connections are identified by matching entity names against
              the Australian Government Lobbying Register. This is approximate — some matches may be
              coincidental name overlaps.
            </p>
            <p>
              <strong>Correlation, not causation:</strong> This report shows that certain entities participate
              in political donations, lobbying, government procurement, and tax minimization simultaneously.
              It does not claim that donations cause contract awards or that lobbying influences procurement decisions.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-red p-8 bg-bauhaus-red/5 text-center">
          <h2 className="text-lg font-black text-bauhaus-black mb-2">See the Full Dossier</h2>
          <p className="text-sm text-bauhaus-muted mb-4 max-w-xl mx-auto">
            Every entity in this report has a complete profile — political donations by party,
            government contracts by department, ATO tax data, lobbying connections, and cross-registry identity matches.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/reports/donor-contractors"
              className="inline-block px-8 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
            >
              Donor-Contractor Report
            </Link>
            <Link
              href="/entities"
              className="inline-block px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
            >
              Entity Graph
            </Link>
          </div>
        </div>
      </section>

      <ReportCTA reportSlug="triple-play" reportTitle="Donate. Lobby. Win. Pay No Tax." />
    </div>
  );
}
