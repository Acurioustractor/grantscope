import { money } from '@/lib/format';
import {
  observedPublishers,
  philanthropyCensus,
  searchFoundations,
} from '@/lib/philanthropy-admin';

export const dynamic = 'force-dynamic';

/**
 * The philanthropy lane, for the people deciding what to build on it.
 *
 * It leads with the ratio rather than the totals, because the totals are the trap: 11,177
 * foundations sounds like a dataset to match against, and 20 observed grantees is what we can
 * actually evidence. A matching or scoring feature built here would be built on self-description.
 *
 * Search is a plain GET form and a server component — no client bundle, and the URL is the state,
 * so a search can be pasted to someone.
 */
export default async function PhilanthropyAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const [census, publishers, results] = await Promise.all([
    philanthropyCensus(),
    observedPublishers(),
    query ? searchFoundations(query) : Promise.resolve([]),
  ]);

  const statedPct = census.foundations
    ? Math.round((census.withStatedTheme / census.foundations) * 1000) / 10
    : 0;
  const observedPct = census.foundations
    ? Math.round((census.withObservedGrantee / census.foundations) * 1000) / 10
    : 0;
  const placeholderTotal = census.givingPlaceholders.reduce((s, p) => s + p.foundations, 0);

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <header>
        <h1 className="text-3xl font-black uppercase tracking-widest">Philanthropy</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed">
          What the foundation lane holds, and what it cannot support. Read the first panel before
          designing anything that matches a funder to an organisation.
        </p>
      </header>

      {/* The ratio is the finding. Everything else on this page is detail under it. */}
      <section className="border-4 border-bauhaus-red bg-white p-6">
        <h2 className="font-black uppercase tracking-widest text-bauhaus-red">
          We hold what they say, not what they do
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Stat label="foundations on the register" value={census.foundations.toLocaleString()} />
          <Stat
            label="carry a stated theme"
            value={`${census.withStatedTheme.toLocaleString()}`}
            sub={`${statedPct}% — self-described`}
          />
          <Stat
            label="have a single observed grantee"
            value={census.withObservedGrantee.toLocaleString()}
            sub={`${observedPct}% — evidenced`}
            accent
          />
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-relaxed">
          Stated focus outruns observed giving by roughly <strong>500 to 1</strong>. Any matching,
          scoring or &ldquo;funders who fund people like you&rdquo; feature built on the stated side
          is built on self-description. The {census.foundationsPublishingGrantees} foundations that
          publish a grantee list are the only ones whose behaviour can be checked.
        </p>
      </section>

      <section className="border-4 border-bauhaus-black bg-white p-6">
        <h2 className="font-black uppercase tracking-widest">
          Giving figures are placeholders — do not rank on them
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          <strong>
            {placeholderTotal.toLocaleString()} of {census.givingNonNull.toLocaleString()}
          </strong>{' '}
          non-null <code>total_giving_annual</code> values sit on three round numbers, and only{' '}
          {census.givingDistinctValues.toLocaleString()} distinct values exist across the whole
          column.
        </p>
        <ul className="mt-4 flex flex-wrap gap-3">
          {census.givingPlaceholders.map(p => (
            <li
              key={p.value}
              className="border-2 border-bauhaus-black px-3 py-2 font-mono text-[11px] uppercase tracking-widest"
            >
              {money(p.value)} × {p.foundations.toLocaleString()}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="border-4 border-bauhaus-black bg-white p-6">
          <h2 className="font-black uppercase tracking-widest">What they say they fund</h2>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-bauhaus-black/60">
            foundation_category_assignments · classified, with evidence text
          </p>
          <ul className="mt-4 space-y-1">
            {census.themes.map(t => (
              <li key={t.slug} className="flex justify-between gap-4 border-b border-bauhaus-black/10 py-1 text-sm">
                <span>{t.slug.replace(/-/g, ' ')}</span>
                <span className="font-mono tabular-nums">{t.foundations.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-4 border-bauhaus-black bg-white p-6">
          <h2 className="font-black uppercase tracking-widest">Where they say they fund</h2>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-bauhaus-black/60">
            foundation_geo_focus · by grain
          </p>
          <ul className="mt-4 space-y-1">
            {census.geoByType.map(g => (
              <li key={g.geoType} className="flex justify-between gap-4 border-b border-bauhaus-black/10 py-1 text-sm">
                <span>
                  {g.geoType}{' '}
                  <span className="font-mono text-[10px] uppercase tracking-widest text-bauhaus-black/50">
                    {g.places} distinct
                  </span>
                </span>
                <span className="font-mono tabular-nums">{g.foundations.toLocaleString()}</span>
              </li>
            ))}
          </ul>
          {/* The limit that decides whether a place-based product is possible at all. */}
          <p className="mt-4 border-l-4 border-bauhaus-yellow pl-3 text-sm leading-relaxed">
            Stated geography is <strong>state or national almost everywhere</strong>. Place-grain
            focus exists for a few dozen foundations only, so a funder cannot be matched to a
            community from what they say — only from where their grantees actually are.
          </p>
        </section>
      </div>

      <section className="border-4 border-bauhaus-black bg-white p-6">
        <h2 className="font-black uppercase tracking-widest">
          The foundations we can actually observe
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          {census.granteeRows.toLocaleString()} published grants from{' '}
          {census.foundationsPublishingGrantees} foundations. This is the whole evidenced picture.
        </p>
        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b-4 border-bauhaus-black text-left font-mono text-[10px] uppercase tracking-widest">
              <th className="py-2">Foundation</th>
              <th className="py-2 text-right">Grants</th>
              <th className="py-2 text-right">With amount</th>
              <th className="py-2 text-right">Published $</th>
              <th className="py-2 text-right">Councils</th>
              <th className="py-2 text-right">Remote</th>
            </tr>
          </thead>
          <tbody>
            {publishers.map(p => (
              <tr key={p.foundation} className="border-b border-bauhaus-black/10">
                <td className="py-2 pr-4">{p.foundation}</td>
                <td className="py-2 text-right font-mono tabular-nums">{p.grants.toLocaleString()}</td>
                <td className="py-2 text-right font-mono tabular-nums text-bauhaus-black/60">
                  {p.withAmount.toLocaleString()}
                </td>
                <td className="py-2 text-right font-mono tabular-nums">
                  {p.dollars > 0 ? money(p.dollars) : '—'}
                </td>
                <td className="py-2 text-right font-mono tabular-nums">{p.councils}</td>
                <td className="py-2 text-right font-mono tabular-nums text-bauhaus-blue">
                  {p.remoteCouncils}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 max-w-3xl font-mono text-[11px] leading-relaxed uppercase tracking-widest text-bauhaus-black/60">
          Grants with no amount are not missing data we failed to fetch — for the curated rows the
          funder published a grantee and no figure. See #291.
        </p>
      </section>

      <section className="border-4 border-bauhaus-black bg-white p-6">
        <h2 className="font-black uppercase tracking-widest">Search</h2>
        <form method="GET" className="mt-4 flex flex-wrap gap-3">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="name, theme slug (first-nations), or stated place"
            aria-label="Search foundations"
            className="min-w-0 flex-1 border-4 border-bauhaus-black px-4 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-bauhaus-yellow"
          />
          <button
            type="submit"
            className="border-4 border-bauhaus-black bg-bauhaus-yellow px-6 py-2 font-black uppercase tracking-widest"
          >
            Search
          </button>
        </form>

        {query && (
          <>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-bauhaus-black/60">
              {results.length} match{results.length === 1 ? '' : 'es'} for &ldquo;{query}&rdquo;
              {results.length >= 40 ? ' — capped at 40' : ''}
            </p>
            <ul className="mt-4 divide-y-2 divide-bauhaus-black/10 border-y-4 border-bauhaus-black">
              {results.map(f => (
                <li key={f.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <span className="min-w-0 flex-1 text-sm font-bold">
                      {f.name}
                      {f.hasDgr && (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-bauhaus-blue">
                          DGR
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-widest">
                      {f.observedGrants > 0 ? (
                        <span className="text-bauhaus-black">
                          {f.observedGrants} observed grant{f.observedGrants === 1 ? '' : 's'} ·{' '}
                          {f.councilsReached} council{f.councilsReached === 1 ? '' : 's'}
                          {f.observedDollars > 0 ? ` · ${money(f.observedDollars)}` : ''}
                        </span>
                      ) : (
                        <span className="text-bauhaus-black/50">no observed giving</span>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-bauhaus-black/55">
                    {f.themes.length > 0 ? f.themes.join(' · ') : 'no stated theme'}
                    {f.geo.length > 0 ? ` — ${f.geo.slice(0, 4).join(', ')}` : ''}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-3xl font-mono text-[11px] leading-relaxed uppercase tracking-widest text-bauhaus-black/60">
              Observed columns join `foundation_grantees` on NAME — that table carries no
              foundation_id. A foundation whose grantee list is filed under a different spelling
              reads here as having no observed giving.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-4">
      <p className="font-mono text-[10px] font-black uppercase tracking-widest text-bauhaus-black/60">
        {label}
      </p>
      <p
        className={`mt-1 text-4xl font-black tracking-tight ${
          accent ? 'text-bauhaus-red' : 'text-bauhaus-black'
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-bauhaus-black/60">
          {sub}
        </p>
      )}
    </div>
  );
}
