/**
 * Reusable building blocks for "long-read" narrative report pages.
 *
 * The long-read is a sister page to a dashboard report — same data, but
 * structured as readable journalism with embedded callouts, source links,
 * and cross-references. Pattern is intended for /reports/<slug>/long-read.
 *
 * All components follow the Bauhaus design system (border-4 black, font-black
 * uppercase headings, no border-radius, primary palette: red / blue / yellow).
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

/* ------------------------------------------------------------------------- */
/* Section + ToC scaffolding                                                  */
/* ------------------------------------------------------------------------- */

export function ReportSection({ id, kicker, title, children }: { id: string; kicker?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mb-16 scroll-mt-24">
      {kicker && <div className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest mb-2">{kicker}</div>}
      <h2 className="text-2xl sm:text-3xl font-black text-bauhaus-black uppercase tracking-tight mb-6">{title}</h2>
      <div className="prose-report space-y-4 text-bauhaus-black font-medium leading-relaxed text-base">
        {children}
      </div>
    </section>
  );
}

export function ReportToc({ entries }: { entries: Array<{ id: string; label: string }> }) {
  return (
    <nav className="border-4 border-bauhaus-black p-6 bg-bauhaus-canvas mb-12">
      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-3">Contents</div>
      <ol className="space-y-1 text-sm font-medium text-bauhaus-black">
        {entries.map((e, i) => (
          <li key={e.id}>
            <a href={`#${e.id}`} className="hover:underline">
              <span className="font-mono text-bauhaus-muted mr-2">{String(i + 1).padStart(2, '0')}</span>
              {e.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------------------- */
/* Findings                                                                   */
/* ------------------------------------------------------------------------- */

export function Finding({ n, title, severity = 'info', children }: { n: number; title: string; severity?: 'info' | 'warn' | 'crit'; children: ReactNode }) {
  const borderColor =
    severity === 'crit' ? 'border-bauhaus-red' :
    severity === 'warn' ? 'border-bauhaus-yellow' : 'border-bauhaus-blue';
  const numberBg =
    severity === 'crit' ? 'bg-bauhaus-red text-white' :
    severity === 'warn' ? 'bg-bauhaus-yellow text-bauhaus-black' : 'bg-bauhaus-blue text-white';
  return (
    <div className={`border-4 ${borderColor} p-5 bg-white mb-6`}>
      <div className="flex items-start gap-4 mb-3">
        <span className={`${numberBg} font-black text-xl px-3 py-1 tabular-nums tracking-tighter shrink-0`}>{String(n).padStart(2, '0')}</span>
        <h3 className="text-lg sm:text-xl font-black text-bauhaus-black uppercase tracking-tight leading-tight pt-1">{title}</h3>
      </div>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Source citations                                                           */
/* ------------------------------------------------------------------------- */

export function SourceLink({ href, label, children }: { href: string; label?: string; children?: ReactNode }) {
  // Numeric superscript-ish citation — clickable through to the source.
  return (
    <a href={href} target="_blank" rel="noopener" className="inline-block align-baseline ml-0.5 text-xs font-black text-bauhaus-blue hover:bg-bauhaus-yellow hover:text-bauhaus-black px-1 py-0.5 border border-bauhaus-blue tabular-nums" title={label || href}>
      {children ?? '↗'}
    </a>
  );
}

export function SourcesPanel({ sources }: { sources: Array<{ id: string; label: string; href: string; type?: string }> }) {
  return (
    <div className="border-4 border-bauhaus-black p-5 bg-bauhaus-canvas">
      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-3">Sources &amp; Methodology</div>
      <ol className="space-y-2 text-xs font-mono text-bauhaus-black">
        {sources.map((s, i) => (
          <li key={s.id} id={s.id} className="leading-relaxed">
            <span className="inline-block w-8 font-black tabular-nums">[{i + 1}]</span>
            <span className="font-medium">{s.label}</span>
            {s.type && <span className="ml-2 text-[10px] uppercase tracking-widest text-bauhaus-muted">({s.type})</span>}
            {' '}
            <a href={s.href} target="_blank" rel="noopener" className="text-bauhaus-blue hover:underline break-all">{s.href}</a>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Inline data callout — wraps a chart/figure with caption                    */
/* ------------------------------------------------------------------------- */

export function DataCallout({ caption, children }: { caption?: ReactNode; children: ReactNode }) {
  return (
    <figure className="border-4 border-bauhaus-black p-5 bg-white my-6">
      {children}
      {caption && (
        <figcaption className="mt-4 pt-3 border-t-2 border-bauhaus-black text-xs font-mono text-bauhaus-muted leading-relaxed">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/* ------------------------------------------------------------------------- */
/* Pull-quote                                                                 */
/* ------------------------------------------------------------------------- */

export function PullQuote({ children, attribution }: { children: ReactNode; attribution?: string }) {
  return (
    <blockquote className="border-l-8 border-bauhaus-red pl-5 py-3 my-6 text-lg sm:text-xl italic font-medium text-bauhaus-black leading-relaxed">
      &ldquo;{children}&rdquo;
      {attribution && <footer className="not-italic text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-3">— {attribution}</footer>}
    </blockquote>
  );
}

/* ------------------------------------------------------------------------- */
/* Stats strip — for inline KPIs                                              */
/* ------------------------------------------------------------------------- */

export function StatStrip({ items }: { items: Array<{ label: string; value: string; tone?: 'red' | 'blue' | 'yellow' | 'black' }> }) {
  const toneClass = (t?: string) =>
    t === 'red' ? 'text-bauhaus-red' :
    t === 'blue' ? 'text-bauhaus-blue' :
    t === 'yellow' ? 'text-bauhaus-yellow' : 'text-bauhaus-black';
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
      {items.map((it, i) => (
        <div key={i} className="border-4 border-bauhaus-black p-3 bg-white">
          <div className="text-[10px] uppercase tracking-widest font-black text-bauhaus-muted">{it.label}</div>
          <div className={`text-xl sm:text-2xl font-black ${toneClass(it.tone)} tabular-nums leading-tight mt-1`}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Related Reads                                                              */
/* ------------------------------------------------------------------------- */

export function RelatedReads({ items }: { items: Array<{ href: string; kicker: string; title: string; description: string }> }) {
  return (
    <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-yellow">
      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-4">Related on CivicGraph</div>
      <div className="grid sm:grid-cols-2 gap-4">
        {items.map((r, i) => (
          <Link key={i} href={r.href} className="block border-4 border-bauhaus-black p-4 bg-white hover:bg-bauhaus-canvas transition-colors">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow mb-1">{r.kicker}</div>
            <div className="text-base font-black text-bauhaus-black uppercase tracking-tight leading-tight mb-2">{r.title} &rarr;</div>
            <p className="text-xs text-bauhaus-muted font-medium leading-relaxed">{r.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Mode toggle (dashboard ⇄ long-read)                                        */
/* ------------------------------------------------------------------------- */

export function ModeToggle({ dashboardHref, longReadHref, current }: { dashboardHref: string; longReadHref: string; current: 'dashboard' | 'long-read' }) {
  const linkBase = 'inline-block px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black';
  return (
    <div className="flex flex-wrap items-center gap-0 mb-6">
      <Link
        href={dashboardHref}
        className={`${linkBase} ${current === 'dashboard' ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'}`}
        aria-current={current === 'dashboard' ? 'page' : undefined}
      >
        Dashboard
      </Link>
      <Link
        href={longReadHref}
        className={`${linkBase} -ml-0.5 ${current === 'long-read' ? 'bg-bauhaus-black text-white' : 'bg-bauhaus-yellow text-bauhaus-black hover:bg-bauhaus-canvas'}`}
        aria-current={current === 'long-read' ? 'page' : undefined}
      >
        📖 Read the Long-form Report
      </Link>
    </div>
  );
}
