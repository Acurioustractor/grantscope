import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shell } from '@/components/shell/shell';
import { placeSlug } from '@/lib/atlas/share';
import { getRemoteCouncils } from '@/lib/services/council-place-report';
import { allocationForCode, stateNeighbours, type AllocationRow } from '@/lib/allocation';
import { charitiesInCouncil, TREND_LABEL, type TrajectoryRow } from '@/lib/charity-trajectory';

export const dynamic = 'force-dynamic';

function money(n: number | null | undefined): string {
  if (n == null || n === 0) return '—';
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}bn`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n).toLocaleString('en-AU')}`;
}
const num = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('en-AU'));
const perHead = (n: number | null | undefined, pop: number | null) => (!pop ? 'no population' : n == null ? '—' : `$${Math.round(n).toLocaleString('en-AU')} a head`);
const pct = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n)}%`);
const TREND_TONE: Record<TrajectoryRow['trend'], string> = { growing: '#059669', steady: '#121212', shrinking: '#D02020', lapsed: '#777777', single_year: '#777777' };

export async function generateMetadata({ params }: { params: Promise<{ lga_code: string }> }): Promise<Metadata> {
  const { lga_code } = await params;
  const row = await allocationForCode(lga_code).catch(() => null);
  return {
    title: row ? `${row.lga_name}: disadvantage versus dollars — CivicGraph` : 'Council not found — CivicGraph',
    description: row ? `Need, population, the organisations placed in ${row.lga_name}, what they reported from government and donors, and how sure the record is.` : undefined,
  };
}

export default async function CouncilAllocationPage({ params }: { params: Promise<{ lga_code: string }> }) {
  const { lga_code } = await params;
  const row = await allocationForCode(lga_code).catch(() => null);
  if (!row) notFound();
  const [charities, neighbours, councilSlugs] = await Promise.all([
    charitiesInCouncil(lga_code).catch(() => ({ rows: [], total: 0, byTrend: { growing: 0, steady: 0, shrinking: 0, lapsed: 0, single_year: 0 } })),
    stateNeighbours(row.state).catch(() => [] as AllocationRow[]),
    getRemoteCouncils().then((cs) => cs.map((c) => c.slug)).catch(() => [] as string[]),
  ]);
  const want = placeSlug(row.lga_name);
  const councilSlug = councilSlugs.find((s) => s === want) ?? councilSlugs.find((s) => want.startsWith(s + '-') || s.startsWith(want + '-'));
  const sure = row.placed_share_pct;
  const sureTone = sure == null ? '#777' : sure >= 80 ? '#059669' : sure >= 40 ? '#B8860B' : '#D02020';

  return (
    <Shell title={row.lga_name}>
      <div className="mx-auto max-w-[1180px] px-6 py-6">
        <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: '#777' }}>
          <Link href="/allocation" className="hover:underline">Allocation</Link> · <Link href={`/allocation?state=${row.state}`} className="hover:underline">{row.state}</Link> · {row.remoteness ?? 'remoteness unknown'} · LGA {row.lga_code}
        </p>
        <h1 className="mt-1 font-display text-[26px] font-extrabold uppercase tracking-tight">{row.lga_name}</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed" style={{ color: '#333' }}>
          {num(row.population)} people. SEIFA need decile {row.irsd_decile == null ? 'unknown' : row.irsd_decile.toFixed(1)}
          {row.min_irsd_decile != null && row.irsd_decile != null && row.min_irsd_decile < Math.floor(row.irsd_decile) ? `, with a postcode at decile ${row.min_irsd_decile}` : ''}
          , where 1 is the most disadvantaged tenth of Australia. {num(row.org_count)} organisations placed here
          {row.community_controlled ? `, ${num(row.community_controlled)} of them community-controlled` : ''}. Money on this page follows the address of the organisation that received it, which is not always where it was spent.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Government revenue, charities here, 2023" value={money(row.charity_gov_revenue)} sub={perHead(row.gov_revenue_per_head, row.population)} />
          <Stat label="Donations and bequests, 2023" value={money(row.charity_donations)} sub={perHead(row.donations_per_head, row.population)} />
          <Stat label="Commonwealth grants, last 24 months" value={money(row.cw_grant_value_24m)} sub={`${num(row.cw_grant_count)} awards all time · ${perHead(row.cw_grants_24m_per_head, row.population)}`} />
          <Stat label="How sure" value={sure == null ? '—' : `${Math.round(sure)}%`} sub={`${num(row.unplaced_sharing_postcodes)} organisations share these postcodes and could not be placed`} tone={sureTone} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Charities reporting" value={num(row.charities_reporting)} sub={`${num(row.charity_fte)} full-time-equivalent staff`} />
          <Stat label="Total charity revenue, 2023" value={money(row.charity_revenue)} sub={row.charity_revenue ? `${Math.round((100 * row.charity_gov_revenue) / row.charity_revenue)}% from government` : ''} />
          <Stat label="Justice grants on record" value={money(row.jf_grant_value)} sub={`${num(row.jf_grant_count)} rows, grant lane only`} />
          <Stat label="AusTender contracts, last 24 months" value={money(row.contract_value_24m)} sub="by supplier address" />
        </div>

        {sure != null && sure < 40 ? (
          <p className="mt-4 border-4 border-bauhaus-black bg-[#FFF8E0] p-3 text-[13px]">
            <b>Read this row as a statement about the record.</b> Fewer than four in ten organisations touching these postcodes could be placed. The dollar figures above are what we can see, and most of what is here is in the unplaced count.
          </p>
        ) : null}

        <section className="mt-8">
          <h2 className="font-display text-[15px] font-black uppercase tracking-widest">Charities placed here, largest first</h2>
          <p className="mt-1 text-[12px]" style={{ color: '#555' }}>
            {num(charities.total)} with at least one ACNC statement:{' '}
            {(['growing', 'steady', 'shrinking', 'lapsed', 'single_year'] as TrajectoryRow['trend'][]).filter((t) => charities.byTrend[t] > 0).map((t) => `${charities.byTrend[t]} ${TREND_LABEL[t].toLowerCase()}`).join(' · ')}
            . Direction is first statement to latest, 2017 to 2023.
          </p>
          <div className="mt-2 overflow-x-auto border-4 border-bauhaus-black bg-white">
            <table className="w-full min-w-[820px] border-collapse text-[13px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr className="border-b-4 border-bauhaus-black">
                  {['Charity', 'Years', 'Latest revenue', 'Change', 'Gov share', 'Donations share', 'Direction'].map((h, i) => (
                    <th key={h} className={`px-2 py-2 font-mono text-[10px] font-black uppercase tracking-widest ${i >= 2 && i <= 5 ? 'text-right' : 'text-left'}`} style={{ color: '#777' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {charities.rows.map((r) => (
                  <tr key={r.abn} className="border-b border-[#D0D0D0] hover:bg-[#F7F7F7]">
                    <td className="px-2 py-[6px]"><Link href={`/charities/${r.abn}`} className="font-semibold hover:underline" style={{ color: '#1040C0' }}>{r.charity_name}</Link><span className="ml-1 font-mono text-[10px]" style={{ color: '#777' }}>{r.charity_size ?? ''}</span></td>
                    <td className="px-2 py-[6px] font-mono text-[11px]" style={{ color: '#555' }}>{r.first_year}–{r.last_year}</td>
                    <td className="px-2 py-[6px] text-right">{money(r.revenue_last)}</td>
                    <td className="px-2 py-[6px] text-right" style={{ color: (r.revenue_change_pct ?? 0) < 0 ? '#D02020' : '#121212' }}>{r.revenue_change_pct == null ? '—' : `${r.revenue_change_pct > 0 ? '+' : ''}${Math.round(r.revenue_change_pct)}%`}</td>
                    <td className="px-2 py-[6px] text-right" style={{ color: r.gov_dependent ? '#D02020' : undefined }}>{pct(r.gov_share_last_pct)}</td>
                    <td className="px-2 py-[6px] text-right">{pct(r.donation_share_last_pct)}</td>
                    <td className="px-2 py-[6px]" style={{ color: TREND_TONE[r.trend] }}>{TREND_LABEL[r.trend]}</td>
                  </tr>
                ))}
                {charities.rows.length === 0 ? <tr><td colSpan={7} className="px-2 py-4 text-center" style={{ color: '#777' }}>No charity with a financial statement is placed in this council.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-[15px] font-black uppercase tracking-widest">Neighbours by need, {row.state}</h2>
          <p className="mt-1 text-[12px]" style={{ color: '#555' }}>The most disadvantaged councils in the same state. A hub council next door often holds the address for money spent here.</p>
          <div className="mt-2 overflow-x-auto border-4 border-bauhaus-black bg-white">
            <table className="w-full min-w-[720px] border-collapse text-[13px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr className="border-b-4 border-bauhaus-black">
                  {['Council', 'Need', 'People', 'Orgs', 'Gov $ / head', 'Donations / head', 'How sure'].map((h, i) => (
                    <th key={h} className={`px-2 py-2 font-mono text-[10px] font-black uppercase tracking-widest ${i >= 2 ? 'text-right' : 'text-left'}`} style={{ color: '#777' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {neighbours.map((n) => (
                  <tr key={n.lga_code} className="border-b border-[#D0D0D0] hover:bg-[#F7F7F7]" style={n.lga_code === row.lga_code ? { background: '#FFF8E0' } : undefined}>
                    <td className="px-2 py-[6px]">{n.lga_code === row.lga_code ? <b>{n.lga_name}</b> : <Link href={`/allocation/${n.lga_code}`} className="font-semibold hover:underline" style={{ color: '#1040C0' }}>{n.lga_name}</Link>}</td>
                    <td className="px-2 py-[6px] font-black" style={{ color: n.irsd_decile != null && n.irsd_decile <= 2.5 ? '#D02020' : '#121212' }}>{n.irsd_decile?.toFixed(1) ?? '—'}</td>
                    <td className="px-2 py-[6px] text-right">{num(n.population)}</td>
                    <td className="px-2 py-[6px] text-right">{num(n.org_count)}</td>
                    <td className="px-2 py-[6px] text-right">{n.population ? `$${num(n.gov_revenue_per_head)}` : '—'}</td>
                    <td className="px-2 py-[6px] text-right">{n.population ? `$${num(n.donations_per_head)}` : '—'}</td>
                    <td className="px-2 py-[6px] text-right">{n.placed_share_pct == null ? '—' : `${Math.round(n.placed_share_pct)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 max-w-3xl border-4 border-bauhaus-black bg-white p-4 text-[13px] leading-relaxed">
          <h2 className="font-display text-[13px] font-black uppercase tracking-widest">Where this comes from, and what is missing</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Population is the ABS Estimated Resident Population, 2023. Need is SEIFA IRSD 2021, held per postcode and weighted into the council by each postcode&apos;s share of it.</li>
            <li>Government revenue and donations are what every charity placed here reported to the ACNC for 2023. Councils, companies and schools file nothing here, so a place run by its shire council can read as $0.</li>
            <li>{num(row.unplaced_sharing_postcodes)} organisations use a postcode that crosses into this council and could not be placed on one side of the line. They are counted, never guessed.</li>
            {councilSlug ? (
              <li>This council also has a <Link href={`/place/council/${councilSlug}`} className="underline" style={{ color: '#1040C0' }}>place page</Link> listing the organisations we could not place and a form to correct them.</li>
            ) : (
              <li>Corrections: <Link href="/charities/claim" className="underline" style={{ color: '#1040C0' }}>claim your organisation</Link> and its address is read from the claim.</li>
            )}
          </ul>
        </section>
      </div>
    </Shell>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="border-4 border-bauhaus-black bg-white px-3 py-2">
      <div className="font-mono text-[10px] font-black uppercase tracking-widest" style={{ color: '#777' }}>{label}</div>
      <div className="font-display text-[22px] font-black" style={{ color: tone ?? '#121212', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub ? <div className="text-[12px]" style={{ color: '#555' }}>{sub}</div> : null}
    </div>
  );
}
