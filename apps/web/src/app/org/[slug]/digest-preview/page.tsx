// Digest preview — renders today's would-be email digest from the same
// services the desk reads (docs/specs/grants-digest-spec.md), so the content
// and shape get reviewed before any send infrastructure exists. This page is
// the read channel's mock-up; it never sends anything.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isActSlug } from '@/lib/services/fast-local-org';
import { getOneDeskPool, type DeskRecord } from '@/lib/services/act-one-desk';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Digest preview — CivicGraph' };
}

function Row({ r, slug }: { r: DeskRecord; slug: string }) {
  return (
    <div className="flex items-baseline gap-2 border-t border-ql-border/60 py-2 text-sm first:border-t-0">
      <span className="font-ql-mono text-[9px] uppercase text-ql-muted">{r.project}</span>
      <Link href={`/org/${slug}/desk?rec=${encodeURIComponent(r.id)}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
        {r.name}
      </Link>
      <span className="hidden max-w-[40%] truncate text-[11px] text-ql-text2 sm:block">{r.next}</span>
      {r.dueDays != null && (
        <span className={`font-ql-mono text-[10px] font-semibold ${r.dueDays < 0 ? 'text-ql-alert' : 'text-ql-ink'}`}>
          {r.dueDays < 0 ? `${-r.dueDays}d overdue` : `${r.dueDays}d`}
        </span>
      )}
    </div>
  );
}

export default async function DigestPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isActSlug(slug)) notFound();
  const pool = await getOneDeskPool(slug);

  // Section 1 — new decisions due. The real digest diffs against digest_log
  // ("since last digest"); the preview shows everything currently in the
  // decision window so the shape can be judged.
  const decisions = pool.filter((r) => r.isDecision);
  // Section 2 — going due / overdue: desk rows in the urgent window (≤ 7d or past).
  const goingDue = pool.filter((r) => !r.isDecision && r.dueDays != null && r.dueDays <= 7);

  const subject = `CivicGraph desk digest — ${decisions.length} decision${decisions.length === 1 ? '' : 's'} due, ${goingDue.length} going due`;

  return (
    <main className="min-h-screen bg-ql-surface2 p-6 text-ql-ink">
      <div className="mx-auto max-w-[760px]">
        <div className="font-ql-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ql-accent">
          Preview — nothing is sent from this page
        </div>
        <h1 className="mt-1 font-ql-display text-3xl font-semibold">Desk digest</h1>
        <p className="mt-1 text-sm text-ql-text2">
          Daily 07:00 Brisbane, delta-only (Monday heartbeat sends regardless). Everything here is on the desk; the digest is a pull-back-in, never a second queue.
        </p>

        <div className="mt-5 rounded-lg border border-ql-border bg-ql-surface p-6">
          <div className="border-b border-ql-border pb-3">
            <div className="font-ql-mono text-[9px] uppercase tracking-[0.12em] text-ql-muted">Subject</div>
            <div className="mt-0.5 text-sm font-semibold">{subject}</div>
          </div>

          <section className="mt-4">
            <h2 className="font-ql-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ql-accent">
              New decisions due · {decisions.length}
            </h2>
            <div className="mt-2">
              {decisions.slice(0, 15).map((r) => <Row key={r.id} r={r} slug={slug} />)}
              {decisions.length === 0 && <p className="py-2 text-sm text-ql-text2">Nothing new crossed the thresholds.</p>}
            </div>
          </section>

          <section className="mt-5">
            <h2 className="font-ql-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ql-accent">
              Going due / overdue · {goingDue.length}
            </h2>
            <div className="mt-2">
              {goingDue.slice(0, 15).map((r) => <Row key={r.id} r={r} slug={slug} />)}
              {goingDue.length === 0 && <p className="py-2 text-sm text-ql-text2">Nothing entering the urgent window.</p>}
            </div>
          </section>

          <div className="mt-5 border-t border-ql-border pt-3 text-[11px] text-ql-muted">
            Open the desk for the full queue → <Link href={`/org/${slug}/desk`} className="underline hover:text-ql-ink">/org/{slug}/desk</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
