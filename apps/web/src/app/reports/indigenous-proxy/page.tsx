import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';
import { ReportEmailCapture } from '@/components/report-email-capture';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'The Indigenous Proxy Problem — CivicGraph',
  description:
    '57% of Australian government funding tagged "Indigenous" flows to non-Indigenous-controlled organisations. Cross-system investigation of where the money actually lands versus where it was promised.',
  openGraph: {
    title: 'The Indigenous Proxy Problem',
    description:
      '57% of Indigenous-tagged government funding flows to non-Indigenous-controlled organisations. A CivicGraph investigation.',
    type: 'article',
    siteName: 'CivicGraph',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Indigenous Proxy Problem',
    description:
      '57% of Indigenous-tagged funding flows to non-Indigenous orgs. CivicGraph investigation.',
  },
};

function money(n: number | null | undefined): string {
  if (n == null) return '--';
  if (n === 0) return '$0';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${((n / total) * 100).toFixed(1)}%`;
}

const TOPIC_FILTER = `topics @> ARRAY['indigenous']::text[] AND source NOT IN ('austender-direct')`;
const EXCLUDE_ROGS = `program_name NOT LIKE 'ROGS%' AND program_name NOT LIKE 'Total%'`;

type FundingSplit = {
  org_type: string;
  orgs: number;
  total: number;
  avg_grant: number;
};

type ProxyOrg = {
  recipient_name: string;
  gs_id: string | null;
  total: number;
  grants: number;
};

type StateSplit = {
  state: string;
  cc_total: number;
  non_total: number;
  cc_pct: number;
};

type YearTrend = {
  financial_year: string;
  cc_total: number;
  non_total: number;
  cc_pct: number;
};

type ProgramSplit = {
  program_name: string;
  cc_total: number;
  non_total: number;
  total: number;
  cc_pct: number;
};

async function getData() {
  const db = getServiceSupabase();

  const [splitRes, proxyRes, communityRes, stateRes, trendRes, programRes] = await Promise.all([
    // 1. Overall funding split
    safe(db.rpc('exec_sql', {
      query: `SELECT
                CASE WHEN ge.is_community_controlled THEN 'Community Controlled' ELSE 'Non-Indigenous' END as org_type,
                COUNT(DISTINCT jf.recipient_name)::int as orgs,
                COALESCE(SUM(jf.amount_dollars), 0)::bigint as total,
                COALESCE(ROUND(AVG(jf.amount_dollars)), 0)::bigint as avg_grant
              FROM justice_funding jf
              JOIN gs_entities ge ON ge.id = jf.gs_entity_id
              WHERE ${TOPIC_FILTER}
                AND ${EXCLUDE_ROGS}
              GROUP BY CASE WHEN ge.is_community_controlled THEN 'Community Controlled' ELSE 'Non-Indigenous' END`,
    }), 'funding-split'),

    // 2. Top non-Indigenous recipients (proxy orgs)
    safe(db.rpc('exec_sql', {
      query: `SELECT jf.recipient_name, ge.gs_id,
                COALESCE(SUM(jf.amount_dollars), 0)::bigint as total,
                COUNT(*)::int as grants
              FROM justice_funding jf
              JOIN gs_entities ge ON ge.id = jf.gs_entity_id
              WHERE ${TOPIC_FILTER}
                AND ${EXCLUDE_ROGS}
                AND ge.is_community_controlled = false
                AND jf.amount_dollars IS NOT NULL
                AND jf.amount_dollars > 0
              GROUP BY jf.recipient_name, ge.gs_id
              ORDER BY total DESC
              LIMIT 15`,
    }), 'proxy-orgs'),

    // 3. Top community-controlled recipients
    safe(db.rpc('exec_sql', {
      query: `SELECT jf.recipient_name, ge.gs_id,
                COALESCE(SUM(jf.amount_dollars), 0)::bigint as total,
                COUNT(*)::int as grants
              FROM justice_funding jf
              JOIN gs_entities ge ON ge.id = jf.gs_entity_id
              WHERE ${TOPIC_FILTER}
                AND ${EXCLUDE_ROGS}
                AND ge.is_community_controlled = true
                AND jf.amount_dollars IS NOT NULL
                AND jf.amount_dollars > 0
              GROUP BY jf.recipient_name, ge.gs_id
              ORDER BY total DESC
              LIMIT 15`,
    }), 'community-orgs'),

    // 4. State breakdown
    safe(db.rpc('exec_sql', {
      query: `SELECT jf.state,
                COALESCE(SUM(CASE WHEN ge.is_community_controlled THEN jf.amount_dollars END), 0)::bigint as cc_total,
                COALESCE(SUM(CASE WHEN NOT ge.is_community_controlled THEN jf.amount_dollars END), 0)::bigint as non_total,
                CASE WHEN SUM(jf.amount_dollars) > 0
                  THEN ROUND(SUM(CASE WHEN ge.is_community_controlled THEN jf.amount_dollars ELSE 0 END) * 100.0 / SUM(jf.amount_dollars), 1)
                  ELSE 0 END as cc_pct
              FROM justice_funding jf
              JOIN gs_entities ge ON ge.id = jf.gs_entity_id
              WHERE ${TOPIC_FILTER}
                AND ${EXCLUDE_ROGS}
                AND jf.state IS NOT NULL
                AND jf.amount_dollars IS NOT NULL
              GROUP BY jf.state
              ORDER BY (COALESCE(SUM(CASE WHEN ge.is_community_controlled THEN jf.amount_dollars END), 0) +
                        COALESCE(SUM(CASE WHEN NOT ge.is_community_controlled THEN jf.amount_dollars END), 0)) DESC`,
    }), 'state-split'),

    // 5. Year-over-year trends
    safe(db.rpc('exec_sql', {
      query: `SELECT jf.financial_year,
                COALESCE(SUM(CASE WHEN ge.is_community_controlled THEN jf.amount_dollars END), 0)::bigint as cc_total,
                COALESCE(SUM(CASE WHEN NOT ge.is_community_controlled THEN jf.amount_dollars END), 0)::bigint as non_total,
                CASE WHEN SUM(jf.amount_dollars) > 0
                  THEN ROUND(SUM(CASE WHEN ge.is_community_controlled THEN jf.amount_dollars ELSE 0 END) * 100.0 / SUM(jf.amount_dollars), 1)
                  ELSE 0 END as cc_pct
              FROM justice_funding jf
              JOIN gs_entities ge ON ge.id = jf.gs_entity_id
              WHERE ${TOPIC_FILTER}
                AND ${EXCLUDE_ROGS}
                AND jf.financial_year IS NOT NULL
                AND jf.amount_dollars IS NOT NULL
              GROUP BY jf.financial_year
              HAVING SUM(jf.amount_dollars) > 100000
              ORDER BY jf.financial_year`,
    }), 'year-trends'),

    // 6. Program analysis
    safe(db.rpc('exec_sql', {
      query: `SELECT jf.program_name,
                COALESCE(SUM(CASE WHEN ge.is_community_controlled THEN jf.amount_dollars END), 0)::bigint as cc_total,
                COALESCE(SUM(CASE WHEN NOT ge.is_community_controlled THEN jf.amount_dollars END), 0)::bigint as non_total,
                COALESCE(SUM(jf.amount_dollars), 0)::bigint as total,
                CASE WHEN SUM(jf.amount_dollars) > 0
                  THEN ROUND(SUM(CASE WHEN ge.is_community_controlled THEN jf.amount_dollars ELSE 0 END) * 100.0 / SUM(jf.amount_dollars), 1)
                  ELSE 0 END as cc_pct
              FROM justice_funding jf
              JOIN gs_entities ge ON ge.id = jf.gs_entity_id
              WHERE ${TOPIC_FILTER}
                AND ${EXCLUDE_ROGS}
                AND jf.amount_dollars IS NOT NULL
                AND jf.amount_dollars > 0
              GROUP BY jf.program_name
              HAVING SUM(jf.amount_dollars) > 1000000
              ORDER BY total DESC
              LIMIT 20`,
    }), 'program-split'),
  ]);

  const split = (splitRes || []) as FundingSplit[];
  const ccRow = split.find(r => r.org_type === 'Community Controlled');
  const nonRow = split.find(r => r.org_type === 'Non-Indigenous');
  const totalFunding = (ccRow?.total ?? 0) + (nonRow?.total ?? 0);
  const nonPct = totalFunding > 0 ? ((nonRow?.total ?? 0) / totalFunding * 100) : 0;

  return {
    ccTotal: ccRow?.total ?? 0,
    nonTotal: nonRow?.total ?? 0,
    ccOrgs: ccRow?.orgs ?? 0,
    nonOrgs: nonRow?.orgs ?? 0,
    ccAvgGrant: ccRow?.avg_grant ?? 0,
    nonAvgGrant: nonRow?.avg_grant ?? 0,
    totalFunding,
    nonPct: Math.round(nonPct),
    proxyOrgs: (proxyRes || []) as ProxyOrg[],
    communityOrgs: (communityRes || []) as ProxyOrg[],
    states: (stateRes || []) as StateSplit[],
    trends: (trendRes || []) as YearTrend[],
    programs: (programRes || []) as ProgramSplit[],
    lgaProxy: ((await safe(db.from('mv_lga_indigenous_proxy_score')
      .select('state, lga_name, total_indigenous_tagged_funding, community_controlled_share_pct, proxy_share_pct, unique_recipients')
      .gte('total_indigenous_tagged_funding', 1000000)
      .gte('proxy_share_pct', 80)
      .order('total_indigenous_tagged_funding', { ascending: false })
      .limit(15), 'lga-proxy')) || []) as Array<{
        state: string;
        lga_name: string;
        total_indigenous_tagged_funding: number;
        community_controlled_share_pct: number | null;
        proxy_share_pct: number;
        unique_recipients: number;
      }>,
  };
}

export default async function IndigenousProxyPage() {
  const data = await getData();

  // Find the state with best and worst cc_pct
  const statesWithFunding = data.states.filter(s => (s.cc_total + s.non_total) > 100000);
  const bestState = statesWithFunding.reduce((best, s) => (s.cc_pct > best.cc_pct ? s : best), statesWithFunding[0]);
  const worstState = statesWithFunding.reduce((worst, s) => (s.cc_pct < worst.cc_pct ? s : worst), statesWithFunding[0]);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <Link href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; All Reports
      </Link>

      {/* Advisory review banner — non-negotiable per /about/curious-tractor */}
      <div className="mt-4 border-4 border-bauhaus-yellow bg-bauhaus-yellow/20 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 border-2 border-bauhaus-black bg-bauhaus-yellow px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
            Under Advisory Review
          </div>
          <div className="text-sm text-bauhaus-black">
            <p className="font-bold">
              This investigation analyses First Nations data and is being reviewed by our Indigenous advisory before broader distribution.
            </p>
            <p className="mt-2 text-bauhaus-muted">
              CivicGraph&rsquo;s{' '}
              <Link href="/about/curious-tractor" className="font-black text-bauhaus-black underline hover:text-bauhaus-red">
                published principle
              </Link>{' '}
              is that Indigenous-related publications pass advisory review before full public release. The data and
              methodology are public for transparency; the framing is iterating with Aboriginal and Torres Strait Islander
              voices. If you&rsquo;re a community member, researcher, or advisor who wants to contribute, see the{' '}
              <a href="#contribute" className="font-black text-bauhaus-black underline hover:text-bauhaus-red">
                review invitation
              </a>{' '}
              below.
            </p>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="mt-8 mb-8">
        <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-[0.25em] mb-1">Cross-System Investigation</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          The Indigenous Proxy Problem
        </h1>
        <p className="text-lg text-bauhaus-muted leading-relaxed max-w-3xl">
          <strong className="text-bauhaus-red">{data.nonPct}%</strong> of Indigenous-tagged government funding goes to
          non-Indigenous organisations. Community-controlled orgs &mdash; the ones with cultural authority,
          local knowledge, and community trust &mdash; receive the minority share of money earmarked for
          their own communities.
        </p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-10 border-4 border-bauhaus-black">
        <div className="p-5 border-r-2 border-b-2 sm:border-b-0 border-bauhaus-black/10">
          <div className="text-3xl font-black text-bauhaus-black">{money(data.totalFunding)}</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Indigenous-Tagged Funding</div>
        </div>
        <div className="p-5 border-b-2 sm:border-b-0 sm:border-r-2 border-bauhaus-black/10">
          <div className="text-3xl font-black text-bauhaus-red">{data.nonPct}%</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">To Non-Indigenous Orgs</div>
        </div>
        <div className="p-5 border-r-2 border-bauhaus-black/10">
          <div className="text-3xl font-black text-bauhaus-black">{data.nonOrgs}</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Non-Indigenous Recipients</div>
        </div>
        <div className="p-5">
          <div className="text-3xl font-black text-bauhaus-black">{data.ccOrgs}</div>
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Community-Controlled Orgs</div>
        </div>
      </div>

      {/* The Numbers */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          The Numbers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 border-4 border-bauhaus-black">
          <div className="p-6 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-3">Non-Indigenous Organisations</div>
            <div className="text-3xl font-black text-bauhaus-black mb-1">{money(data.nonTotal)}</div>
            <div className="text-sm text-bauhaus-muted font-medium">{data.nonOrgs} organisations &middot; {money(data.nonAvgGrant)} avg grant</div>
            <div className="mt-3 h-3 bg-gray-100 w-full">
              <div className="h-3 bg-bauhaus-red" style={{ width: `${data.nonPct}%` }} />
            </div>
            <div className="text-xs text-bauhaus-muted mt-1">{data.nonPct}% of total</div>
          </div>
          <div className="p-6">
            <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-3">Community-Controlled Organisations</div>
            <div className="text-3xl font-black text-bauhaus-black mb-1">{money(data.ccTotal)}</div>
            <div className="text-sm text-bauhaus-muted font-medium">{data.ccOrgs} organisations &middot; {money(data.ccAvgGrant)} avg grant</div>
            <div className="mt-3 h-3 bg-gray-100 w-full">
              <div className="h-3 bg-emerald-600" style={{ width: `${100 - data.nonPct}%` }} />
            </div>
            <div className="text-xs text-bauhaus-muted mt-1">{100 - data.nonPct}% of total</div>
          </div>
        </div>
      </section>

      {/* The Proxy Orgs */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          The Proxy Orgs &mdash; Top Non-Indigenous Recipients
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          These organisations are not Indigenous community-controlled, yet they receive the largest shares of
          Indigenous-tagged government funding. Some do valuable work. The question is: why does the money
          flow through intermediaries rather than directly to community?
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white text-left">
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Organisation</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Funding</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Grants</th>
              </tr>
            </thead>
            <tbody>
              {data.proxyOrgs.map((org, i) => (
                <tr key={org.recipient_name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-bold">
                    {org.gs_id ? (
                      <Link href={`/entities/${org.gs_id}`} className="text-bauhaus-black hover:text-bauhaus-red">
                        {org.recipient_name}
                      </Link>
                    ) : (
                      org.recipient_name
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-bauhaus-red">{money(org.total)}</td>
                  <td className="px-4 py-3 text-right font-mono text-bauhaus-muted">{org.grants.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Community-Controlled Orgs */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          Community-Controlled &mdash; The Direct Path
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          These are Aboriginal and Torres Strait Islander community-controlled organisations &mdash; governed by
          community, accountable to community, and delivering services with cultural authority. They exist.
          They work. They are underfunded.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-emerald-800 text-white text-left">
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Organisation</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Funding</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Grants</th>
              </tr>
            </thead>
            <tbody>
              {data.communityOrgs.map((org, i) => (
                <tr key={org.recipient_name} className={i % 2 === 0 ? 'bg-white' : 'bg-emerald-50/30'}>
                  <td className="px-4 py-3 font-bold">
                    {org.gs_id ? (
                      <Link href={`/entities/${org.gs_id}`} className="text-bauhaus-black hover:text-emerald-700">
                        {org.recipient_name}
                      </Link>
                    ) : (
                      org.recipient_name
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{money(org.total)}</td>
                  <td className="px-4 py-3 text-right font-mono text-bauhaus-muted">{org.grants.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* State Breakdown */}
      <section className="mb-10">
        <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
          State Breakdown
        </h2>
        <p className="text-sm text-bauhaus-muted mb-4">
          {bestState && worstState && bestState.state !== worstState.state ? (
            <>
              <strong className="text-bauhaus-black">{bestState.state}</strong> directs {bestState.cc_pct}% of Indigenous funding to community-controlled orgs.{' '}
              <strong className="text-bauhaus-black">{worstState.state}</strong> directs just {worstState.cc_pct}%.
              The variation between jurisdictions reveals that this is a policy choice, not an inevitability.
            </>
          ) : (
            'State-by-state variation shows this is a policy choice, not an inevitability.'
          )}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white text-left">
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">State</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Community-Controlled</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Non-Indigenous</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">CC Share</th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {data.states.map((s, i) => {
                const total = s.cc_total + s.non_total;
                const ccWidth = total > 0 ? (s.cc_total / total * 100) : 0;
                return (
                  <tr key={s.state} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-black">{s.state}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 font-bold">{money(s.cc_total)}</td>
                    <td className="px-4 py-3 text-right font-mono text-bauhaus-red font-bold">{money(s.non_total)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{s.cc_pct}%</td>
                    <td className="px-4 py-3">
                      <div className="h-3 bg-gray-100 w-full flex">
                        <div className="h-3 bg-emerald-600" style={{ width: `${ccWidth}%` }} />
                        <div className="h-3 bg-bauhaus-red" style={{ width: `${100 - ccWidth}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex gap-4 mt-3 text-xs text-bauhaus-muted">
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-600" /> Community-Controlled</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-bauhaus-red" /> Non-Indigenous</div>
        </div>
      </section>

      {/* The Pattern */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-red p-6 bg-red-50">
          <h2 className="text-xl font-black uppercase tracking-widest mb-4">The Pattern</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-2">Step 1: Label</div>
              <p className="text-sm text-bauhaus-black font-medium">
                Government creates programs with &ldquo;Indigenous&rdquo;, &ldquo;Aboriginal&rdquo;, or &ldquo;Torres Strait Islander&rdquo;
                in the title. {money(data.totalFunding)} allocated.
              </p>
            </div>
            <div>
              <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-2">Step 2: Route</div>
              <p className="text-sm text-bauhaus-black font-medium">
                Funding flows through mainstream service providers &mdash; large non-Indigenous NGOs, state agencies,
                and consulting firms who lack cultural authority but have procurement compliance.
              </p>
            </div>
            <div>
              <div className="text-[10px] font-black text-bauhaus-red uppercase tracking-widest mb-2">Step 3: Report</div>
              <p className="text-sm text-bauhaus-black font-medium">
                Government reports {money(data.totalFunding)} &ldquo;spent on Indigenous services&rdquo; while community-controlled
                organisations receive {pct(data.ccTotal, data.totalFunding)}. The headline number is real. The self-determination is not.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* LGA Proxy Score — from mv_lga_indigenous_proxy_score */}
      {data.lgaProxy.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
            Worst LGAs — Where The Proxy Problem Hits Hardest
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            Local Government Areas where 80%+ of Indigenous-tagged funding flows to
            non-Indigenous-controlled organisations. The story isn&rsquo;t even — some LGAs concentrate
            the leakage in spectacular ways.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white text-left">
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">State</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">LGA</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Funding</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">CC Share</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Proxy Share</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Recipients</th>
                </tr>
              </thead>
              <tbody>
                {data.lgaProxy.map((l, i) => (
                  <tr key={`${l.state}-${l.lga_name}`} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas/40'}>
                    <td className="px-4 py-3 font-mono text-xs text-bauhaus-muted">{l.state}</td>
                    <td className="px-4 py-3 font-medium text-bauhaus-black">{l.lga_name}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{money(l.total_indigenous_tagged_funding)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700">{l.community_controlled_share_pct ?? 0}%</td>
                    <td className="px-4 py-3 text-right font-mono text-bauhaus-red font-bold">{l.proxy_share_pct}%</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{l.unique_recipients}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-bauhaus-muted mt-3">
            Source: <code>mv_lga_indigenous_proxy_score</code> — joins justice_funding (Indigenous topic) ×
            gs_entities (community-controlled flag) × LGA. Filtered to LGAs with ≥$1M funding and ≥80% proxy share.
          </p>
        </section>
      )}

      {/* Year-over-Year Trends */}
      {data.trends.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
            Year-over-Year Trends
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            Is it getting better? Track the community-controlled share of Indigenous funding over time.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white text-left">
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Year</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Community-Controlled</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Non-Indigenous</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">CC Share</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Trend</th>
                </tr>
              </thead>
              <tbody>
                {data.trends.map((t, i) => {
                  const total = t.cc_total + t.non_total;
                  const ccWidth = total > 0 ? (t.cc_total / total * 100) : 0;
                  return (
                    <tr key={t.financial_year} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-mono font-bold text-bauhaus-black">{t.financial_year}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-700">{money(t.cc_total)}</td>
                      <td className="px-4 py-3 text-right font-mono text-bauhaus-red">{money(t.non_total)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{t.cc_pct}%</td>
                      <td className="px-4 py-3">
                        <div className="h-3 bg-gray-100 w-full flex">
                          <div className="h-3 bg-emerald-600" style={{ width: `${ccWidth}%` }} />
                          <div className="h-3 bg-bauhaus-red" style={{ width: `${100 - ccWidth}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Program Analysis */}
      {data.programs.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-bauhaus-black pb-2 mb-6">
            Program Analysis &mdash; Where the Proxying Happens
          </h2>
          <p className="text-sm text-bauhaus-muted mb-4">
            Which government programs route money through non-Indigenous intermediaries, and which fund
            community directly? Programs with low CC Share are the primary proxy vectors.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white text-left">
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Program</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">Total</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs text-right">CC Share</th>
                  <th className="px-4 py-3 font-black uppercase tracking-wider text-xs">Split</th>
                </tr>
              </thead>
              <tbody>
                {data.programs.map((p, i) => {
                  const ccWidth = p.total > 0 ? (p.cc_total / p.total * 100) : 0;
                  // Truncate long program names
                  const displayName = p.program_name.length > 80
                    ? p.program_name.slice(0, 77) + '...'
                    : p.program_name;
                  return (
                    <tr key={p.program_name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-medium text-bauhaus-black max-w-xs">
                        <span title={p.program_name}>{displayName}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{money(p.total)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        <span className={p.cc_pct >= 50 ? 'text-emerald-700' : 'text-bauhaus-red'}>{p.cc_pct}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3 bg-gray-100 w-24 flex">
                          <div className="h-3 bg-emerald-600" style={{ width: `${ccWidth}%` }} />
                          <div className="h-3 bg-bauhaus-red" style={{ width: `${100 - ccWidth}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Email capture — top of funnel for journalism distribution */}
      <ReportEmailCapture
        reportSlug="indigenous-proxy"
        source="report-indigenous-proxy"
        headline="When the next investigation lands, get it in your inbox"
        description="The Indigenous Proxy Problem is one of several cross-system investigations. Subscribe for the next one — Consulting Class follow-ups, board interlocks at scale, where philanthropic money actually flows. Free, irregular cadence, never shared."
      />

      {/* Contribute / advisory review invitation */}
      <section id="contribute" className="mb-10">
        <div className="border-4 border-bauhaus-black bg-bauhaus-black text-white p-6 sm:p-8">
          <div className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-[0.3em] mb-2">
            Contribute To This Investigation
          </div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-4">
            This is a living investigation. Help shape it.
          </h2>
          <p className="text-sm text-white/80 leading-relaxed mb-4 max-w-3xl">
            The data is strong. The framing needs to be right. If you&rsquo;re an Aboriginal or Torres
            Strait Islander person, community organisation, peak body, researcher, or advocate working
            in this space, CivicGraph wants your input before wider public release.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 mt-6">
            <div className="border-4 border-white/20 p-4">
              <p className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-1">
                Indigenous advisors
              </p>
              <p className="text-sm text-white/80">
                Advance review of framing and findings. Named publicly (with your agreement).
                Honorarium available.
              </p>
            </div>
            <div className="border-4 border-white/20 p-4">
              <p className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-1">
                Community organisations
              </p>
              <p className="text-sm text-white/80">
                Tell us what&rsquo;s missing. Flag misclassifications. Point us to data we haven&rsquo;t
                found yet.
              </p>
            </div>
            <div className="border-4 border-white/20 p-4">
              <p className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-1">
                Journalists
              </p>
              <p className="text-sm text-white/80">
                Request the full dataset, methodology notes, and entity-level data for your own
                investigation.
              </p>
            </div>
            <div className="border-4 border-white/20 p-4">
              <p className="text-[10px] font-black text-bauhaus-yellow uppercase tracking-widest mb-1">
                Researchers
              </p>
              <p className="text-sm text-white/80">
                Access for peer-reviewed work. We cite your feedback; you cite the atlas.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-0">
            <a
              href="mailto:ben@benjamink.com.au?subject=Indigenous%20Proxy%20Problem%20%E2%80%94%20contribute"
              className="border-4 border-white bg-bauhaus-yellow px-6 py-3 text-xs font-black uppercase tracking-widest text-bauhaus-black transition-colors hover:bg-white"
            >
              Get in touch
            </a>
            <Link
              href="/about/curious-tractor"
              className="border-y-4 border-r-4 border-white bg-transparent px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-bauhaus-black"
            >
              Our principles
            </Link>
          </div>
        </div>
      </section>

      {/* How to cite */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-black p-4 bg-white">
          <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-widest mb-2">
            How to cite
          </h3>
          <p className="text-xs text-bauhaus-muted font-mono leading-relaxed">
            A Curious Tractor. &ldquo;The Indigenous Proxy Problem.&rdquo; CivicGraph, 2026.{' '}
            https://civicgraph.com.au/reports/indigenous-proxy
          </p>
          <p className="text-xs text-bauhaus-muted mt-2">
            Republication, data reuse, and adaptation welcome under attribution. If you&rsquo;re publishing a
            derivative investigation, we&rsquo;d appreciate a heads-up so we can support verification.
          </p>
        </div>
      </section>

      {/* Methodology */}
      <section className="mb-8">
        <div className="bg-bauhaus-canvas p-4">
          <h3 className="text-sm font-black text-bauhaus-black uppercase tracking-widest mb-2">Methodology</h3>
          <ul className="text-xs text-bauhaus-muted space-y-1">
            <li><strong>Data source:</strong> justice_funding table &mdash; federal and state government funding records tagged with the &ldquo;indigenous&rdquo; topic via automated classification.</li>
            <li><strong>Community-controlled:</strong> Organisations flagged as <code className="font-mono text-bauhaus-black">is_community_controlled = true</code> in the CivicGraph entity registry, based on ORIC registration, self-identification, or governance structure analysis.</li>
            <li><strong>Non-Indigenous:</strong> All other organisations receiving Indigenous-tagged funding &mdash; mainstream NGOs, state government agencies, consulting firms, and non-ATSICCO service providers.</li>
            <li><strong>Exclusions:</strong> ROGS aggregate rows, &ldquo;Total&rdquo; summary rows, and austender-direct procurement (general government procurement not related to justice/social services).</li>
            <li><strong>Limitations:</strong> Some community-controlled organisations may not be correctly flagged in the entity registry. Funding amounts may include multi-year allocations recorded in a single year. Sub-contracting to community organisations by proxy recipients is not captured.</li>
          </ul>
          <p className="text-[10px] text-bauhaus-muted mt-3">
            This is a living investigation. All data is sourced from public datasets. Entity classification by CivicGraph via ORIC and ABN matching. Last updated: March 2026.
          </p>
        </div>
      </section>
    </div>
  );
}
