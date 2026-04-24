import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Foundation Review Set | CivicGraph',
  description: 'Public hub for the six-foundation review set: Snow, PRF, Minderoo, Ian Potter, ECSTRA, and Rio Tinto.',
};

const FOUNDATIONS = [
  {
    id: 'd242967e-0e68-4367-9785-06cf0ec7485e',
    label: 'Snow',
    route: '/snow-foundation',
    compareTargets: [
      { id: '4ee5baca-c898-4318-ae2b-d79b95379cc7', label: 'Compare with PRF' },
      { id: '8f8704be-d6e8-40f3-b561-ac6630ce5b36', label: 'Compare with Minderoo' },
      { id: 'b9e090e5-1672-48ff-815a-2a6314ebe033', label: 'Compare with Ian Potter' },
      { id: '25b80b63-416e-4aaa-b470-2f8dc6fa835f', label: 'Compare with ECSTRA' },
      { id: '85f0de43-d004-4122-83a6-287eeecc4da9', label: 'Compare with Rio Tinto' },
    ],
  },
  {
    id: '4ee5baca-c898-4318-ae2b-d79b95379cc7',
    label: 'PRF',
    route: '/foundations/prf',
    compareTargets: [
      { id: 'd242967e-0e68-4367-9785-06cf0ec7485e', label: 'Compare with Snow' },
      { id: '8f8704be-d6e8-40f3-b561-ac6630ce5b36', label: 'Compare with Minderoo' },
      { id: 'b9e090e5-1672-48ff-815a-2a6314ebe033', label: 'Compare with Ian Potter' },
      { id: '25b80b63-416e-4aaa-b470-2f8dc6fa835f', label: 'Compare with ECSTRA' },
      { id: '85f0de43-d004-4122-83a6-287eeecc4da9', label: 'Compare with Rio Tinto' },
    ],
  },
  {
    id: '8f8704be-d6e8-40f3-b561-ac6630ce5b36',
    label: 'Minderoo',
    route: '/foundations/minderoo',
    compareTargets: [
      { id: 'd242967e-0e68-4367-9785-06cf0ec7485e', label: 'Compare with Snow' },
      { id: '4ee5baca-c898-4318-ae2b-d79b95379cc7', label: 'Compare with PRF' },
      { id: 'b9e090e5-1672-48ff-815a-2a6314ebe033', label: 'Compare with Ian Potter' },
      { id: '25b80b63-416e-4aaa-b470-2f8dc6fa835f', label: 'Compare with ECSTRA' },
      { id: '85f0de43-d004-4122-83a6-287eeecc4da9', label: 'Compare with Rio Tinto' },
    ],
  },
  {
    id: 'b9e090e5-1672-48ff-815a-2a6314ebe033',
    label: 'Ian Potter',
    route: '/foundations/ian-potter',
    compareTargets: [
      { id: 'd242967e-0e68-4367-9785-06cf0ec7485e', label: 'Compare with Snow' },
      { id: '4ee5baca-c898-4318-ae2b-d79b95379cc7', label: 'Compare with PRF' },
      { id: '8f8704be-d6e8-40f3-b561-ac6630ce5b36', label: 'Compare with Minderoo' },
      { id: '25b80b63-416e-4aaa-b470-2f8dc6fa835f', label: 'Compare with ECSTRA' },
      { id: '85f0de43-d004-4122-83a6-287eeecc4da9', label: 'Compare with Rio Tinto' },
    ],
  },
  {
    id: '25b80b63-416e-4aaa-b470-2f8dc6fa835f',
    label: 'ECSTRA',
    route: '/foundations/ecstra',
    compareTargets: [
      { id: 'd242967e-0e68-4367-9785-06cf0ec7485e', label: 'Compare with Snow' },
      { id: '4ee5baca-c898-4318-ae2b-d79b95379cc7', label: 'Compare with PRF' },
      { id: '8f8704be-d6e8-40f3-b561-ac6630ce5b36', label: 'Compare with Minderoo' },
      { id: 'b9e090e5-1672-48ff-815a-2a6314ebe033', label: 'Compare with Ian Potter' },
      { id: '85f0de43-d004-4122-83a6-287eeecc4da9', label: 'Compare with Rio Tinto' },
    ],
  },
  {
    id: '85f0de43-d004-4122-83a6-287eeecc4da9',
    label: 'Rio Tinto',
    route: '/foundations/rio-tinto',
    compareTargets: [
      { id: 'd242967e-0e68-4367-9785-06cf0ec7485e', label: 'Compare with Snow' },
      { id: '4ee5baca-c898-4318-ae2b-d79b95379cc7', label: 'Compare with PRF' },
      { id: '8f8704be-d6e8-40f3-b561-ac6630ce5b36', label: 'Compare with Minderoo' },
      { id: 'b9e090e5-1672-48ff-815a-2a6314ebe033', label: 'Compare with Ian Potter' },
      { id: '25b80b63-416e-4aaa-b470-2f8dc6fa835f', label: 'Compare with ECSTRA' },
    ],
  },
] as const;

interface FoundationSummaryRow {
  id: string;
  name: string;
  total_giving_annual: number | null;
  board_roles: number;
  verified_grants: number;
  year_memory_count: number;
  verified_source_backed_count: number;
}

interface PairSummary {
  left: (typeof FOUNDATIONS)[number];
  right: (typeof FOUNDATIONS)[number];
  status: string;
  detail: string;
  score: number;
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}

function reviewLabel(row: FoundationSummaryRow) {
  const completed = [
    row.board_roles > 0,
    row.verified_grants > 0,
    row.year_memory_count > 0,
    row.verified_source_backed_count > 0,
  ].filter(Boolean).length;

  if (completed === 4) return 'Stable review';
  if (completed >= 2) return 'Developing review';
  return 'Early review';
}

function reviewSignalCount(row: FoundationSummaryRow) {
  return [
    row.board_roles > 0,
    row.verified_grants > 0,
    row.year_memory_count > 0,
    row.verified_source_backed_count > 0,
  ].filter(Boolean).length;
}

function buildPairStatus(left: FoundationSummaryRow, right: FoundationSummaryRow) {
  const leftSignals = reviewSignalCount(left);
  const rightSignals = reviewSignalCount(right);
  const bothStable = leftSignals === 4 && rightSignals === 4;
  const oneStableOneDeveloping =
    (leftSignals === 4 && rightSignals >= 2) ||
    (rightSignals === 4 && leftSignals >= 2);

  if (bothStable) {
    return {
      status: 'Ready now',
      detail: 'Both sides already meet the stable-review threshold.',
      score: 3,
    };
  }

  if (oneStableOneDeveloping) {
    return {
      status: 'Close pair',
      detail: 'One side is stable and the other is reviewable, but still missing part of the evidence stack.',
      score: 2,
    };
  }

  return {
    status: 'Developing pair',
    detail: 'This pairing is useful for review, but both sides still need more evidence depth before it becomes a stable benchmark pair.',
    score: 1,
  };
}

export default async function FoundationReviewSetPage() {
  const supabase = getServiceSupabase();
  const ids = FOUNDATIONS.map((foundation) => `'${foundation.id}'`).join(',');

  const { data } = await supabase.rpc('exec_sql', {
    query: `WITH rel AS (
              SELECT s.abn, COUNT(*)::int AS relationship_grants
              FROM gs_relationships r
              JOIN gs_entities s ON s.id = r.source_entity_id
              WHERE r.relationship_type = 'grant'
                AND r.dataset = 'foundation_grantees'
              GROUP BY s.abn
            ),
            yrs AS (
              SELECT
                foundation_id,
                COUNT(*)::int AS year_memory_count,
                COUNT(*) FILTER (
                  WHERE COALESCE(metadata->>'source', '') NOT ILIKE '%inferred%'
                )::int AS verified_source_backed_count
              FROM foundation_program_years
              GROUP BY foundation_id
            )
            SELECT
              f.id,
              f.name,
              f.total_giving_annual,
              (
                SELECT COUNT(*)::int
                FROM person_roles pr
                WHERE (
                    (f.acnc_abn IS NOT NULL AND f.acnc_abn <> '' AND pr.company_abn = f.acnc_abn)
                    OR ((f.acnc_abn IS NULL OR f.acnc_abn = '') AND pr.company_name = f.name)
                  )
                  AND pr.cessation_date IS NULL
              ) AS board_roles,
              GREATEST(
                (
                  SELECT COUNT(*)::int
                  FROM foundation_grantees fg
                  WHERE fg.foundation_id = f.id
                ),
                COALESCE(rel.relationship_grants, 0)
              ) AS verified_grants,
              COALESCE(yrs.year_memory_count, 0) AS year_memory_count,
              COALESCE(yrs.verified_source_backed_count, 0) AS verified_source_backed_count
            FROM foundations f
            LEFT JOIN rel ON rel.abn = f.acnc_abn
            LEFT JOIN yrs ON yrs.foundation_id = f.id
            WHERE f.id IN (${ids})
            ORDER BY f.total_giving_annual DESC NULLS LAST`,
  });

  const rows = (data || []) as FoundationSummaryRow[];
  const summaryMap = new Map(rows.map((row) => [row.id, row]));
  const pairRows: PairSummary[] = FOUNDATIONS.flatMap((left, index) =>
    FOUNDATIONS.slice(index + 1).flatMap((right) => {
      const leftRow = summaryMap.get(left.id);
      const rightRow = summaryMap.get(right.id);
      if (!leftRow || !rightRow) return [];

      return [{
        left,
        right,
        ...buildPairStatus(leftRow, rightRow),
      }];
    })
  );
  const recommendedPair = [...pairRows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTotal = (summaryMap.get(a.left.id)?.total_giving_annual || 0) + (summaryMap.get(a.right.id)?.total_giving_annual || 0);
    const bTotal = (summaryMap.get(b.left.id)?.total_giving_annual || 0) + (summaryMap.get(b.right.id)?.total_giving_annual || 0);
    return bTotal - aTotal;
  })[0] || null;
  const nextClosePair =
    [...pairRows]
      .filter((pair) => pair.status === 'Close pair')
      .sort((a, b) => {
        const aTotal = (summaryMap.get(a.left.id)?.total_giving_annual || 0) + (summaryMap.get(a.right.id)?.total_giving_annual || 0);
        const bTotal = (summaryMap.get(b.left.id)?.total_giving_annual || 0) + (summaryMap.get(b.right.id)?.total_giving_annual || 0);
        return bTotal - aTotal;
      })[0] || null;
  const strongestDevelopingPair =
    [...pairRows]
      .filter((pair) => pair.status === 'Developing pair')
      .sort((a, b) => {
        const aTotal = (summaryMap.get(a.left.id)?.total_giving_annual || 0) + (summaryMap.get(a.right.id)?.total_giving_annual || 0);
        const bTotal = (summaryMap.get(b.left.id)?.total_giving_annual || 0) + (summaryMap.get(b.right.id)?.total_giving_annual || 0);
        return bTotal - aTotal;
      })[0] || null;

  return (
    <div className="pb-16">
      <section className="border-b-4 border-bauhaus-black pb-10">
        <Link
          href="/foundations"
          className="text-xs font-black uppercase tracking-[0.35em] text-bauhaus-muted transition-colors hover:text-bauhaus-black"
        >
          ← Back to foundations
        </Link>
        <div className="mt-4 text-xs font-black uppercase tracking-[0.35em] text-bauhaus-red">Public review set</div>
        <h1 className="mt-4 text-4xl font-black leading-[0.9] text-bauhaus-black sm:text-6xl">
          Six-foundation
          <br />
          review set
        </h1>
        <p className="mt-5 max-w-4xl text-lg font-medium leading-relaxed text-bauhaus-muted">
          This hub gathers the current benchmark set for public philanthropic review: Snow, PRF,
          Minderoo, Ian Potter, ECSTRA, and Rio Tinto. Each card links to its compact review route and the closest side-by-side comparisons.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.25em]">
          <span className="border-2 border-bauhaus-black px-3 py-2 text-bauhaus-black">6 live foundations</span>
          <span className="border-2 border-bauhaus-blue bg-link-light px-3 py-2 text-bauhaus-blue">Public review routes</span>
          <span className="border-2 border-bauhaus-red bg-bauhaus-red/5 px-3 py-2 text-bauhaus-red">Compare-ready set</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.22em]">
          <Link
            href="/foundations/compare"
            className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
          >
            Open compare surface
          </Link>
          <Link
            href="/foundations?review=stable"
            className="border-2 border-bauhaus-black/20 bg-white px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
          >
            Open stable slice
          </Link>
        </div>
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-2">
        {FOUNDATIONS.map((foundation) => {
          const row = summaryMap.get(foundation.id);
          if (!row) return null;
          const label = reviewLabel(row);

          return (
            <div key={foundation.id} className="border-4 border-bauhaus-black bg-white">
              <div className="border-b-4 border-bauhaus-black bg-bauhaus-yellow px-6 py-4">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-black">{foundation.label}</div>
                <div className="mt-1 text-2xl font-black text-bauhaus-black">{row.name}</div>
              </div>
              <div className="space-y-5 p-6">
                <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                  <span className="border-2 border-bauhaus-black px-2.5 py-1 text-bauhaus-black">{label}</span>
                  <span className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 px-2.5 py-1 text-bauhaus-red">
                    {formatMoney(row.total_giving_annual)} annual giving
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Governance</div>
                    <div className="mt-2 text-2xl font-black text-bauhaus-black">{row.board_roles}</div>
                  </div>
                  <div className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Verified grants</div>
                    <div className="mt-2 text-2xl font-black text-bauhaus-black">{row.verified_grants}</div>
                  </div>
                  <div className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Year memory</div>
                    <div className="mt-2 text-2xl font-black text-bauhaus-black">{row.year_memory_count}</div>
                  </div>
                  <div className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">Source-backed</div>
                    <div className="mt-2 text-2xl font-black text-bauhaus-black">{row.verified_source_backed_count}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                  <Link
                    href={foundation.route}
                    className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas px-3 py-2 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                  >
                    Open review route
                  </Link>
                  {foundation.compareTargets.map((target) => (
                    <Link
                      key={target.id}
                      href={`/foundations/compare?left=${foundation.id}&right=${target.id}`}
                      className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                    >
                      {target.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-10 border-4 border-bauhaus-black bg-white p-6">
        {recommendedPair ? (
          <div className="mb-6 border-2 border-bauhaus-black bg-bauhaus-yellow p-4">
            <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">Recommended starting pair</div>
            <div className="mt-2 text-2xl font-black text-bauhaus-black">
              {recommendedPair.left.label} vs {recommendedPair.right.label}
            </div>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-bauhaus-black">
              {recommendedPair.detail}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
              <span className="border-2 border-bauhaus-black px-2.5 py-1 text-bauhaus-black">
                {recommendedPair.status}
              </span>
              <Link
                href={`/foundations/compare?left=${recommendedPair.left.id}&right=${recommendedPair.right.id}`}
                className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
              >
                Open recommended compare
              </Link>
            </div>
          </div>
        ) : null}
        {nextClosePair || strongestDevelopingPair ? (
          <div className="mb-6 grid gap-4 xl:grid-cols-2">
            {nextClosePair ? (
              <div className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas p-4">
                <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">Next close pair</div>
                <div className="mt-2 text-xl font-black text-bauhaus-black">
                  {nextClosePair.left.label} vs {nextClosePair.right.label}
                </div>
                <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                  {nextClosePair.detail}
                </p>
                <Link
                  href={`/foundations/compare?left=${nextClosePair.left.id}&right=${nextClosePair.right.id}`}
                  className="mt-3 inline-flex border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                >
                  Open close pair
                </Link>
              </div>
            ) : null}
            {strongestDevelopingPair ? (
              <div className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas p-4">
                <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">Best developing pair</div>
                <div className="mt-2 text-xl font-black text-bauhaus-black">
                  {strongestDevelopingPair.left.label} vs {strongestDevelopingPair.right.label}
                </div>
                <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-muted">
                  {strongestDevelopingPair.detail}
                </p>
                <Link
                  href={`/foundations/compare?left=${strongestDevelopingPair.left.id}&right=${strongestDevelopingPair.right.id}`}
                  className="mt-3 inline-flex border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                >
                  Open developing pair
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="text-xs font-black uppercase tracking-[0.3em] text-bauhaus-red">Pair matrix</div>
        <h2 className="mt-2 text-2xl font-black text-bauhaus-black">Live compare pairs inside the review set</h2>
        <p className="mt-3 max-w-4xl text-sm font-medium leading-relaxed text-bauhaus-muted">
          These are the live pairings currently available across Snow, PRF, Minderoo, Ian Potter, ECSTRA, and Rio Tinto. Use this as the fastest way to choose the strongest side-by-side route before dropping into the full compare surface.
        </p>
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {pairRows.map((pair) => (
            <div key={`${pair.left.id}-${pair.right.id}`} className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-black text-bauhaus-black">
                    {pair.left.label} vs {pair.right.label}
                  </div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
                    {pair.status}
                  </div>
                </div>
                <Link
                  href={`/foundations/compare?left=${pair.left.id}&right=${pair.right.id}`}
                  className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                >
                  Open compare
                </Link>
              </div>
              <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-muted">{pair.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
