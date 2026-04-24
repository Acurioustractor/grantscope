import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';
import { fmt } from '@/lib/services/report-service';

export const revalidate = 3600;

type EvidenceEventRow = {
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

function stageLabel(v: string) {
  return v.replaceAll('_', ' ');
}

function mirrorLabel(v: string) {
  return v.replaceAll('_', ' ');
}

function titleFromKey(key: string) {
  return key.replaceAll('-', ' ');
}

function sentenceCase(value: string) {
  const text = titleFromKey(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function strengthTone(v: string) {
  const styles: Record<string, string> = {
    official: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    mirror: 'bg-blue-100 text-blue-700 border-blue-200',
    public_trace: 'bg-amber-100 text-amber-700 border-amber-200',
    mirror_gap: 'bg-red-100 text-red-700 border-red-200',
  };
  return styles[v] || 'bg-gray-100 text-gray-700 border-gray-200';
}

function formatEventDateTime(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}

async function getData(trackerKey: string) {
  const supabase = getServiceSupabase();
  const escapedTrackerKey = trackerKey.replace(/'/g, "''");
  const query = `
    SELECT
      tracker_key,
      stage,
      event_date::text,
      title,
      summary,
      source_name,
      source_url,
      provider_name,
      site_names,
      evidence_strength,
      mirror_status,
      metadata->'source_fetch'->>'doc_title' AS source_doc_title,
      COALESCE(metadata->'source_fetch'->>'doc_excerpt', metadata->'source_fetch'->>'page_excerpt') AS source_excerpt,
      metadata->'source_fetch'->>'html_title' AS source_html_title,
      metadata->'source_fetch'->>'fetch_status' AS source_fetch_status,
      metadata->'source_fetch'->>'fetch_error' AS source_fetch_error,
      metadata->'source_fetch'->>'render_hint' AS source_render_hint,
      metadata->'source_fetch'->>'cf_mitigated' AS source_cf_mitigated,
      metadata->'source_fetch'->>'fetch_via' AS source_fetch_via,
      metadata->>'source_id' AS trace_source_id,
      metadata->>'issued_by' AS trace_issued_by,
      metadata->>'unspsc' AS trace_unspsc,
      metadata->>'released_at' AS trace_released_at,
      metadata->>'closing_at' AS trace_closing_at,
      metadata->>'notice_type' AS trace_notice_type,
      metadata->>'trace_basis' AS trace_basis
    FROM tracker_evidence_events
    WHERE domain = 'youth-justice'
      AND jurisdiction = 'QLD'
      AND tracker_key = '${escapedTrackerKey}'
    ORDER BY event_date ASC, created_at ASC
  `;
  const result = await safe<EvidenceEventRow[] | null>(
    supabase.rpc('exec_sql', { query }) as PromiseLike<{ data: EvidenceEventRow[] | null; error: unknown }>,
    `qld tracker detail ${trackerKey}`,
  );
  return result ?? [];
}

export async function generateMetadata({ params }: { params: Promise<{ trackerKey: string }> }) {
  const { trackerKey } = await params;
  return {
    title: `${sentenceCase(trackerKey)} Tracker — CivicGraph`,
    description: `Structured QLD youth justice evidence chain for ${titleFromKey(trackerKey)}.`,
  };
}

export default async function QldYouthJusticeTrackerDetailPage({
  params,
}: {
  params: Promise<{ trackerKey: string }>;
}) {
  const { trackerKey } = await params;
  const events = await getData(trackerKey);
  if (!events.length) notFound();

  const officialCount = events.filter((row) => row.evidence_strength === 'official').length;
  const mirroredCount = events.filter((row) => row.mirror_status === 'mirrored').length;
  const gapCount = events.filter((row) => ['missing_from_mirror', 'external_only'].includes(row.mirror_status)).length;
  const providerCount = new Set(events.map((row) => row.provider_name).filter(Boolean)).size;
  const siteCount = new Set(events.flatMap((row) => row.site_names || []).filter(Boolean)).size;
  const hasSpecialistPage = trackerKey === 'crime-prevention-schools';

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <Link
          href="/reports/youth-justice/qld/trackers"
          className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
        >
          &larr; All QLD trackers
        </Link>
        <div className="mb-1 mt-4 text-xs font-black uppercase tracking-widest text-bauhaus-red">Generic Tracker Surface</div>
        <h1 className="text-3xl font-black text-bauhaus-black sm:text-4xl">{sentenceCase(trackerKey)}</h1>
        <p className="mt-3 max-w-4xl text-base font-medium leading-relaxed text-bauhaus-muted sm:text-lg">
          This generic page is powered only by <code>tracker_evidence_events</code>. It is the reusable accountability layer for new QLD
          youth justice procurement stories before or alongside a deeper custom investigation page.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {hasSpecialistPage ? (
            <Link
              href="/reports/youth-justice/qld/tracker"
              className="border-2 border-bauhaus-black bg-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-bauhaus-black"
            >
              Open specialist tracker
            </Link>
          ) : null}
          <Link
            href="/reports/youth-justice/qld/crime-prevention-schools"
            className="border-2 border-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-wider text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
          >
            Open QLD investigation
          </Link>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <div className="text-2xl font-black text-emerald-700 sm:text-3xl">{fmt(events.length)}</div>
          <div className="mt-1 text-xs text-gray-500">Evidence events</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center">
          <div className="text-2xl font-black text-blue-700 sm:text-3xl">{fmt(officialCount)}</div>
          <div className="mt-1 text-xs text-gray-500">Official rows</div>
        </div>
        <div className="rounded-xl border border-bauhaus-black bg-bauhaus-black p-5 text-center text-white">
          <div className="text-2xl font-black text-bauhaus-red sm:text-3xl">{fmt(mirroredCount)}</div>
          <div className="mt-1 text-xs text-white/70">Mirrored rows</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <div className="text-2xl font-black text-amber-700 sm:text-3xl">{fmt(gapCount)}</div>
          <div className="mt-1 text-xs text-gray-500">Gap rows</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <div className="text-2xl font-black text-red-700 sm:text-3xl">{fmt(providerCount + siteCount)}</div>
          <div className="mt-1 text-xs text-gray-500">Providers + sites touched</div>
        </div>
      </div>

      <section className="mb-12 rounded-sm border-4 border-bauhaus-black bg-white p-6">
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-red">What this layer does</div>
        <p className="max-w-4xl text-sm leading-relaxed text-bauhaus-muted">
          Every row below is sync-managed. If a new tracker manifest lands in <code>data/tracker-evidence</code> and the sync runs, this
          page can render the evidence chain without another custom page build.
        </p>
      </section>

      <section className="space-y-4">
        {events.map((item) => (
          <div key={`${item.event_date}-${item.stage}-${item.title}`} className="rounded-sm border-2 border-bauhaus-black/10 bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="text-xs font-black uppercase tracking-widest text-bauhaus-blue">{item.event_date}</span>
              <span className="rounded-sm bg-gray-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-muted">
                {stageLabel(item.stage)}
              </span>
              <span className={`rounded-sm border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${strengthTone(item.evidence_strength)}`}>
                {item.evidence_strength.replaceAll('_', ' ')}
              </span>
              <span className="rounded-sm bg-gray-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-muted">
                {mirrorLabel(item.mirror_status)}
              </span>
            </div>
            <h2 className="text-lg font-black text-bauhaus-black">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">{item.summary}</p>

            <div className="mt-4 grid gap-3 xl:grid-cols-[1.1fr,0.9fr]">
              <div className="rounded-sm border border-bauhaus-black/10 bg-bauhaus-muted/5 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Source extraction</div>
                {item.source_doc_title || item.source_html_title ? (
                  <div className="mt-2 text-xs font-black uppercase tracking-wider text-bauhaus-black">
                    {item.source_doc_title || item.source_html_title}
                  </div>
                ) : null}
                {item.source_cf_mitigated ? (
                  <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
                    Direct source fetch is blocked by a challenge page. This tracker is relying on the mirrored row and the rest of the
                    evidence chain rather than the raw source body.
                  </p>
                ) : item.source_render_hint === 'client_rendered_page_shell' ? (
                  <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
                    This source resolves to a client-rendered shell, so the tracker is carrying the structured trace metadata rather than a
                    full server-rendered document extract.
                  </p>
                ) : item.source_excerpt ? (
                  <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">{item.source_excerpt}</p>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
                    No extractable passage captured for this source yet.
                  </p>
                )}
              </div>

              <div className="rounded-sm border border-bauhaus-black/10 bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Source diagnostics</div>
                <div className="mt-2 space-y-2 text-sm leading-relaxed text-bauhaus-muted">
                  {item.trace_source_id ? (
                    <div><span className="font-black text-bauhaus-black">Trace ID:</span> {item.trace_source_id}</div>
                  ) : null}
                  {item.trace_notice_type ? (
                    <div><span className="font-black text-bauhaus-black">Notice type:</span> {item.trace_notice_type}</div>
                  ) : null}
                  {item.trace_issued_by ? (
                    <div><span className="font-black text-bauhaus-black">Issued by:</span> {item.trace_issued_by}</div>
                  ) : null}
                  {item.trace_unspsc ? (
                    <div><span className="font-black text-bauhaus-black">UNSPSC:</span> {item.trace_unspsc}</div>
                  ) : null}
                  {item.trace_released_at ? (
                    <div><span className="font-black text-bauhaus-black">Released:</span> {formatEventDateTime(item.trace_released_at)}</div>
                  ) : null}
                  {item.trace_closing_at ? (
                    <div><span className="font-black text-bauhaus-black">Closing:</span> {formatEventDateTime(item.trace_closing_at)}</div>
                  ) : null}
                  {item.source_render_hint ? (
                    <div><span className="font-black text-bauhaus-black">Render:</span> {item.source_render_hint.replaceAll('_', ' ')}</div>
                  ) : null}
                  {item.source_cf_mitigated ? (
                    <div><span className="font-black text-bauhaus-black">Access gate:</span> {item.source_cf_mitigated}</div>
                  ) : null}
                  {item.source_fetch_error ? (
                    <div><span className="font-black text-bauhaus-black">Fetch note:</span> {item.source_fetch_error}</div>
                  ) : null}
                  {item.source_fetch_status ? (
                    <div>
                      <span className="font-black text-bauhaus-black">Fetch status:</span> {item.source_fetch_status}
                      {item.source_fetch_via ? ` via ${item.source_fetch_via}` : ''}
                    </div>
                  ) : null}
                  {item.trace_basis ? (
                    <div className="border-t border-bauhaus-black/10 pt-2 text-xs font-medium uppercase tracking-wide text-bauhaus-muted">
                      {item.trace_basis}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">
              {item.source_name ? <span>{item.source_name}</span> : null}
              {item.provider_name ? <span>• Provider: {item.provider_name}</span> : null}
              {item.site_names && item.site_names.length > 0 ? <span>• Sites: {item.site_names.join(', ')}</span> : null}
            </div>
            {item.source_url ? (
              <a
                href={item.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
              >
                Open source &rarr;
              </a>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}
