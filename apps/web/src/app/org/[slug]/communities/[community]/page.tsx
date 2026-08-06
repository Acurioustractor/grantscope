// One Community record — a read surface composed of existing state (spec
// docs/specs/community-records-spec.md): who we know there, what we owe,
// what's live, last touch. Communities never mint desk rows.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isActSlug } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getCommunityRecord } from '@/lib/services/act-communities';

export const dynamic = 'force-dynamic';

const LINK_LABEL: Record<string, string> = {
  'in': 'based here',
  'distributes-into': 'channel into here',
  'anchored-in': 'anchored here',
};

function Due({ d }: { d: number | null }) {
  if (d == null) return <span className="font-ql-mono text-[10px] text-ql-muted">no date</span>;
  if (d < 0) return <span className="font-ql-mono text-[10px] font-semibold text-ql-alert">{-d}d overdue</span>;
  return <span className="font-ql-mono text-[10px] font-medium text-ql-ink">{d}d</span>;
}

export default async function CommunityRecordPage({ params }: { params: Promise<{ slug: string; community: string }> }) {
  const { slug, community } = await params;
  if (!isActSlug(slug)) notFound();
  const profile = await getOrgProfileBySlug(slug).catch(() => null);
  const record = profile ? await getCommunityRecord(profile.id, community) : null;
  if (!record) notFound();

  const people = record.links.filter((l) => l.subjectType === 'person');
  const orgs = record.links.filter((l) => l.subjectType === 'org');
  const paneTitle = 'font-ql-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ql-accent';

  return (
    <main className="min-h-screen bg-ql-surface2 p-6 text-ql-ink">
      <div className="mx-auto max-w-[1100px]">
        <Link href={`/org/${slug}/communities`} className="font-ql-mono text-[10px] uppercase tracking-[0.12em] text-ql-muted hover:text-ql-ink">
          ← Communities
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h1 className="font-ql-display text-4xl font-semibold">{record.name}</h1>
          {record.lastTouch && (
            <span className="font-ql-mono text-[10px] text-ql-muted">
              last touch {new Date(record.lastTouch).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
        {record.notes && <p className="mt-1.5 max-w-[70ch] text-sm text-ql-text2">{record.notes}</p>}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {/* Pane 1 — who we know there */}
          <section className="rounded-lg border border-ql-border bg-ql-surface p-5">
            <h2 className={paneTitle}>Who we know there</h2>
            <div className="mt-3 space-y-2">
              {orgs.map((l) => (
                <div key={l.id} className="flex items-baseline gap-2 text-sm">
                  <span className="font-semibold">{l.subjectRef}</span>
                  <span className="text-[11px] text-ql-text2">{LINK_LABEL[l.linkType]}</span>
                  {l.warmth && <span className="ml-auto font-ql-mono text-[10px] text-ql-moss">{l.warmth}</span>}
                </div>
              ))}
              {people.map((l) => (
                <div key={l.id} className="flex items-baseline gap-2 text-sm">
                  <span className="font-semibold">{l.subjectRef}</span>
                  <span className="text-[11px] italic text-ql-text2">{LINK_LABEL[l.linkType]}</span>
                </div>
              ))}
              {record.links.length === 0 && <p className="text-sm text-ql-text2">No connections recorded yet.</p>}
            </div>
          </section>

          {/* Pane 2 — what we owe */}
          <section className="rounded-lg border border-ql-border bg-ql-surface p-5">
            <h2 className={paneTitle}>What we owe</h2>
            <div className="mt-3 space-y-2">
              {record.obligations.map((o) => (
                <div key={o.id} className="flex items-baseline gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">{o.title}</span>
                  <span className="font-ql-mono text-[10px] text-ql-muted">→ {o.owedTo}</span>
                  <Due d={o.dueDays} />
                </div>
              ))}
              {record.obligations.length === 0 && <p className="text-sm text-ql-text2">Nothing owed here right now.</p>}
            </div>
          </section>

          {/* Pane 3 — what's live */}
          <section className="rounded-lg border border-ql-border bg-ql-surface p-5">
            <h2 className={paneTitle}>What&apos;s live</h2>
            <div className="mt-3 space-y-2">
              {record.channels.map((l) => (
                <div key={l.id} className="flex items-baseline gap-2 text-sm">
                  <span className="font-semibold">{l.subjectRef}</span>
                  <span className="text-[11px] text-ql-text2">live channel</span>
                  {l.warmth && <span className="ml-auto font-ql-mono text-[10px] text-ql-moss">{l.warmth}</span>}
                </div>
              ))}
              {record.channels.length === 0 && <p className="text-sm text-ql-text2">No live Channels into this place yet.</p>}
            </div>
          </section>

          {/* Pane 4 — the record itself */}
          <section className="rounded-lg border border-ql-border bg-ql-surface p-5">
            <h2 className={paneTitle}>Record</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="text-ql-text2">Minted</dt>
                <dd className="font-ql-mono text-[11px]">
                  {new Date(record.mintedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {record.mintedBy ? ` · ${record.mintedBy}` : ''}
                </dd>
              </div>
              {Array.isArray(record.geo.postcodes) && record.geo.postcodes.length > 0 && (
                <div className="flex gap-2">
                  <dt className="text-ql-text2">Postcodes</dt>
                  <dd className="font-ql-mono text-[11px]">{(record.geo.postcodes as string[]).join(', ')}</dd>
                </div>
              )}
              {Array.isArray(record.geo.lga_codes) && record.geo.lga_codes.length > 0 && (
                <div className="flex gap-2">
                  <dt className="text-ql-text2">LGAs</dt>
                  <dd className="font-ql-mono text-[11px]">{(record.geo.lga_codes as string[]).join(', ')}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 text-[11px] leading-5 text-ql-muted">
              Geo codes are annotations, never identity. This record exists because someone decided ACT is engaged here.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
