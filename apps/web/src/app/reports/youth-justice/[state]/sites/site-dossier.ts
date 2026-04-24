import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';
import { slugifySegment, sentenceCaseTracker } from '../../tracker-meta';

export type SiteEvidenceRow = {
  tracker_key: string;
  stage: string;
  event_date: string;
  title: string;
  summary: string | null;
  source_name: string | null;
  source_url: string | null;
  provider_name: string | null;
  evidence_strength: string;
  mirror_status: string;
  site_name: string;
  source_excerpt: string | null;
};

export type ProviderSummary = {
  name: string;
  eventCount: number;
  mirroredCount: number;
  gapCount: number;
  trackerCount: number;
  latestEventDate: string | null;
};

export type TrackerSummary = {
  trackerKey: string;
  eventCount: number;
  officialCount: number;
  mirroredCount: number;
  gapCount: number;
  latestEventDate: string | null;
  firstTitle: string | null;
  firstSummary: string | null;
  providerNames: string[];
};

export type SiteDossier = {
  stateKey: string;
  stateAbbr: string;
  stateName: string;
  siteSlug: string;
  siteName: string;
  availableSites: string[];
  siteRows: SiteEvidenceRow[];
  trackerSummaries: TrackerSummary[];
  providerSummaries: ProviderSummary[];
  communityLinkedProviders: ProviderSummary[];
  mirroredProviders: ProviderSummary[];
  gapRows: SiteEvidenceRow[];
  mirroredRows: SiteEvidenceRow[];
  officialCount: number;
  latestEventDate: string | null;
  accountabilityQuestions: string[];
  nextDataAsks: string[];
  markdownBrief: string;
};

function normaliseText(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function stageLabel(value: string) {
  return value.replaceAll('_', ' ');
}

export function formatSiteDate(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-AU', { dateStyle: 'medium' });
}

function isCommunityLinked(label: string | null | undefined, context: string) {
  return /(aboriginal|torres|community|cultural|murri|jinibara|first nations|elders|local)/i.test(`${label || ''} ${context}`);
}

async function getStateSiteRows(stateAbbr: string) {
  const supabase = getServiceSupabase();
  const escapedJurisdiction = stateAbbr.replace(/'/g, "''");
  const query = `
    WITH scoped AS (
      SELECT
        tracker_key,
        stage,
        event_date::text AS event_date,
        title,
        summary,
        source_name,
        source_url,
        provider_name,
        evidence_strength,
        mirror_status,
        COALESCE(metadata->'source_fetch'->>'doc_excerpt', metadata->'source_fetch'->>'page_excerpt') AS source_excerpt,
        site_names
      FROM tracker_evidence_events
      WHERE domain = 'youth-justice'
        AND jurisdiction = '${escapedJurisdiction}'
    )
    SELECT
      tracker_key,
      stage,
      event_date,
      title,
      summary,
      source_name,
      source_url,
      provider_name,
      evidence_strength,
      mirror_status,
      TRIM(site_name) AS site_name,
      source_excerpt
    FROM scoped,
    LATERAL unnest(COALESCE(site_names, ARRAY[]::text[])) AS site_name
    WHERE TRIM(site_name) <> ''
    ORDER BY event_date ASC, title
  `;
  const result = await safe<SiteEvidenceRow[] | null>(
    supabase.rpc('exec_sql', { query }) as PromiseLike<{ data: SiteEvidenceRow[] | null; error: unknown }>,
    `${stateAbbr} site dossier`,
  );
  return result ?? [];
}

export async function getSiteDossierBySlug({
  stateKey,
  stateAbbr,
  stateName,
  siteSlug,
}: {
  stateKey: string;
  stateAbbr: string;
  stateName: string;
  siteSlug: string;
}): Promise<SiteDossier | null> {
  const rows = await getStateSiteRows(stateAbbr);
  const genericSiteTokens = new Set(
    [stateAbbr, stateName, `${stateName} youth justice`, 'queensland', 'new south wales', 'northern territory', 'statewide'].map((value) =>
      normaliseText(value),
    ),
  );
  const availableSites = Array.from(
    new Set(
      rows
        .map((row) => row.site_name)
        .filter((value) => value.length > 0)
        .filter((value) => !genericSiteTokens.has(normaliseText(value))),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const siteName = availableSites.find((value) => slugifySegment(value) === siteSlug);
  if (!siteName) return null;

  const siteRows = rows.filter((row) => slugifySegment(row.site_name) === siteSlug);
  const trackerSummaries = Array.from(
    siteRows.reduce((acc, row) => {
      const current = acc.get(row.tracker_key) || {
        trackerKey: row.tracker_key,
        eventCount: 0,
        officialCount: 0,
        mirroredCount: 0,
        gapCount: 0,
        latestEventDate: null,
        firstTitle: null,
        firstSummary: null,
        providerNames: [],
      };
      current.eventCount += 1;
      current.officialCount += row.evidence_strength === 'official' ? 1 : 0;
      current.mirroredCount += row.mirror_status === 'mirrored' ? 1 : 0;
      current.gapCount += ['missing_from_mirror', 'external_only'].includes(row.mirror_status) ? 1 : 0;
      current.latestEventDate =
        !current.latestEventDate || row.event_date > current.latestEventDate ? row.event_date : current.latestEventDate;
      if (!current.firstTitle) {
        current.firstTitle = row.title;
        current.firstSummary = row.summary;
      }
      if (row.provider_name && !current.providerNames.includes(row.provider_name)) current.providerNames.push(row.provider_name);
      acc.set(row.tracker_key, current);
      return acc;
    }, new Map<string, TrackerSummary>()),
  )
    .map(([, value]) => value)
    .sort((a, b) => b.mirroredCount - a.mirroredCount || b.eventCount - a.eventCount || a.trackerKey.localeCompare(b.trackerKey));

  const providerSummaries = Array.from(
    siteRows.reduce((acc, row) => {
      if (!row.provider_name) return acc;
      const current = acc.get(row.provider_name) || {
        name: row.provider_name,
        eventCount: 0,
        mirroredCount: 0,
        gapCount: 0,
        trackerCount: 0,
        latestEventDate: null,
        trackerKeys: new Set<string>(),
      };
      current.eventCount += 1;
      current.mirroredCount += row.mirror_status === 'mirrored' ? 1 : 0;
      current.gapCount += ['missing_from_mirror', 'external_only'].includes(row.mirror_status) ? 1 : 0;
      current.trackerKeys.add(row.tracker_key);
      current.trackerCount = current.trackerKeys.size;
      current.latestEventDate =
        !current.latestEventDate || row.event_date > current.latestEventDate ? row.event_date : current.latestEventDate;
      acc.set(row.provider_name, current);
      return acc;
    }, new Map<string, ProviderSummary & { trackerKeys: Set<string> }>()),
  )
    .map(([, value]) => ({
      name: value.name,
      eventCount: value.eventCount,
      mirroredCount: value.mirroredCount,
      gapCount: value.gapCount,
      trackerCount: value.trackerCount,
      latestEventDate: value.latestEventDate,
    }))
    .sort((a, b) => b.mirroredCount - a.mirroredCount || b.eventCount - a.eventCount || a.name.localeCompare(b.name));

  const communityLinkedProviders = providerSummaries.filter((provider) =>
    siteRows.some(
      (row) =>
        row.provider_name === provider.name && isCommunityLinked(provider.name, `${row.title} ${row.summary || ''} ${row.source_excerpt || ''}`),
    ),
  );
  const mirroredProviders = providerSummaries.filter((provider) => provider.mirroredCount > 0);
  const gapRows = siteRows.filter((row) => ['missing_from_mirror', 'external_only'].includes(row.mirror_status));
  const mirroredRows = siteRows.filter((row) => row.mirror_status === 'mirrored');
  const officialCount = siteRows.filter((row) => row.evidence_strength === 'official').length;
  const latestEventDate = siteRows.reduce<string | null>((latest, row) => {
    if (!latest) return row.event_date;
    return row.event_date > latest ? row.event_date : latest;
  }, null);

  const accountabilityQuestions = Array.from(
    new Set(
      [
        gapRows.length > 0
          ? `Which parts of the ${siteName} process are still visible only through external/public traces rather than mirrored procurement or funding records?`
          : null,
        mirroredProviders.length > 0
          ? `How do the mirrored provider footprints at ${siteName} line up with the public commitments, site rollout statements, and delivery model?`
          : null,
        communityLinkedProviders.length > 0
          ? `Are community-linked organisations at ${siteName} being positioned as delivery partners, or only appearing around the edges of the record?`
          : `Which community-controlled or local organisations around ${siteName} are still missing from this evidence chain?`,
        trackerSummaries.length > 1
          ? `Where do the different tracker families converge on ${siteName}, and where do they tell conflicting or incomplete stories?`
          : `What adjacent trackers should be added so ${siteName} is not only understood through a single issue chain?`,
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  const nextDataAsks = Array.from(
    new Set(
      gapRows.slice(0, 6).map((row) => {
        const provider = row.provider_name ? ` for ${row.provider_name}` : '';
        return `Mirror the ${stageLabel(row.stage)} step${provider} referenced in "${row.title}" so ${siteName} has an auditable local chain.`;
      }),
    ),
  );

  const markdownBrief = [
    `# ${siteName} (${stateAbbr}) — Youth Justice Site Dossier`,
    '',
    `## Snapshot`,
    `- Tracker families touching site: ${trackerSummaries.length}`,
    `- Evidence events: ${siteRows.length}`,
    `- Official rows: ${officialCount}`,
    `- Mirrored rows: ${mirroredRows.length}`,
    `- Gap rows: ${gapRows.length}`,
    `- Latest event: ${formatSiteDate(latestEventDate)}`,
    '',
    `## Tracker families`,
    ...trackerSummaries.map(
      (tracker) =>
        `- ${sentenceCaseTracker(tracker.trackerKey)}: ${tracker.eventCount} events, ${tracker.mirroredCount} mirrored, ${tracker.gapCount} gaps, latest ${formatSiteDate(tracker.latestEventDate)}`,
    ),
    '',
    `## Named providers`,
    ...(providerSummaries.length > 0
      ? providerSummaries.slice(0, 8).map(
          (provider) =>
            `- ${provider.name}: ${provider.eventCount} event references, ${provider.mirroredCount} mirrored, ${provider.gapCount} gaps, ${provider.trackerCount} tracker families`,
        )
      : ['- No named providers are visible yet in the site-filtered chain.']),
    '',
    `## Community-linked alternatives`,
    ...(communityLinkedProviders.length > 0
      ? communityLinkedProviders
          .slice(0, 6)
          .map((provider) => `- ${provider.name}: ${provider.eventCount} event references, latest ${formatSiteDate(provider.latestEventDate)}`)
      : ['- No community-linked provider is explicitly named yet.']),
    '',
    `## Current accountability questions`,
    ...accountabilityQuestions.map((question) => `- ${question}`),
    '',
    `## Next data asks`,
    ...(nextDataAsks.length > 0 ? nextDataAsks.map((ask) => `- ${ask}`) : ['- No immediate data asks generated.']),
  ].join('\n');

  return {
    stateKey,
    stateAbbr,
    stateName,
    siteSlug,
    siteName,
    availableSites,
    siteRows,
    trackerSummaries,
    providerSummaries,
    communityLinkedProviders,
    mirroredProviders,
    gapRows,
    mirroredRows,
    officialCount,
    latestEventDate,
    accountabilityQuestions,
    nextDataAsks,
    markdownBrief,
  };
}
