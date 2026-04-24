import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';
import { fmt } from '@/lib/services/report-service';
import { slugifySegment, TRACKER_STATE_META, sentenceCaseTracker } from '../../tracker-meta';

export const revalidate = 3600;

type TrackerSummaryRow = {
  tracker_key: string;
  event_count: number;
  official_count: number;
  mirrored_count: number;
  gap_count: number;
  latest_event_date: string | null;
  first_title: string | null;
  first_summary: string | null;
};

type SiteMatrixRow = {
  site_name: string;
  tracker_key: string;
  event_count: number;
  official_count: number;
  mirrored_count: number;
  gap_count: number;
  latest_event_date: string | null;
};

function normaliseText(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((Date.now() - parsed.getTime()) / 86_400_000);
}

function hotSiteScore(site: { trackerCount: number; mirroredCount: number; gapCount: number; latestEventDate: string | null }) {
  const age = daysSince(site.latestEventDate);
  const freshnessBonus = age === null ? 0 : age <= 45 ? 18 : age <= 120 ? 10 : age <= 240 ? 4 : 0;
  return site.trackerCount * 40 + site.gapCount * 9 + site.mirroredCount * 5 + freshnessBonus;
}

function hotSiteReasons(site: { trackerCount: number; mirroredCount: number; gapCount: number; latestEventDate: string | null }) {
  const reasons: string[] = [];
  const age = daysSince(site.latestEventDate);
  if (site.trackerCount > 1) reasons.push('multi-tracker overlap');
  if (site.gapCount >= 5) reasons.push('gap-heavy chain');
  else if (site.gapCount > 0) reasons.push('visible process gaps');
  if (age !== null && age <= 120) reasons.push('recent movement');
  if (site.mirroredCount >= 2) reasons.push('usable mirrored base');
  return reasons.length > 0 ? reasons : ['steady watch'];
}

export function generateStaticParams() {
  return Object.keys(TRACKER_STATE_META).map((state) => ({ state }));
}

export function generateMetadata({ params }: { params: Promise<{ state: string }> }) {
  return params.then(({ state }) => {
    const meta = TRACKER_STATE_META[state.toLowerCase()];
    if (!meta) return { title: 'Not Found' };
    return {
      title: `${meta.name} Tracker Registry — CivicGraph`,
      description: `Structured youth justice tracker registry for ${meta.name}.`,
    };
  });
}

async function getData(jurisdiction: string) {
  const supabase = getServiceSupabase();
  const escapedJurisdiction = jurisdiction.replace(/'/g, "''");
  const trackerQuery = `
    WITH scoped AS (
      SELECT *
      FROM tracker_evidence_events
      WHERE domain = 'youth-justice'
        AND jurisdiction = '${escapedJurisdiction}'
    ),
    ranked AS (
      SELECT
        tracker_key,
        title,
        summary,
        ROW_NUMBER() OVER (
          PARTITION BY tracker_key
          ORDER BY event_date ASC, created_at ASC
        ) AS rn
      FROM scoped
    ),
    first_ranked AS (
      SELECT tracker_key, title, summary
      FROM ranked
      WHERE rn = 1
    ),
    aggregated AS (
      SELECT
        tracker_key,
        COUNT(*)::int AS event_count,
        COUNT(*) FILTER (WHERE evidence_strength = 'official')::int AS official_count,
        COUNT(*) FILTER (WHERE mirror_status = 'mirrored')::int AS mirrored_count,
        COUNT(*) FILTER (
          WHERE mirror_status IN ('missing_from_mirror', 'external_only')
        )::int AS gap_count,
        MAX(event_date)::text AS latest_event_date
      FROM scoped
      GROUP BY tracker_key
    )
    SELECT
      a.tracker_key,
      a.event_count,
      a.official_count,
      a.mirrored_count,
      a.gap_count,
      a.latest_event_date,
      f.title AS first_title,
      f.summary AS first_summary
    FROM aggregated a
    LEFT JOIN first_ranked f ON f.tracker_key = a.tracker_key
    ORDER BY a.latest_event_date DESC NULLS LAST, a.tracker_key
  `;
  const siteMatrixQuery = `
    WITH scoped AS (
      SELECT tracker_key, site_names, mirror_status, evidence_strength, event_date
      FROM tracker_evidence_events
      WHERE domain = 'youth-justice'
        AND jurisdiction = '${escapedJurisdiction}'
    ),
    expanded AS (
      SELECT
        tracker_key,
        TRIM(site_name) AS site_name,
        mirror_status,
        evidence_strength,
        event_date
      FROM scoped,
      LATERAL unnest(COALESCE(site_names, ARRAY[]::text[])) AS site_name
      WHERE TRIM(site_name) <> ''
    )
    SELECT
      site_name,
      tracker_key,
      COUNT(*)::int AS event_count,
      COUNT(*) FILTER (WHERE evidence_strength = 'official')::int AS official_count,
      COUNT(*) FILTER (WHERE mirror_status = 'mirrored')::int AS mirrored_count,
      COUNT(*) FILTER (
        WHERE mirror_status IN ('missing_from_mirror', 'external_only')
      )::int AS gap_count,
      MAX(event_date)::text AS latest_event_date
    FROM expanded
    GROUP BY site_name, tracker_key
    ORDER BY site_name, tracker_key
  `;
  const [trackerResult, siteMatrixResult] = await Promise.all([
    safe<TrackerSummaryRow[] | null>(
      supabase.rpc('exec_sql', { query: trackerQuery }) as PromiseLike<{ data: TrackerSummaryRow[] | null; error: unknown }>,
      `${jurisdiction} tracker index`,
    ),
    safe<SiteMatrixRow[] | null>(
      supabase.rpc('exec_sql', { query: siteMatrixQuery }) as PromiseLike<{ data: SiteMatrixRow[] | null; error: unknown }>,
      `${jurisdiction} site matrix`,
    ),
  ]);

  return {
    trackers: trackerResult ?? [],
    siteMatrix: siteMatrixResult ?? [],
  };
}

export default async function StateYouthJusticeTrackersIndexPage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state } = await params;
  const stateKey = state.toLowerCase();
  const meta = TRACKER_STATE_META[stateKey];
  if (!meta) notFound();

  const data = await getData(meta.abbr);
  const trackers = data.trackers;
  const genericSiteTokens = new Set(
    [meta.abbr, meta.name, `${meta.name} youth justice`, 'statewide', 'queensland', 'new south wales', 'northern territory']
      .map((value) => normaliseText(value)),
  );
  const filteredSiteMatrix = data.siteMatrix.filter((row) => !genericSiteTokens.has(normaliseText(row.site_name)));
  const trackerOrder = trackers.map((tracker) => tracker.tracker_key);
  const siteMatrixSites = Array.from(
    filteredSiteMatrix.reduce((acc, row) => {
      const current = acc.get(row.site_name) || [];
      current.push(row);
      acc.set(row.site_name, current);
      return acc;
    }, new Map<string, SiteMatrixRow[]>()),
  )
    .map(([siteName, rows]) => ({
      siteName,
      rows,
      trackerCount: new Set(rows.map((row) => row.tracker_key)).size,
      mirroredCount: rows.reduce((sum, row) => sum + Number(row.mirrored_count || 0), 0),
      gapCount: rows.reduce((sum, row) => sum + Number(row.gap_count || 0), 0),
      latestEventDate: rows.reduce<string | null>((latest, row) => {
        if (!row.latest_event_date) return latest;
        if (!latest) return row.latest_event_date;
        return row.latest_event_date > latest ? row.latest_event_date : latest;
      }, null),
    }))
    .sort((a, b) => b.trackerCount - a.trackerCount || b.mirroredCount - a.mirroredCount || a.siteName.localeCompare(b.siteName));
  const hotSites = [...siteMatrixSites]
    .map((site) => ({
      ...site,
      hotScore: hotSiteScore(site),
      reasons: hotSiteReasons(site),
    }))
    .sort((a, b) => b.hotScore - a.hotScore || b.gapCount - a.gapCount || a.siteName.localeCompare(b.siteName))
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <Link
          href={`/reports/youth-justice/${stateKey}`}
          className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
        >
          &larr; {meta.name} youth justice
        </Link>
        <div className="mb-1 mt-4 text-xs font-black uppercase tracking-widest text-bauhaus-red">Tracker Registry</div>
        <h1 className="text-3xl font-black text-bauhaus-black sm:text-4xl">{meta.name} Accountability Trackers</h1>
        <p className="mt-3 max-w-4xl text-base font-medium leading-relaxed text-bauhaus-muted sm:text-lg">
          Reusable tracker surfaces for {meta.name}. These are driven directly from <code>tracker_evidence_events</code>, so new manifests
          appear here after refresh without another custom page build.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/reports/youth-justice/trackers"
            className="border-2 border-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-wider text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
          >
            Open national portfolio
          </Link>
          {stateKey === 'qld' ? (
            <Link
              href="/reports/youth-justice/qld/tracker"
              className="border-2 border-bauhaus-blue bg-bauhaus-blue px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-blue-800"
            >
              Open QLD specialist tracker
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <div className="text-2xl font-black text-emerald-700 sm:text-3xl">{fmt(trackers.length)}</div>
          <div className="mt-1 text-xs text-gray-500">Trackers registered</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center">
          <div className="text-2xl font-black text-blue-700 sm:text-3xl">
            {fmt(trackers.reduce((sum, row) => sum + Number(row.event_count || 0), 0))}
          </div>
          <div className="mt-1 text-xs text-gray-500">Evidence events</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <div className="text-2xl font-black text-amber-700 sm:text-3xl">
            {fmt(trackers.reduce((sum, row) => sum + Number(row.gap_count || 0), 0))}
          </div>
          <div className="mt-1 text-xs text-gray-500">Mirror / visibility gaps</div>
        </div>
        <div className="rounded-xl border border-bauhaus-black bg-bauhaus-black p-5 text-center text-white">
          <div className="text-2xl font-black text-bauhaus-red sm:text-3xl">
            {fmt(trackers.reduce((sum, row) => sum + Number(row.mirrored_count || 0), 0))}
          </div>
          <div className="mt-1 text-xs text-white/70">Mirrored evidence rows</div>
        </div>
      </div>

      {hotSites.length > 0 ? (
        <section className="mb-8 rounded-sm border-4 border-bauhaus-black bg-white p-6">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Watch now</div>
          <h2 className="text-2xl font-black text-bauhaus-black">Hot sites needing attention this cycle</h2>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-bauhaus-muted">
            Hotness is ranked from three things already visible in the tracker layer: multi-tracker overlap, unresolved gap rows, and how recently this site moved. Use this strip as the shortlist before you dive into the full matrix.
          </p>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {hotSites.map((site) => (
              <div key={site.siteName} className="rounded-sm border-2 border-bauhaus-black p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Hot site score</div>
                    <div className="mt-2 text-2xl font-black text-bauhaus-black">{fmt(site.hotScore)}</div>
                  </div>
                  <div className="rounded-sm bg-bauhaus-black px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                    latest {site.latestEventDate || '—'}
                  </div>
                </div>

                <div className="mt-4 text-xl font-black text-bauhaus-black">{site.siteName}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {site.reasons.map((reason) => (
                    <span
                      key={`${site.siteName}-${reason}`}
                      className="rounded-sm border border-bauhaus-black/10 bg-bauhaus-muted/5 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-muted"
                    >
                      {reason}
                    </span>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-sm border border-bauhaus-black/10 p-2">
                    <div className="font-black text-bauhaus-black">{fmt(site.trackerCount)}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-bauhaus-muted">trackers</div>
                  </div>
                  <div className="rounded-sm border border-emerald-200 bg-emerald-50 p-2">
                    <div className="font-black text-emerald-700">{fmt(site.mirroredCount)}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-bauhaus-muted">mirrored</div>
                  </div>
                  <div className="rounded-sm border border-amber-200 bg-amber-50 p-2">
                    <div className="font-black text-amber-700">{fmt(site.gapCount)}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-bauhaus-muted">gaps</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/reports/youth-justice/${stateKey}/sites/${slugifySegment(site.siteName)}`}
                    className="border-2 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
                  >
                    Open dossier
                  </Link>
                  <Link
                    href={`/reports/youth-justice/${stateKey}/sites/${slugifySegment(site.siteName)}/brief`}
                    className="border-2 border-bauhaus-blue bg-bauhaus-blue px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-blue-800"
                  >
                    Download brief
                  </Link>
                  {site.rows[0] ? (
                    <Link
                      href={`/reports/youth-justice/${stateKey}/trackers/${site.rows[0].tracker_key}?site=${encodeURIComponent(site.siteName)}`}
                      className="border-2 border-bauhaus-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted transition-colors hover:border-bauhaus-black hover:text-bauhaus-black"
                    >
                      Open first tracker
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {siteMatrixSites.length > 0 ? (
        <section className="mb-10 rounded-sm border-4 border-bauhaus-black bg-white p-6">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">Cross-tracker site matrix</div>
          <h2 className="text-2xl font-black text-bauhaus-black">Which sites show up across multiple tracker families?</h2>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-bauhaus-muted">
            This matrix turns the QLD registry into a place-first control surface. It shows which named sites are touched by multiple tracker families, where mirrored evidence already exists, and where the remaining gaps still sit.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <div className="border-2 border-bauhaus-black/10 bg-bauhaus-muted/5 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Named sites</div>
              <div className="mt-2 text-2xl font-black text-bauhaus-black">{fmt(siteMatrixSites.length)}</div>
            </div>
            <div className="border-2 border-blue-200 bg-blue-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">Multi-tracker sites</div>
              <div className="mt-2 text-2xl font-black text-blue-700">
                {fmt(siteMatrixSites.filter((site) => site.trackerCount > 1).length)}
              </div>
            </div>
            <div className="border-2 border-emerald-200 bg-emerald-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Mirrored site rows</div>
              <div className="mt-2 text-2xl font-black text-emerald-700">
                {fmt(siteMatrixSites.reduce((sum, site) => sum + site.mirroredCount, 0))}
              </div>
            </div>
            <div className="border-2 border-amber-200 bg-amber-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-700">Gap site rows</div>
              <div className="mt-2 text-2xl font-black text-amber-700">
                {fmt(siteMatrixSites.reduce((sum, site) => sum + site.gapCount, 0))}
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-bauhaus-black">
                  <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Site</th>
                  <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Coverage</th>
                  {trackerOrder.map((trackerKey) => (
                    <th key={trackerKey} className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                      {sentenceCaseTracker(trackerKey)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {siteMatrixSites.map((site) => (
                  <tr key={site.siteName} className="border-b border-bauhaus-black/10 align-top">
                    <td className="px-3 py-4">
                      <Link
                        href={`/reports/youth-justice/${stateKey}/sites/${slugifySegment(site.siteName)}`}
                        className="group block rounded-sm border-2 border-bauhaus-black/10 p-3 transition-colors hover:border-bauhaus-black"
                      >
                        <div className="font-black text-bauhaus-black">{site.siteName}</div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">
                          latest {site.latestEventDate || '—'}
                        </div>
                        <div className="mt-3 inline-flex text-[10px] font-black uppercase tracking-widest text-bauhaus-blue group-hover:underline">
                          Open site dossier &rarr;
                        </div>
                      </Link>
                      <Link
                        href={`/reports/youth-justice/${stateKey}/sites/${slugifySegment(site.siteName)}/brief`}
                        className="mt-2 inline-flex text-[10px] font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
                      >
                        Download brief (.md)
                      </Link>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-sm font-black text-bauhaus-black">{fmt(site.trackerCount)} tracker{site.trackerCount === 1 ? '' : 's'}</div>
                      <div className="mt-1 text-xs text-bauhaus-muted">
                        {fmt(site.mirroredCount)} mirrored • {fmt(site.gapCount)} gaps
                      </div>
                    </td>
                    {trackerOrder.map((trackerKey) => {
                      const cell = site.rows.find((row) => row.tracker_key === trackerKey);
                      return (
                        <td key={`${site.siteName}-${trackerKey}`} className="px-3 py-4">
                          {cell ? (
                            <Link
                              href={`/reports/youth-justice/${stateKey}/trackers/${trackerKey}?site=${encodeURIComponent(site.siteName)}`}
                              className="group block rounded-sm border-2 border-bauhaus-black/10 p-3 transition-colors hover:border-bauhaus-black"
                            >
                              <div className="text-sm font-black text-bauhaus-black">{fmt(cell.event_count)} events</div>
                              <div className="mt-1 text-xs text-bauhaus-muted">
                                {fmt(cell.official_count)} official • {fmt(cell.mirrored_count)} mirrored
                              </div>
                              <div className="mt-2 inline-flex rounded-sm bg-amber-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700">
                                {fmt(cell.gap_count)} gaps
                              </div>
                            </Link>
                          ) : (
                            <div className="rounded-sm border border-dashed border-bauhaus-black/10 p-3 text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">
                              No site row
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="space-y-4">
        {trackers.length === 0 ? (
          <div className="rounded-sm border-4 border-bauhaus-black bg-white p-6">
            <div className="text-sm font-black uppercase tracking-widest text-bauhaus-red">No trackers yet</div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bauhaus-muted">
              No structured tracker manifests have been synced for {meta.name} yet. Add a manifest in <code>data/tracker-evidence</code>{' '}
              and run the refresh loop.
            </p>
          </div>
        ) : null}

        {trackers.map((tracker) => (
          <Link
            key={tracker.tracker_key}
            href={`/reports/youth-justice/${stateKey}/trackers/${tracker.tracker_key}`}
            className="group block rounded-sm border-4 border-bauhaus-black bg-white p-6 transition-transform hover:-translate-y-1"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                  {sentenceCaseTracker(tracker.tracker_key)}
                </div>
                <h2 className="mt-2 text-2xl font-black text-bauhaus-black">
                  {tracker.first_title || sentenceCaseTracker(tracker.tracker_key)}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-bauhaus-muted">
                  {tracker.first_summary || 'Structured evidence chain ready for investigation.'}
                </p>
              </div>
              <div className="grid min-w-[240px] grid-cols-2 gap-3 text-right">
                <div className="border-2 border-bauhaus-black/10 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Events</div>
                  <div className="mt-1 text-xl font-black text-bauhaus-black">{fmt(tracker.event_count)}</div>
                </div>
                <div className="border-2 border-bauhaus-black/10 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Latest</div>
                  <div className="mt-1 text-sm font-black text-bauhaus-black">{tracker.latest_event_date || '—'}</div>
                </div>
                <div className="border-2 border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Official</div>
                  <div className="mt-1 text-xl font-black text-emerald-700">{fmt(tracker.official_count)}</div>
                </div>
                <div className="border-2 border-amber-200 bg-amber-50 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-700">Gaps</div>
                  <div className="mt-1 text-xl font-black text-amber-700">{fmt(tracker.gap_count)}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 inline-flex text-xs font-black uppercase tracking-widest text-bauhaus-blue group-hover:underline">
              Open tracker &rarr;
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
