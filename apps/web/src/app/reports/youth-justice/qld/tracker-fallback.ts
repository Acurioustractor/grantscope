import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type TrackerSummaryRow = {
  tracker_key: string;
  event_count: number;
  official_count: number;
  mirrored_count: number;
  gap_count: number;
  latest_event_date: string | null;
  first_title: string | null;
  first_summary: string | null;
};

export type EvidenceEventRow = {
  tracker_key: string;
  stage: string;
  event_date: string;
  title: string;
  summary: string | null;
  source_name: string | null;
  source_url: string | null;
  provider_name: string | null;
  site_names: string[] | null;
  evidence_strength: string;
  mirror_status: string;
  source_doc_title: string | null;
  source_excerpt: string | null;
  source_html_title: string | null;
  source_fetch_status: string | null;
  source_fetch_error: string | null;
  source_render_hint: string | null;
  source_cf_mitigated: string | null;
  source_fetch_via: string | null;
  trace_source_id: string | null;
  trace_issued_by: string | null;
  trace_unspsc: string | null;
  trace_released_at: string | null;
  trace_closing_at: string | null;
  trace_notice_type: string | null;
  trace_basis: string | null;
};

type LocalTrackerEvent = {
  stage: string;
  event_date: string;
  title: string;
  summary?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  provider_name?: string | null;
  site_names?: string[] | null;
  evidence_strength?: string | null;
  mirror_status?: string | null;
  metadata?: Record<string, unknown> | null;
};

type LocalTrackerManifest = {
  domain: string;
  jurisdiction: string;
  tracker_key: string;
  events?: LocalTrackerEvent[];
};

function findEvidenceDir() {
  return [
    path.join(process.cwd(), 'data/tracker-evidence'),
    path.join(process.cwd(), '../data/tracker-evidence'),
    path.join(process.cwd(), '../../data/tracker-evidence'),
  ].find(existsSync);
}

function asString(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return null;
  const values = value.map((item) => String(item || '').trim()).filter(Boolean);
  return values.length ? values : null;
}

function sourceFetch(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.source_fetch;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readLocalManifests() {
  const evidenceDir = findEvidenceDir();
  if (!evidenceDir) return [];

  return readdirSync(evidenceDir)
    .filter((fileName) => fileName.startsWith('qld-') && fileName.endsWith('.json'))
    .flatMap((fileName) => {
      try {
        const parsed = JSON.parse(readFileSync(path.join(evidenceDir, fileName), 'utf8')) as LocalTrackerManifest;
        if (parsed.domain !== 'youth-justice' || parsed.jurisdiction !== 'QLD' || !parsed.tracker_key) return [];
        return [parsed];
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.tracker_key.localeCompare(b.tracker_key));
}

function toEventRow(manifest: LocalTrackerManifest, event: LocalTrackerEvent): EvidenceEventRow {
  const metadata = event.metadata || {};
  const fetch = sourceFetch(metadata);
  return {
    tracker_key: manifest.tracker_key,
    stage: event.stage,
    event_date: event.event_date,
    title: event.title,
    summary: event.summary ?? null,
    source_name: event.source_name ?? null,
    source_url: event.source_url ?? null,
    provider_name: event.provider_name ?? null,
    site_names: asStringArray(event.site_names),
    evidence_strength: event.evidence_strength || 'official',
    mirror_status: event.mirror_status || 'external_only',
    source_doc_title: asString(fetch.doc_title),
    source_excerpt: asString(fetch.doc_excerpt) ?? asString(fetch.page_excerpt) ?? asString(metadata.source_excerpt),
    source_html_title: asString(fetch.html_title),
    source_fetch_status: asString(fetch.fetch_status),
    source_fetch_error: asString(fetch.fetch_error),
    source_render_hint: asString(fetch.render_hint),
    source_cf_mitigated: asString(fetch.cf_mitigated),
    source_fetch_via: asString(fetch.fetch_via),
    trace_source_id: asString(metadata.source_id),
    trace_issued_by: asString(metadata.issued_by),
    trace_unspsc: asString(metadata.unspsc),
    trace_released_at: asString(metadata.released_at),
    trace_closing_at: asString(metadata.closing_at),
    trace_notice_type: asString(metadata.notice_type),
    trace_basis: asString(metadata.trace_basis),
  };
}

export function loadQldLocalTrackerEvents(trackerKey?: string) {
  return readLocalManifests()
    .filter((manifest) => !trackerKey || manifest.tracker_key === trackerKey)
    .flatMap((manifest) => (manifest.events || []).map((event) => toEventRow(manifest, event)))
    .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.title.localeCompare(b.title));
}

export function loadQldLocalTrackerSummaries(): TrackerSummaryRow[] {
  return readLocalManifests().map((manifest) => {
    const events = (manifest.events || [])
      .map((event) => toEventRow(manifest, event))
      .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.title.localeCompare(b.title));
    const first = events[0] || null;
    const latest = events.reduce<string | null>((current, event) => {
      if (!current) return event.event_date;
      return event.event_date > current ? event.event_date : current;
    }, null);
    return {
      tracker_key: manifest.tracker_key,
      event_count: events.length,
      official_count: events.filter((event) => event.evidence_strength === 'official').length,
      mirrored_count: events.filter((event) => event.mirror_status === 'mirrored').length,
      gap_count: events.filter((event) => ['missing_from_mirror', 'external_only'].includes(event.mirror_status)).length,
      latest_event_date: latest,
      first_title: first?.title ?? null,
      first_summary: first?.summary ?? null,
    };
  });
}
