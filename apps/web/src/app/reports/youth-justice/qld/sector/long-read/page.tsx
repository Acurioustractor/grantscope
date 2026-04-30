import Link from 'next/link';
import { headers } from 'next/headers';
import { getLiveReportSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';
import {
  ReportSection, ReportToc, Finding, SourceLink, SourcesPanel, PullQuote, StatStrip, ModeToggle,
} from '@/components/reports/long-read';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'QLD Youth Justice — The Federation Doesn\'t Want You To Read This · CivicGraph',
  description: "Live watchhouse data, $1.88B in detention spend, 91% First Nations children — what Queensland's youth-justice system actually looks like, sourced and citation-grade.",
};

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

async function getNumbers() {
  const supabase = getLiveReportSupabase();
  const [latest, spend, partners, alma] = await Promise.all([
    safe(supabase.rpc('exec_sql', {
      query: `SELECT total_people, total_adults, total_children,
                     child_first_nations, child_over_7_days, child_3_7_days, child_longest_days,
                     adult_first_nations, adult_over_7_days, adult_longest_days, child_watchhouse_count,
                     source_generated_at::text
              FROM public.v_qld_watchhouse_latest LIMIT 1`,
    })) as Promise<Array<{ total_people: number; total_adults: number; total_children: number; child_first_nations: number; child_over_7_days: number; child_3_7_days: number; child_longest_days: number; adult_first_nations: number; adult_over_7_days: number; adult_longest_days: number; child_watchhouse_count: number; source_generated_at: string }> | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT recipient_name, SUM(amount_dollars)::bigint AS total
              FROM public.justice_funding
              WHERE state = 'QLD' AND recipient_name LIKE 'Youth Justice -%'
              GROUP BY 1`,
    })) as Promise<Array<{ recipient_name: string; total: number }> | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT COUNT(*)::int AS total_recipients, SUM(amount_dollars)::bigint AS total_dollars
              FROM public.justice_funding WHERE state = 'QLD' AND topics @> ARRAY['youth-justice']`,
    })) as Promise<Array<{ total_recipients: number; total_dollars: number }> | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT COUNT(*)::int FROM public.alma_interventions
              WHERE ('QLD' = ANY(geography) OR 'Queensland' = ANY(geography))
                AND (topics @> ARRAY['youth-justice'] OR type ILIKE '%diversion%' OR type ILIKE '%justice%')`,
    })) as Promise<Array<{ count: number }> | null>,
  ]);

  const l = latest?.[0] || null;
  const detention = (spend ?? []).find(s => /detention/i.test(s.recipient_name))?.total || 0;
  const community = (spend ?? []).find(s => /community/i.test(s.recipient_name))?.total || 0;
  const groupConferencing = (spend ?? []).find(s => /group conferencing/i.test(s.recipient_name))?.total || 0;
  return {
    l, detention, community, groupConferencing,
    partnersCount: partners?.[0]?.total_recipients ?? 0,
    partnersTotal: partners?.[0]?.total_dollars ?? 0,
    almaCount: alma?.[0]?.count ?? 0,
  };
}

export default async function QldYjLongRead({ mode = 'full' }: { mode?: 'full' | 'share' } = {}) {
  const isShare = mode === 'share';
  const r = await getNumbers();
  const fnPctChild = r.l && r.l.total_children > 0 ? Math.round((r.l.child_first_nations / r.l.total_children) * 100) : 0;
  const detentionRatio = r.community > 0 ? (r.detention / r.community).toFixed(2) : '—';
  const total = r.detention + r.community + r.groupConferencing;
  const childOver2 = r.l ? r.l.child_3_7_days + r.l.child_over_7_days : 0;

  const toc = [
    { id: 'summary', label: 'Executive Summary' },
    { id: 'lead', label: "Right now: kids in adult cells" },
    { id: 'spend', label: '$1.88B in detention vs $1.49B community' },
    { id: 'partners', label: "Where the community money actually goes" },
    { id: 'evidence', label: "What the evidence says works" },
    { id: 'fix', label: "What it would take to shift this" },
    { id: 'sources', label: 'Sources' },
  ];

  const sources = [
    { id: 'src-qps-watchhouse', label: 'Queensland Police Service — Persons Currently In Watchhouse Custody (PDF, refreshed daily)', href: 'https://www.police.qld.gov.au/qps-corporate-documents/reports-and-publications/watch-house-data', type: 'Govt' },
    { id: 'src-qld-budget-yj', label: 'QLD State Budget — Youth Justice and Victim Support service-delivery statements', href: 'https://budget.qld.gov.au/', type: 'Govt' },
    { id: 'src-acnc', label: 'ACNC Charity Register data on data.gov.au (recipient governance + financials)', href: 'https://data.gov.au/dataset/ds-dga-b050b242-4487-4306-abf5-07ca073e5594', type: 'Govt Open Data' },
    { id: 'src-alma', label: 'Australian Living Map of Alternatives (ALMA) — community-endorsed and evaluated interventions', href: 'https://justicereinvestment.net.au/', type: 'Civil Society' },
    { id: 'src-justice-reinvestment', label: 'Justice Reinvestment Network Australia — sector resources', href: 'https://justicereinvestment.net.au/', type: 'Civil Society' },
    { id: 'src-closing-the-gap', label: 'Closing the Gap — National Agreement, Target 11 (over-representation of First Nations young people in detention)', href: 'https://www.closingthegap.gov.au/', type: 'Govt' },
  ];

  return (
    <div>
      <ModeToggle
        dashboardHref={isShare ? '/share/qld-youth-justice' : '/reports/youth-justice/qld/sector'}
        longReadHref={isShare ? '/share/qld-youth-justice/long-read' : '/reports/youth-justice/qld/sector/long-read'}
        current="long-read"
      />

      <div className="mb-12">
        {!isShare && (
          <Link href="/reports/youth-justice" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
            ← Youth Justice Reports
          </Link>
        )}
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Long-form Report · 10 min read · Featured</div>
        <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black mb-4 uppercase tracking-tight leading-tight">
          QLD Youth Justice<br />— Where the Money, the Children, and the Evidence Go
        </h1>
        <p className="text-xl sm:text-2xl text-bauhaus-muted leading-tight font-medium max-w-3xl mb-6">
          $1.88B for detention. $1.49B for community-based services. {r.l?.total_children ?? '—'} children in adult police watchhouses today, {fnPctChild}% First Nations.
          Twelve evidence-backed alternatives that already exist in QLD.
        </p>
        <p className="text-xs font-mono text-bauhaus-muted">
          Live data. Last refreshed {r.l ? new Date(r.l.source_generated_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '—'} from QPS.
        </p>
      </div>

      <ReportToc entries={toc} />

      <ReportSection id="summary" kicker="01 · Executive Summary" title="What we found">
        <p>
          Queensland&apos;s youth-justice system is one of the most-debated in the country. CivicGraph pulled the structural numbers — live watchhouse occupancy, multi-year state-budget Youth Justice expenditure, all justice-funding-tagged grants in our dataset, and the Australian Living Map of Alternatives evidence base — and triangulated them.
        </p>

        <Finding n={1} title="Children in adult police watchhouses, right now" severity="crit">
          <p>
            <span className="font-black">{r.l?.total_children ?? '—'} children</span> in QLD watchhouses today across <span className="font-black">{r.l?.child_watchhouse_count ?? '—'}</span> sites. <span className="font-black text-bauhaus-red">{fnPctChild}% First Nations</span>. Adults populate the same watchhouses and the same cells; <span className="font-black">{childOver2}</span> children have been there more than 2 days. Longest current child hold: <span className="font-black">{r.l?.child_longest_days ?? '—'} days</span>. <SourceLink href="#src-qps-watchhouse">[1]</SourceLink>
          </p>
        </Finding>

        <Finding n={2} title={`$${(r.detention/1e9).toFixed(2)}B detention vs $${(r.community/1e9).toFixed(2)}B community-based`} severity="crit">
          <p>
            QLD&apos;s state-budget Youth Justice line items disclose <span className="font-black">{money(r.detention)}</span> on detention-based services and <span className="font-black">{money(r.community)}</span> on community-based services. Ratio: <span className="font-black text-bauhaus-red">{detentionRatio}:1 detention to community.</span> <SourceLink href="#src-qld-budget-yj">[2]</SourceLink> Group-conferencing — the most evidence-backed early-stage intervention in the budget — gets <span className="font-black">{money(r.groupConferencing)}</span>, ~{total > 0 ? ((r.groupConferencing/total)*100).toFixed(1) : '—'}% of the total.
          </p>
        </Finding>

        <Finding n={3} title="The $1.49B community spend goes through ~12 large NGOs" severity="warn">
          <p>
            Within the community-based budget line, named-recipient grants in the topic &lsquo;youth-justice&rsquo; flow to <span className="font-black">{r.partnersCount}</span> distinct organisations — Lifeline Community Care, Anglicare/Synod of Brisbane, Mission Australia, Relationships Australia QLD, The Ted Noffs Foundation, YouthLink, Life Without Barriers, Shine For Kids, UnitingCare Community. Aboriginal Community-Controlled Organisations are funded, but at a fraction of the dollar amounts going to the bigger NGOs. <SourceLink href="#src-acnc">[3]</SourceLink>
          </p>
        </Finding>

        <Finding n={4} title={`${r.almaCount} evidence-backed alternatives exist for QLD already`} severity="info">
          <p>
            ALMA — the Australian Living Map of Alternatives — catalogues community-endorsed and evaluated diversion / wraparound / justice-reinvestment programs. <span className="font-black">{r.almaCount}</span> of them have explicit Queensland presence. Most are graded &ldquo;promising&rdquo; (community-endorsed, emerging evidence), a handful are at &ldquo;proven&rdquo; or &ldquo;evaluated&rdquo; level. <SourceLink href="#src-alma">[4]</SourceLink> They are not theoretical; they are running.
          </p>
        </Finding>

        <Finding n={5} title="The contradiction is the story" severity="info">
          <p>
            QLD spends {detentionRatio} times more on detention than on the community-based programs the evidence supports. {fnPctChild}% of the children currently held in adult watchhouses are First Nations, in a state where First Nations make up ~5% of the 10–17 population. Closing the Gap target 11 explicitly commits to reducing this. <SourceLink href="#src-closing-the-gap">[6]</SourceLink> Funders, boards, and journalists working in this space already know this. The sourced live data makes the case impossible to ignore.
          </p>
        </Finding>
      </ReportSection>

      <ReportSection id="lead" kicker="02" title="Right now: kids in adult cells">
        <p>
          The numbers refresh every 12 hours from the QPS public PDF. As of {r.l ? new Date(r.l.source_generated_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}, there are <span className="font-black">{r.l?.total_people ?? '—'}</span> people in Queensland watchhouses — <span className="font-black">{r.l?.total_adults ?? '—'}</span> adults and <span className="font-black text-bauhaus-red">{r.l?.total_children ?? '—'} children</span>. <SourceLink href="#src-qps-watchhouse">[1]</SourceLink>
        </p>

        <StatStrip items={[
          { label: 'Children in custody', value: String(r.l?.total_children ?? '—'), tone: 'red' },
          { label: 'First Nations %', value: `${fnPctChild}%`, tone: 'red' },
          { label: 'Children > 2 days', value: String(childOver2), tone: 'red' },
          { label: 'Longest hold (child)', value: `${r.l?.child_longest_days ?? '—'}d`, tone: 'red' },
        ]} />

        <p>
          Police watchhouses are designed for adult arrestees on short-term pre-charge or pre-court holds. They have no schooling, no programs, no rehabilitation infrastructure, and limited natural light. Children held in them are mixed in the same buildings as the adult population, even where physical separation is enforced.
        </p>
        <p>
          The longest-current-hold figure matters. A child in a watchhouse for 5+ days is sitting in a police cell while courts and remand-bed availability cycle through. The QPS data shows this happening today, in multiple regional and metropolitan watchhouses simultaneously.
        </p>

        <PullQuote attribution="Queensland Police Service public watchhouse occupancy report">
          {fnPctChild}% of the {r.l?.total_children ?? '—'} children currently in custody are First Nations.
        </PullQuote>
      </ReportSection>

      <ReportSection id="spend" kicker="03" title="The detention vs community spend ratio">
        <p>
          Queensland&apos;s state budget discloses Youth Justice expenditure across three named lines: detention-based services, community-based services, and group conferencing. Cumulative expenditure across the years our dataset covers: <SourceLink href="#src-qld-budget-yj">[2]</SourceLink>
        </p>

        <StatStrip items={[
          { label: 'Detention services', value: money(r.detention), tone: 'red' },
          { label: 'Community-based', value: money(r.community), tone: 'blue' },
          { label: 'Group conferencing', value: money(r.groupConferencing), tone: 'yellow' },
          { label: 'Detention : Community', value: `${detentionRatio} : 1`, tone: 'red' },
        ]} />

        <p>
          The ratio matters because detention is structurally more expensive per child than every alternative. Custodial beds are infrastructure, staffed 24/7, and carry capital, security, and overhead costs. The community line covers diversion, family-led decision-making, school re-engagement, mental-health and AOD support, employment pathways — the program work that the evidence consistently identifies as effective.
        </p>
        <p>
          The structural choice is not whether to fund youth justice; it&apos;s where to put the dollar. {detentionRatio}:1 detention-to-community is the current answer.
        </p>
      </ReportSection>

      <ReportSection id="partners" kicker="04" title="Where the community money actually goes">
        <p>
          Inside the {money(r.community)} community-based budget, named-recipient grants in CivicGraph&apos;s justice-funding dataset flow to <span className="font-black">{r.partnersCount}</span> distinct organisations. The dashboard view shows the top dozen by dollar amount.
        </p>
        <p>
          The pattern: large national NGOs hold the largest contracts. Anglicare/Synod of Brisbane, Mission Australia, Lifeline Community Care, Relationships Australia QLD, Life Without Barriers, UnitingCare Community. Aboriginal Community-Controlled Organisations are funded too — but typically at smaller dollar amounts and with shorter contract terms.
        </p>
        <p>
          For a foundation considering grantee diligence, or a peak body assessing the sector, the structural question is whether community-controlled delivery is being adequately resourced relative to the population it serves. The data suggests it is not.
        </p>
      </ReportSection>

      <ReportSection id="evidence" kicker="05" title="What the evidence says works">
        <p>
          The Australian Living Map of Alternatives — a civil-society-maintained register of community-endorsed and evaluated diversion and reinvestment programs — has <span className="font-black">{r.almaCount}</span> interventions with explicit QLD presence. <SourceLink href="#src-alma">[4]</SourceLink>
        </p>
        <p>
          Categories include <span className="font-black">justice reinvestment</span> (Maranguka-style place-based investment), <span className="font-black">wraparound support</span> (multi-disciplinary teams around a young person and their family), <span className="font-black">diversion</span> (pre-court / pre-charge alternatives), <span className="font-black">community-led</span> (programs designed and delivered by ACCOs), and <span className="font-black">therapeutic</span> (trauma-informed, culturally-safe care).
        </p>
        <p>
          Of these, evidence levels split roughly: most at &ldquo;promising&rdquo; (community-endorsed, emerging evidence), a smaller share at &ldquo;proven&rdquo; (rigorously evaluated, demonstrable outcomes), and a portion still at &ldquo;untested&rdquo; (theory or pilot stage).
        </p>
        <p>
          The evidence base is real. The frame &ldquo;there&apos;s no alternative&rdquo; doesn&apos;t hold. The frame &ldquo;the alternatives are unproven&rdquo; partly holds — but is itself a function of where evaluation funding has historically gone, not whether the programs work.
        </p>
      </ReportSection>

      <ReportSection id="fix" kicker="06" title="What it would take to shift this">
        <p>
          Three structural moves stand out from the data:
        </p>
        <p>
          <span className="font-black">1. Move the detention-to-community spend ratio.</span> Even a $200M reallocation from detention to community would be a 13% expansion of the community-services budget — enough to fund the scale-up of the most-promising ALMA interventions across the regional network.
        </p>
        <p>
          <span className="font-black">2. Triple the proportion going to ACCOs.</span> Aboriginal Community-Controlled Organisations consistently outperform mainstream NGOs in retention and outcomes for First Nations young people. The dollar share doesn&apos;t reflect this. Closing the Gap target 11 commits the QLD government to addressing it.
        </p>
        <p>
          <span className="font-black">3. Resource evaluation alongside delivery.</span> The reason most ALMA interventions sit at &ldquo;promising&rdquo; rather than &ldquo;proven&rdquo; is that programs are funded to deliver, not to be evaluated. A small percentage of every grant going to monitoring &amp; evaluation would close the evidence gap within a budget cycle.
        </p>
        <p>
          None of these moves requires new policy frameworks. The Closing the Gap commitments, the Justice Reinvestment Network&apos;s sector roadmap, and the QLD government&apos;s own Strategy 2019–2023 all point in this direction. <SourceLink href="#src-closing-the-gap">[6]</SourceLink> <SourceLink href="#src-justice-reinvestment">[5]</SourceLink>
        </p>
      </ReportSection>

      {!isShare ? (
        <ReportSection id="sources" kicker="07" title="Sources">
          <SourcesPanel sources={sources} />
        </ReportSection>
      ) : (
        <div id="sources" className="mb-16 scroll-mt-24">
          <h2 className="text-2xl sm:text-3xl font-black text-bauhaus-black uppercase tracking-tight mb-6">Sources</h2>
          <SourcesPanel sources={sources} />
        </div>
      )}

      {/* CTA */}
      <section className="border-4 border-bauhaus-black p-8 bg-bauhaus-yellow mb-12">
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-3">Was this useful?</h2>
        <p className="text-bauhaus-black font-medium leading-relaxed max-w-3xl mb-5">
          We&apos;re building CivicGraph in public. Same pipeline works for any sector or organisation in Australia. Tell us what you found valuable and what you&apos;d want next &mdash; anonymously if you like.
        </p>
        <Link href="/feedback?subject=qld-youth-justice" className="inline-block px-5 py-3 text-sm font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red">★ Send feedback (~2 min) →</Link>
      </section>

      <div className="text-center mb-8">
        <div className="text-xs font-mono text-bauhaus-muted">CivicGraph long-form report · {new Date().toISOString().slice(0, 10)}</div>
      </div>
    </div>
  );
}
