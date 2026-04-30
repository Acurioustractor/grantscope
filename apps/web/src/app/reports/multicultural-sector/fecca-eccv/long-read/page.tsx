import Link from 'next/link';
import { getLiveReportSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';
import {
  ReportSection, ReportToc, Finding, SourceLink, SourcesPanel, DataCallout,
  PullQuote, StatStrip, RelatedReads, ModeToggle,
} from '@/components/reports/long-read';

export const dynamic = 'force-dynamic';

const FECCA_ABN = '23684792947';
const ECCV_ABN = '65071572705';

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

async function getNumbers() {
  const supabase = getLiveReportSupabase();
  const [feccaCir, eccvAis, totals, ames, topicMix] = await Promise.all([
    safe(supabase.rpc('exec_sql', {
      query: `SELECT total_revenue::bigint, revenue_from_government::bigint, total_expenses::bigint,
                     net_surplus_deficit::bigint AS deficit, employee_expenses::bigint, total_paid_kmp::bigint,
                     staff_full_time
              FROM public.charity_impact_reports WHERE abn='${FECCA_ABN}' AND report_year=2024`,
    })) as Promise<Array<{ total_revenue: number; revenue_from_government: number; total_expenses: number; deficit: number; employee_expenses: number; total_paid_kmp: number; staff_full_time: number | null }> | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT ais_year::int, total_revenue::bigint AS rev, revenue_from_government::bigint AS govt, net_surplus_deficit::bigint AS surplus
              FROM public.acnc_ais WHERE abn='${ECCV_ABN}' ORDER BY ais_year ASC`,
    })) as Promise<Array<{ ais_year: number; rev: number; govt: number; surplus: number }> | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT COUNT(*)::int AS grants, SUM(amount_aud)::bigint AS total
              FROM public.vic_grants_awarded WHERE amount_aud > 0`,
    })) as Promise<Array<{ grants: number; total: number }> | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT SUM(contract_value)::bigint AS total, COUNT(*)::int AS contracts
              FROM public.austender_contracts WHERE supplier_name ILIKE 'ADULT MULTICULTURAL EDUCATION%' OR supplier_name ILIKE '%AMES Australia%'`,
    })) as Promise<Array<{ total: number; contracts: number }> | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT topic, SUM(amount_aud)::bigint AS total FROM (
                SELECT amount_aud, CASE
                  WHEN program_name ILIKE '%aboriginal%' OR program_name ILIKE '%first peoples%' OR program_name ILIKE '%treaty%' OR program_name ILIKE '%self-determination%' OR program_name ILIKE '%traditional owner%' OR program_name ILIKE '%stolen generations%' OR program_name ILIKE '%reconciliation%' OR program_name ILIKE '%RAP %' OR program_name ILIKE '%RAP-%' OR program_name ILIKE '%native title%' OR program_name ILIKE '%indigenous%' OR program_name ILIKE '%munarra%' OR program_name ILIKE '%DDWCAC%' OR recipient_name ILIKE '%aboriginal corporation%' OR recipient_name ILIKE '%traditional owner%' OR recipient_name ILIKE '%first peoples%' OR recipient_name ILIKE '%RNTBC%' THEN 'first_peoples'
                  WHEN program_name ILIKE '%multicultural%' OR program_name ILIKE '%ethnic%' OR program_name ILIKE '%refugee%' OR program_name ILIKE '%settlement%' OR program_name ILIKE '%migrant%' OR program_name ILIKE '%MCIF%' OR recipient_name ILIKE '%ethnic communit%' OR recipient_name ILIKE '%multicultural%' OR recipient_name ILIKE '%migrant%' OR recipient_name ILIKE '%refugee%' THEN 'multicultural'
                  ELSE 'other' END AS topic FROM public.vic_grants_awarded WHERE amount_aud > 0 AND program_name IS NOT NULL
              ) t GROUP BY 1`,
    })) as Promise<Array<{ topic: string; total: number }> | null>,
  ]);

  const fecca = feccaCir?.[0] || null;
  const eccvAisArr = eccvAis ?? [];
  const eccvLatest = eccvAisArr[eccvAisArr.length - 1] || null;
  const eccvPrior = eccvAisArr[eccvAisArr.length - 2] || null;
  const totalsRow = totals?.[0] || null;
  const amesRow = ames?.[0] || null;
  const topics = (topicMix ?? []).reduce((m, r) => ({ ...m, [r.topic]: r.total }), {} as Record<string, number>);

  return { fecca, eccvAisArr, eccvLatest, eccvPrior, totals: totalsRow, ames: amesRow, topics };
}

export default async function FeccaEccvLongRead() {
  const r = await getNumbers();
  const eccvDropPct = r.eccvLatest && r.eccvPrior && r.eccvPrior.rev > 0
    ? (((r.eccvLatest.rev - r.eccvPrior.rev) / r.eccvPrior.rev) * 100)
    : 0;
  const feccaGovtPct = r.fecca && r.fecca.total_revenue > 0
    ? (r.fecca.revenue_from_government / r.fecca.total_revenue) * 100
    : 0;
  const fecca2yrDeficit = -1003345; // sum of -494998 + -508347, both disclosed in audit
  const feccaReserves = 1273205; // accumulated surplus FY2024
  const feccaAccumPriorYear = 1781552;
  const feccaRunwayYears = (feccaReserves / 500000).toFixed(1);
  const totalGrants = r.totals?.total ?? 0;
  const grantCount = r.totals?.grants ?? 0;
  const amesTotal = r.ames?.total ?? 0;
  const firstPeoplesTotal = r.topics.first_peoples ?? 0;
  const multiTotal = r.topics.multicultural ?? 0;
  const ratioFpVsMulti = multiTotal > 0 ? (firstPeoplesTotal / multiTotal).toFixed(1) : '—';

  const toc = [
    { id: 'summary', label: 'Executive Summary' },
    { id: 'anchors', label: 'Why these two anchors?' },
    { id: 'ames', label: 'The AMES Asymmetry' },
    { id: 'fragility', label: "FECCA's Hidden Fragility" },
    { id: 'cliff', label: "ECCV's Cycle Cliff" },
    { id: 'mix', label: 'Where the State Money Goes' },
    { id: 'methodology', label: "What's Verified vs What's Not" },
    { id: 'related', label: 'Related Reads' },
    { id: 'sources', label: 'Sources' },
  ];

  const sources = [
    { id: 'src-fecca-ar2024', label: 'FECCA 2023-24 Annual Report (PDF)', href: 'https://fecca.org.au/wp-content/uploads/2024/11/2023-24-FECCA-Annual-Report.pdf', type: 'PDF' },
    { id: 'src-fecca-fin2024', label: 'FECCA Audited Financial Statements 2023-24', href: 'https://fecca.org.au/wp-content/uploads/2024/11/FECCA-Audited-2023_2024-Financial-Statements.pdf', type: 'PDF' },
    { id: 'src-eccv-ar2023', label: 'ECCV Annual Report 2022-23 (PDF)', href: 'https://eccv.org.au/wp-content/uploads/2023/12/ECCV-Annual-Report-2022-23.pdf', type: 'PDF' },
    { id: 'src-eccv-ar2022', label: 'ECCV Annual Report 2021-22 (PDF)', href: 'https://eccv.org.au/wp-content/uploads/2022/12/Annual-Report-2021-22.pdf', type: 'PDF' },
    { id: 'src-abr-fecca', label: 'FECCA ABN record on the Australian Business Register', href: 'https://abr.business.gov.au/ABN/View?abn=23684792947', type: 'Govt Register' },
    { id: 'src-acnc-bulk', label: 'ACNC AIS bulk data (data.gov.au CKAN)', href: 'https://data.gov.au/data/dataset/acnc-2023-annual-information-statement-ais-data', type: 'Govt Open Data' },
    { id: 'src-acnc-register', label: 'ACNC Charity Register data on data.gov.au', href: 'https://data.gov.au/dataset/ds-dga-b050b242-4487-4306-abf5-07ca073e5594', type: 'Govt Open Data' },
    { id: 'src-fecca-people', label: 'FECCA team page (fecca.org.au/about/people)', href: 'https://fecca.org.au/about/people/', type: 'Web' },
    { id: 'src-eccv-board', label: 'ECCV board page (eccv.org.au/about/board)', href: 'https://eccv.org.au/about/board', type: 'Web' },
    { id: 'src-austender', label: 'AustEnder federal procurement data (austender_contracts table, ingested via daily scrape)', href: 'https://www.tenders.gov.au/', type: 'Govt' },
    { id: 'src-vic-grants', label: 'Victorian government department annual reports (DPC, DFFH, DJSIR), 5,202 grants extracted via pdftotext + Claude Haiku / MiniMax', href: 'https://www.vic.gov.au/', type: 'Govt' },
  ];

  return (
    <div>
      <ModeToggle
        dashboardHref="/reports/multicultural-sector/fecca-eccv"
        longReadHref="/reports/multicultural-sector/fecca-eccv/long-read"
        current="long-read"
      />

      {/* Title */}
      <div className="mb-12">
        <Link href="/reports/multicultural-sector" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          ← Multicultural Sector
        </Link>
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Long-form Report · 12 min read</div>
        <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black mb-4 uppercase tracking-tight leading-tight">
          The Federation&apos;s Money Map
        </h1>
        <p className="text-xl sm:text-2xl text-bauhaus-muted leading-tight font-medium max-w-3xl mb-6">
          FECCA &amp; ECCV — two policy bodies, two single-funder dependencies, $1B of federal multicultural procurement they don&apos;t see.
        </p>
        <p className="text-xs font-mono text-bauhaus-muted">
          Published {new Date().toISOString().slice(0, 10)} · CivicGraph deep-dive
        </p>
      </div>

      <ReportToc entries={toc} />

      {/* §1 Executive Summary */}
      <ReportSection id="summary" kicker="01 · Executive Summary" title="What we found">
        <p>
          The Federation of Ethnic Communities&apos; Councils of Australia (FECCA) and the Ethnic Communities&apos; Council of Victoria (ECCV) are two of the most-cited &ldquo;peak bodies&rdquo; in Australian multicultural policy. They&apos;re cited in submissions, briefings, and commentary as the voice of the sector. We pulled every public record we could find on both — ACNC AIS, ABR registrations, audited financial statements, federal procurement contracts, Victorian state grants, board membership, annual report PDFs — and triangulated them.
        </p>
        <p className="text-bauhaus-black">
          Five things stand out:
        </p>

        <Finding n={1} title="The federation's federal procurement footprint is rounding error" severity="warn">
          <p>
            FECCA holds {money(768350)} of lifetime Commonwealth procurement across 8 contracts. AMES (Adult Multicultural Education Services) holds <span className="font-black">{money(amesTotal)}</span> across {r.ames?.contracts ?? '?'} federal contracts — roughly <span className="font-black text-bauhaus-red">{amesTotal && totalGrants ? Math.round(amesTotal / 768350).toLocaleString() : '?'}× FECCA&apos;s entire lifetime total</span>. The sector&apos;s federal procurement story isn&apos;t the federation; it&apos;s AMES, mostly delivering the Adult Migrant English Program. <SourceLink href="#src-austender" label="Austender">[10]</SourceLink>
          </p>
        </Finding>

        <Finding n={2} title="FECCA was not an ACNC-registered charity for 24 years" severity="crit">
          <p>
            Per the Australian Business Register: FECCA&apos;s ABN has been active since <span className="font-black">01 Nov 1999</span>; GST since <span className="font-black">01 Jul 2000</span>. But charity tax concession + ACNC registration were only granted <span className="font-black">08 Aug 2023</span>. <SourceLink href="#src-abr-fecca" label="ABR">[5]</SourceLink> 24 years as an ACT incorporated association without charity tax exemption, ACNC oversight, or DGR. Their first ACNC public-bulk-data appearance will be the FY2024-25 dataset (next quarterly drop).
          </p>
        </Finding>

        <Finding n={3} title="Two consecutive years of ~$500K deficits, 2.5 years of runway" severity="crit">
          <p>
            FECCA&apos;s audited Directors&apos; Report discloses operating deficits of <span className="font-black">{money(-494998)}</span> in FY2022-23 and <span className="font-black">{money(-508347)}</span> in FY2023-24 — cumulative <span className="font-black text-bauhaus-red">{money(fecca2yrDeficit)}</span> over two years. <SourceLink href="#src-fecca-ar2024" label="FECCA AR">[1]</SourceLink> Accumulated Surplus dropped {money(feccaAccumPriorYear)} → {money(feccaReserves)}. At the current burn rate, that&apos;s ~<span className="font-black">{feccaRunwayYears} years</span> of buffer.
          </p>
        </Finding>

        <Finding n={4} title="ECCV's revenue collapsed 34% in FY2022-23" severity="warn">
          <p>
            ECCV&apos;s audited Statement of Income shows total revenue dropped <span className="font-black">{money(r.eccvPrior?.rev)}</span> &rarr; <span className="font-black">{money(r.eccvLatest?.rev)}</span> in one year &mdash; grants fell {money(986000)} (-37%), &ldquo;other income&rdquo; fell $247K. <SourceLink href="#src-eccv-ar2023" label="ECCV AR">[3]</SourceLink> They survived a {money(15180)} surplus only by cutting program expenses 79% ($885K → $183K) and wages 21% (~6 FTE worth).
          </p>
        </Finding>

        <Finding n={5} title="State grant flow shows a 6× ratio: First Peoples vs Multicultural" severity="info">
          <p>
            From {grantCount.toLocaleString()} grants extracted from VIC department annual reports (FY2021-22 → FY2023-24, total {money(totalGrants)}), <span className="font-black">First Peoples / Treaty receives {money(firstPeoplesTotal)}</span>; <span className="font-black">Multicultural / Settlement receives {money(multiTotal)}</span>. Ratio {ratioFpVsMulti}×. <SourceLink href="#src-vic-grants" label="VIC Grants">[11]</SourceLink> But the structural shape differs: First Peoples funding clusters in a few large institutional grants (Treaty Authority, Self-Determination Fund, Munarra Centre); multicultural funding is fragmented across hundreds of small grants.
          </p>
        </Finding>
      </ReportSection>

      {/* §2 Why these two anchors */}
      <ReportSection id="anchors" kicker="02" title="Why these two anchors?">
        <p>
          The federation has roughly two dozen state and regional Ethnic Communities Councils. Most of them — Geelong, Sunraysia-Mallee, Albury-Wodonga, ECCNSW, ECCQ, ECCWA, the Northern Federation of Ethnic Senior Citizens Clubs, and others — operate locally with small staff and limited national policy reach. <SourceLink href="#src-acnc-bulk" label="ACNC bulk data">[6]</SourceLink>
        </p>
        <p>
          FECCA and ECCV are different. FECCA is the only national peak body that brings the federation&apos;s voice to Commonwealth policy. ECCV is the largest state council by revenue and staff, with a much longer audited-financials history (we have ECCV AIS data back to 2017). They sit on each other&apos;s referral pathways — FECCA&apos;s board includes Jill Morgan AM, who was previously executive at ECCV and Multicultural Arts Victoria — and they share the federation&apos;s state-to-national bridge.
        </p>
        <p>
          Whatever stress shows up in these two organisations is likely echoed across the smaller state and regional councils that look to them for cover. That&apos;s why this deep-dive starts here, not at AMES.
        </p>
      </ReportSection>

      {/* §3 AMES Asymmetry */}
      <ReportSection id="ames" kicker="03" title="The AMES Asymmetry — where federal multicultural procurement actually goes">
        <p>
          The first surprise from triangulating Austender against ACNC was the scale gap.
        </p>

        <StatStrip items={[
          { label: 'AMES — total federal procurement', value: money(amesTotal), tone: 'red' },
          { label: 'AMES — federal contracts', value: String(r.ames?.contracts ?? '?'), tone: 'red' },
          { label: "FECCA's lifetime federal procurement", value: money(768350), tone: 'black' },
          { label: 'Ratio', value: amesTotal ? `${Math.round(amesTotal / 768350).toLocaleString()}×` : '—', tone: 'red' },
        ]} />

        <p>
          AMES delivers the Adult Migrant English Program (AMEP) and a portfolio of settlement services. Their {r.ames?.contracts ?? '?'} federal contracts averaging tens of millions each are the dominant form of federal multicultural funding in Australia. <SourceLink href="#src-austender" label="Austender">[10]</SourceLink>
        </p>
        <p>
          The federation peak bodies — FECCA at the national level, ECCV at the state — barely register at this scale. FECCA&apos;s eight contracts since 2016 sit between $11K and $249K each, all with Health and Aged Care, Australian Digital Health Agency, Aged Care Quality and Safety Commission, and the ABS. ECCV holds zero Commonwealth contracts; their government revenue runs entirely through Victorian state grant cycles.
        </p>
        <p>
          This matters for how the report should be read: when the page calls FECCA the &ldquo;national peak,&rdquo; that&apos;s a designation about policy weight and federation membership, not procurement volume. The national multicultural procurement story is being written elsewhere, by a different actor.
        </p>
      </ReportSection>

      {/* §4 FECCA Fragility */}
      <ReportSection id="fragility" kicker="04" title="FECCA's Hidden Fragility">
        <p>
          FECCA&apos;s 2023-24 annual report opens with the usual peak-body framing — advocacy, policy, membership. The audited financial statements at the back of the same report describe a different organisation.
        </p>

        <StatStrip items={[
          { label: 'Cumulative deficit (FY22-23 + FY23-24)', value: money(fecca2yrDeficit), tone: 'red' },
          { label: 'Accumulated surplus (FY24 close)', value: money(feccaReserves), tone: 'black' },
          { label: 'Reserves change YoY', value: money(feccaReserves - feccaAccumPriorYear), tone: 'red' },
          { label: 'Runway @ current burn', value: `~${feccaRunwayYears} yrs`, tone: 'red' },
        ]} />

        <p>
          The Directors&apos; Report &mdash; a signed declaration by the Committee — discloses both years&apos; deficits in a single line, then claims: <SourceLink href="#src-fecca-ar2024" label="FECCA AR">[1]</SourceLink>
        </p>

        <PullQuote attribution="FECCA Directors' Report, FY2023-24">
          No significant changes in the Corporation&apos;s state of affairs occurred during the financial year.
        </PullQuote>

        <p>
          On the same audit, in the staff section: <span className="font-black">5 of 13 staff (38%) departed during the year.</span> The Director of Policy and Advocacy left in March 2024. The Strategy, Stakeholder &amp; Sector Development Lead left in December 2023. The Senior Advisor left in April 2024. Two Policy and Project Officers left in May 2024. CEO Mohammad Al-Khafaji exited in August 2024; Mary Ann Baquero Geronimo took over in September. Board Chair changed from Carlo Carli (audit period) to Peter Doukas (current).
        </p>
        <p>
          On the balance sheet: total liabilities tripled from $1.37M to $3.82M. The growth is almost entirely &ldquo;Grants received in advance&rdquo; — $2.4M+ of grant money already received but accounted for in future periods. Cash position improved on paper because more is sitting in the pipeline; the operating reality is the deficit it&apos;s being used to mask.
        </p>
        <p>
          And the regulatory posture: FECCA only became an ACNC-registered charity on 8 August 2023. <SourceLink href="#src-abr-fecca" label="ABR">[5]</SourceLink> For the prior 24 years they operated as an ACT incorporated association with an ABN but no charity tax concessions. They could not receive deductible-gift donations. They were technically liable for income tax on surpluses (which, given the recent deficits, has been moot — but the structural exposure was real).
        </p>
        <p>
          Taken together: a national peak body two years into a deficit pattern, with 38% staff turnover, a CEO transition mid-year, ~2.5 years of accumulated reserves remaining, and a regulatory framework only just standardised. The annual report is not wrong — it is an organisation in advocacy, policy, and membership work. It is also an organisation under significant structural strain.
        </p>
      </ReportSection>

      {/* §5 ECCV Cycle Cliff */}
      <ReportSection id="cliff" kicker="05" title="ECCV's Cycle Cliff">
        <p>
          ECCV&apos;s seven-year audited revenue history (2017→2023) grows from $1.18M to $3.63M, then collapses 34% in a single year to $2.40M. The collapse is not a story of diversification away from government; it is a story of the funding cycle ending. <SourceLink href="#src-eccv-ar2023" label="ECCV AR">[3]</SourceLink>
        </p>

        <DataCallout caption="ECCV total revenue 2017→2023 from audited Statements of Income. The FY2022-23 drop is concentrated in the &lsquo;Grants&rsquo; line ($2.64M → $1.65M, −37%); &lsquo;Other income&rsquo; also dropped $971K → $724K. The two together account for the $1.23M revenue loss.">
          <div className="space-y-2">
            {r.eccvAisArr.map((y) => {
              const peak = Math.max(...r.eccvAisArr.map(a => a.rev));
              const w = (y.rev / peak) * 100;
              const govtW = y.rev > 0 ? (y.govt / peak) * 100 : 0;
              return (
                <div key={y.ais_year}>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="font-black">{y.ais_year}</span>
                    <span className="text-bauhaus-muted">{money(y.rev)} · {y.rev > 0 ? Math.round((y.govt / y.rev) * 100) : 0}% govt</span>
                  </div>
                  <div className="relative h-5 bg-bauhaus-canvas border-2 border-bauhaus-black">
                    <div className="absolute inset-y-0 left-0 bg-bauhaus-red" style={{ width: `${govtW}%` }} />
                    <div className="absolute inset-y-0 bg-bauhaus-blue" style={{ left: `${govtW}%`, width: `${Math.max(w - govtW, 0)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </DataCallout>

        <p>
          ECCV survived FY2022-23 with a $15K surplus. They did it by cutting program expenses 79% ($885K → $183K) and employee expenses 21% ($2.32M → $1.83M, equivalent to roughly 6 FTE). With 77% of spend going to wages, there were no other levers.
        </p>
        <p>
          The pattern matters because it&apos;s how state-funded peak bodies survive cycle ends. When the 2022 election commitments wound down, ECCV cut programs and headcount in a single year, kept the lights on, then went into the next cycle smaller. The annual report described this period as &ldquo;a welcome opportunity to reset and reconnect.&rdquo; The audited statements describe it differently.
        </p>
      </ReportSection>

      {/* §6 Topic Mix */}
      <ReportSection id="mix" kicker="06" title="Where the State Money Actually Goes">
        <p>
          We extracted {grantCount.toLocaleString()} grants worth {money(totalGrants)} from the audited annual reports of three Victorian government departments (Premier and Cabinet, Families/Fairness/Housing, Jobs/Skills/Industry/Regions) across FY2021-22, FY2022-23, and FY2023-24. <SourceLink href="#src-vic-grants" label="VIC grants">[11]</SourceLink>
        </p>
        <p>
          Classifying each grant by program-name keyword (with recipient-name fallback for entities like &ldquo;X Aboriginal Corporation&rdquo; or &ldquo;X Ethnic Communities Council&rdquo;) produces a topic mix that reframes how Victorian state grant flow actually allocates.
        </p>

        <StatStrip items={[
          { label: 'First Peoples / Treaty', value: money(firstPeoplesTotal), tone: 'red' },
          { label: 'Multicultural / Settlement', value: money(multiTotal), tone: 'yellow' },
          { label: 'Ratio', value: `${ratioFpVsMulti}×`, tone: 'red' },
          { label: 'Total classified', value: money(totalGrants), tone: 'black' },
        ]} />

        <p>
          The asymmetry isn&apos;t obvious from FECCA or ECCV&apos;s own publications because their reports describe their own funded programs, not the broader allocation. Once you assemble it across three years and three departments, two structural patterns emerge:
        </p>
        <p>
          <span className="font-black">First Peoples funding clusters in large institutional grants.</span> The Self-Determination Fund Trustee receives $35M in a single grant. The Treaty Authority receives $20.9M. First Peoples&apos; Assembly of Victoria receives $24.2M. Munarra Centre for Regional Excellence receives $32M. These are institution-building grants — establishing bodies meant to outlast a single political cycle.
        </p>
        <p>
          <span className="font-black">Multicultural funding is fragmented across hundreds of small grants.</span> The Multicultural Community Infrastructure Fund (MCIF) alone makes 71 separate grants averaging ~$150K. The largest single multicultural recipient is Centre for Multicultural Youth ($18M across 6 grants). Only three multicultural-coded grants in the dataset exceed $5M.
        </p>
        <p>
          That&apos;s a deliberate structural choice in policy design. It is not a comment on equity, need, or impact — only on how the money is shaped. But it explains a lot about why a peak body like FECCA, accustomed to operating in the multicultural-funding model, runs deficits while First Peoples&apos; Assembly of Victoria operates from a $24M institutional grant.
        </p>
      </ReportSection>

      {/* §7 Methodology / verification */}
      <ReportSection id="methodology" kicker="07" title="What's verified, what's inferred, what's missing">
        <p>
          A report is only as honest as the gap-acknowledgement section. Here&apos;s what we know with confidence and what we don&apos;t:
        </p>
        <p>
          <span className="font-black text-bauhaus-blue">VERIFIED</span> — Numbers cross-referenced across the audited PDF and the ACNC AIS data.gov.au bulk record. ECCV&apos;s LLM-extracted revenue ($2.40M for FY2022-23) matches its ACNC AIS figure exactly. Federal contracts pulled directly from the Austender CSV. Director listings verified against eccv.org.au/about/board and ACNC responsible-persons.
        </p>
        <p>
          <span className="font-black text-bauhaus-yellow">INFERRED</span> — Topic classification of 5,202 VIC grants by keyword + recipient name. Manually reviewed accuracy on the largest 30 rows; classifier is conservative on First Peoples (only counts explicit mentions / known traditional-owner-group names). The 4% &ldquo;Other&rdquo; bucket is mostly Asia Society funding, AAP support, charity-to-charity donations.
        </p>
        <p>
          <span className="font-black text-bauhaus-red">UNVERIFIED / MISSING</span> — FECCA&apos;s 2017-2022 financial history is not in any public ACNC dataset (they were not registered). The 2024-25 ACNC AIS bulk drop is the first one that will include them. Their staff numbers are sourced from fecca.org.au/about/people, not an audited document, and may include or exclude part-timers. ECCV&apos;s FY2023-24 PDF is image-only (iLovePDF flattened the text to bitmaps); we have FY2022-23 financials, not the most recent year.
        </p>
      </ReportSection>

      {/* §8 Related Reads */}
      <div id="related" className="mb-16 scroll-mt-24">
        <h2 className="text-2xl sm:text-3xl font-black text-bauhaus-black uppercase tracking-tight mb-6">Related Reads</h2>
        <RelatedReads items={[
          { href: '/reports/multicultural-sector/fecca-eccv', kicker: 'Dashboard', title: 'FECCA & ECCV — All the data', description: 'Live dashboard view: 11 sections of charts, contracts, board portfolios, and grant tables. Same numbers as this report, scannable.' },
          { href: '/reports/multicultural-sector', kicker: 'Sector overview', title: 'Multicultural Sector — Sector overview', description: 'Sector-level view including AMES, the state-by-state ECC federation, and Home Affairs settlement programs.' },
          { href: '/graph?focus=federation-of-ethnic-communities', kicker: 'Network graph', title: 'See the federation network visually', description: 'Interactive force graph of FECCA + ECCV + sister state ECCs + their shared directors and funded programs.' },
          { href: '/orgs/AU-ABN-23684792947', kicker: 'Entity profile', title: 'FECCA — full entity profile', description: 'Single-org page: every contract, donation, grant, board seat, and relationship CivicGraph has on FECCA.' },
          { href: '/orgs/AU-ABN-65071572705', kicker: 'Entity profile', title: 'ECCV — full entity profile', description: 'Single-org page: ECCV’s 7-year financial history, board, programs, partner connections.' },
          { href: '/funding-deserts', kicker: 'Geography', title: 'Funding deserts — VIC LGAs', description: 'Where the multicultural sector’s state grants land vs where CALD population concentrates.' },
        ]} />
      </div>

      {/* §9 Sources */}
      <ReportSection id="sources" kicker="08" title="Sources & Methodology">
        <p>
          Every numerical claim in this report is sourced. Click a [n] reference inline above or scan the list below.
        </p>
        <SourcesPanel sources={sources} />
      </ReportSection>

      <div className="text-center mb-8">
        <div className="text-xs font-mono text-bauhaus-muted">CivicGraph long-form report · {new Date().toISOString().slice(0, 10)}</div>
      </div>
    </div>
  );
}
