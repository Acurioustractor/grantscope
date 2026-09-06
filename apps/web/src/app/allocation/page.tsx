import type { Metadata } from 'next';
import Link from 'next/link';
import { Shell } from '@/components/shell/shell';
import { placeSlug } from '@/lib/atlas/share';
import { getRemoteCouncils } from '@/lib/services/council-place-report';
import {
  ALLOCATION_SORTS,
  REMOTENESS_BANDS,
  STATES,
  UNFILTERED,
  listAllocation,
  parseAllocationFilters,
  summariseAllocation,
  type AllocationFilters,
  type AllocationRow,
  type AllocationSort,
} from '@/lib/allocation';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Allocation — CivicGraph',
  description:
    'Disadvantage versus dollars for every council in Australia: SEIFA need, population, the organisations placed there, what government and donors put into them, and how sure each row is.',
};

function money(n: number | null | undefined): string {
  if (n == null || n === 0) return '—';
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}bn`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n).toLocaleString('en-AU')}`;
}
function num(n: number | null | undefined): string {
  return n == null ? '—' : Math.round(n).toLocaleString('en-AU');
}
function perHead(n: number | null | undefined, population: number | null): string {
  if (!population) return 'no pop.';
  if (n == null) return '—';
  return `$${Math.round(n).toLocaleString('en-AU')}`;
}
function decileTone(d: number | null): string {
  if (d == null) return '#777777';
  if (d <= 2.5) return '#D02020';
  if (d <= 5.5) return '#B8860B';
  return '#121212';
}
function remotenessShort(r: string | null): string {
  return (r ?? '—').replace(' of Australia', '').replace(' Australia', '');
}

const DECILE_CHIPS: { key: string; label: string }[] = [
  { key: '', label: 'All need' },
  { key: '1-2', label: 'Most disadvantaged (decile 1–2)' },
  { key: '3-5', label: 'Decile 3–5' },
  { key: '6-10', label: 'Decile 6–10' },
];

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="border-2 border-bauhaus-black px-2 py-[2px] text-[11px] font-black uppercase tracking-widest"
      style={active ? { background: '#121212', color: '#F0F0F0' } : { background: '#fff', color: '#121212' }}
    >
      {children}
    </Link>
  );
}

/**
 * Every column sorts. First click gives the column its natural direction (need ascending, money descending);
 * a click on the active column flips it. The arrow shows the direction in force; inactive columns show a
 * faint pair so the reader knows they can be clicked.
 */
function Head({ label, sortKey, f, qs, className, title }: { label: string; sortKey: AllocationSort; f: AllocationFilters; qs: (o: Record<string, string>) => string; className?: string; title?: string }) {
  const active = f.sort === sortKey;
  const next = active ? (f.dir === 'asc' ? 'desc' : 'asc') : ALLOCATION_SORTS[sortKey].defaultDir;
  return (
    <th className={`px-2 py-2 text-left font-mono text-[10px] font-black uppercase tracking-widest ${className ?? ''}`} title={title ? `${title}. Click to sort ${next === 'asc' ? 'lowest first' : 'highest first'}.` : `Sort ${next === 'asc' ? 'lowest first' : 'highest first'}`}>
      <Link href={qs({ sort: sortKey, dir: next })} className="whitespace-nowrap hover:underline" style={{ color: active ? '#121212' : '#777777' }}>
        {label}<span className="ml-[2px]" style={{ color: active ? '#D02020' : '#C0C0C0' }}>{active ? (f.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </Link>
    </th>
  );
}

export default async function AllocationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const f = parseAllocationFilters(sp);
  let rows: AllocationRow[] = [];
  let all: AllocationRow[] = [];
  let why: string | null = null;
  try {
    const filtered = f.state || f.remoteness || f.decile || f.q || f.sure;
    [rows, all] = await Promise.all([
      listAllocation(f),
      filtered ? listAllocation(UNFILTERED) : Promise.resolve([] as AllocationRow[]),
    ]);
    if (!filtered) all = rows;
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }
  const nation = summariseAllocation(all);
  // A council page exists only for councils holding remote community-controlled organisations, and it
  // is keyed by the register's name, which can be a truncation of the ABS name ("Lower Eyre" for
  // "Lower Eyre Peninsula"). Link only where a page exists; everything else is plain text, not a 404.
  const councilSlugs = await getRemoteCouncils().then((cs) => cs.map((c) => c.slug)).catch(() => [] as string[]);
  const councilHref = (name: string): string | null => {
    const want = placeSlug(name);
    const hit = councilSlugs.find((s) => s === want) ?? councilSlugs.find((s) => want.startsWith(s + '-') || s.startsWith(want + '-'));
    return hit ? `/place/council/${hit}` : null;
  };
  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string> = { state: f.state, remoteness: f.remoteness, decile: f.decile, q: f.q, sure: f.sure, sort: f.sort, dir: f.dir, ...over };
    const sortKey = (merged.sort || 'need') as AllocationSort;
    for (const [k, v] of Object.entries(merged)) {
      if (!v) continue;
      if (k === 'sort' && v === 'need') continue;
      if (k === 'dir' && v === ALLOCATION_SORTS[sortKey].defaultDir) continue;
      p.set(k, v);
    }
    const s = p.toString();
    return `/allocation${s ? `?${s}` : ''}`;
  };

  return (
    <Shell title="Allocation">
      <div className="mx-auto max-w-[1600px] px-2 py-6">
        <h1 className="font-display text-[22px] font-extrabold uppercase tracking-tight">Disadvantage versus dollars, by council</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed" style={{ color: '#333' }}>
          Every council in Australia on one line: how disadvantaged it is, how many people live there, which
          organisations are placed there, and what government and donors put into those organisations in the
          latest reporting year. The last column says how sure we are, because a postcode that straddles two
          councils leaves organisations we cannot place. Those are counted, never guessed.
        </p>

        {why ? (
          <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>The table could not be read: {why}</p>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-6">
              <Stat label="Councils" value={num(nation.councils)} />
              <Stat label="Charity revenue from government, 2023" value={money(nation.charity_gov_revenue)} hint="Sum of revenue_from_government across every charity placed in a council, ACNC statements for 2023" />
              <Stat label="Donations and bequests, 2023" value={money(nation.charity_donations)} hint="Same statements, donations_and_bequests" />
              <Stat label="Commonwealth grants, last 24 months" value={money(nation.cw_grant_value_24m)} hint="GrantConnect awards approved in the last two years, by recipient's council" />
              <Stat label="Of which state where delivered" value={nation.cw_grant_value_24m ? `${Math.round((100 * nation.cw_recipient_24m_with_delivery) / nation.cw_grant_value_24m)}%` : '—'} hint={`${money(nation.cw_recipient_24m_with_delivery)} of those awards carry a delivery postcode the ABS can place. The National Indigenous Australians Agency states none; Health 2%.`} tone="#B8860B" />
              <Stat label="Decile 1–2 councils under the median $/head" value={num(nation.under_median_disadvantaged)} hint={`National median government revenue per head is $${num(nation.median_gov_per_head)}`} tone="#D02020" />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Chip href={qs({ state: '' })} active={!f.state}>All states</Chip>
              {STATES.map((s) => <Chip key={s} href={qs({ state: s })} active={f.state === s}>{s}</Chip>)}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip href={qs({ remoteness: '' })} active={!f.remoteness}>All remoteness</Chip>
              {REMOTENESS_BANDS.map((r) => <Chip key={r} href={qs({ remoteness: r })} active={f.remoteness === r}>{remotenessShort(r)}</Chip>)}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {DECILE_CHIPS.map((d) => <Chip key={d.key} href={qs({ decile: d.key })} active={f.decile === d.key}>{d.label}</Chip>)}
              <Chip href={qs({ sure: f.sure === '80' ? '' : '80' })} active={f.sure === '80'}>Sure rows only (80%+)</Chip>
            </div>
            <form action="/allocation" method="get" className="mt-3 flex flex-wrap items-center gap-2">
              {f.state ? <input type="hidden" name="state" value={f.state} /> : null}
              {f.remoteness ? <input type="hidden" name="remoteness" value={f.remoteness} /> : null}
              {f.decile ? <input type="hidden" name="decile" value={f.decile} /> : null}
              {f.sure ? <input type="hidden" name="sure" value={f.sure} /> : null}
              {f.sort !== 'need' ? <input type="hidden" name="sort" value={f.sort} /> : null}
              {f.dir !== ALLOCATION_SORTS[f.sort].defaultDir ? <input type="hidden" name="dir" value={f.dir} /> : null}
              <input name="q" defaultValue={f.q} placeholder="Council name" maxLength={60} className="border-2 border-bauhaus-black bg-white px-2 py-1 font-mono text-[12px]" style={{ width: 220 }} />
              <button type="submit" className="border-2 border-bauhaus-black bg-bauhaus-black px-2 py-1 font-mono text-[11px] font-black uppercase tracking-widest text-white">Find</button>
              {f.q ? <Link href={qs({ q: '' })} className="font-mono text-[11px] uppercase tracking-widest underline" style={{ color: '#777' }}>clear</Link> : null}
            </form>

            <p className="mt-4 font-mono text-[11px] uppercase tracking-widest" style={{ color: '#777' }}>
              {rows.length} councils · sorted by {ALLOCATION_SORTS[f.sort].label}, {f.dir === 'asc' ? 'lowest first' : 'highest first'} · click a column to sort, click again to flip
            </p>

            <div className="mt-2 overflow-x-auto border-4 border-bauhaus-black bg-white">
              <table className="w-full min-w-[1180px] border-collapse text-[13px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr className="border-b-4 border-bauhaus-black">
                    <Head label="Council" sortKey="name" f={f} qs={qs} />
                    <Head label="Where" sortKey="remoteness" f={f} qs={qs} title="ABS remoteness band of the council's largest postcode" />
                    <Head label="Need" sortKey="need" f={f} qs={qs} title="SEIFA IRSD decile, weighted across the council's postcodes. 1 is the most disadvantaged tenth of Australia." />
                    <Head label="People" sortKey="population" f={f} qs={qs} className="text-right" title="ABS estimated resident population, 2023" />
                    <Head label="Orgs" sortKey="orgs" f={f} qs={qs} className="text-right" title="Entities placed in this council (community-controlled in brackets)" />
                    <Head label="Gov $ / head" sortKey="gov_per_head" f={f} qs={qs} className="text-right" title="Revenue from government reported by charities placed here, 2023, divided by population" />
                    <Head label="Donations / head" sortKey="donations_per_head" f={f} qs={qs} className="text-right" title="Donations and bequests reported by charities placed here, 2023, divided by population" />
                    <Head label="Cwlth grants / head" sortKey="grants_per_head" f={f} qs={qs} className="text-right" title="GrantConnect awards to recipients placed here, approved in the last two years, divided by population" />
                    <Head label="Delivered / head" sortKey="delivered_per_head" f={f} qs={qs} className="text-right" title="The same awards spread by the delivery postcode the agency stated, divided by population. Grey percentage: how much of this council's recipient-lane money carries a delivery postcode at all" />
                    <Head label="Shrinking" sortKey="shrinking" f={f} qs={qs} className="text-right" title="Charities placed here whose revenue fell more than 20% from first statement to latest (2017 to 2023), as a share of charities with a statement" />
                    <Head label="How sure" sortKey="sure" f={f} qs={qs} className="text-right" title="Placed entities as a share of placed plus entities sharing this council's postcodes that could not be placed" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.lga_code} className="border-b border-[#D0D0D0] hover:bg-[#F7F7F7]">
                      <td className="px-2 py-[6px]">
                        <Link href={`/allocation/${r.lga_code}`} className="font-semibold hover:underline" style={{ color: '#1040C0' }}>{r.lga_name}</Link>
                        {councilHref(r.lga_name) ? <Link href={councilHref(r.lga_name)!} className="ml-1 font-mono text-[10px] uppercase hover:underline" style={{ color: '#777' }} title="Place page: organisations we could not place, and a correction form">place</Link> : null}
                        <span className="ml-1 font-mono text-[10px]" style={{ color: '#777' }}>{r.state}</span>
                      </td>
                      <td className="px-2 py-[6px] text-[12px]" style={{ color: '#555' }}>{remotenessShort(r.remoteness)}</td>
                      <td className="px-2 py-[6px] font-black" style={{ color: decileTone(r.irsd_decile) }}>
                        {r.irsd_decile == null ? '—' : r.irsd_decile.toFixed(1)}
                        {r.min_irsd_decile != null && r.irsd_decile != null && r.min_irsd_decile < Math.floor(r.irsd_decile) ? <span className="ml-1 font-mono text-[10px] font-normal" style={{ color: '#777' }} title="Most disadvantaged postcode touching this council">↓{r.min_irsd_decile}</span> : null}
                      </td>
                      <td className="px-2 py-[6px] text-right">{num(r.population)}</td>
                      <td className="px-2 py-[6px] text-right">{num(r.org_count)}{r.community_controlled ? <span className="ml-1 text-[11px]" style={{ color: '#777' }}>({r.community_controlled})</span> : null}</td>
                      <td className="px-2 py-[6px] text-right">{perHead(r.gov_revenue_per_head, r.population)}</td>
                      <td className="px-2 py-[6px] text-right">{perHead(r.donations_per_head, r.population)}</td>
                      <td className="px-2 py-[6px] text-right">{perHead(r.cw_grants_24m_per_head, r.population)}</td>
                      <td className="px-2 py-[6px] text-right">
                        {perHead(r.cw_delivery_24m_per_head, r.population)}
                        {r.cw_grant_value_24m > 0 ? <span className="ml-1 font-mono text-[10px]" style={{ color: '#777' }} title="Share of recipient-lane money here that states a delivery postcode">{r.cw_delivery_stated_pct == null ? '' : `${Math.round(r.cw_delivery_stated_pct)}%`}</span> : null}
                      </td>
                      <td className="px-2 py-[6px] text-right">
                        {r.charities_tracked === 0 ? <span style={{ color: '#777' }}>—</span> : <><span className="font-black" style={{ color: r.charities_shrinking > 0 && (r.shrinking_share_pct ?? 0) >= 25 ? '#D02020' : '#121212' }}>{num(r.charities_shrinking)}</span><span className="ml-1 font-mono text-[10px]" style={{ color: '#777' }}>of {num(r.charities_tracked)}</span></>}
                      </td>
                      <td className="px-2 py-[6px] text-right">
                        <Sure pct={r.placed_share_pct} unplaced={r.unplaced_sharing_postcodes} />
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? <tr><td colSpan={11} className="px-2 py-6 text-center" style={{ color: '#777' }}>No council matches these filters.</td></tr> : null}
                </tbody>
              </table>
            </div>

            <section className="mt-8 max-w-3xl border-4 border-bauhaus-black bg-white p-4 text-[13px] leading-relaxed">
              <h2 className="font-display text-[13px] font-black uppercase tracking-widest">How to read this</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><b>Need</b> is the SEIFA Index of Relative Socio-economic Disadvantage (2021), held per postcode and weighted into the council by each postcode's share. Decile 1 is the most disadvantaged tenth of Australia. The small arrow shows the worst postcode touching the council when it is more than a whole decile below the average.</li>
                <li><b>Gov $ / head</b> and <b>Donations / head</b> come from the Annual Information Statements every registered charity files with the ACNC. This is the whole register for 2023, not a sample. An organisation that is not a charity (a council, a company, a school) files nothing here.</li>
                <li><b>Money follows the recipient's address.</b> A land council or regional service in a hub town collects money that is spent hours away. A remote council can show $0 per head while being served from the next council over. Read the row together with its neighbours.</li>
                <li><b>Delivered here / head</b> is the second lane on the same GrantConnect awards. Some agencies state the postcode where the money is to be spent; where they do, the award is spread across councils by the ABS postcode-to-council ratio, so a postcode that straddles two councils splits the award instead of picking a side. The grey percentage is how much of the council&apos;s recipient-lane money states a delivery postcode at all. It is low almost everywhere that matters: the National Indigenous Australians Agency states none, Health, Disability and Ageing 2%, Education 11%, while the Australian Research Council states one on every dollar. A blank here is the record being silent, not money going elsewhere.</li>
                <li><b>Shrinking</b> counts charities placed here whose revenue fell more than a fifth between their first and latest statement, 2017 to 2023, out of those with a statement. A charity at $0 in its latest year is dormant and is not counted. The <Link href="/charities/trajectories" className="underline" style={{ color: '#1040C0' }}>trajectories page</Link> lists the councils where this share is highest.</li>
                <li><b>How sure</b> is the share of organisations we could place. Where a postcode crosses two councils and nothing in the record says which side an organisation is on, it is left unplaced and counted here. A row at 10% is a row about what we cannot see; do not read its dollar figures as a finding.</li>
                <li>Population is the ABS Estimated Resident Population for 2023. Commonwealth grants are GrantConnect awards approved in the last two years. Nothing on this page reads Xero, GoHighLevel or any private table.</li>
              </ul>
              <p className="mt-3" style={{ color: '#555' }}>
                Every council links to its own page: the charities placed there, largest first, with their direction, and its neighbours by need. Councils marked <span className="font-mono text-[10px] uppercase">place</span> also have a <Link href="/place/council" className="underline" style={{ color: '#1040C0' }}>place page</Link> listing the organisations we could not place, with a form to correct them. The earlier narrative on the same question is <Link href="/reports/funding-deserts" className="underline" style={{ color: '#1040C0' }}>Where the Money Doesn&apos;t Go</Link>.
              </p>
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="border-4 border-bauhaus-black bg-white px-3 py-2" title={hint}>
      <div className="font-mono text-[10px] font-black uppercase tracking-widest" style={{ color: '#777' }}>{label}</div>
      <div className="font-display text-[22px] font-black" style={{ color: tone ?? '#121212', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function Sure({ pct, unplaced }: { pct: number | null; unplaced: number }) {
  if (pct == null) return <span style={{ color: '#777' }}>—</span>;
  const tone = pct >= 80 ? '#059669' : pct >= 40 ? '#B8860B' : '#D02020';
  return (
    <span title={`${unplaced.toLocaleString('en-AU')} organisations share this council's postcodes and could not be placed`}>
      <span className="font-black" style={{ color: tone }}>{Math.round(pct)}%</span>
      {unplaced > 0 ? <span className="ml-1 font-mono text-[10px]" style={{ color: '#777' }}>{unplaced.toLocaleString('en-AU')} unplaced</span> : null}
    </span>
  );
}
