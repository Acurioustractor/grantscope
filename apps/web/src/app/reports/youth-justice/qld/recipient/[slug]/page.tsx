// Per-recipient drill-down for the QLD Youth Justice sector report.
// Extracted from §9.5 of /reports/youth-justice/qld/sector. One page per top-8 recipient.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  recipientForSlug,
  getRecipientChain,
} from '@/lib/services/qld-yj-recipient';

export const revalidate = 3600; // 1h ISR

function money(n: number | null | undefined): string {
  if (n == null) return '—';
  const v = Math.abs(Number(n));
  if (v >= 1_000_000_000) return `$${(Number(n) / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(Number(n) / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(Number(n) / 1_000)}K`;
  return `$${Math.round(Number(n))}`;
}

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rec = recipientForSlug(slug);
  if (!rec) return { title: 'Recipient not found' };
  return {
    title: `${rec.recipient_name} · QLD Youth Justice funding · CivicGraph`,
    description: `Programs funded, ALMA evidence links, and cross-system topic spread for ${rec.recipient_name} under the QLD Youth Justice stream.`,
  };
}

export default async function RecipientDrillDown({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rec = recipientForSlug(slug);
  if (!rec) notFound();

  const chain = await getRecipientChain(rec.recipient_name);

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Breadcrumb */}
        <nav className="mb-6 text-[10px] sm:text-xs font-mono uppercase tracking-widest text-bauhaus-muted">
          <Link href="/reports/youth-justice/qld/sector" className="text-bauhaus-blue hover:underline">← QLD Youth Justice sector report</Link>
          <span className="mx-2">/</span>
          <span>§9 · Top recipients</span>
          <span className="mx-2">/</span>
          <span className="text-bauhaus-black font-black">{rec.recipient_name}</span>
        </nav>

        <div className="border-l-8 border-bauhaus-red pl-5 mb-8">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">RECIPIENT DRILL-DOWN</div>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">{rec.recipient_name}</h1>
          <p className="text-bauhaus-muted font-medium max-w-3xl mt-2">
            Top programs by $, ALMA evidence links, and cross-system topic spread under QLD Youth Justice.
            Source: <code className="font-mono text-xs">justice_funding</code> joined to <code className="font-mono text-xs">alma_interventions</code> via the <code className="font-mono text-xs">alma_intervention_id</code> FK.
          </p>
        </div>

        {!chain ? (
          <div className="border-4 border-bauhaus-black p-6 bg-white">
            <p className="text-sm text-bauhaus-black font-medium">
              No QLD youth-justice grants located for <span className="font-black">{rec.recipient_name}</span>. The data may have shifted under a renamed
              recipient string. Return to the <Link href="/reports/youth-justice/qld/sector#top-recipients" className="text-bauhaus-blue font-black underline">main recipient table</Link>.
            </p>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <section className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border-4 border-bauhaus-red p-4 bg-white">
                <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">Total funding</div>
                <div className="text-2xl font-black tabular-nums text-bauhaus-red">{money(chain.total)}</div>
              </div>
              <div className="border-4 border-bauhaus-black p-4 bg-white">
                <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">Grants</div>
                <div className="text-2xl font-black tabular-nums">{chain.grants}</div>
              </div>
              <div className="border-4 border-bauhaus-black p-4 bg-white">
                <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">FY range</div>
                <div className="text-base font-black font-mono">{chain.first_year ?? '?'}{chain.first_year !== chain.last_year ? `–${chain.last_year ?? '?'}` : ''}</div>
              </div>
              <div className="border-4 border-bauhaus-blue p-4 bg-white">
                <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">ALMA links</div>
                <div className="text-2xl font-black tabular-nums text-bauhaus-blue">{chain.interventions.length}</div>
              </div>
            </section>

            {/* Programs */}
            <section className="mb-10">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">PROGRAMS</div>
              <h2 className="text-xl font-black uppercase tracking-tight mb-3">Top programs by $, what was actually funded</h2>
              {chain.programs.length > 0 ? (
                <ul className="space-y-2">
                  {chain.programs.map((p, j) => (
                    <li key={j} className="border-l-4 border-bauhaus-red pl-3 bg-white p-3 border-y-2 border-r-2 border-bauhaus-black">
                      <div className="flex flex-wrap items-baseline gap-2 mb-1">
                        <span className="font-black text-bauhaus-black text-sm">{p.program_name ?? '(unnamed line item)'}</span>
                        <span className="font-mono text-xs font-black text-bauhaus-red">{money(p.amount)}</span>
                        <span className="font-mono text-xs text-bauhaus-muted">FY {p.financial_year ?? '—'}</span>
                      </div>
                      {p.description && <p className="text-xs text-bauhaus-black/80 leading-snug">{p.description}{p.description.length >= 240 ? '…' : ''}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-bauhaus-muted font-mono border-2 border-bauhaus-black p-3 bg-white">No itemised programs; total is from aggregate line items only.</p>
              )}
            </section>

            {/* ALMA evidence */}
            <section className="mb-10">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">ALMA EVIDENCE</div>
              <h2 className="text-xl font-black uppercase tracking-tight mb-3">Does what was funded match an evaluated intervention?</h2>
              {chain.interventions.length > 0 ? (
                <ul className="grid sm:grid-cols-2 gap-2">
                  {chain.interventions.map((iv, j) => (
                    <li key={j} className="border-l-4 border-bauhaus-blue pl-3 bg-white p-3 border-y-2 border-r-2 border-bauhaus-black">
                      <div className="font-black text-bauhaus-black text-sm leading-tight mb-1">{iv.name}</div>
                      <div className="text-[10px] font-mono text-bauhaus-muted">
                        {iv.type ? `${iv.type} · ` : ''}{iv.evidence_level ?? 'unrated'}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-bauhaus-muted font-mono border-2 border-bauhaus-black p-3 bg-white">
                  No ALMA intervention is linked to this recipient&apos;s grants. Funding may be operational, infrastructure, or not yet matched to an evaluated program.
                </p>
              )}
            </section>

            {/* Cross-system topics */}
            <section className="mb-10">
              <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">CROSS-SYSTEM REACH</div>
              <h2 className="text-xl font-black uppercase tracking-tight mb-3">All topic tags across this recipient&apos;s grants</h2>
              {chain.all_topics.length > 0 ? (
                <div className="border-2 border-bauhaus-black p-4 bg-white">
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {chain.all_topics.map((t, j) => (
                      <span key={j} className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border-2 border-bauhaus-black ${t === 'youth-justice' ? 'bg-bauhaus-red text-white' : 'bg-white text-bauhaus-black'}`}>{t}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-bauhaus-muted font-mono">
                    {chain.all_topics.length > 1
                      ? <>This recipient is funded across <span className="font-black">{chain.all_topics.length}</span> tagged sectors. Multi-system reach, siloed funding, integrated service.</>
                      : <>Single-sector recipient, funded only under youth-justice tags in this dataset.</>}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-bauhaus-muted font-mono border-2 border-bauhaus-black p-3 bg-white">No topic tags.</p>
              )}
            </section>
          </>
        )}

        <div className="mt-12 border-t-4 border-bauhaus-black pt-5 flex flex-wrap gap-3 text-[10px] sm:text-xs font-black uppercase tracking-widest">
          <Link href="/reports/youth-justice/qld/sector#top-recipients" className="inline-block px-4 py-2 border-2 border-bauhaus-black bg-white hover:bg-bauhaus-yellow">← Back to recipient table</Link>
          <Link href="/reports/youth-justice/qld/sector" className="inline-block px-4 py-2 border-2 border-bauhaus-black bg-white hover:bg-bauhaus-yellow">↑ Sector report (top)</Link>
        </div>

        <p className="text-[10px] font-mono text-bauhaus-muted mt-6">
          Source: <code>justice_funding</code> grouped per recipient · top 15 named programs by amount · <code>alma_interventions</code> joined via <code>alma_intervention_id</code> FK · all topic tags across the recipient&apos;s justice grants. Evidence levels are self-attributed by ALMA submitters.
        </p>
      </div>
    </main>
  );
}
