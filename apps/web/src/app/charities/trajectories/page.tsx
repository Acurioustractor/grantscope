import type { Metadata } from 'next';
import Link from 'next/link';
import { Shell } from '@/components/shell/shell';
import { TREND_LABEL, trajectoryLists, type TrajectoryLists, type TrajectoryRow } from '@/lib/charity-trajectory';
import { shrinkingCouncils, type AllocationRow } from '@/lib/allocation';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Charity trajectories — CivicGraph',
  description: 'Seven years of ACNC statements read as direction: which charities are growing, shrinking, living on government revenue, or running deficits three years straight.',
};

const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

function money(n: number | null | undefined): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}bn`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n).toLocaleString('en-AU')}`;
}
function pct(n: number | null | undefined, signed = false): string {
  if (n == null) return '—';
  const s = `${Math.round(n)}%`;
  return signed && n > 0 ? `+${s}` : s;
}
function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className="border-2 border-bauhaus-black px-2 py-[2px] text-[11px] font-black uppercase tracking-widest" style={active ? { background: '#121212', color: '#F0F0F0' } : { background: '#fff', color: '#121212' }}>
      {children}
    </Link>
  );
}

const TREND_TONE: Record<TrajectoryRow['trend'], string> = { growing: '#059669', steady: '#121212', shrinking: '#D02020', lapsed: '#777777', single_year: '#777777' };

export default async function TrajectoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const state = typeof sp.state === 'string' && STATES.includes(sp.state) ? sp.state : '';
  let lists: TrajectoryLists | null = null;
  let councils: AllocationRow[] = [];
  let why: string | null = null;
  try {
    [lists, councils] = await Promise.all([trajectoryLists(state), shrinkingCouncils(state).catch(() => [] as AllocationRow[])]);
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }
  const total = lists?.cohort.reduce((a, c) => a + c.n, 0) ?? 0;
  const href = (s: string) => (s ? `/charities/trajectories?state=${s}` : '/charities/trajectories');

  return (
    <Shell title="Charity trajectories">
      <div className="mx-auto max-w-[1180px] px-6 py-6">
        <h1 className="font-display text-[22px] font-extrabold uppercase tracking-tight">Charity trajectories</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed" style={{ color: '#333' }}>
          Every registered charity files an Annual Information Statement. Read one year and you get a size. Read
          seven and you get a direction: growing, shrinking, leaning on one government line, running deficits.
          This page reads 2017 to 2023 for every ABN on the register and sorts the register by what moved.
        </p>
        <p className="mt-1 text-[13px]" style={{ color: '#777' }}>
          <Link href="/charities" className="underline" style={{ color: '#1040C0' }}>Back to the register</Link>
          {' · '}
          <Link href="/allocation" className="underline" style={{ color: '#1040C0' }}>Disadvantage versus dollars by council</Link>
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Chip href={href('')} active={!state}>Australia</Chip>
          {STATES.map((s) => <Chip key={s} href={href(s)} active={state === s}>{s}</Chip>)}
        </div>

        {why || !lists ? (
          <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>The trajectories could not be read: {why}</p>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
              {lists.cohort.map((c) => (
                <div key={c.trend} className="border-4 border-bauhaus-black bg-white px-3 py-2">
                  <div className="font-mono text-[10px] font-black uppercase tracking-widest" style={{ color: '#777' }}>{TREND_LABEL[c.trend]}</div>
                  <div className="font-display text-[22px] font-black" style={{ color: TREND_TONE[c.trend], fontVariantNumeric: 'tabular-nums' }}>
                    {c.n.toLocaleString('en-AU')}
                    <span className="ml-2 text-[12px] font-bold" style={{ color: '#777' }}>{total ? Math.round((100 * c.n) / total) : 0}%</span>
                  </div>
                  <div className="text-[12px]" style={{ color: '#555' }}>{c.gov_dependent.toLocaleString('en-AU')} government-dependent · {c.three_year_deficit.toLocaleString('en-AU')} three-year deficits</div>
                </div>
              ))}
            </div>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-widest" style={{ color: '#777' }}>
              {total.toLocaleString('en-AU')} charities with at least one statement · growing and shrinking mean revenue moved more than a fifth between first and latest statement · government-dependent means 70% or more of latest revenue came from government
            </p>

            <Table
              title="Large charities that have shrunk most"
              note="Peak revenue over $1m, revenue down more than a fifth from first to latest statement, still reporting some revenue. Sorted by the size of the fall. Charities at $0 are dormant or mid-wind-up and sit in the deficit and lapsed lists instead."
              rows={lists.shrinkingLarge}
              cols={[
                { h: 'First → latest', r: (r) => `${money(r.revenue_first)} → ${money(r.revenue_last)}`, right: true },
                { h: 'Change', r: (r) => pct(r.revenue_change_pct, true), right: true, tone: () => '#D02020' },
                { h: 'Gov share', r: (r) => pct(r.gov_share_last_pct), right: true },
                { h: 'Reserves', r: (r) => (r.reserve_months == null ? '—' : `${r.reserve_months.toFixed(0)} mo`), right: true },
              ]}
            />
            <Table
              title="Living on government revenue"
              note="Latest revenue over $1m and 70% or more of it from government. Sorted by that share, then size. A single contract ending is the whole organisation ending."
              rows={lists.govDependent}
              cols={[
                { h: 'Latest revenue', r: (r) => money(r.revenue_last), right: true },
                { h: 'From government', r: (r) => money(r.gov_revenue_last), right: true },
                { h: 'Gov share', r: (r) => pct(r.gov_share_last_pct), right: true, tone: () => '#D02020' },
                { h: 'Was (first yr)', r: (r) => pct(r.gov_share_first_pct), right: true },
              ]}
            />
            <Table
              title="Deficits three statements running"
              note="A deficit in each of the last three statements on file, largest first. Reserves are net assets over annual expenses, in months."
              rows={lists.threeYearDeficit}
              cols={[
                { h: 'Latest revenue', r: (r) => money(r.revenue_last), right: true },
                { h: 'Margin', r: (r) => pct(r.margin_last_pct, true), right: true, tone: () => '#D02020' },
                { h: 'Reserves', r: (r) => (r.reserve_months == null ? '—' : `${r.reserve_months.toFixed(0)} mo`), right: true },
                { h: 'Staff FTE', r: (r) => (r.fte_last == null ? '—' : Math.round(r.fte_last).toLocaleString('en-AU')), right: true },
              ]}
            />
            <Table
              title="Where donations changed the shape of the organisation"
              note="Charities over $1m with four or more statements whose donations-and-bequests share of revenue moved 15 points or more, either way. This is the philanthropy signal: money that arrived or money that left."
              rows={lists.donationShift}
              cols={[
                { h: 'Donation share, first → latest', r: (r) => `${pct(r.donation_share_first_pct)} → ${pct(r.donation_share_last_pct)}`, right: true, tone: (r) => ((r.donation_share_last_pct ?? 0) >= (r.donation_share_first_pct ?? 0) ? '#059669' : '#D02020') },
                { h: 'Donations, latest', r: (r) => money(r.donations_last), right: true },
                { h: 'Revenue, latest', r: (r) => money(r.revenue_last), right: true },
                { h: 'Trend', r: (r) => TREND_LABEL[r.trend], tone: (r) => TREND_TONE[r.trend] },
              ]}
            />
            <Table
              title="Fastest compound growth from a $1m base"
              note="Started above $1m in their first statement; sorted by compound annual growth to the latest."
              rows={lists.growingLarge}
              cols={[
                { h: 'First → latest', r: (r) => `${money(r.revenue_first)} → ${money(r.revenue_last)}`, right: true },
                { h: 'Growth / yr', r: (r) => pct(r.revenue_cagr_pct, true), right: true, tone: () => '#059669' },
                { h: 'Gov share', r: (r) => pct(r.gov_share_last_pct), right: true },
                { h: 'Donation share', r: (r) => pct(r.donation_share_last_pct), right: true },
              ]}
            />

            <section className="mt-8">
              <h2 className="font-display text-[15px] font-black uppercase tracking-widest">Councils where charities are shrinking</h2>
              <p className="mt-1 text-[12px]" style={{ color: '#555' }}>Councils with ten or more charities on file, sorted by the share whose revenue fell more than a fifth from first statement to latest. Revenue lost is the sum of those falls, a year. Each council links to its allocation page with the charities named.</p>
              <div className="mt-2 overflow-x-auto border-4 border-bauhaus-black bg-white">
                <table className="w-full min-w-[820px] border-collapse text-[13px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr className="border-b-4 border-bauhaus-black">
                      {['Council', 'Need', 'Charities on file', 'Shrinking', 'Share', 'Revenue lost / yr', 'Growing', 'On government'].map((h, i) => (
                        <th key={h} className={`px-2 py-2 font-mono text-[10px] font-black uppercase tracking-widest ${i >= 2 ? 'text-right' : 'text-left'}`} style={{ color: '#777' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {councils.map((c) => (
                      <tr key={c.lga_code} className="border-b border-[#D0D0D0] hover:bg-[#F7F7F7]">
                        <td className="px-2 py-[6px]"><Link href={`/allocation/${c.lga_code}`} className="font-semibold hover:underline" style={{ color: '#1040C0' }}>{c.lga_name}</Link><span className="ml-1 font-mono text-[10px]" style={{ color: '#777' }}>{[c.state, (c.remoteness ?? '').replace(' of Australia', '').replace(' Australia', '')].filter(Boolean).join(' · ')}</span></td>
                        <td className="px-2 py-[6px] font-black" style={{ color: c.irsd_decile != null && c.irsd_decile <= 2.5 ? '#D02020' : '#121212' }}>{c.irsd_decile?.toFixed(1) ?? '—'}</td>
                        <td className="px-2 py-[6px] text-right">{c.charities_tracked.toLocaleString('en-AU')}</td>
                        <td className="px-2 py-[6px] text-right font-black" style={{ color: '#D02020' }}>{c.charities_shrinking.toLocaleString('en-AU')}</td>
                        <td className="px-2 py-[6px] text-right">{c.shrinking_share_pct == null ? '—' : `${Math.round(c.shrinking_share_pct)}%`}</td>
                        <td className="px-2 py-[6px] text-right">{money(c.shrinking_revenue_lost)}</td>
                        <td className="px-2 py-[6px] text-right">{c.charities_growing.toLocaleString('en-AU')}</td>
                        <td className="px-2 py-[6px] text-right">{c.charities_gov_dependent.toLocaleString('en-AU')}</td>
                      </tr>
                    ))}
                    {councils.length === 0 ? <tr><td colSpan={8} className="px-2 py-4 text-center" style={{ color: '#777' }}>No council here has ten charities on file.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 max-w-3xl border-4 border-bauhaus-black bg-white p-4 text-[13px] leading-relaxed">
              <h2 className="font-display text-[13px] font-black uppercase tracking-widest">How to read this</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Every figure is the charity&apos;s own statement to the ACNC, as filed. Nothing is adjusted for inflation, mergers or a change of reporting entity; a group that consolidated will look like it grew.</li>
                <li>&ldquo;No statement since 2021&rdquo; can mean the charity closed, merged, lost registration, or that its latest return is not yet in the extract. It is a question to ask, not a finding.</li>
                <li>Government share is <code>revenue_from_government</code> over <code>total_revenue</code>. It includes grants, contracts and fee-for-service paid by any level of government.</li>
                <li>Reserves in months is net assets over annual expenses, times twelve. It counts buildings and endowments as if they were cash, so it overstates what a service could actually spend.</li>
              </ul>
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}

function Table({ title, note, rows, cols }: {
  title: string;
  note: string;
  rows: TrajectoryRow[];
  cols: { h: string; r: (r: TrajectoryRow) => string; right?: boolean; tone?: (r: TrajectoryRow) => string }[];
}) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-[15px] font-black uppercase tracking-widest">{title}</h2>
      <p className="mt-1 text-[12px]" style={{ color: '#555' }}>{note}</p>
      <div className="mt-2 overflow-x-auto border-4 border-bauhaus-black bg-white">
        <table className="w-full min-w-[820px] border-collapse text-[13px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="border-b-4 border-bauhaus-black">
              <th className="px-2 py-2 text-left font-mono text-[10px] font-black uppercase tracking-widest" style={{ color: '#777' }}>Charity</th>
              <th className="px-2 py-2 text-left font-mono text-[10px] font-black uppercase tracking-widest" style={{ color: '#777' }}>Years</th>
              {cols.map((c) => <th key={c.h} className={`px-2 py-2 font-mono text-[10px] font-black uppercase tracking-widest ${c.right ? 'text-right' : 'text-left'}`} style={{ color: '#777' }}>{c.h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.abn} className="border-b border-[#D0D0D0] hover:bg-[#F7F7F7]">
                <td className="px-2 py-[6px]">
                  <Link href={`/charities/${r.abn}`} className="font-semibold hover:underline" style={{ color: '#1040C0' }}>{r.charity_name}</Link>
                  <span className="ml-1 font-mono text-[10px]" style={{ color: '#777' }}>{[r.charity_size, r.state, r.lga_name].filter(Boolean).join(' · ')}</span>
                </td>
                <td className="px-2 py-[6px] font-mono text-[11px]" style={{ color: '#555' }}>{r.first_year}–{r.last_year}</td>
                {cols.map((c) => <td key={c.h} className={`px-2 py-[6px] ${c.right ? 'text-right' : ''}`} style={{ color: c.tone?.(r) }}>{c.r(r)}</td>)}
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={2 + cols.length} className="px-2 py-4 text-center" style={{ color: '#777' }}>Nothing matches here.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
