import type { Metadata } from 'next';
import Link from 'next/link';
import { Shell } from '@/components/shell/shell';
import { placeSlug } from '@/lib/atlas/share';
import { getRemoteCouncils } from '@/lib/services/council-place-report';
import {
  ALLOCATION_SORTS,
  REMOTENESS_BANDS,
  STATES,
  listAllocation,
  parseAllocationFilters,
  summariseAllocation,
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

function Head({ label, sortKey, current, qs, className, title }: { label: string; sortKey: AllocationSort; current: AllocationSort; qs: (o: Record<string, string>) => string; className?: string; title?: string }) {
  const active = current === sortKey;
  return (
    <th className={`px-2 py-2 text-left font-mono text-[10px] font-black uppercase tracking-widest ${className ?? ''}`} title={title}>
      <Link href={qs({ sort: sortKey })} className="hover:underline" style={{ color: active ? '#121212' : '#777777' }}>
        {label}{active ? ' ▾' : ''}
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
    const filtered = f.state || f.remoteness || f.decile;
    [rows, all] = await Promise.all([
      listAllocation(f),
      filtered ? listAllocation({ state: '', remoteness: '', decile: '', sort: 'need' }) : Promise.resolve([] as AllocationRow[]),
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
    const merged: Record<string, string> = { state: f.state, remoteness: f.remoteness, decile: f.decile, sort: f.sort, ...over };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === 'sort' && v === 'need')) p.set(k, v);
    const s = p.toString();
    return `/allocation${s ? `?${s}` : ''}`;
  };

  return (
    <Shell title="Allocation">
      <div className="mx-auto max-w-[1280px] px-6 py-6">
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
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
              <Stat label="Councils" value={num(nation.councils)} />
              <Stat label="Charity revenue from government, 2023" value={money(nation.charity_gov_revenue)} hint="Sum of revenue_from_government across every charity placed in a council, ACNC statements for 2023" />
              <Stat label="Donations and bequests, 2023" value={money(nation.charity_donations)} hint="Same statements, donations_and_bequests" />
              <Stat label="Commonwealth grants, last 24 months" value={money(nation.cw_grant_value_24m)} hint="GrantConnect awards approved in the last two years, by recipient's council" />
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
            </div>

            <p className="mt-4 font-mono text-[11px] uppercase tracking-widest" style={{ color: '#777' }}>
              {rows.length} councils · sorted by {ALLOCATION_SORTS[f.sort].label} · click a column to sort
            </p>

            <div className="mt-2 overflow-x-auto border-4 border-bauhaus-black bg-white">
              <table className="w-full min-w-[1100px] border-collapse text-[13px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr className="border-b-4 border-bauhaus-black">
                    <Head label="Council" sortKey="name" current={f.sort} qs={qs} />
                    <th className="px-2 py-2 text-left font-mono text-[10px] font-black uppercase tracking-widest" style={{ color: '#777' }}>Where</th>
                    <Head label="Need" sortKey="need" current={f.sort} qs={qs} title="SEIFA IRSD decile, weighted across the council's postcodes. 1 is the most disadvantaged tenth of Australia." />
                    <Head label="People" sortKey="population" current={f.sort} qs={qs} className="text-right" title="ABS estimated resident population, 2023" />
                    <Head label="Orgs" sortKey="orgs" current={f.sort} qs={qs} className="text-right" title="Entities placed in this council (community-controlled in brackets)" />
                    <Head label="Gov $ / head" sortKey="gov_per_head" current={f.sort} qs={qs} className="text-right" title="Revenue from government reported by charities placed here, 2023, divided by population" />
                    <Head label="Donations / head" sortKey="donations_per_head" current={f.sort} qs={qs} className="text-right" title="Donations and bequests reported by charities placed here, 2023, divided by population" />
                    <Head label="Cwlth grants 24m / head" sortKey="grants_per_head" current={f.sort} qs={qs} className="text-right" title="GrantConnect awards to recipients placed here, approved in the last two years, divided by population" />
                    <Head label="How sure" sortKey="sure" current={f.sort} qs={qs} className="text-right" title="Placed entities as a share of placed plus entities sharing this council's postcodes that could not be placed" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.lga_code} className="border-b border-[#D0D0D0] hover:bg-[#F7F7F7]">
                      <td className="px-2 py-[6px]">
                        {councilHref(r.lga_name)
                          ? <Link href={councilHref(r.lga_name)!} className="font-semibold hover:underline" style={{ color: '#1040C0' }}>{r.lga_name}</Link>
                          : <span className="font-semibold">{r.lga_name}</span>}
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
                        <Sure pct={r.placed_share_pct} unplaced={r.unplaced_sharing_postcodes} />
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? <tr><td colSpan={9} className="px-2 py-6 text-center" style={{ color: '#777' }}>No council matches these filters.</td></tr> : null}
                </tbody>
              </table>
            </div>

            <section className="mt-8 max-w-3xl border-4 border-bauhaus-black bg-white p-4 text-[13px] leading-relaxed">
              <h2 className="font-display text-[13px] font-black uppercase tracking-widest">How to read this</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><b>Need</b> is the SEIFA Index of Relative Socio-economic Disadvantage (2021), held per postcode and weighted into the council by each postcode's share. Decile 1 is the most disadvantaged tenth of Australia. The small arrow shows the worst postcode touching the council when it is more than a whole decile below the average.</li>
                <li><b>Gov $ / head</b> and <b>Donations / head</b> come from the Annual Information Statements every registered charity files with the ACNC. This is the whole register for 2023, not a sample. An organisation that is not a charity (a council, a company, a school) files nothing here.</li>
                <li><b>Money follows the recipient's address.</b> A land council or regional service in a hub town collects money that is spent hours away. A remote council can show $0 per head while being served from the next council over. Read the row together with its neighbours.</li>
                <li><b>How sure</b> is the share of organisations we could place. Where a postcode crosses two councils and nothing in the record says which side an organisation is on, it is left unplaced and counted here. A row at 10% is a row about what we cannot see; do not read its dollar figures as a finding.</li>
                <li>Population is the ABS Estimated Resident Population for 2023. Commonwealth grants are GrantConnect awards approved in the last two years. Nothing on this page reads Xero, GoHighLevel or any private table.</li>
              </ul>
              <p className="mt-3" style={{ color: '#555' }}>
                Councils shown as links have a <Link href="/place/council" className="underline" style={{ color: '#1040C0' }}>council page</Link> listing the organisations behind the row and the ones we could not place, with a form to correct them. Those pages exist so far only for councils holding remote community-controlled organisations. The earlier narrative on the same question is <Link href="/reports/funding-deserts" className="underline" style={{ color: '#1040C0' }}>Where the Money Doesn&apos;t Go</Link>.
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
