import Link from 'next/link';
import { headers } from 'next/headers';
import { getLiveReportSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'QLD Youth Justice — Sector Deep Dive · CivicGraph',
  description: "Live watchhouse data, $11.7B in spend, the detention-vs-community ratio, and where the money actually flows in Queensland's youth justice system.",
};

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

type WatchhouseLatest = {
  source_generated_at: string;
  total_people: number;
  total_adults: number;
  total_children: number;
  child_first_nations: number;
  child_non_indigenous: number;
  child_other_status: number;
  child_0_2_days: number;
  child_3_7_days: number;
  child_over_7_days: number;
  child_longest_days: number;
  adult_first_nations: number;
  adult_non_indigenous: number;
  adult_over_7_days: number;
  adult_longest_days: number;
  child_watchhouse_count: number;
};

type WatchhouseRow = {
  watchhouse_name: string;
  age_group: string;
  total_in_custody: number;
  first_nations: number;
  non_indigenous: number;
  custody_over_7_days: number;
  longest_days: number;
};

type FundingYearRow = { financial_year: string; recipient_name: string; amount: number };
type SpendCategoryRow = { category: string; total: number };
type PartnerRow = { recipient_name: string; total: number; grants: number };
type AlmaInterventionRow = { name: string; type: string; evidence_level: string | null; geography: string[] };

async function getReport() {
  const supabase = getLiveReportSupabase();
  const [latest, sites, spendByCategory, partners, alma, recentAnnouncements] = await Promise.all([
    safe(supabase.rpc('exec_sql', {
      query: `SELECT source_generated_at::text, total_people, total_adults, total_children,
                     child_first_nations, child_non_indigenous, child_other_status,
                     child_0_2_days, child_3_7_days, child_over_7_days, child_longest_days,
                     adult_first_nations, adult_non_indigenous, adult_over_7_days, adult_longest_days,
                     child_watchhouse_count
              FROM public.v_qld_watchhouse_latest LIMIT 1`,
    })) as Promise<WatchhouseLatest[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT watchhouse_name, age_group, total_in_custody::int, first_nations::int,
                     non_indigenous::int, custody_over_7_days::int, longest_days::int
              FROM public.qld_watchhouse_snapshot_rows
              WHERE snapshot_id = (SELECT id FROM public.v_qld_watchhouse_latest LIMIT 1)
              ORDER BY total_in_custody DESC LIMIT 25`,
    })) as Promise<WatchhouseRow[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT
                CASE
                  WHEN recipient_name ILIKE '%detention%' THEN 'Detention services'
                  WHEN recipient_name ILIKE '%community-based%' OR recipient_name ILIKE '%community based%' THEN 'Community-based services'
                  WHEN recipient_name ILIKE '%group conferencing%' THEN 'Group conferencing'
                  WHEN recipient_name ILIKE '%transition%' OR recipient_name ILIKE '%after-care%' THEN 'Transition / aftercare'
                  ELSE NULL
                END AS category,
                SUM(amount_dollars)::bigint AS total
              FROM public.justice_funding
              WHERE state = 'QLD'
                AND recipient_name LIKE 'Youth Justice -%'
              GROUP BY 1 HAVING category IS NOT NULL
              ORDER BY 2 DESC`,
    })) as Promise<SpendCategoryRow[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT recipient_name, SUM(amount_dollars)::bigint AS total, COUNT(*)::int AS grants
              FROM public.justice_funding
              WHERE state = 'QLD' AND topics @> ARRAY['youth-justice']
                AND recipient_name NOT ILIKE '%total%'
                AND recipient_name NOT ILIKE 'department of youth justice%'
                AND recipient_name NOT ILIKE 'youth justice -%'
                AND recipient_name NOT IN ('(blank)','TAFE Queensland')
                AND amount_dollars > 0
              GROUP BY 1 ORDER BY total DESC NULLS LAST LIMIT 12`,
    })) as Promise<PartnerRow[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT name, type, evidence_level, geography
              FROM public.alma_interventions
              WHERE ('QLD' = ANY(geography) OR 'Queensland' = ANY(geography))
                AND (topics @> ARRAY['youth-justice'] OR type ILIKE '%diversion%' OR type ILIKE '%justice%' OR type ILIKE '%wraparound%' OR type ILIKE '%community-led%')
              ORDER BY (CASE WHEN evidence_level ILIKE '%proven%' THEN 0 WHEN evidence_level ILIKE '%promising%' THEN 1 ELSE 2 END), name
              LIMIT 12`,
    })) as Promise<AlmaInterventionRow[] | null>,
    safe(supabase.rpc('exec_sql', {
      query: `SELECT count(*)::int FROM public.qld_watchhouse_snapshots`,
    })) as Promise<Array<{ count: number }> | null>,
  ]);
  return {
    latest: latest?.[0] || null,
    sites: sites ?? [],
    spendByCategory: spendByCategory ?? [],
    partners: partners ?? [],
    alma: alma ?? [],
    snapshotCount: recentAnnouncements?.[0]?.count ?? 0,
  };
}

export default async function QldYjSector() {
  const hdrs = await headers();
  const isShare = (hdrs.get('x-pathname') ?? '').startsWith('/share/');
  const dashboardPath = isShare ? '/share/qld-youth-justice' : '/reports/youth-justice/qld/sector';
  const longReadPath = isShare ? '/share/qld-youth-justice/long-read' : '/reports/youth-justice/qld/sector/long-read';
  const r = await getReport();

  const fnPctChild = r.latest && r.latest.total_children > 0
    ? Math.round((r.latest.child_first_nations / r.latest.total_children) * 100)
    : 0;
  const fnPctAdult = r.latest && r.latest.total_adults > 0
    ? Math.round((r.latest.adult_first_nations / r.latest.total_adults) * 100)
    : 0;
  const childOver2Days = r.latest ? r.latest.child_3_7_days + r.latest.child_over_7_days : 0;
  const detention = r.spendByCategory.find(c => c.category === 'Detention services')?.total || 0;
  const community = r.spendByCategory.find(c => c.category === 'Community-based services')?.total || 0;
  const groupConferencing = r.spendByCategory.find(c => c.category === 'Group conferencing')?.total || 0;
  const detentionRatio = community > 0 ? (detention / community).toFixed(2) : '—';

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex flex-wrap items-center gap-0 mb-6">
        <Link href={dashboardPath} className="inline-block px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-black text-white" aria-current="page">Dashboard</Link>
        <Link href={longReadPath} className="inline-block px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black -ml-0.5 bg-bauhaus-yellow text-bauhaus-black hover:bg-bauhaus-canvas">📖 Read the Long-form Report</Link>
      </div>

      <div className="mb-10">
        {!isShare && (
          <Link href="/reports/youth-justice" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
            &larr; Youth Justice Reports
          </Link>
        )}
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Featured Sector Deep Dive</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3 uppercase tracking-tight">
          QLD Youth Justice — Where The Money, The Children, And The Evidence Go
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          A live, sourced look at Queensland&apos;s youth-justice system. Watchhouse occupancy refreshes from QPS daily. Funding flows pulled from the state budget &amp; Justice department disclosures.
          {r.latest && (
            <> Latest snapshot: <span className="font-black text-bauhaus-black">{new Date(r.latest.source_generated_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span>.</>
          )}
        </p>
      </div>

      {/* §1 — TODAY's WATCHHOUSE OCCUPANCY (the lead) */}
      {r.latest && (
        <section className="mb-16">
          <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§1 · LIVE</div>
          <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">In QLD watchhouses, right now</h2>
          <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
            Auto-refreshed twice daily from the Queensland Police Service watchhouse-occupancy publication. Children held in adult police lock-ups is the signal we lead with.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="border-4 border-bauhaus-red p-5 bg-white">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">Children in custody</div>
              <div className="text-4xl font-black text-bauhaus-red tabular-nums">{r.latest.total_children}</div>
              <p className="text-xs text-bauhaus-muted font-medium mt-2">Across <span className="font-black">{r.latest.child_watchhouse_count}</span> watchhouses today</p>
            </div>
            <div className="border-4 border-bauhaus-red p-5 bg-white">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-1">First Nations children</div>
              <div className="text-4xl font-black text-bauhaus-red tabular-nums">{fnPctChild}%</div>
              <p className="text-xs text-bauhaus-muted font-medium mt-2"><span className="font-black">{r.latest.child_first_nations}</span> of {r.latest.total_children} kids in custody. First Nations make up ~5% of QLD&apos;s 10–17 population.</p>
            </div>
            <div className="border-4 border-bauhaus-black p-5 bg-white">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-1">Children held &gt;2 days</div>
              <div className="text-4xl font-black text-bauhaus-black tabular-nums">{childOver2Days}</div>
              <p className="text-xs text-bauhaus-muted font-medium mt-2">Adult police cells, no programs, no schooling. Longest current child hold: <span className="font-black">{r.latest.child_longest_days} days</span>.</p>
            </div>
            <div className="border-4 border-bauhaus-black p-5 bg-white">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-1">Adults &gt; 7 days</div>
              <div className="text-4xl font-black text-bauhaus-black tabular-nums">{r.latest.adult_over_7_days}</div>
              <p className="text-xs text-bauhaus-muted font-medium mt-2">Of {r.latest.total_adults} adults; {fnPctAdult}% First Nations. Longest: {r.latest.adult_longest_days} days.</p>
            </div>
          </div>

          {/* Site-level table */}
          {r.sites.length > 0 && (
            <div className="border-4 border-bauhaus-black overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bauhaus-black text-white">
                  <tr>
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Watchhouse</th>
                    <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Age group</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs">In custody</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">First Nations</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">&gt; 7 days</th>
                    <th className="text-right p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Longest</th>
                  </tr>
                </thead>
                <tbody>
                  {r.sites.map((s, i) => {
                    const isChild = s.age_group === 'Child';
                    return (
                      <tr key={`${s.watchhouse_name}-${s.age_group}`} className={isChild ? 'bg-bauhaus-red/10 border-l-4 border-bauhaus-red' : i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                        <td className="p-3 font-black text-bauhaus-black">{s.watchhouse_name}</td>
                        <td className={`p-3 text-xs uppercase tracking-widest font-black ${isChild ? 'text-bauhaus-red' : 'text-bauhaus-muted'}`}>{s.age_group}</td>
                        <td className="p-3 text-right font-mono font-black text-bauhaus-black">{s.total_in_custody}</td>
                        <td className="p-3 text-right font-mono">{s.first_nations} ({s.total_in_custody > 0 ? Math.round((s.first_nations / s.total_in_custody) * 100) : 0}%)</td>
                        <td className="p-3 text-right font-mono">{s.custody_over_7_days || '—'}</td>
                        <td className="p-3 text-right font-mono">{s.longest_days || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* §2 — Detention vs community spend */}
      {(detention > 0 || community > 0) && (
        <section className="mb-16">
          <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§2</div>
          <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Detention vs Community — The Spend Ratio</h2>
          <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
            From the QLD state-budget Youth Justice expenditure lines. Detention costs ~<span className="font-black">${detention > 0 && community > 0 ? Math.round(detention / community * 100) / 100 : '—'}</span> for every $1 spent on community-based services.
          </p>
          <div className="border-4 border-bauhaus-black p-6 bg-white">
            {(() => {
              const total = detention + community + groupConferencing;
              const peak = Math.max(detention, community, groupConferencing) || 1;
              const segs = [
                { label: 'Detention services', value: detention, color: 'bg-bauhaus-red' },
                { label: 'Community-based services', value: community, color: 'bg-bauhaus-blue' },
                { label: 'Group conferencing', value: groupConferencing, color: 'bg-bauhaus-yellow' },
              ];
              return (
                <>
                  {segs.map(s => {
                    const pct = total > 0 ? (s.value / total) * 100 : 0;
                    const w = (s.value / peak) * 100;
                    return (
                      <div key={s.label} className="mb-4 last:mb-0">
                        <div className="flex justify-between text-xs font-mono mb-1">
                          <span className="font-black text-bauhaus-black">{s.label}</span>
                          <span className="text-bauhaus-muted">{money(s.value)} · {pct.toFixed(0)}%</span>
                        </div>
                        <div className="relative h-7 bg-bauhaus-canvas border-2 border-bauhaus-black">
                          <div className={`absolute inset-y-0 left-0 ${s.color}`} style={{ width: `${w}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-4 pt-3 border-t-2 border-bauhaus-black text-xs font-mono text-bauhaus-muted">
                    Total Youth Justice expenditure surfaced: <span className="font-black text-bauhaus-black">{money(total)}</span> · ratio detention:community = <span className="font-black text-bauhaus-red">{detentionRatio}</span>:1
                  </div>
                </>
              );
            })()}
          </div>
        </section>
      )}

      {/* §3 — Top community partners */}
      {r.partners.length > 0 && (
        <section className="mb-16">
          <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§3</div>
          <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Top Community Partners (the $1.49B community spend goes here)</h2>
          <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
            Cumulative grants from QLD&apos;s justice-funding stream tagged youth-justice. Recipients include both Aboriginal Community-Controlled Organisations and large national NGOs.
          </p>
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Recipient</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Grants</th>
                </tr>
              </thead>
              <tbody>
                {r.partners.map((p, i) => (
                  <tr key={p.recipient_name} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="p-3 font-black text-bauhaus-black">{p.recipient_name}</td>
                    <td className="p-3 text-right font-mono font-black">{money(p.total)}</td>
                    <td className="p-3 text-right font-mono">{p.grants}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* §4 — Evidence */}
      {r.alma.length > 0 && (
        <section className="mb-16">
          <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">§4</div>
          <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">What the Evidence Says Works (ALMA)</h2>
          <p className="text-bauhaus-muted font-medium max-w-3xl mb-6">
            Australian Living Map of Alternatives (ALMA) — community-endorsed and evaluated diversion / wraparound / justice reinvestment interventions with QLD presence.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {r.alma.map((a, i) => {
              const ev = (a.evidence_level || '').toLowerCase();
              const tone = ev.includes('proven') ? 'border-bauhaus-blue' : ev.includes('promising') ? 'border-bauhaus-yellow' : 'border-bauhaus-black';
              return (
                <div key={i} className={`border-4 ${tone} p-4 bg-white`}>
                  <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-1">{a.type}</div>
                  <div className="font-black text-bauhaus-black uppercase tracking-tight text-sm mb-2 leading-tight">{a.name}</div>
                  <div className="text-xs text-bauhaus-muted font-mono leading-relaxed">
                    {a.evidence_level ? <span className="block mb-1">Evidence: {a.evidence_level}</span> : null}
                    {Array.isArray(a.geography) && a.geography.length ? <span className="block">Geography: {a.geography.join(' · ')}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* §5 — What this means */}
      <section className="border-4 border-bauhaus-black p-8 bg-white mb-12">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">For Boards · Funders · Journalists · Sector Peers</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-4">What this means for you</h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm font-medium leading-relaxed text-bauhaus-black">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-2">If you fund youth-justice work in QLD</div>
            <ul className="space-y-2">
              <li><span className="font-black">Spending ratio is structural.</span> {detentionRatio}:1 detention to community means dollars going into hardware (cells, beds, custody staff), not the diversion / wraparound programs the ALMA evidence supports.</li>
              <li><span className="font-black">First Nations over-representation is daily-data, not a quarterly statistic.</span> Today {fnPctChild}% of children in QLD watchhouses are First Nations. Frame your grants against this denominator.</li>
              <li><span className="font-black">Community-controlled orgs receive a small share.</span> Bigger NGOs (Anglicare, Mission Australia, Lifeline) hold the largest contracts; ACCOs are funded but at materially smaller dollar amounts.</li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-2">If you sit on a board doing youth-justice work</div>
            <ul className="space-y-2">
              <li><span className="font-black">Map your funder concentration.</span> If &gt;70% of your revenue comes from one Justice department line item, that&apos;s a single-funder dependency — see how FECCA / ECCV manage that risk.</li>
              <li><span className="font-black">Audit your evidence-level disclosure.</span> Of the ~12 ALMA-listed interventions for QLD, very few are at &ldquo;proven&rdquo; level. Most are &ldquo;promising&rdquo; or &ldquo;untested&rdquo;. Funders are starting to ask.</li>
              <li><span className="font-black">Watchhouse-data should sit on every QLD YJ board agenda.</span> It&apos;s public, daily, and tells you who&apos;s in custody right now.</li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">If you&apos;re a journalist</div>
            <ul className="space-y-2">
              <li><span className="font-black">The watchhouse data is fresh every 12 hours</span> — published by QPS, scraped here. Pair it with the day&apos;s political news for live context.</li>
              <li><span className="font-black">The detention-vs-community spend ratio</span> is publicly disclosed in the QLD budget; the ratio is the story most coverage misses.</li>
              <li><span className="font-black">First-Nations longest-hold-in-watchhouse stats</span> are a metric few reports use. They quantify the system&apos;s pressure point.</li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-2">If you run advocacy / a sector peak</div>
            <ul className="space-y-2">
              <li><span className="font-black">$1.88B detention vs $1.49B community</span> is a campaign-grade statistic. Detention isn&apos;t cheaper; it&apos;s structurally larger.</li>
              <li><span className="font-black">First-Nations children at 91% of in-custody kids</span> is a Closing-the-Gap-relevant signal under target outcome 11.</li>
              <li><span className="font-black">ALMA-listed alternatives</span> are real, evaluated, community-endorsed work. Surface them in submissions; the &ldquo;there&apos;s no alternative&rdquo; framing doesn&apos;t hold.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-4 border-bauhaus-black p-8 bg-bauhaus-yellow mb-12">
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-3">Was this useful?</h2>
        <p className="text-bauhaus-black font-medium leading-relaxed max-w-3xl mb-5">
          We&apos;re building CivicGraph in public. Same pipeline works for any sector or organisation &mdash; multicultural peak bodies, youth-justice ACCOs, foundations, lobbyists, federal procurement. Tell us what was valuable and what you&apos;d want next, anonymously if you like.
        </p>
        <Link href="/feedback?subject=qld-youth-justice" className="inline-block px-5 py-3 text-sm font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red">★ Send feedback (~2 min) →</Link>
      </section>

      <section className="text-center mb-8">
        <div className="text-xs font-mono text-bauhaus-muted">
          Watchhouse: refreshed twice daily from QPS · Funding: QLD state-budget &amp; Justice department disclosures · ALMA: public living-map of alternatives · Last loaded {new Date().toISOString().slice(0, 10)}
        </div>
      </section>
    </div>
  );
}
