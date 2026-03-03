import { getServiceSupabase } from '@/lib/supabase';
import { TableOfContents } from './toc';
import {
  SizePyramidChart, GeographyCharts, PurposesChart, BeneficiariesChart,
  GrantMakersChart, PbiChart, WorkforceChart, TrendsChart,
  type SnapshotData,
} from './charts';

export const dynamic = 'force-dynamic';

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="bg-white border-4 border-bauhaus-black p-5 bauhaus-shadow-sm">
      <div className={`text-3xl sm:text-4xl font-black tabular-nums ${color || 'text-bauhaus-black'}`}>{value}</div>
      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-1">{label}</div>
    </div>
  );
}

function SectionHeading({ id, number, children }: { id: string; number: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl sm:text-3xl font-black text-bauhaus-black mt-16 mb-6 flex items-start gap-4 scroll-mt-24">
      <span className="text-bauhaus-red font-black text-lg mt-1">{number}</span>
      <span>{children}</span>
    </h2>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="text-base text-bauhaus-black/80 leading-relaxed font-medium space-y-4 max-w-[680px]">{children}</div>;
}

function Callout({ children, color = 'yellow' }: { children: React.ReactNode; color?: 'yellow' | 'red' | 'blue' }) {
  const bg = color === 'red' ? 'bg-bauhaus-red text-white' : color === 'blue' ? 'bg-bauhaus-blue text-white' : 'bg-bauhaus-yellow text-bauhaus-black';
  return (
    <blockquote className={`${bg} border-4 border-bauhaus-black p-6 my-8 bauhaus-shadow-sm`}>
      <div className="text-lg font-bold leading-relaxed">{children}</div>
    </blockquote>
  );
}

function formatB(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

type RpcResult = { data: unknown; error: { message: string; code: string } | null };

async function callRpc(supabase: ReturnType<typeof getServiceSupabase>, name: string): Promise<unknown[]> {
  const { data, error } = await supabase.rpc(name as never) as RpcResult;
  if (error) {
    console.error(`[charity-insights] RPC ${name} failed:`, error.message);
    return [];
  }
  return (data as unknown[]) || [];
}

async function getSnapshot(): Promise<SnapshotData> {
  const supabase = getServiceSupabase();

  // Run all RPCs in parallel — each returns [] on failure so partial data still renders
  const [bySize, byState, operatingStates, purposeCounts, beneficiaryCounts, pbiBySize, yearlyTrends, topGrantMakers] = await Promise.all([
    callRpc(supabase, 'charity_snapshot_by_size'),
    callRpc(supabase, 'charity_snapshot_by_state'),
    callRpc(supabase, 'charity_snapshot_operating_states'),
    callRpc(supabase, 'charity_snapshot_purposes'),
    callRpc(supabase, 'charity_snapshot_beneficiaries'),
    callRpc(supabase, 'charity_snapshot_pbi'),
    callRpc(supabase, 'charity_snapshot_trends'),
    callRpc(supabase, 'charity_snapshot_top_grant_makers'),
  ]);

  return {
    bySize: bySize as SnapshotData['bySize'],
    byState: byState as SnapshotData['byState'],
    operatingStates: operatingStates as SnapshotData['operatingStates'],
    purposeCounts: purposeCounts as SnapshotData['purposeCounts'],
    beneficiaryCounts: beneficiaryCounts as SnapshotData['beneficiaryCounts'],
    pbiBySize: pbiBySize as SnapshotData['pbiBySize'],
    yearlyTrends: yearlyTrends as SnapshotData['yearlyTrends'],
    topGrantMakers: topGrantMakers as SnapshotData['topGrantMakers'],
  };
}

export default async function CharityInsightsPage() {
  const snapshot = await getSnapshot();

  const totalCharities = snapshot.bySize.reduce((s, r) => s + r.count, 0);
  const totalRevenue = snapshot.bySize.reduce((s, r) => s + r.total_revenue, 0);
  const totalGrants = snapshot.bySize.reduce((s, r) => s + r.total_grants, 0);
  const totalPbi = snapshot.pbiBySize.reduce((s, r) => s + r.pbi_count, 0);
  const smallCount = snapshot.bySize.find(s => s.size === 'Small')?.count || 0;
  const largeRow = snapshot.bySize.find(s => s.size === 'Large');
  const largePct = largeRow ? ((largeRow.count / totalCharities) * 100).toFixed(0) : '10';
  const largeRevPct = largeRow && totalRevenue > 0 ? ((largeRow.total_revenue / totalRevenue) * 100).toFixed(1) : '90';

  const latest = snapshot.yearlyTrends[snapshot.yearlyTrends.length - 1];
  const earliest = snapshot.yearlyTrends[0];
  const revenueGrowth = earliest && latest ? Math.round(((latest.revenue - earliest.revenue) / earliest.revenue) * 100) : 0;

  // Reconciliation is typically the rarest purpose
  const reconciliationCount = snapshot.purposeCounts.find(p => p.purpose === 'Reconciliation')?.count || 0;
  const firstNationsCount = snapshot.beneficiaryCounts.find(b => b.beneficiary === 'First Nations')?.count || 0;
  const generalCommunityCount = snapshot.beneficiaryCounts.find(b => b.beneficiary === 'General Community')?.count || 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <a href="/charities" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; Charity Directory</a>
      </div>

      <header className="mb-12 border-b-4 border-bauhaus-black pb-12">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-3">Sector Analysis</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-bauhaus-black leading-[0.95] mb-6">
          The Anatomy of<br /><span className="text-bauhaus-blue">{totalCharities.toLocaleString()} Charities</span>
        </h1>
        <p className="text-lg text-bauhaus-muted font-medium max-w-2xl leading-relaxed mb-6">
          A comprehensive visualisation of Australia&apos;s registered charity sector &mdash;
          where money concentrates, who it serves, and what the numbers reveal about
          equity in our social infrastructure.
        </p>
        <div className="flex flex-wrap gap-4 text-xs font-black text-bauhaus-muted uppercase tracking-widest">
          <span>Source: ACNC Register + AIS Data</span>
          <span>|</span>
          <span>{totalCharities.toLocaleString()} charities</span>
          <span>|</span>
          <span>2017&ndash;2023</span>
        </div>
      </header>

      {/* Layout: TOC sidebar + content */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
        <TableOfContents />

        <article className="min-w-0">
          {/* Hero stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-12">
            <Stat value={totalCharities.toLocaleString()} label="Registered Charities" color="text-bauhaus-blue" />
            <Stat value={formatB(totalRevenue)} label="Total Revenue (2023)" />
            <Stat value={formatB(totalGrants)} label="Grants Distributed" color="text-money" />
            <Stat value={smallCount.toLocaleString()} label="Small Charities" />
            <Stat value={totalPbi.toLocaleString()} label="PBIs*" color="text-bauhaus-red" />
            <Stat value="16,000+" label="Grant-Makers" />
          </div>

          <p className="text-xs text-bauhaus-muted font-medium -mt-8 mb-12">
            *PBI = Public Benevolent Institution &mdash; charities that provide direct relief to people in need.
            PBIs receive the highest level of tax concession: donors can claim deductions (DGR status),
            and the charity gets FBT exemptions and GST concessions.
          </p>

          {/* ===== 01: SIZE PYRAMID ===== */}
          <SectionHeading id="size-pyramid" number="01">The Size Pyramid</SectionHeading>
          <Prose>
            <p>
              Australia&apos;s charity sector is shaped like a steep pyramid. <strong className="text-bauhaus-black">Large charities</strong> &mdash;
              just {largePct}% of all registered charities &mdash; control {largeRevPct}% of total revenue.
              The {smallCount.toLocaleString()} small charities that form the base of the pyramid share
              just {totalRevenue > 0 ? ((snapshot.bySize.find(s => s.size === 'Small')?.total_revenue || 0) / totalRevenue * 100).toFixed(1) : '0'}% of resources.
            </p>
            <p>
              This isn&apos;t just a scale difference. It&apos;s a structural feature that shapes
              who can access funding, who can afford compliance, and who ultimately
              survives in the sector.
            </p>
          </Prose>

          <Callout>
            {largePct}% of charities (Large) hold {largeRevPct}% of all revenue. The pyramid
            gets steeper every year.
          </Callout>

          <SizePyramidChart bySize={snapshot.bySize} />

          <div className="my-8 p-4 bg-bauhaus-canvas border-4 border-bauhaus-black">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Explore further</p>
            <a href="/reports/power-dynamics" className="text-sm font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">Power Dynamics Report &rarr;</a>
          </div>

          {/* ===== 02: GEOGRAPHY ===== */}
          <SectionHeading id="geography" number="02">Where the Money Goes</SectionHeading>
          <Prose>
            <p>
              Geography shapes everything. NSW and Victoria together account for the
              majority of registered charities and an even larger share of revenue.
              Meanwhile, the Northern Territory and Tasmania &mdash; where community need
              is often greatest &mdash; have the fewest charities and smallest revenue pools.
            </p>
            <p>
              The gap between <em>registered</em> state and <em>operating</em> state tells
              its own story. Many charities operate nationally from an eastern-seaboard headquarters,
              meaning the money flows through Sydney and Melbourne regardless of where the
              impact is needed.
            </p>
          </Prose>

          <GeographyCharts byState={snapshot.byState} operatingStates={snapshot.operatingStates} />

          <div className="my-8 p-4 bg-bauhaus-canvas border-4 border-bauhaus-black">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Explore further</p>
            <a href="/reports/community-parity" className="text-sm font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">Community Parity Report &rarr;</a>
          </div>

          {/* ===== 03: PURPOSES ===== */}
          <SectionHeading id="purposes" number="03">What Charities Do</SectionHeading>
          <Prose>
            <p>
              Every charity registers one or more charitable purposes with the ACNC.
              The distribution reveals clear patterns: <strong className="text-bauhaus-black">Religion</strong> is
              the most commonly registered purpose, while <strong className="text-bauhaus-red">Reconciliation</strong> is
              the rarest with only {reconciliationCount.toLocaleString()} charities &mdash; a telling signal
              about where the sector directs its collective attention.
            </p>
          </Prose>

          <Callout color="red">
            Only {reconciliationCount.toLocaleString()} charities list Reconciliation as a purpose.
            In a country still grappling with its colonial history, the sector&apos;s priorities
            are written in the data.
          </Callout>

          <PurposesChart purposeCounts={snapshot.purposeCounts} />

          <div className="my-8 p-4 bg-bauhaus-canvas border-4 border-bauhaus-black">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Explore further</p>
            <a href="/reports/community-parity" className="text-sm font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">Community Parity Report &rarr;</a>
          </div>

          {/* ===== 04: BENEFICIARIES ===== */}
          <SectionHeading id="beneficiaries" number="04">Who They Serve</SectionHeading>
          <Prose>
            <p>
              <strong className="text-bauhaus-black">General Community</strong> is by far the most commonly listed
              beneficiary ({generalCommunityCount.toLocaleString()} charities) &mdash; a broad category that
              reveals little about who actually benefits. At the other end, the groups with
              the most acute needs are served by the fewest charities.
            </p>
            <p>
              Only {firstNationsCount.toLocaleString()} charities list <strong className="text-bauhaus-red">First Nations
              people</strong> as beneficiaries. LGBTIQA+ communities, people at risk of homelessness,
              and pre/post-release populations are similarly underserved in the data.
            </p>
          </Prose>

          <BeneficiariesChart beneficiaryCounts={snapshot.beneficiaryCounts} />

          <div className="my-8 p-4 bg-bauhaus-canvas border-4 border-bauhaus-black">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Explore further</p>
            <a href="/reports/community-parity" className="text-sm font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">Community Parity Report &rarr;</a>
          </div>

          {/* ===== 05: GRANT-MAKERS ===== */}
          <SectionHeading id="grant-makers" number="05">The Grant-Making Ecosystem</SectionHeading>
          <Prose>
            <p>
              Over 16,000 charities distribute grants to other organisations or individuals.
              But the top 20 alone account for a disproportionate share of total grant-making.
              A striking finding: many of the largest grant-makers are <strong className="text-bauhaus-black">not
              foundations</strong> &mdash; they&apos;re universities, religious organisations, and
              government-funded service providers passing through money.
            </p>
            <p>
              The colour coding below reveals which top grant-makers are registered foundations
              versus other types of charities. The distinction matters because it changes
              who controls the allocation decisions.
            </p>
          </Prose>

          <GrantMakersChart topGrantMakers={snapshot.topGrantMakers} />

          <div className="my-8 p-4 bg-bauhaus-canvas border-4 border-bauhaus-black">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Explore further</p>
            <div className="flex gap-3 flex-wrap">
              <a href="/reports/money-flow" className="text-sm font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">Follow the Dollar &rarr;</a>
              <a href="/foundations" className="text-sm font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">All Foundations &rarr;</a>
            </div>
          </div>

          {/* ===== 06: PBI ===== */}
          <SectionHeading id="pbi" number="06">PBI &amp; Tax Deductibility</SectionHeading>
          <Prose>
            <p>
              <strong className="text-bauhaus-black">Public Benevolent Institutions (PBIs)</strong> enjoy the highest
              level of tax concession &mdash; donors can claim tax deductions, and the charity
              itself receives FBT exemptions. PBI status is the gold standard for fundraising.
            </p>
            <p>
              But who holds it? The data shows that large charities are disproportionately
              likely to have PBI status. This creates a self-reinforcing cycle: PBI status
              makes fundraising easier, which helps organisations grow, which makes them
              more likely to maintain PBI status.
            </p>
          </Prose>

          <PbiChart pbiBySize={snapshot.pbiBySize} />

          <div className="my-8 p-4 bg-bauhaus-canvas border-4 border-bauhaus-black">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Explore further</p>
            <a href="/reports/access-gap" className="text-sm font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">The Access Gap Report &rarr;</a>
          </div>

          {/* ===== 07: WORKFORCE ===== */}
          <SectionHeading id="workforce" number="07">The Workforce</SectionHeading>
          <Prose>
            <p>
              The workforce composition reveals the real operating model of each tier.
              <strong className="text-bauhaus-black"> Large charities</strong> are staff-heavy enterprises &mdash;
              they employ the vast majority of paid workers in the sector. <strong className="text-bauhaus-black">Small
              charities</strong> run on volunteers, with minimal paid staff.
            </p>
            <p>
              This isn&apos;t just a funding story. It&apos;s about who can offer careers,
              who can retain talent, and who must rely on the goodwill of unpaid labour
              to deliver critical community services.
            </p>
          </Prose>

          <Callout color="blue">
            Large charities employ {largeRow ? (largeRow.total_staff / 1000).toFixed(0) : '?'}K paid staff.
            Small charities have {snapshot.bySize.find(s => s.size === 'Small')
              ? ((snapshot.bySize.find(s => s.size === 'Small')?.total_volunteers || 0) / 1000).toFixed(0)
              : '?'}K volunteers
            keeping services running.
          </Callout>

          <WorkforceChart bySize={snapshot.bySize} />

          <div className="my-8 p-4 bg-bauhaus-canvas border-4 border-bauhaus-black">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Explore further</p>
            <a href="/reports/access-gap" className="text-sm font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">The Access Gap Report &rarr;</a>
          </div>

          {/* ===== 08: TRENDS ===== */}
          <SectionHeading id="trends" number="08">Seven-Year Trends</SectionHeading>
          <Prose>
            <p>
              Between 2017 and 2023, the sector&apos;s total revenue grew by <strong className="text-bauhaus-black">{revenueGrowth}%</strong> &mdash;
              from {formatB(earliest?.revenue || 0)} to {formatB(latest?.revenue || 0)}. Assets grew even
              faster, from {formatB(earliest?.assets || 0)} to {formatB(latest?.assets || 0)}.
            </p>
            <p>
              But grants distributed &mdash; the money that actually flows out to communities &mdash;
              grew from {formatB(earliest?.grants || 0)} to {formatB(latest?.grants || 0)}. As a share of
              revenue, grant-making has remained stubbornly flat. The sector is accumulating
              wealth faster than it&apos;s deploying it.
            </p>
          </Prose>

          <Callout>
            Revenue +{revenueGrowth}% over 7 years. Assets grew from {formatB(earliest?.assets || 0)} to {formatB(latest?.assets || 0)}.
            But grants as a share of revenue haven&apos;t budged.
          </Callout>

          <TrendsChart yearlyTrends={snapshot.yearlyTrends} />

          <div className="my-8 p-4 bg-bauhaus-canvas border-4 border-bauhaus-black">
            <p className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Explore further</p>
            <a href="/reports/big-philanthropy" className="text-sm font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">$222 Billion Report &rarr;</a>
          </div>

          {/* CTA links */}
          <div className="my-12 flex gap-4 flex-wrap">
            <a href="/reports" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-bauhaus-black text-white uppercase tracking-widest hover:bg-bauhaus-red border-4 border-bauhaus-black bauhaus-shadow-sm">
              All Reports &rarr;
            </a>
            <a href="/charities" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-white text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-canvas border-4 border-bauhaus-black bauhaus-shadow-sm">
              Search Charities &rarr;
            </a>
            <a href="/foundations" className="inline-flex items-center gap-2 px-6 py-3 font-black text-sm bg-white text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-canvas border-4 border-bauhaus-black bauhaus-shadow-sm">
              Explore Foundations &rarr;
            </a>
          </div>

          {/* Methodology */}
          <section className="border-t-4 border-bauhaus-black pt-8 mt-16">
            <h2 className="text-sm font-black text-bauhaus-black mb-4 uppercase tracking-widest">Methodology</h2>
            <div className="text-sm text-bauhaus-muted font-medium space-y-3 max-w-[680px] leading-relaxed">
              <p>
                <strong className="text-bauhaus-black">Data source:</strong> ACNC Charity Register
                ({totalCharities.toLocaleString()} charities) and Annual Information Statement (AIS) data
                for 2017&ndash;2023. Financial figures are from the most recent AIS filing for each charity.
              </p>
              <p>
                <strong className="text-bauhaus-black">Size tiers:</strong> Small (annual revenue under $250K),
                Medium ($250K&ndash;$1M), Large (over $1M). As defined by the ACNC.
              </p>
              <p>
                <strong className="text-bauhaus-black">Limitations:</strong> All data is self-reported by
                charities. Not all charities file every year. Financial figures for &ldquo;Unknown&rdquo;
                size charities (those without a recent AIS) are excluded from size-based analysis.
                Purposes and beneficiaries are self-selected categories.
              </p>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
