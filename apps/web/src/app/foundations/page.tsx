import { getServiceSupabase } from '@/lib/supabase';
import { FilterBar } from '../components/filter-bar';
import { FoundationActionsProvider, FoundationCardActions } from '../components/foundation-card-actions';
import { FundingIntelligenceRail } from '../components/funding-intelligence-rail';
import { ListPreviewProvider, FoundationPreviewTrigger } from '../components/list-preview';

export const dynamic = 'force-dynamic';

interface FoundationRow {
  id: string;
  name: string;
  type: string | null;
  website: string | null;
  description: string | null;
  total_giving_annual: number | null;
  thematic_focus: string[];
  geographic_focus: string[];
  profile_confidence: string;
  enriched_at: string | null;
  created_at: string;
}

interface FoundationPowerProfileRow {
  foundation_id: string;
  capital_holder_class: string;
  capital_source_class: string;
  reportable_in_power_map: boolean;
  openness_score: number | null;
  gatekeeping_score: number | null;
}

interface FoundationYearMemorySummaryRow {
  foundation_id: string;
  year_memory_count: number;
  verified_source_backed_count: number;
}

interface FoundationReviewSummaryRow {
  foundation_id: string;
  board_roles: number;
  table_grants: number;
  relationship_grants: number;
}

interface ReviewBreakdownRow {
  review_status: string;
  count: number;
}

interface MissingSignalSummaryRow {
  missing_governance: number;
  missing_verified_grants: number;
  missing_year_memory: number;
  missing_source_backed: number;
}

interface CountRow {
  count: number;
}

const SNOW_FOUNDATION_ID = 'd242967e-0e68-4367-9785-06cf0ec7485e';
const PRF_FOUNDATION_ID = '4ee5baca-c898-4318-ae2b-d79b95379cc7';
const MINDEROO_FOUNDATION_ID = '8f8704be-d6e8-40f3-b561-ac6630ce5b36';
const RIO_TINTO_FOUNDATION_ID = '85f0de43-d004-4122-83a6-287eeecc4da9';
const IAN_POTTER_FOUNDATION_ID = 'b9e090e5-1672-48ff-815a-2a6314ebe033';
const ECSTRA_FOUNDATION_ID = '25b80b63-416e-4aaa-b470-2f8dc6fa835f';

const PUBLIC_REVIEW_ROUTE_MAP: Record<string, string> = {
  [SNOW_FOUNDATION_ID]: '/snow-foundation',
  [PRF_FOUNDATION_ID]: '/foundations/prf',
  [MINDEROO_FOUNDATION_ID]: '/foundations/minderoo',
  [RIO_TINTO_FOUNDATION_ID]: '/foundations/rio-tinto',
  [IAN_POTTER_FOUNDATION_ID]: '/foundations/ian-potter',
  [ECSTRA_FOUNDATION_ID]: '/foundations/ecstra',
};

const REVIEW_SET_COMPARE_TARGETS = [
  { id: SNOW_FOUNDATION_ID, label: 'Compare with Snow' },
  { id: PRF_FOUNDATION_ID, label: 'Compare with PRF' },
  { id: MINDEROO_FOUNDATION_ID, label: 'Compare with Minderoo' },
  { id: IAN_POTTER_FOUNDATION_ID, label: 'Compare with Ian Potter' },
  { id: ECSTRA_FOUNDATION_ID, label: 'Compare with ECSTRA' },
];

function formatGiving(amount: number | null): string {
  if (!amount) return 'Unknown';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function typeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    private_ancillary_fund: 'Private Ancillary Fund',
    public_ancillary_fund: 'Public Ancillary Fund',
    trust: 'Trust',
    corporate_foundation: 'Corporate Foundation',
    grantmaker: 'Grantmaker',
  };
  return type ? labels[type] || type : 'Foundation';
}

function powerClassLabel(value: string | null | undefined) {
  if (!value) return 'Unclassified';
  return value.replace(/_/g, ' ');
}

function opennessLabel(score: number | null | undefined) {
  if (score == null) return 'Unknown openness';
  if (score >= 0.6) return 'Open capital';
  if (score < 0.35) return 'Gatekept capital';
  return 'Mixed access';
}

function reviewStatusLabel({
  boardRoles,
  verifiedGrants,
  yearMemory,
  verifiedSourceBacked,
}: {
  boardRoles: number;
  verifiedGrants: number;
  yearMemory: number;
  verifiedSourceBacked: number;
}) {
  const stableSignals = [
    boardRoles > 0,
    verifiedGrants > 0,
    yearMemory > 0,
    verifiedSourceBacked > 0,
  ].filter(Boolean).length;

  if (stableSignals === 4) {
    return {
      label: 'Stable review',
      cls: 'border-money bg-money-light text-money',
    };
  }

  if (stableSignals >= 2) {
    return {
      label: 'Developing review',
      cls: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black',
    };
  }

  return {
    label: 'Early review',
    cls: 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted',
  };
}

function reviewSignals({
  boardRoles,
  verifiedGrants,
  yearMemory,
  verifiedSourceBacked,
}: {
  boardRoles: number;
  verifiedGrants: number;
  yearMemory: number;
  verifiedSourceBacked: number;
}) {
  return [
    { key: 'governance', label: 'Governance', active: boardRoles > 0 },
    { key: 'grants', label: 'Verified grants', active: verifiedGrants > 0 },
    { key: 'memory', label: 'Year memory', active: yearMemory > 0 },
    { key: 'sources', label: 'Source-backed', active: verifiedSourceBacked > 0 },
  ];
}

function missingReviewSignals({
  boardRoles,
  verifiedGrants,
  yearMemory,
  verifiedSourceBacked,
}: {
  boardRoles: number;
  verifiedGrants: number;
  yearMemory: number;
  verifiedSourceBacked: number;
}) {
  return reviewSignals({
    boardRoles,
    verifiedGrants,
    yearMemory,
    verifiedSourceBacked,
  })
    .filter((signal) => !signal.active)
    .map((signal) => signal.label);
}

function buildCompareTargets(foundationId: string) {
  return REVIEW_SET_COMPARE_TARGETS.filter((target) => target.id !== foundationId);
}

function getPublicReviewHref(foundationId: string) {
  return PUBLIC_REVIEW_ROUTE_MAP[foundationId] || null;
}

function nextMoveForFoundation(foundationId: string, missingSignals: string[]) {
  if (missingSignals.includes('Year memory') || missingSignals.includes('Source-backed')) {
    return {
      label: 'Next move: build year memory',
      href: `/foundations/${foundationId}#program-history`,
    };
  }

  if (missingSignals.includes('Governance')) {
    return {
      label: 'Next move: link governance',
      href: `/foundations/${foundationId}#board-leadership`,
    };
  }

  if (missingSignals.includes('Verified grants')) {
    return {
      label: 'Next move: pressure-test grant layer',
      href: `/foundations/compare?left=${foundationId}&right=${SNOW_FOUNDATION_ID}`,
    };
  }

  return {
    label: 'Open review path',
    href: `/foundations/${foundationId}`,
  };
}

const STATES = [
  { value: 'AU-National', label: 'National' },
  { value: 'AU-QLD', label: 'Queensland' },
  { value: 'AU-NSW', label: 'New South Wales' },
  { value: 'AU-VIC', label: 'Victoria' },
  { value: 'AU-WA', label: 'Western Australia' },
  { value: 'AU-SA', label: 'South Australia' },
  { value: 'AU-TAS', label: 'Tasmania' },
  { value: 'AU-ACT', label: 'ACT' },
  { value: 'AU-NT', label: 'Northern Territory' },
];

interface SearchParams {
  q?: string;
  type?: string;
  focus?: string;
  profiled?: string;
  page?: string;
  sort?: string;
  geo?: string;
  giving_min?: string;
  giving_max?: string;
  review?: string;
  missing?: string;
}

function sqlString(value: string) {
  return value.replace(/'/g, "''");
}

function buildReviewHref(baseParams: URLSearchParams, review: string) {
  const params = new URLSearchParams(baseParams.toString());
  if (review) {
    params.set('review', review);
  } else {
    params.delete('review');
  }

  const queryString = params.toString();
  return queryString ? `/foundations?${queryString}` : '/foundations';
}

function buildMissingHref(baseParams: URLSearchParams, missing: string) {
  const params = new URLSearchParams(baseParams.toString());
  if (missing) {
    params.set('missing', missing);
  } else {
    params.delete('missing');
  }

  const queryString = params.toString();
  return queryString ? `/foundations?${queryString}` : '/foundations';
}

export default async function FoundationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = params.q || '';
  const typeFilter = params.type || '';
  const focusFilter = params.focus || '';
  const profiledOnly = params.profiled === '1';
  const sortBy = params.sort || 'giving';
  const geoFilter = params.geo || '';
  const givingMin = params.giving_min ? parseInt(params.giving_min, 10) : null;
  const givingMax = params.giving_max ? parseInt(params.giving_max, 10) : null;
  const reviewFilter = params.review || '';
  const missingFilter = params.missing || '';
  const page = parseInt(params.page || '1', 10);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const supabase = getServiceSupabase();
  const useReviewSqlPath = Boolean(reviewFilter) || Boolean(missingFilter) || sortBy === 'review';
  let foundations: FoundationRow[] = [];
  let count = 0;

  const baseWhereClauses = ['TRUE'];

  if (query) {
    const escaped = sqlString(query);
    baseWhereClauses.push(`(f.name ILIKE '%${escaped}%' OR COALESCE(f.description, '') ILIKE '%${escaped}%')`);
  }
  if (typeFilter) {
    baseWhereClauses.push(`f.type = '${sqlString(typeFilter)}'`);
  }
  if (focusFilter) {
    baseWhereClauses.push(`COALESCE(f.thematic_focus, '{}'::text[]) @> ARRAY['${sqlString(focusFilter)}']::text[]`);
  }
  if (profiledOnly) {
    baseWhereClauses.push('f.enriched_at IS NOT NULL');
  }
  if (geoFilter) {
    baseWhereClauses.push(`COALESCE(f.geographic_focus, '{}'::text[]) @> ARRAY['${sqlString(geoFilter)}']::text[]`);
  }
  if (givingMin != null) {
    baseWhereClauses.push(`COALESCE(f.total_giving_annual, 0) >= ${givingMin}`);
  }
  if (givingMax != null) {
    baseWhereClauses.push(`COALESCE(f.total_giving_annual, 0) <= ${givingMax}`);
  }

  const reviewPredicate =
    reviewFilter === 'stable'
      ? `COALESCE(fr.board_roles, 0) > 0
         AND COALESCE(fr.verified_grants, 0) > 0
         AND COALESCE(fr.year_memory_count, 0) > 0
         AND COALESCE(fr.verified_source_backed_count, 0) > 0`
      : reviewFilter === 'developing'
        ? `((COALESCE(fr.board_roles, 0) > 0)::int
            + (COALESCE(fr.verified_grants, 0) > 0)::int
            + (COALESCE(fr.year_memory_count, 0) > 0)::int
            + (COALESCE(fr.verified_source_backed_count, 0) > 0)::int) BETWEEN 2 AND 3`
        : reviewFilter === 'early'
          ? `((COALESCE(fr.board_roles, 0) > 0)::int
              + (COALESCE(fr.verified_grants, 0) > 0)::int
              + (COALESCE(fr.year_memory_count, 0) > 0)::int
              + (COALESCE(fr.verified_source_backed_count, 0) > 0)::int) <= 1`
          : null;

  const missingPredicate =
    missingFilter === 'governance'
      ? 'COALESCE(fr.board_roles, 0) <= 0'
      : missingFilter === 'grants'
        ? 'COALESCE(fr.verified_grants, 0) <= 0'
        : missingFilter === 'year_memory'
          ? 'COALESCE(fr.year_memory_count, 0) <= 0'
          : missingFilter === 'source_backed'
            ? 'COALESCE(fr.verified_source_backed_count, 0) <= 0'
            : null;

  function buildReviewCte(whereClauses: string[]) {
    return `
      WITH board_counts AS (
        SELECT
          company_abn AS acnc_abn,
          COUNT(*)::int AS board_roles
        FROM person_roles
        WHERE cessation_date IS NULL
        GROUP BY company_abn
      ),
      table_grant_counts AS (
        SELECT
          foundation_id,
          COUNT(*)::int AS table_grants
        FROM foundation_grantees
        GROUP BY foundation_id
      ),
      relationship_grant_counts AS (
        SELECT
          s.abn AS acnc_abn,
          COUNT(*)::int AS relationship_grants
        FROM gs_relationships r
        JOIN gs_entities s ON s.id = r.source_entity_id
        WHERE r.relationship_type = 'grant'
          AND r.dataset = 'foundation_grantees'
        GROUP BY s.abn
      ),
      year_memory_counts AS (
        SELECT
          foundation_id,
          COUNT(*)::int AS year_memory_count,
          COUNT(*) FILTER (
            WHERE COALESCE(metadata->>'source', '') NOT ILIKE '%inferred%'
          )::int AS verified_source_backed_count
        FROM foundation_program_years
        GROUP BY foundation_id
      ),
      foundation_review AS (
        SELECT
          f.id,
          COALESCE(b.board_roles, 0) AS board_roles,
          GREATEST(COALESCE(t.table_grants, 0), COALESCE(r.relationship_grants, 0)) AS verified_grants,
          COALESCE(y.year_memory_count, 0) AS year_memory_count,
          COALESCE(y.verified_source_backed_count, 0) AS verified_source_backed_count
        FROM foundations f
        LEFT JOIN board_counts b ON b.acnc_abn = f.acnc_abn
        LEFT JOIN table_grant_counts t ON t.foundation_id = f.id
        LEFT JOIN relationship_grant_counts r ON r.acnc_abn = f.acnc_abn
        LEFT JOIN year_memory_counts y ON y.foundation_id = f.id
      ),
      filtered AS (
        SELECT
          f.*,
          fr.board_roles,
          fr.verified_grants,
          fr.year_memory_count,
          fr.verified_source_backed_count,
          CASE
            WHEN fr.board_roles > 0
              AND fr.verified_grants > 0
              AND fr.year_memory_count > 0
              AND fr.verified_source_backed_count > 0 THEN 'stable'
            WHEN ((fr.board_roles > 0)::int + (fr.verified_grants > 0)::int + (fr.year_memory_count > 0)::int + (fr.verified_source_backed_count > 0)::int) >= 2 THEN 'developing'
            ELSE 'early'
          END AS review_status
        FROM foundations f
        LEFT JOIN foundation_review fr ON fr.id = f.id
        WHERE ${whereClauses.join(' AND ')}
      )
    `;
  }

  if (useReviewSqlPath) {
    const filteredWhereClauses = [...baseWhereClauses];
    if (reviewPredicate) filteredWhereClauses.push(reviewPredicate);
    if (missingPredicate) filteredWhereClauses.push(missingPredicate);

    const orderClause =
      sortBy === 'profiled'
        ? 'enriched_at DESC NULLS LAST'
        : sortBy === 'name'
          ? 'name ASC'
          : sortBy === 'giving_asc'
            ? 'total_giving_annual ASC NULLS LAST'
            : sortBy === 'newest'
              ? 'created_at DESC'
              : sortBy === 'review'
                ? `CASE review_status
                     WHEN 'stable' THEN 0
                     WHEN 'developing' THEN 1
                     ELSE 2
                   END ASC,
                   total_giving_annual DESC NULLS LAST`
                : 'total_giving_annual DESC NULLS LAST';

    const reviewCte = buildReviewCte(filteredWhereClauses);

    const [{ data: countRows }, { data: foundationRows }, { data: programCounts }, { data: acncSummary }] = await Promise.all([
      supabase.rpc('exec_sql', {
        query: `${reviewCte} SELECT COUNT(*)::int AS count FROM filtered`,
      }),
      supabase.rpc('exec_sql', {
        query: `${reviewCte}
                SELECT id, name, type, website, description, total_giving_annual, thematic_focus, geographic_focus, profile_confidence, enriched_at, created_at
                FROM filtered
                ORDER BY ${orderClause}
                LIMIT ${pageSize} OFFSET ${offset}`,
      }),
      supabase.rpc('get_foundation_program_counts'),
      supabase.rpc('get_foundation_acnc_summary'),
    ]);

    foundations = (foundationRows || []) as FoundationRow[];
    count = Number(((countRows as Array<{ count: number }> | null)?.[0]?.count) || 0);

    // rebind for later shared logic
    var sharedProgramCounts = programCounts;
    var sharedAcncSummary = acncSummary;
  } else {
    let dbQuery = supabase
      .from('foundations')
      .select('id, name, type, website, description, total_giving_annual, thematic_focus, geographic_focus, profile_confidence, enriched_at, created_at', { count: 'exact' });

    if (query) {
      dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    }
    if (typeFilter) {
      dbQuery = dbQuery.eq('type', typeFilter);
    }
    if (focusFilter) {
      dbQuery = dbQuery.contains('thematic_focus', [focusFilter]);
    }
    if (profiledOnly) {
      dbQuery = dbQuery.not('enriched_at', 'is', null);
    }
    if (geoFilter) {
      dbQuery = dbQuery.contains('geographic_focus', [geoFilter]);
    }
    if (givingMin) {
      dbQuery = dbQuery.gte('total_giving_annual', givingMin);
    }
    if (givingMax) {
      dbQuery = dbQuery.lte('total_giving_annual', givingMax);
    }

    if (sortBy === 'profiled') {
      dbQuery = dbQuery.order('enriched_at', { ascending: false, nullsFirst: false });
    } else if (sortBy === 'name') {
      dbQuery = dbQuery.order('name', { ascending: true });
    } else if (sortBy === 'giving_asc') {
      dbQuery = dbQuery.order('total_giving_annual', { ascending: true, nullsFirst: false });
    } else if (sortBy === 'newest') {
      dbQuery = dbQuery.order('created_at', { ascending: false });
    } else {
      dbQuery = dbQuery.order('total_giving_annual', { ascending: false, nullsFirst: false });
    }

    dbQuery = dbQuery.range(offset, offset + pageSize - 1);

    const [{ data: foundationRows, count: totalCount }, { data: programCounts }, { data: acncSummary }] = await Promise.all([
      dbQuery,
      supabase.rpc('get_foundation_program_counts'),
      supabase.rpc('get_foundation_acnc_summary'),
    ]);

    foundations = (foundationRows || []) as FoundationRow[];
    count = totalCount || 0;
    var sharedProgramCounts = programCounts;
    var sharedAcncSummary = acncSummary;
  }

  const reviewBreakdownWhereClauses = [...baseWhereClauses];
  if (missingPredicate) reviewBreakdownWhereClauses.push(missingPredicate);

  const missingSummaryWhereClauses = [...baseWhereClauses];
  if (reviewPredicate) missingSummaryWhereClauses.push(reviewPredicate);

  const releaseReviewWhereClauses = [...baseWhereClauses];
  if (missingPredicate) releaseReviewWhereClauses.push(missingPredicate);

  const releaseMissingWhereClauses = [...baseWhereClauses];
  if (reviewPredicate) releaseMissingWhereClauses.push(reviewPredicate);

  const [{ data: reviewBreakdown }, { data: missingSignalSummary }] = await Promise.all([
    supabase.rpc('exec_sql', {
      query: `${buildReviewCte(reviewBreakdownWhereClauses)}
              SELECT review_status, COUNT(*)::int AS count
              FROM filtered
              GROUP BY review_status`,
    }),
    supabase.rpc('exec_sql', {
      query: `${buildReviewCte(missingSummaryWhereClauses)}
              SELECT
                SUM(CASE WHEN COALESCE(board_roles, 0) <= 0 THEN 1 ELSE 0 END)::int AS missing_governance,
                SUM(CASE WHEN COALESCE(verified_grants, 0) <= 0 THEN 1 ELSE 0 END)::int AS missing_verified_grants,
                SUM(CASE WHEN COALESCE(year_memory_count, 0) <= 0 THEN 1 ELSE 0 END)::int AS missing_year_memory,
                SUM(CASE WHEN COALESCE(verified_source_backed_count, 0) <= 0 THEN 1 ELSE 0 END)::int AS missing_source_backed
              FROM filtered`,
    }),
  ]);

  const [{ data: releaseReviewCountRows }, { data: releaseMissingCountRows }, { data: resetLaneCountRows }] = await Promise.all([
    reviewFilter
      ? supabase.rpc('exec_sql', {
          query: `${buildReviewCte(releaseReviewWhereClauses)}
                  SELECT COUNT(*)::int AS count
                  FROM filtered`,
        })
      : Promise.resolve({ data: null }),
    missingFilter
      ? supabase.rpc('exec_sql', {
          query: `${buildReviewCte(releaseMissingWhereClauses)}
                  SELECT COUNT(*)::int AS count
                  FROM filtered`,
        })
      : Promise.resolve({ data: null }),
    reviewFilter || missingFilter
      ? supabase.rpc('exec_sql', {
          query: `${buildReviewCte(baseWhereClauses)}
                  SELECT COUNT(*)::int AS count
                  FROM filtered`,
        })
      : Promise.resolve({ data: null }),
  ]);

  const foundationIds = ((foundations || []) as FoundationRow[]).map((foundation) => foundation.id);
  const [{ data: powerProfiles }, { data: yearMemorySummary }, { data: reviewSummary }] = foundationIds.length
    ? await Promise.all([
        supabase
          .from('foundation_power_profiles')
          .select('foundation_id, capital_holder_class, capital_source_class, reportable_in_power_map, openness_score, gatekeeping_score')
          .in('foundation_id', foundationIds),
        supabase.rpc('exec_sql', {
          query: `SELECT
                    foundation_id::text AS foundation_id,
                    COUNT(*)::int AS year_memory_count,
                    COUNT(*) FILTER (
                      WHERE COALESCE(metadata->>'source', '') NOT ILIKE '%inferred%'
                    )::int AS verified_source_backed_count
                  FROM foundation_program_years
                  WHERE foundation_id IN (${foundationIds.map((id) => `'${id}'`).join(', ')})
                  GROUP BY foundation_id`,
        }),
        supabase.rpc('exec_sql', {
          query: `SELECT
                    f.id::text AS foundation_id,
                    (SELECT COUNT(*)::int
                     FROM person_roles pr
                     WHERE (
                         (f.acnc_abn IS NOT NULL AND f.acnc_abn <> '' AND pr.company_abn = f.acnc_abn)
                         OR ((f.acnc_abn IS NULL OR f.acnc_abn = '') AND pr.company_name = f.name)
                       )
                       AND pr.cessation_date IS NULL) AS board_roles,
                    (SELECT COUNT(*)::int
                     FROM foundation_grantees fg
                     WHERE fg.foundation_id = f.id) AS table_grants,
                    (SELECT COUNT(*)::int
                     FROM gs_relationships r
                     JOIN gs_entities s ON s.id = r.source_entity_id
                     WHERE s.abn = f.acnc_abn
                       AND r.relationship_type = 'grant'
                       AND r.dataset = 'foundation_grantees') AS relationship_grants
                  FROM foundations f
                  WHERE f.id IN (${foundationIds.map((id) => `'${id}'`).join(', ')})`,
        }),
      ])
    : [
        { data: [] as FoundationPowerProfileRow[] },
        { data: [] as FoundationYearMemorySummaryRow[] },
        { data: [] as FoundationReviewSummaryRow[] },
      ];
  const totalPages = Math.ceil((count || 0) / pageSize);

  // Build lookup map for program counts
  const progCountMap = new Map<string, { programs: number; open: number }>();
  if (sharedProgramCounts) {
    for (const pc of sharedProgramCounts as Array<{ foundation_id: string; program_count: number; open_count: number }>) {
      progCountMap.set(pc.foundation_id, { programs: Number(pc.program_count), open: Number(pc.open_count) });
    }
  }

  // Build lookup map for ACNC financials
  const acncMap = new Map<string, { total_assets: number; grants_given: number; latest_year: number }>();
  if (sharedAcncSummary) {
    for (const row of sharedAcncSummary as Array<{ foundation_id: string; total_assets: number; grants_given: number; latest_year: number }>) {
      acncMap.set(row.foundation_id, { total_assets: Number(row.total_assets), grants_given: Number(row.grants_given), latest_year: row.latest_year });
    }
  }

  const powerMap = new Map<string, FoundationPowerProfileRow>();
  if (powerProfiles) {
    for (const row of powerProfiles as FoundationPowerProfileRow[]) {
      powerMap.set(row.foundation_id, row);
    }
  }

  const yearMemoryMap = new Map<string, { total: number; verified: number }>();
  if (yearMemorySummary) {
    for (const row of yearMemorySummary as FoundationYearMemorySummaryRow[]) {
      yearMemoryMap.set(row.foundation_id, {
        total: Number(row.year_memory_count),
        verified: Number(row.verified_source_backed_count),
      });
    }
  }

  const reviewMap = new Map<string, { boardRoles: number; verifiedGrants: number }>();
  if (reviewSummary) {
    for (const row of reviewSummary as FoundationReviewSummaryRow[]) {
      reviewMap.set(row.foundation_id, {
        boardRoles: Number(row.board_roles),
        verifiedGrants: Math.max(Number(row.table_grants), Number(row.relationship_grants)),
      });
    }
  }

  const reviewBreakdownMap = new Map<string, number>();
  if (reviewBreakdown) {
    for (const row of reviewBreakdown as ReviewBreakdownRow[]) {
      reviewBreakdownMap.set(row.review_status, Number(row.count));
    }
  }

  const missingSignals = ((missingSignalSummary as MissingSignalSummaryRow[] | null)?.[0] || {
    missing_governance: 0,
    missing_verified_grants: 0,
    missing_year_memory: 0,
    missing_source_backed: 0,
  }) as MissingSignalSummaryRow;
  const releaseReviewCount = Number(((releaseReviewCountRows as CountRow[] | null)?.[0]?.count) || 0);
  const releaseMissingCount = Number(((releaseMissingCountRows as CountRow[] | null)?.[0]?.count) || 0);
  const resetLaneCount = Number(((resetLaneCountRows as CountRow[] | null)?.[0]?.count) || 0);

  const types = ['private_ancillary_fund', 'public_ancillary_fund', 'trust', 'corporate_foundation', 'grantmaker'];
  const focuses = ['arts', 'indigenous', 'health', 'education', 'community', 'environment', 'research'];
  const sortOptions = [
    { value: 'giving', label: 'Highest Giving' },
    { value: 'giving_asc', label: 'Lowest Giving' },
    { value: 'review', label: 'Review Status' },
    { value: 'profiled', label: 'Recently Profiled' },
    { value: 'newest', label: 'Newest Added' },
    { value: 'name', label: 'Name A-Z' },
  ];
  const reviewOptions = [
    { value: '', label: 'All review states' },
    { value: 'stable', label: 'Stable review' },
    { value: 'developing', label: 'Developing review' },
    { value: 'early', label: 'Early review' },
  ];
  const missingOptions = [
    { value: '', label: 'All evidence gaps' },
    { value: 'governance', label: 'Missing governance' },
    { value: 'grants', label: 'Missing verified grants' },
    { value: 'year_memory', label: 'Missing year memory' },
    { value: 'source_backed', label: 'Missing source-backed memory' },
  ];

  // Build filter query string for pagination
  const filterParams = new URLSearchParams();
  if (query) filterParams.set('q', query);
  if (typeFilter) filterParams.set('type', typeFilter);
  if (focusFilter) filterParams.set('focus', focusFilter);
  if (profiledOnly) filterParams.set('profiled', '1');
  if (sortBy !== 'giving') filterParams.set('sort', sortBy);
  if (geoFilter) filterParams.set('geo', geoFilter);
  if (givingMin) filterParams.set('giving_min', String(givingMin));
  if (givingMax) filterParams.set('giving_max', String(givingMax));
  if (reviewFilter) filterParams.set('review', reviewFilter);
  if (missingFilter) filterParams.set('missing', missingFilter);
  const filterQS = filterParams.toString();
  const reviewChipBaseParams = new URLSearchParams(filterParams.toString());
  reviewChipBaseParams.delete('review');
  const missingChipBaseParams = new URLSearchParams(filterParams.toString());
  missingChipBaseParams.delete('missing');
  const reviewSliceResetParams = new URLSearchParams(filterParams.toString());
  reviewSliceResetParams.delete('review');
  reviewSliceResetParams.delete('missing');
  const reviewQuickLinks = [
    { value: '', label: 'Reset review filter' },
    { value: 'stable', label: `Stable review (${(reviewBreakdownMap.get('stable') || 0).toLocaleString()})` },
    { value: 'developing', label: `Developing review (${(reviewBreakdownMap.get('developing') || 0).toLocaleString()})` },
    { value: 'early', label: `Early review (${(reviewBreakdownMap.get('early') || 0).toLocaleString()})` },
  ];
  const missingQuickLinks = [
    { value: '', label: 'Current gaps', count: null },
    { value: 'governance', label: 'Governance', count: missingSignals.missing_governance || 0 },
    { value: 'grants', label: 'Grants', count: missingSignals.missing_verified_grants || 0 },
    { value: 'year_memory', label: 'Year memory', count: missingSignals.missing_year_memory || 0 },
    { value: 'source_backed', label: 'Source-backed', count: missingSignals.missing_source_backed || 0 },
  ];
  const activeReviewOption = reviewOptions.find((option) => option.value === reviewFilter);
  const activeMissingOption = missingOptions.find((option) => option.value === missingFilter);
  const nearbyReviewOptions = reviewOptions
    .filter((option) => option.value && option.value !== reviewFilter)
    .map((option) => ({
      ...option,
      kind: 'review' as const,
      count: reviewBreakdownMap.get(option.value) || 0,
      href: buildReviewHref(reviewChipBaseParams, option.value),
    }))
    .filter((option) => option.count > 0)
    .sort((a, b) => b.count - a.count);
  const nearbyMissingOptions = missingOptions
    .filter((option) => option.value && option.value !== missingFilter)
    .map((option) => {
      const count =
        option.value === 'governance'
          ? missingSignals.missing_governance || 0
          : option.value === 'grants'
            ? missingSignals.missing_verified_grants || 0
            : option.value === 'year_memory'
              ? missingSignals.missing_year_memory || 0
              : missingSignals.missing_source_backed || 0;
      return {
        ...option,
        kind: 'missing' as const,
        count,
        href: buildMissingHref(missingChipBaseParams, option.value),
      };
    })
    .filter((option) => option.count > 0)
    .sort((a, b) => b.count - a.count);
  const closestRecoveryOption =
    (reviewFilter && missingFilter
      ? nearbyMissingOptions[0] || nearbyReviewOptions[0]
      : reviewFilter
        ? nearbyReviewOptions[0]
        : missingFilter
          ? nearbyMissingOptions[0]
          : undefined);
  const bestRecoveryOption = closestRecoveryOption || [...nearbyReviewOptions, ...nearbyMissingOptions]
    .sort((a, b) => b.count - a.count)[0];
  const bestRecoveryLabel = bestRecoveryOption
    ? bestRecoveryOption.kind === 'missing'
      ? bestRecoveryOption.label.replace('Missing ', '').toLowerCase()
      : bestRecoveryOption.label.toLowerCase()
    : null;
  const bestRecoveryReason = bestRecoveryOption
    ? reviewFilter && missingFilter
      ? bestRecoveryOption.kind === 'missing'
        ? 'Closest live recovery that keeps the current review state.'
        : 'Wider recovery path because no nearby evidence-gap slice is still live.'
      : reviewFilter
        ? 'Closest live recovery within the current review-state lane.'
        : missingFilter
          ? 'Closest live recovery within the current evidence-gap lane.'
          : 'Best live recovery from the current directory state.'
    : null;
  const sliceCount = Number(count || 0);
  const isThinSlice = Boolean((reviewFilter || missingFilter) && sliceCount > 0 && sliceCount <= 5);
  const sliceMode =
    (reviewFilter || missingFilter) && sliceCount > 0
      ? sliceCount <= 5
        ? {
            label: 'Narrow lead list',
            description: 'Good for direct prospecting, not for broad landscape claims.',
            actionLabel: 'Use for: direct outreach and shortlist review',
            actionHref: '/funding-workspace',
            actionCta: 'Open funding workspace',
            secondaryHref: bestRecoveryOption && bestRecoveryOption.count > sliceCount ? bestRecoveryOption.href : null,
            secondaryCta: bestRecoveryOption && bestRecoveryOption.count > sliceCount ? `Broaden to ${bestRecoveryLabel}` : null,
            nextStep: bestRecoveryOption && bestRecoveryOption.count > sliceCount
              ? `Next step: broaden to ${bestRecoveryLabel} if you need a wider market read.`
              : 'Next step: stay narrow and work the shortlist directly.',
            className: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black',
          }
        : sliceCount <= 50
          ? {
              label: 'Focused subset',
              description: 'Useful for reading a lane closely, but still too small for broad system claims.',
              actionLabel: 'Use for: close comparison inside one lane',
              actionHref: '/foundations/compare',
              actionCta: 'Open compare surface',
              secondaryHref: '/funding-workspace',
              secondaryCta: 'Open funding workspace',
              nextStep: 'Next step: compare the strongest candidates inside this lane before broadening further.',
              className: 'border-bauhaus-blue/25 bg-link-light text-bauhaus-blue',
            }
          : {
              label: 'Landscape-ready',
              description: 'Large enough to scan for patterns inside the current reviewability lane.',
              actionLabel: 'Use for: pattern scanning and gap analysis',
              actionHref: '/reports/philanthropy-power',
              actionCta: 'Open philanthropy power map',
              secondaryHref: '/foundations/compare',
              secondaryCta: 'Tighten with compare',
              nextStep: 'Next step: scan the pattern, then tighten the slice when you are ready to shortlist.',
              className: 'border-money/25 bg-money-light text-money',
            }
      : null;
  const currentLaneSummary =
    (reviewFilter || missingFilter) && sliceCount > 0
      ? reviewFilter && missingFilter
        ? [
            `Fixed review state: ${activeReviewOption?.label || reviewFilter}.`,
            `Fixed evidence gap: ${activeMissingOption?.label.replace('Missing ', '') || missingFilter}.`,
            query ? `Fixed search query: "${query}".` : null,
            geoFilter ? `Fixed geography: ${geoFilter}.` : null,
            typeFilter ? `Fixed type: ${typeLabel(typeFilter)}.` : null,
            focusFilter ? `Fixed focus: ${focusFilter}.` : null,
            givingMin != null && givingMax != null
              ? `Fixed annual giving band: ${formatGiving(givingMin)} to ${formatGiving(givingMax)}.`
              : givingMin != null
                ? `Fixed annual giving floor: ${formatGiving(givingMin)} and above.`
                : givingMax != null
                  ? `Fixed annual giving ceiling: ${formatGiving(givingMax)} and below.`
                  : null,
            profiledOnly ? 'Profiled-only view is active.' : null,
            'Use pivots to move one axis at a time without losing the current lane.',
          ].filter(Boolean) as string[]
        : reviewFilter
          ? [
              `Fixed review state: ${activeReviewOption?.label || reviewFilter}.`,
              query ? `Fixed search query: "${query}".` : null,
              geoFilter ? `Fixed geography: ${geoFilter}.` : null,
              typeFilter ? `Fixed type: ${typeLabel(typeFilter)}.` : null,
              focusFilter ? `Fixed focus: ${focusFilter}.` : null,
              givingMin != null && givingMax != null
                ? `Fixed annual giving band: ${formatGiving(givingMin)} to ${formatGiving(givingMax)}.`
                : givingMin != null
                  ? `Fixed annual giving floor: ${formatGiving(givingMin)} and above.`
                  : givingMax != null
                    ? `Fixed annual giving ceiling: ${formatGiving(givingMax)} and below.`
                    : null,
              profiledOnly ? 'Profiled-only view is active.' : null,
              'Evidence gap is still open.',
              'Use evidence pivots or gap filters to tighten this lane.',
            ].filter(Boolean) as string[]
          : [
              `Fixed evidence gap: ${activeMissingOption?.label.replace('Missing ', '') || missingFilter}.`,
              query ? `Fixed search query: "${query}".` : null,
              geoFilter ? `Fixed geography: ${geoFilter}.` : null,
              typeFilter ? `Fixed type: ${typeLabel(typeFilter)}.` : null,
              focusFilter ? `Fixed focus: ${focusFilter}.` : null,
              givingMin != null && givingMax != null
                ? `Fixed annual giving band: ${formatGiving(givingMin)} to ${formatGiving(givingMax)}.`
                : givingMin != null
                  ? `Fixed annual giving floor: ${formatGiving(givingMin)} and above.`
                  : givingMax != null
                    ? `Fixed annual giving ceiling: ${formatGiving(givingMax)} and below.`
                    : null,
              profiledOnly ? 'Profiled-only view is active.' : null,
              'Review state is still open.',
              'Use review pivots or review filters to tighten this lane.',
            ].filter(Boolean) as string[]
      : [];
  const laneControlLinks = [
    reviewFilter
      ? {
          href: buildReviewHref(reviewChipBaseParams, ''),
          label: `Release review state${releaseReviewCount > 0 ? ` (${releaseReviewCount.toLocaleString()})` : ''}`,
        }
      : null,
    missingFilter
      ? {
          href: buildMissingHref(missingChipBaseParams, ''),
          label: `Release evidence gap${releaseMissingCount > 0 ? ` (${releaseMissingCount.toLocaleString()})` : ''}`,
        }
      : null,
    reviewFilter || missingFilter
      ? {
          href: buildMissingHref(reviewSliceResetParams, ''),
          label: `Reset lane${resetLaneCount > 0 ? ` (${resetLaneCount.toLocaleString()})` : ''}`,
        }
      : null,
  ].filter(Boolean) as Array<{ href: string; label: string }>;
  const laneType =
    (reviewFilter || missingFilter) && sliceCount > 0
      ? reviewFilter && missingFilter
        ? {
            label: 'Two-axis lane',
            description: 'Both review state and evidence gap are fixed.',
            className: 'border-bauhaus-red/25 bg-bauhaus-red/5 text-bauhaus-red',
          }
        : {
            label: 'Single-axis lane',
            description: reviewFilter
              ? 'Review state is fixed; evidence gap can still move.'
              : 'Evidence gap is fixed; review state can still move.',
            className: 'border-bauhaus-black/15 bg-bauhaus-canvas text-bauhaus-black',
          }
      : null;
  const emptySliceReasons =
    reviewFilter && missingFilter
      ? [
          nearbyMissingOptions.length > 0 && activeReviewOption?.value
            ? `The ${activeReviewOption.label.toLowerCase()} lane is still live, but not with ${activeMissingOption?.label.replace('Missing ', '').toLowerCase()}.`
            : null,
          nearbyReviewOptions.length > 0 && activeMissingOption?.value
            ? `The ${activeMissingOption.label.replace('Missing ', '').toLowerCase()} gap still exists, but only in other review states.`
            : null,
        ].filter(Boolean) as string[]
      : [];
  const adjacentReviewOptions = nearbyReviewOptions.slice(0, 2).map((option) => ({
    ...option,
    displayLabel: option.label,
  }));
  const adjacentMissingOptions = nearbyMissingOptions.slice(0, 2).map((option) => ({
    ...option,
    displayLabel: option.label.replace('Missing ', ''),
  }));
  const foundationsList = (foundations as FoundationRow[] || []);

  return (
    <ListPreviewProvider>
    <FoundationActionsProvider>
    <div>
      <FundingIntelligenceRail
        current="foundations"
        totalLabel={`${(count || 0).toLocaleString()} foundations, trusts, and ancillary funds in the current funder search`}
        query={query}
        theme={focusFilter || query}
        geography={geoFilter}
        trackerHref="/tracker"
      />

      <div className="mb-8">
        <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-2">Directory</p>
        <h1 className="text-3xl font-black text-bauhaus-black mb-2">Australian Foundations</h1>
        <p className="text-bauhaus-muted font-medium">
          {(count || 0).toLocaleString()} foundations, trusts, and ancillary funds from the ACNC register
          {' '}&middot;{' '}
          <a href="/charities" className="text-bauhaus-blue hover:underline font-bold">See all 64,000+ charities &rarr;</a>
        </p>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-widest">
        <a href="/reports/philanthropy-power" className="px-3 py-2 border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors">
          Open philanthropy power map
        </a>
          <a href="/foundations/backlog" className="px-3 py-2 border-2 border-bauhaus-black/20 bg-white text-bauhaus-black hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors">
            Open backlog
          </a>
          <a href="/foundations/review-set" className="px-3 py-2 border-2 border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors">
            Open review set
          </a>
          <a href="/foundations/compare" className="px-3 py-2 border-2 border-bauhaus-red text-bauhaus-red bg-bauhaus-red/5 hover:bg-bauhaus-red hover:text-white transition-colors">
            Compare foundations
          </a>
          <a href="/funding-workspace" className="px-3 py-2 border-2 border-bauhaus-blue text-bauhaus-blue bg-link-light hover:bg-bauhaus-blue hover:text-white transition-colors">
            Open funding workspace
          </a>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-widest">
          {reviewQuickLinks.map((option) => {
            const isActive = (option.value || '') === reviewFilter;
            return (
              <a
                key={option.value || 'all'}
                href={buildReviewHref(reviewChipBaseParams, option.value)}
                className={`px-3 py-2 border-2 transition-colors ${
                  isActive
                    ? 'border-bauhaus-red bg-bauhaus-red text-white'
                    : option.value === 'stable'
                      ? 'border-money text-money bg-money-light hover:bg-money hover:text-white'
                      : option.value === 'developing'
                        ? 'border-bauhaus-yellow text-bauhaus-black bg-warning-light hover:bg-bauhaus-yellow'
                        : option.value === 'early'
                          ? 'border-bauhaus-black/20 text-bauhaus-muted bg-bauhaus-canvas hover:border-bauhaus-black hover:text-bauhaus-black'
                          : 'border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white'
                }`}
              >
                {option.label}
              </a>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
          {missingQuickLinks.map((option) => {
            const isActive = (option.value || '') === missingFilter;
            return (
              <a
                key={option.value || 'all'}
                href={buildMissingHref(missingChipBaseParams, option.value)}
                className={`border-2 px-3 py-2 transition-colors ${
                  isActive
                    ? 'border-bauhaus-red bg-bauhaus-red text-white'
                    : option.value
                      ? 'border-bauhaus-black/15 bg-bauhaus-canvas text-bauhaus-black hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white'
                      : 'border-bauhaus-black/15 bg-bauhaus-canvas text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black'
                }`}
              >
                {option.count == null ? option.label : `${option.label} ${option.count.toLocaleString()}`}
              </a>
            );
          })}
        </div>
      </div>

      <form method="get" className="flex flex-col sm:flex-row gap-0 mb-4 flex-wrap">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search foundations..."
          className="flex-1 min-w-[200px] px-4 py-2.5 border-4 border-bauhaus-black text-sm font-bold bg-white focus:bg-bauhaus-yellow focus:outline-none"
        />
        <select name="type" defaultValue={typeFilter} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          <option value="">All types</option>
          {types.map(t => (
            <option key={t} value={t}>{typeLabel(t)}</option>
          ))}
        </select>
        <select name="focus" defaultValue={focusFilter} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          <option value="">All focus areas</option>
          {focuses.map(f => (
            <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
          ))}
        </select>
        <select name="sort" defaultValue={sortBy} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          {sortOptions.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select name="review" defaultValue={reviewFilter} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          {reviewOptions.map(option => (
            <option key={option.value || 'all'} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select name="missing" defaultValue={missingFilter} className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none">
          {missingOptions.map(option => (
            <option key={option.value || 'all'} value={option.value}>{option.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs font-black text-bauhaus-black cursor-pointer px-4 py-2.5 border-4 border-l-0 border-bauhaus-black bg-white uppercase tracking-wider">
          <input type="checkbox" name="profiled" value="1" defaultChecked={profiledOnly} className="accent-bauhaus-red" />
          Profiled
        </label>
        <button type="submit" className="px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red cursor-pointer border-4 border-bauhaus-black">
          Filter
        </button>
      </form>

      {/* Additional filters */}
      <FilterBar>
        <form method="get" className="flex flex-col sm:flex-row gap-0 border-4 border-bauhaus-black bg-white">
          {query && <input type="hidden" name="q" value={query} />}
          {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
          {focusFilter && <input type="hidden" name="focus" value={focusFilter} />}
          {profiledOnly && <input type="hidden" name="profiled" value="1" />}
          {sortBy !== 'giving' && <input type="hidden" name="sort" value={sortBy} />}
          {reviewFilter && <input type="hidden" name="review" value={reviewFilter} />}
          {missingFilter && <input type="hidden" name="missing" value={missingFilter} />}
          <div className="flex items-center px-3 py-2 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <span className="text-[11px] font-black text-bauhaus-muted uppercase tracking-wider mr-2 whitespace-nowrap">Annual Giving</span>
            <input
              type="number"
              name="giving_min"
              defaultValue={givingMin || ''}
              placeholder="Min $"
              className="w-20 px-2 py-1 text-xs font-bold border-2 border-bauhaus-black/20 bg-bauhaus-canvas focus:outline-none tabular-nums"
            />
            <span className="mx-1 text-bauhaus-muted">–</span>
            <input
              type="number"
              name="giving_max"
              defaultValue={givingMax || ''}
              placeholder="Max $"
              className="w-20 px-2 py-1 text-xs font-bold border-2 border-bauhaus-black/20 bg-bauhaus-canvas focus:outline-none tabular-nums"
            />
          </div>
          <div className="flex items-center px-3 py-2 border-b-4 sm:border-b-0 sm:border-r-4 border-bauhaus-black">
            <span className="text-[11px] font-black text-bauhaus-muted uppercase tracking-wider mr-2">State</span>
            <select name="geo" defaultValue={geoFilter} className="text-xs font-bold bg-bauhaus-canvas border-2 border-bauhaus-black/20 px-2 py-1 focus:outline-none">
              <option value="">All</option>
              {STATES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="px-4 py-2 bg-bauhaus-black text-white text-[11px] font-black uppercase tracking-widest hover:bg-bauhaus-red cursor-pointer">
            Apply
          </button>
        </form>
      </FilterBar>

      {(reviewFilter || missingFilter) && (
        <div className="mb-4 border-4 border-bauhaus-black bg-bauhaus-canvas px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Current review slice</p>
              <p className="mt-1 text-sm font-bold text-bauhaus-black">
                {sliceCount.toLocaleString()} foundations in this reviewability subset.
              </p>
              <p className="mt-1 text-[11px] font-medium text-bauhaus-muted">
                Bands: 1-5 narrow lead list, 6-50 focused subset, 51+ landscape-ready.
              </p>
              {laneType && (
                <div className={`mt-2 inline-flex flex-col border-2 px-3 py-2 ${laneType.className}`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em]">{laneType.label}</p>
                  <p className="mt-1 text-xs font-medium">{laneType.description}</p>
                </div>
              )}
              {sliceMode && (
                <div className={`mt-2 border-2 px-3 py-2 ${sliceMode.className}`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em]">{sliceMode.label}</p>
                  <p className="mt-1 text-xs font-medium">{sliceMode.description}</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em]">
                      {sliceMode.actionLabel}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={sliceMode.actionHref}
                        className="inline-flex border-2 border-current px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] transition-colors hover:bg-bauhaus-black hover:text-white hover:border-bauhaus-black"
                      >
                        {sliceMode.actionCta}
                      </a>
                      {sliceMode.secondaryHref && sliceMode.secondaryCta && (
                        <a
                          href={sliceMode.secondaryHref}
                          className="inline-flex border-2 border-current/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] opacity-80 transition-colors hover:bg-bauhaus-black hover:text-white hover:border-bauhaus-black hover:opacity-100"
                        >
                          {sliceMode.secondaryCta}
                        </a>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-medium">
                    {sliceMode.nextStep}
                  </p>
                </div>
              )}
              {currentLaneSummary.length > 0 && (
                <div className="mt-2 border-2 border-bauhaus-black/10 bg-white/70 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-bauhaus-muted">Current lane</p>
                  <div className="mt-1 space-y-1 text-xs font-medium text-bauhaus-black">
                    {currentLaneSummary.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                  {laneControlLinks.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                      {laneControlLinks.map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-3 py-1.5 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {isThinSlice && (
                <div className="mt-2 border-l-4 border-bauhaus-yellow bg-warning-light px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-bauhaus-muted">Thin slice</p>
                  <p className="mt-1 text-xs font-medium text-bauhaus-black">
                    Only {sliceCount.toLocaleString()} foundation{sliceCount === 1 ? '' : 's'} match this reviewability subset. Treat this as a narrow lead list, not a landscape read.
                  </p>
                  {bestRecoveryOption && bestRecoveryOption.count > sliceCount && bestRecoveryLabel && (
                    <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                      Broaden to {bestRecoveryLabel} to reopen {bestRecoveryOption.count.toLocaleString()} foundations.
                    </p>
                  )}
                </div>
              )}
              {(adjacentReviewOptions.length > 0 || adjacentMissingOptions.length > 0) && (
                <div className="mt-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-bauhaus-muted">Adjacent live slices</p>
                  {adjacentReviewOptions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Review state pivots</p>
                      <p className="mt-1 text-[11px] font-medium text-bauhaus-muted">
                        Keep the current evidence gap fixed and move across review states.
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                        {adjacentReviewOptions.map((option) => (
                          <a
                            key={`${option.kind}-${option.value}`}
                            href={option.href}
                            className="border-2 border-money/25 bg-money-light px-3 py-1.5 text-money transition-colors hover:border-money hover:bg-money hover:text-white"
                          >
                            {option.displayLabel} ({option.count.toLocaleString()})
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {adjacentMissingOptions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Evidence gap pivots</p>
                      <p className="mt-1 text-[11px] font-medium text-bauhaus-muted">
                        Keep the current review state fixed and move across adjacent evidence gaps.
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                        {adjacentMissingOptions.map((option) => (
                          <a
                            key={`${option.kind}-${option.value}`}
                            href={option.href}
                            className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 px-3 py-1.5 text-bauhaus-red transition-colors hover:border-bauhaus-red hover:bg-bauhaus-red hover:text-white"
                          >
                            {option.displayLabel} ({option.count.toLocaleString()})
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
              {activeReviewOption && activeReviewOption.value && (
                <span className="border-2 border-money/25 bg-money-light px-2.5 py-1 text-money">
                  {activeReviewOption.label}
                </span>
              )}
              {activeMissingOption && activeMissingOption.value && (
                <span className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 px-2.5 py-1 text-bauhaus-red">
                  {activeMissingOption.label}
                </span>
              )}
              <a
                href={buildMissingHref(reviewSliceResetParams, '')}
                className="border-2 border-bauhaus-black px-2.5 py-1 text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
              >
                Reset slice
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {foundationsList.length === 0 && (
          <div className="border-4 border-bauhaus-black bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-bauhaus-red">No foundations in this slice</p>
            <h2 className="mt-2 text-xl font-black text-bauhaus-black">This filter combination is too tight.</h2>
            <p className="mt-2 max-w-3xl text-sm font-medium text-bauhaus-muted">
              {reviewFilter || missingFilter
                ? 'The current reviewability filters do not leave any matching foundations. Loosen one of the active slice controls or reset the slice entirely.'
                : 'The current search and filter combination does not leave any matching foundations. Clear one or more filters and try again.'}
            </p>
            {emptySliceReasons.length > 0 && (
              <div className="mt-4 border-l-4 border-bauhaus-red bg-bauhaus-red/5 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-bauhaus-red">Why this is empty</p>
                <div className="mt-2 space-y-1 text-sm font-medium text-bauhaus-black">
                  {emptySliceReasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                  ))}
                </div>
              </div>
            )}
            {bestRecoveryOption && (
              <div className="mt-4 border-4 border-bauhaus-yellow bg-warning-light p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-bauhaus-muted">Recommended recovery</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-bauhaus-black">
                      Jump to {bestRecoveryLabel} and reopen {bestRecoveryOption.count.toLocaleString()} foundations.
                    </p>
                    {bestRecoveryReason && (
                      <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                        {bestRecoveryReason}
                      </p>
                    )}
                  </div>
                  <a
                    href={bestRecoveryOption.href}
                    className="inline-flex border-2 border-bauhaus-black bg-bauhaus-yellow px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
                  >
                    Open best recovery
                  </a>
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
              <a
                href={buildMissingHref(reviewSliceResetParams, '')}
                className="border-2 border-bauhaus-black px-3 py-2 text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
              >
                Reset slice
              </a>
              {reviewFilter && (
                <a
                  href={buildReviewHref(reviewChipBaseParams, '')}
                  className="border-2 border-money/25 bg-money-light px-3 py-2 text-money transition-colors hover:border-money hover:bg-money hover:text-white"
                >
                  Clear review state
                </a>
              )}
              {missingFilter && (
                <a
                  href={buildMissingHref(missingChipBaseParams, '')}
                  className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 px-3 py-2 text-bauhaus-red transition-colors hover:border-bauhaus-red hover:bg-bauhaus-red hover:text-white"
                >
                  Clear evidence gap
                </a>
              )}
              <a
                href="/foundations"
                className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
              >
                Open full directory
              </a>
            </div>
            {nearbyReviewOptions.length > 0 && (
              <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-bauhaus-muted">Nearest live review states</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                  {nearbyReviewOptions.map((option) => (
                    <a
                      key={option.value}
                      href={option.href}
                      className="border-2 border-bauhaus-yellow bg-warning-light px-3 py-2 text-bauhaus-black transition-colors hover:bg-bauhaus-yellow"
                    >
                      {option.label} ({option.count.toLocaleString()})
                    </a>
                  ))}
                </div>
              </div>
            )}
            {nearbyMissingOptions.length > 0 && (
              <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-bauhaus-muted">Nearest live evidence gaps</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                  {nearbyMissingOptions.map((option) => (
                    <a
                      key={option.value}
                      href={option.href}
                      className="border-2 border-bauhaus-red/25 bg-bauhaus-red/5 px-3 py-2 text-bauhaus-red transition-colors hover:border-bauhaus-red hover:bg-bauhaus-red hover:text-white"
                    >
                      {option.label.replace('Missing ', '')} ({option.count.toLocaleString()})
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {foundationsList.map((f) => {
          const pc = progCountMap.get(f.id);
          const acnc = acncMap.get(f.id);
          const power = powerMap.get(f.id);
          const yearMemory = yearMemoryMap.get(f.id);
          const review = reviewMap.get(f.id);
          const compareTargets = buildCompareTargets(f.id);
          const reviewStatus = review
            ? reviewStatusLabel({
                boardRoles: review.boardRoles,
                verifiedGrants: review.verifiedGrants,
                yearMemory: yearMemory?.total || 0,
                verifiedSourceBacked: yearMemory?.verified || 0,
              })
            : null;
          const signalSummary = review
            ? reviewSignals({
                boardRoles: review.boardRoles,
                verifiedGrants: review.verifiedGrants,
                yearMemory: yearMemory?.total || 0,
                verifiedSourceBacked: yearMemory?.verified || 0,
              })
            : [];
          const missingSignals = review
            ? missingReviewSignals({
                boardRoles: review.boardRoles,
                verifiedGrants: review.verifiedGrants,
                yearMemory: yearMemory?.total || 0,
                verifiedSourceBacked: yearMemory?.verified || 0,
              })
            : [];
          const nextMove = missingSignals.length > 0 ? nextMoveForFoundation(f.id, missingSignals) : null;
          const publicReviewHref = getPublicReviewHref(f.id);
          return (
          <FoundationPreviewTrigger key={f.id} foundation={{
              id: f.id,
              name: f.name,
              type: f.type,
              description: f.description,
              total_giving_annual: f.total_giving_annual,
              thematic_focus: f.thematic_focus || [],
              geographic_focus: f.geographic_focus || [],
              website: f.website,
            }}><div className="group">
            <div className="bg-white border-4 border-bauhaus-black p-4 sm:px-5 transition-all group-hover:-translate-y-1 bauhaus-shadow-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-bauhaus-black text-[15px] group-hover:text-bauhaus-blue">{f.name}</h3>
                  <div className="text-sm text-bauhaus-muted mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{typeLabel(f.type)}</span>
                    {f.enriched_at && (
                      <span className={`text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 ${
                        f.profile_confidence === 'high' ? 'border-money bg-money-light text-money' :
                        f.profile_confidence === 'medium' ? 'border-bauhaus-yellow bg-warning-light text-bauhaus-black' :
                        'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'
                      }`}>
                        {f.profile_confidence}
                      </span>
                    )}
                    {pc && pc.programs > 0 && (
                      <span className={`text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 ${
                        pc.open > 0 ? 'border-money bg-money-light text-money' : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'
                      }`}>
                        {pc.open > 0 ? `${pc.open} open` : `${pc.programs} program${pc.programs !== 1 ? 's' : ''}`}
                      </span>
                    )}
                    {f.website && (
                      <span className="text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 border-bauhaus-blue/20 bg-link-light text-bauhaus-blue">Web</span>
                    )}
                    {yearMemory && yearMemory.total > 0 && (
                      <span className="text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black">
                        {yearMemory.total} year-memory
                      </span>
                    )}
                    {yearMemory && yearMemory.verified > 0 && (
                      <span className="text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 border-money bg-money-light text-money">
                        {yearMemory.verified} source-backed
                      </span>
                    )}
                    {reviewStatus && (
                      <span className={`text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 ${reviewStatus.cls}`}>
                        {reviewStatus.label}
                      </span>
                    )}
                    {power && (
                      <>
                        <span className={`text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 ${
                          power.reportable_in_power_map
                            ? 'border-bauhaus-black bg-bauhaus-black text-white'
                            : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'
                        }`}>
                          {power.reportable_in_power_map ? 'Power map' : 'Operator'}
                        </span>
                        <span className={`text-[11px] px-1.5 py-0.5 font-black uppercase tracking-wider border-2 ${
                          (power.openness_score || 0) >= 0.6
                            ? 'border-money bg-money-light text-money'
                            : (power.gatekeeping_score || 0) >= 0.45
                              ? 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red'
                              : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'
                        }`}>
                          {opennessLabel(power.openness_score)}
                        </span>
                      </>
                    )}
                  </div>
                  {f.description && (
                    <div className="text-sm text-bauhaus-muted mt-1 line-clamp-2">
                      {f.description}
                    </div>
                  )}
                  {signalSummary.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em]">
                      <span className="text-bauhaus-muted">Review signals</span>
                      {signalSummary.map((signal) => (
                        <span
                          key={signal.key}
                          className={`border-2 px-2 py-1 ${
                            signal.active
                              ? 'border-money bg-money-light text-money'
                              : 'border-bauhaus-black/15 bg-bauhaus-canvas text-bauhaus-muted'
                          }`}
                        >
                          {signal.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {missingSignals.length > 0 && (
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-muted">
                      Missing: {missingSignals.join(', ')}
                    </div>
                  )}
                  {nextMove && (
                    <div className="mt-2">
                      <a
                        href={nextMove.href}
                        className="inline-flex border-2 border-bauhaus-red/25 bg-bauhaus-red/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red transition-colors hover:border-bauhaus-red hover:bg-bauhaus-red hover:text-white"
                      >
                        {nextMove.label}
                      </a>
                    </div>
                  )}
                </div>
                <div className="sm:text-right sm:ml-4 flex-shrink-0 flex flex-col items-end gap-1">
                  <FoundationCardActions foundationId={f.id} />
                  <div className="text-base font-black text-money tabular-nums">
                    {formatGiving(f.total_giving_annual)}/yr
                  </div>
                  {acnc && acnc.total_assets > 0 && (
                    <div className="text-[11px] text-bauhaus-muted font-bold tabular-nums mt-0.5">
                      {formatGiving(acnc.total_assets)} assets
                    </div>
                  )}
                  {acnc && acnc.grants_given > 0 && (
                    <div className="text-[11px] text-money/70 font-bold tabular-nums">
                      {formatGiving(acnc.grants_given)} granted (FY{acnc.latest_year})
                    </div>
                  )}
                </div>
              </div>
              {(f.thematic_focus?.length > 0 || f.geographic_focus?.length > 0) && (
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {f.thematic_focus?.map(t => (
                    <span key={t} className="text-[11px] px-2 py-0.5 bg-money-light text-money font-bold border-2 border-money/20">{t}</span>
                  ))}
                  {f.geographic_focus?.map(g => (
                    <span key={g} className="text-[11px] px-2 py-0.5 bg-bauhaus-canvas text-bauhaus-black font-bold border-2 border-bauhaus-black/20">{g}</span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
                {publicReviewHref && (
                  <a
                    href={publicReviewHref}
                    className="border-2 border-bauhaus-black/20 bg-bauhaus-canvas px-2 py-1 text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                  >
                    Open review route
                  </a>
                )}
                {compareTargets.map((target) => (
                  <a
                    key={target.id}
                    href={`/foundations/compare?left=${f.id}&right=${target.id}`}
                    className="border-2 border-bauhaus-blue/25 bg-link-light px-2 py-1 text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                  >
                    {target.label}
                  </a>
                ))}
              </div>
              {power && (
                <div className="mt-3 grid gap-2 sm:grid-cols-3 text-[11px] font-bold">
                  <div className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-2 py-2">
                    <p className="text-bauhaus-muted uppercase tracking-wider text-[10px] font-black">Capital role</p>
                    <p className="mt-1 text-bauhaus-black">{powerClassLabel(power.capital_holder_class)}</p>
                  </div>
                  <div className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-2 py-2">
                    <p className="text-bauhaus-muted uppercase tracking-wider text-[10px] font-black">Capital source</p>
                    <p className="mt-1 text-bauhaus-black">{powerClassLabel(power.capital_source_class)}</p>
                  </div>
                  <div className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-2 py-2">
                    <p className="text-bauhaus-muted uppercase tracking-wider text-[10px] font-black">Access pattern</p>
                    <p className="mt-1 text-bauhaus-black">
                      {power.reportable_in_power_map
                        ? `${opennessLabel(power.openness_score)} · gatekeeping ${Math.round((power.gatekeeping_score || 0) * 100)}%`
                        : 'Excluded from power map'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div></FoundationPreviewTrigger>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-0 mt-8">
          {page > 1 && (
            <a href={`/foundations?${filterQS}&page=${page - 1}`} className="px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white">
              Previous
            </a>
          )}
          <span className="px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-l-0 border-bauhaus-black bg-bauhaus-canvas">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={`/foundations?${filterQS}&page=${page + 1}`} className="px-4 py-2 text-xs font-black uppercase tracking-widest border-4 border-l-0 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white">
              Next
            </a>
          )}
        </div>
      )}
    </div>
    </FoundationActionsProvider>
    </ListPreviewProvider>
  );
}
