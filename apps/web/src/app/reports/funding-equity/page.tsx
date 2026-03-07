import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function fmt(n: number) { return n.toLocaleString(); }
function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
function pct(n: number, d: number) { return d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0%'; }

interface DecileRow {
  irsd_decile: number;
  disadvantage_group: string;
  charity_count: number;
  total_income: number;
  govt_revenue: number;
  donations: number;
  total_expenses: number;
  avg_income: number;
  avg_govt_revenue: number;
  avg_staff_fte: number;
  total_volunteers: number;
}

interface IndigenousRow {
  irsd_decile: number;
  disadvantage_group: string;
  charity_count: number;
  total_income: number;
  govt_revenue: number;
  donations: number;
  avg_income: number;
  avg_govt_revenue: number;
  avg_staff_fte: number;
}

interface DonorRow {
  donor_name: string;
  donor_abn: string;
  total_donated: number;
  donation_count: number;
  parties_donated_to: string;
  name_variants: number;
  contract_count: number;
  total_contract_value: number;
  buyers: string | null;
}

async function getData() {
  const supabase = getServiceSupabase();

  const [
    { data: decileData },
    { data: indigenousData },
    { data: donorData },
    { count: donationCount },
    { count: seifaCount },
    { count: postcodeCount },
  ] = await Promise.all([
    supabase.from('mv_funding_by_disadvantage').select('*').order('irsd_decile'),
    supabase.from('mv_indigenous_funding_by_disadvantage').select('*').order('irsd_decile'),
    supabase.from('mv_donor_contract_crossref').select('*').order('total_donated', { ascending: false }).limit(20),
    supabase.from('political_donations').select('*', { count: 'exact', head: true }),
    supabase.from('seifa_2021').select('*', { count: 'exact', head: true }).eq('index_type', 'IRSD'),
    supabase.from('postcode_geo').select('*', { count: 'exact', head: true }),
  ]);

  const deciles = (decileData || []) as DecileRow[];
  const indigenous = (indigenousData || []) as IndigenousRow[];
  const donors = (donorData || []) as DonorRow[];

  // Compute grouped stats
  const totalIncome = deciles.reduce((s, d) => s + Number(d.total_income), 0);
  const totalGovt = deciles.reduce((s, d) => s + Number(d.govt_revenue), 0);
  const totalCharities = deciles.reduce((s, d) => s + Number(d.charity_count), 0);

  const groups = [
    { label: 'Most Disadvantaged (1-3)', deciles: deciles.filter(d => d.irsd_decile <= 3) },
    { label: 'Middle (4-7)', deciles: deciles.filter(d => d.irsd_decile >= 4 && d.irsd_decile <= 7) },
    { label: 'Least Disadvantaged (8-10)', deciles: deciles.filter(d => d.irsd_decile >= 8) },
  ].map(g => ({
    label: g.label,
    charities: g.deciles.reduce((s, d) => s + Number(d.charity_count), 0),
    income: g.deciles.reduce((s, d) => s + Number(d.total_income), 0),
    govt: g.deciles.reduce((s, d) => s + Number(d.govt_revenue), 0),
    donations: g.deciles.reduce((s, d) => s + Number(d.donations), 0),
    avgIncome: g.deciles.length > 0
      ? g.deciles.reduce((s, d) => s + Number(d.total_income), 0) / g.deciles.reduce((s, d) => s + Number(d.charity_count), 0)
      : 0,
  }));

  // Indigenous grouped
  const indigenousGroups = [
    { label: 'Most Disadvantaged (1-3)', deciles: indigenous.filter(d => d.irsd_decile <= 3) },
    { label: 'Middle (4-7)', deciles: indigenous.filter(d => d.irsd_decile >= 4 && d.irsd_decile <= 7) },
    { label: 'Least Disadvantaged (8-10)', deciles: indigenous.filter(d => d.irsd_decile >= 8) },
  ].map(g => ({
    label: g.label,
    charities: g.deciles.reduce((s, d) => s + Number(d.charity_count), 0),
    avgIncome: g.deciles.length > 0
      ? g.deciles.reduce((s, d) => s + Number(d.total_income), 0) / g.deciles.reduce((s, d) => s + Number(d.charity_count), 0)
      : 0,
    avgGovt: g.deciles.length > 0
      ? g.deciles.reduce((s, d) => s + Number(d.govt_revenue), 0) / g.deciles.reduce((s, d) => s + Number(d.charity_count), 0)
      : 0,
  }));

  return {
    deciles,
    groups,
    indigenousGroups,
    donors,
    totalIncome,
    totalGovt,
    totalCharities,
    donationCount: donationCount || 0,
    seifaCount: seifaCount || 0,
    postcodeCount: postcodeCount || 0,
  };
}

export default async function FundingEquityPage() {
  const d = await getData();

  const bottomPct = d.totalIncome > 0 ? ((d.groups[0]?.income || 0) / d.totalIncome * 100).toFixed(1) : '0';
  const topPct = d.totalIncome > 0 ? ((d.groups[2]?.income || 0) / d.totalIncome * 100).toFixed(1) : '0';
  const gapRatio = d.groups[0]?.avgIncome && d.groups[2]?.avgIncome
    ? (d.groups[2].avgIncome / d.groups[0].avgIncome).toFixed(1)
    : '0';

  const indigenousGapRatio = d.indigenousGroups[0]?.avgIncome && d.indigenousGroups[2]?.avgIncome
    ? (d.indigenousGroups[2].avgIncome / d.indigenousGroups[0].avgIncome).toFixed(1)
    : '0';

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Live Investigation</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Funding Equity: Who Gets What
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          The most disadvantaged communities get {bottomPct}% of charity funding.
          The least disadvantaged get {topPct}%. For the first time, we connected SEIFA
          disadvantage data to charity financial records to measure the gap.
        </p>
      </div>

      {/* Hero Stats */}
      <section className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-red text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Most Disadvantaged Postcodes</div>
            <div className="text-4xl sm:text-5xl font-black">{bottomPct}%</div>
            <div className="text-white/60 text-sm font-bold mt-2">of total charity income</div>
            <div className="text-white/40 text-xs font-bold mt-1">{fmt(d.groups[0]?.charities || 0)} charities</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-8 bg-bauhaus-black text-white">
            <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">The Gap</div>
            <div className="text-4xl sm:text-5xl font-black">{gapRatio}x</div>
            <div className="text-white/60 text-sm font-bold mt-2">less per charity in disadvantaged areas</div>
            <div className="text-white/40 text-xs font-bold mt-1">{money(d.groups[0]?.avgIncome || 0)} vs {money(d.groups[2]?.avgIncome || 0)}</div>
          </div>
          <div className="border-4 border-l-0 max-md:border-l-4 max-md:border-t-0 border-bauhaus-black p-8 bg-bauhaus-blue text-white">
            <div className="text-xs font-black text-blue-200 uppercase tracking-widest mb-2">Least Disadvantaged Postcodes</div>
            <div className="text-4xl sm:text-5xl font-black">{topPct}%</div>
            <div className="text-white/60 text-sm font-bold mt-2">of total charity income</div>
            <div className="text-white/40 text-xs font-bold mt-1">{fmt(d.groups[2]?.charities || 0)} charities</div>
          </div>
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas text-center">
          <p className="text-sm text-bauhaus-muted font-bold">
            Source: {fmt(d.totalCharities)} charities matched to {fmt(d.seifaCount)} SEIFA IRSD postcodes.
            ABS Census 2021 disadvantage index. ACNC Annual Information Statement financial data.
          </p>
        </div>
      </section>

      {/* Decile Breakdown */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Funding by Disadvantage Decile</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Every postcode in Australia is assigned a SEIFA IRSD decile (1 = most disadvantaged, 10 = least).
          We matched each charity&apos;s registered postcode to its decile and summed their financial data.
        </p>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Decile</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Charities</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total Income</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Govt Revenue</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Donations</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {d.deciles.map((row, i) => {
                const incomePct = d.totalIncome > 0 ? (Number(row.total_income) / d.totalIncome * 100).toFixed(1) : '0';
                const isBottom = row.irsd_decile <= 3;
                const isTop = row.irsd_decile >= 8;
                return (
                  <tr key={row.irsd_decile} className={isBottom ? 'bg-red-50' : isTop ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3">
                      <span className={`font-black ${isBottom ? 'text-bauhaus-red' : isTop ? 'text-bauhaus-blue' : 'text-bauhaus-black'}`}>
                        {row.irsd_decile}
                      </span>
                      <span className="text-bauhaus-muted text-xs ml-2">
                        {isBottom ? '← disadvantaged' : isTop ? '← advantaged' : ''}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">{fmt(Number(row.charity_count))}</td>
                    <td className="p-3 text-right font-mono font-bold">{money(Number(row.total_income))}</td>
                    <td className="p-3 text-right font-mono">{money(Number(row.govt_revenue))}</td>
                    <td className="p-3 text-right font-mono">{money(Number(row.donations))}</td>
                    <td className="p-3 text-right font-mono font-black">{incomePct}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-bauhaus-black text-white font-black">
                <td className="p-3">Total</td>
                <td className="p-3 text-right font-mono">{fmt(d.totalCharities)}</td>
                <td className="p-3 text-right font-mono">{money(d.totalIncome)}</td>
                <td className="p-3 text-right font-mono">{money(d.totalGovt)}</td>
                <td className="p-3 text-right font-mono">{money(d.deciles.reduce((s, r) => s + Number(r.donations), 0))}</td>
                <td className="p-3 text-right font-mono">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* The Story in Numbers */}
      <section className="mb-12">
        <div className="border-4 border-bauhaus-red p-8 bg-bauhaus-red/5">
          <h2 className="text-lg font-black text-bauhaus-red mb-4 uppercase tracking-widest">What the Numbers Mean</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-black text-bauhaus-black mb-2">Fewer charities where need is greatest</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed">
                The most disadvantaged 30% of postcodes have just {fmt(d.groups[0]?.charities || 0)} charities
                ({d.totalCharities > 0 ? ((d.groups[0]?.charities || 0) / d.totalCharities * 100).toFixed(0) : 0}% of total).
                The least disadvantaged 30% have {fmt(d.groups[2]?.charities || 0)}
                ({d.totalCharities > 0 ? ((d.groups[2]?.charities || 0) / d.totalCharities * 100).toFixed(0) : 0}%).
                The places that need the most help have the fewest organisations.
              </p>
            </div>
            <div>
              <h3 className="font-black text-bauhaus-black mb-2">Government funding follows wealth</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed">
                Average government revenue per charity: {money(d.groups[0]?.charities ? d.groups[0].govt / d.groups[0].charities : 0)} in
                disadvantaged areas vs {money(d.groups[2]?.charities ? d.groups[2].govt / d.groups[2].charities : 0)} in
                advantaged areas. Government money flows{' '}
                {d.groups[0]?.charities && d.groups[2]?.charities
                  ? ((d.groups[2].govt / d.groups[2].charities) / (d.groups[0].govt / d.groups[0].charities) * 100 - 100).toFixed(0)
                  : '0'}% more per charity to wealthy postcodes.
              </p>
            </div>
            <div>
              <h3 className="font-black text-bauhaus-black mb-2">Donations are the most skewed</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed">
                Total donations to disadvantaged postcodes: {money(d.groups[0]?.donations || 0)}.
                To advantaged postcodes: {money(d.groups[2]?.donations || 0)}.
                That&apos;s a {d.groups[0]?.donations && d.groups[2]?.donations
                  ? (d.groups[2].donations / d.groups[0].donations).toFixed(1) : '—'}x gap.
                Private giving concentrates in areas that are already well-served.
              </p>
            </div>
            <div>
              <h3 className="font-black text-bauhaus-black mb-2">The structural explanation</h3>
              <p className="text-sm text-bauhaus-muted leading-relaxed">
                Large national charities are headquartered in affluent metro postcodes (Sydney CBD, Melbourne inner suburbs)
                but serve communities nationally. Their income inflates the &ldquo;advantaged&rdquo; postcode totals.
                This doesn&apos;t invalidate the pattern — it IS the pattern. Money pools where power is, not where need is.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Indigenous-Serving Charities */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Indigenous-Serving Charities</h2>
        <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
          Charities that list Aboriginal and Torres Strait Islander peoples as beneficiaries.
          The funding gap is even wider than the sector average.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {d.indigenousGroups.map((g, i) => {
            const colors = ['bg-bauhaus-red text-white', 'bg-bauhaus-black text-white', 'bg-bauhaus-blue text-white'];
            const labelColors = ['text-bauhaus-yellow', 'text-bauhaus-yellow', 'text-blue-200'];
            return (
              <div key={g.label} className={`border-4 ${i > 0 ? 'border-l-0 max-md:border-l-4 max-md:border-t-0' : ''} border-bauhaus-black p-6 ${colors[i]}`}>
                <div className={`text-xs font-black ${labelColors[i]} uppercase tracking-widest mb-3`}>
                  {g.label}
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-2xl font-black">{fmt(g.charities)}</div>
                    <div className="text-white/60 text-xs">charities</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black">{money(g.avgIncome)}</div>
                    <div className="text-white/60 text-xs">avg income per charity</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black">{money(g.avgGovt)}</div>
                    <div className="text-white/60 text-xs">avg govt funding per charity</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black p-6 bg-bauhaus-canvas">
          <p className="text-sm font-black text-bauhaus-red">
            Indigenous-serving charities in disadvantaged postcodes earn {indigenousGapRatio}x less
            than those in advantaged postcodes. Government funding per charity is{' '}
            {money(d.indigenousGroups[0]?.avgGovt || 0)} vs {money(d.indigenousGroups[2]?.avgGovt || 0)} —
            a {d.indigenousGroups[0]?.avgGovt && d.indigenousGroups[2]?.avgGovt
              ? (d.indigenousGroups[2].avgGovt / d.indigenousGroups[0].avgGovt).toFixed(1)
              : '—'}x gap. The organisations closest to community receive the least.
          </p>
        </div>
      </section>

      {/* Political Donations */}
      {d.donors.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Political Donations &amp; Government Contracts</h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            Cross-referencing {fmt(d.donationCount)} AEC political donation records with AusTender
            federal procurement data. When donors also receive government contracts, the relationship
            between money and power becomes visible.
          </p>
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Donor</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Donated</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Parties</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Govt Contracts</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Contract Value</th>
                </tr>
              </thead>
              <tbody>
                {d.donors.map((row, i) => {
                  const ratio = Number(row.total_contract_value) > 0 && Number(row.total_donated) > 0
                    ? (Number(row.total_contract_value) / Number(row.total_donated)).toFixed(0)
                    : null;
                  return (
                    <tr key={`${row.donor_abn}-${row.donor_name}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3">
                        <div className="font-bold text-bauhaus-black">{row.donor_name}</div>
                        <div className="text-xs text-bauhaus-muted font-mono">
                          ABN {row.donor_abn} · {fmt(Number(row.donation_count))} donations
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono font-bold">{money(Number(row.total_donated))}</td>
                      <td className="p-3 text-right text-xs text-bauhaus-muted max-w-[200px] truncate" title={row.parties_donated_to || ''}>
                        {row.parties_donated_to ? row.parties_donated_to.split(', ').length : 0}
                      </td>
                      <td className="p-3 text-right font-mono">{Number(row.contract_count) > 0 ? fmt(Number(row.contract_count)) : '—'}</td>
                      <td className="p-3 text-right font-mono font-black">
                        {Number(row.total_contract_value) > 0 ? (
                          <span>
                            {money(Number(row.total_contract_value))}
                            {ratio && <span className="text-bauhaus-red text-xs ml-1">({ratio}x)</span>}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-4 border-t-0 border-bauhaus-black p-4 bg-bauhaus-canvas">
            <p className="text-xs text-bauhaus-muted">
              ABN-based matching between AEC Transparency Register and AusTender procurement data.
              5,361 donor entities resolved to ABNs via normalised name matching against ASIC and ACNC registers.
              279 donors also hold government contracts. Ratio shows contract value per dollar donated.
              Correlation does not imply causation, but transparency demands the question be asked.
            </p>
          </div>
        </section>
      )}

      {/* Methodology */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-black p-6 bg-white">
          <h2 className="text-sm font-black text-bauhaus-black mb-3 uppercase tracking-widest">Methodology</h2>
          <div className="text-sm text-bauhaus-muted space-y-2">
            <p>
              <span className="font-black text-bauhaus-black">Disadvantage index:</span>{' '}
              ABS SEIFA IRSD (Index of Relative Socio-Economic Disadvantage), 2021 Census.
              {fmt(d.seifaCount)} postcodes scored. Decile 1 = most disadvantaged 10% of postcodes nationally.
            </p>
            <p>
              <span className="font-black text-bauhaus-black">Charity financials:</span>{' '}
              ACNC Annual Information Statement data (most recent reporting year).
              Charities matched by registered postcode to SEIFA decile.
            </p>
            <p>
              <span className="font-black text-bauhaus-black">Political donations:</span>{' '}
              AEC Transparency Register ({fmt(d.donationCount)} records, 1998-2025).
              Donor ABNs resolved via normalized name matching against 2.1M ASIC company records
              and 64,000 ACNC charity records. Cross-referenced with AusTender procurement data
              to identify donors who also hold government contracts.
            </p>
            <p>
              <span className="font-black text-bauhaus-black">Postcode coordinates:</span>{' '}
              {fmt(d.postcodeCount)} Australian postcode centroids from Matthew Proctor&apos;s
              open-source database, with SA2/SA3/SA4 geographic hierarchy and remoteness classification.
            </p>
            <p>
              <span className="font-black text-bauhaus-black">Limitations:</span>{' '}
              Charity postcode reflects registered address, not service delivery area.
              Large national charities headquartered in affluent postcodes inflate those deciles.
              This is itself a finding: institutional power concentrates geographically.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
