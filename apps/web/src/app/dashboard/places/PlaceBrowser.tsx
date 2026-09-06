'use client';

import Link from 'next/link';
import { money, L, makeQs, useDrawer, Drawer, SortHeader } from '@/components/browse/browse-ui';

/**
 * Places browser at LGA grain. The drawer's provenance block shows HOW each entity was placed
 * (lga_source stamps from the attribution rebuild) — a null LGA elsewhere is deliberate
 * unplacement with a reason code, not missing data.
 *
 * The "Unfunded" column is the DB's `desert_score` with the subject of the sentence changed. The
 * score is built entirely from absence (no money flow, participants with no provider), so it
 * measures what funders did not do. Naming a PLACE a desert states a deficit about the community;
 * CARE E1 prohibits that, and it is the wrong reading of the number besides. See
 * docs/strategy/data-standard.md.
 */

export interface PlaceRow {
  key: string;
  lga: string;
  state: string;
  entities: number;
  acco: number;
  funding: number | null;
  seifa: number | null;
  remoteness: string | null;
  desert: number | null;
}

interface PlaceDetail {
  lga_name: string;
  state: string;
  funding: {
    entity_count: number | null;
    community_controlled_count: number | null;
    total_funding: number | null;
    avg_seifa_decile: number | null;
  } | null;
  desert: { desert_score: number | null; remoteness: string | null } | null;
  postcodes: { postcode: string; entity_count: number | null; total_funding: number | null; remoteness: string | null }[];
  placement: Record<string, number>;
}

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

/** Plain-word labels for lga_source stamps; unknown stamps fall through as-is. */
const PLACEMENT_LABEL: Record<string, string> = {
  registry_address: 'registered address',
  single_lga_postcode: 'postcode sits in one council area',
  poa_ratio_dominant: 'postcode is ≥90% in this council area',
  poa_ratio_nolocality: 'postcode is ≥90% in this council area (no suburb on file — less sure)',
  straddler_ratio_dominant: 'straddling postcode, dominant council area',
  'acnc_town_city+abs_asgs': 'charity register town',
  'own_name_town+abs_asgs': 'the organisation is named after its town',
  'oric_register_address+abs_asgs': 'ORIC register address',
  'community_name+abs_asgs': 'community name',
  'acnc_street_line+sal_ratio_dominant': 'charity register street address',
};

export default function PlaceBrowser({
  rows,
  q,
  state,
  sort,
  dir = '',
  statsLine,
  caveat,
}: {
  rows: PlaceRow[];
  q: string;
  state: string;
  sort: string;
  /** 'asc' | 'desc' | '' (natural) */
  dir?: string;
  statsLine: string;
  caveat: string;
}) {
  const drawer = useDrawer<PlaceDetail>();
  const detail = drawer.detail;
  const open = (row: PlaceRow) =>
    drawer.open(row.key, `/api/browse/place?lga=${encodeURIComponent(row.lga)}&state=${encodeURIComponent(row.state)}`);
  const qs = makeQs('/dashboard/places', { q, state, sort, dir });

  return (
    <>
      <p className="mt-1 font-mono text-[11.5px]" style={{ color: 'var(--shell-muted)' }}>
        {statsLine}
      </p>
      <form className="mt-3" action="/dashboard/places">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by council area…"
          className="w-full max-w-[360px] bg-white px-3 py-2 font-mono text-[13px] shell-control"
        />
        {state ? <input type="hidden" name="state" value={state} /> : null}
        {sort ? <input type="hidden" name="sort" value={sort} /> : null}
        {dir ? <input type="hidden" name="dir" value={dir} /> : null}
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Link href={qs({ state: '' })} className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control" style={state === '' ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}>
          All states
        </Link>
        {STATES.map((s) => (
          <Link key={s} href={qs({ state: s })} className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control" style={state === s ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}>
            {s}
          </Link>
        ))}
      </div>

      <div className="mt-4 shell-card">
        <div className="flex items-baseline gap-3 px-4 py-2 font-mono text-[10px] font-black uppercase tracking-widest" style={{ borderBottom: '1px solid var(--shell-line)', color: 'var(--shell-muted)' }}>
          <SortHeader label="Council area" sortKey="name" current={sort} dir={dir} qs={qs} />
          <span className="w-[52px] shrink-0">State</span>
          <SortHeader label="Entities" sortKey="entities" current={sort} dir={dir} qs={qs} width="w-[72px]" align="right" />
          <SortHeader label="ACCO" sortKey="acco" current={sort} dir={dir} qs={qs} width="w-[64px]" align="right" title="community-controlled organisations" />
          <SortHeader label="Funding $" sortKey="funding" current={sort} dir={dir} qs={qs} width="w-[92px]" align="right" />
          <SortHeader label="SEIFA" sortKey="disadvantage" naturalDir="asc" current={sort} dir={dir} qs={qs} width="w-[56px]" align="right" title="average SEIFA disadvantage decile, 1 = most disadvantaged; sorts most-disadvantaged first" />
          <SortHeader label="Unfunded" sortKey="desert" current={sort} dir={dir} qs={qs} width="w-[76px]" align="right" title="how far funders and providers have fallen short of this area's measured need — a measure of funding behaviour, not of the community" />
        </div>
        {rows.map((r) => (
          <button key={r.key} onClick={() => open(r)} className="flex w-full items-baseline gap-3 px-4 py-2 text-left hover:bg-[#FAFAF8]" style={{ borderBottom: '1px solid var(--shell-line)' }}>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" style={{ color: '#1040C0' }}>{r.lga}</span>
            <span className="w-[52px] shrink-0 font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>{r.state}</span>
            <span className="w-[72px] shrink-0 text-right font-mono text-[12.5px]">{r.entities.toLocaleString('en-AU')}</span>
            <span className="w-[64px] shrink-0 text-right font-mono text-[12.5px]">{r.acco || '—'}</span>
            <span className="w-[92px] shrink-0 text-right font-mono text-[12.5px]">{money(r.funding)}</span>
            <span className="w-[56px] shrink-0 text-right font-mono text-[12.5px]">{r.seifa ?? '—'}</span>
            <span className="w-[76px] shrink-0 text-right font-mono text-[12.5px]">{r.desert ?? '—'}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>
        {caveat}
      </p>

      {drawer.openKey ? (
        <Drawer title={detail ? `${detail.lga_name} (${detail.state})` : 'loading…'} err={drawer.err} onClose={drawer.close}>
          {detail ? (
            <>
              <p className="mt-1 text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>
                {detail.desert?.remoteness ?? ''}
                {detail.desert?.desert_score != null ? ` · funding shortfall ${detail.desert.desert_score}` : ''}
              </p>

              {detail.funding ? (
                <>
                  <L>What the record holds here</L>
                  <p className="text-[13px]">
                    {(detail.funding.entity_count ?? 0).toLocaleString('en-AU')} organisations
                    {detail.funding.community_controlled_count ? ` · ${detail.funding.community_controlled_count} community-controlled` : ''}
                    {' · '}funding visible {money(detail.funding.total_funding)}
                    {detail.funding.avg_seifa_decile != null ? ` · SEIFA decile ${detail.funding.avg_seifa_decile}` : ''}
                  </p>
                  <p className="font-mono text-[10.5px]" style={{ color: 'var(--shell-muted)' }}>
                    money attaches to an organisation&rsquo;s address — head-office areas collect their branches&rsquo; figures
                  </p>
                </>
              ) : null}

              {detail.postcodes.length > 0 ? (
                <>
                  <L>By postcode</L>
                  <table className="w-full text-right font-mono text-[11.5px]">
                    <thead>
                      <tr style={{ color: 'var(--shell-muted)' }}>
                        <th className="py-0.5 text-left font-normal">postcode</th>
                        <th className="font-normal">orgs</th>
                        <th className="font-normal">funding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.postcodes.slice(0, 12).map((p) => (
                        <tr key={p.postcode} style={{ borderTop: '1px solid var(--shell-line)' }}>
                          <td className="py-0.5 text-left">{p.postcode}</td>
                          <td>{p.entity_count ?? '—'}</td>
                          <td>{money(p.total_funding)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}

              {Object.keys(detail.placement).length > 0 ? (
                <>
                  <L>How organisations were placed here</L>
                  <div className="flex flex-col gap-0.5">
                    {Object.entries(detail.placement)
                      .sort(([, a], [, b]) => b - a)
                      .map(([src, n]) => (
                        <div key={src} className="flex items-baseline justify-between gap-3 text-[12px]">
                          <span>{PLACEMENT_LABEL[src] ?? src}</span>
                          <span className="font-mono text-[11.5px]" style={{ color: 'var(--shell-muted)' }}>{n.toLocaleString('en-AU')}</span>
                        </div>
                      ))}
                  </div>
                  <p className="mt-1 font-mono text-[10.5px]" style={{ color: 'var(--shell-muted)' }}>
                    every placement carries its method; organisations we could not place confidently are left unplaced with a reason, not guessed
                  </p>
                </>
              ) : null}
            </>
          ) : null}
        </Drawer>
      ) : null}
    </>
  );
}
