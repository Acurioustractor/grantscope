import Link from 'next/link';

/**
 * Share-mode layout.
 *
 * Renders chromeless from the root layout (no global NavBar, no full footer).
 * A minimal top bar identifies the artefact as a CivicGraph deliverable and
 * routes new interest to /pricing or /get-a-report — but does NOT link out to
 * /graph, /reports, /orgs, /tracker, or any other internal app surface.
 *
 * This is the artefact you send to a non-customer: they see the report, they
 * understand what it is, and the only path forward is the conversion funnel.
 */
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bauhaus-canvas">
      <header className="border-b-4 border-bauhaus-black bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-bauhaus-black uppercase tracking-tight">CivicGraph</span>
            <span className="text-xs font-mono text-bauhaus-muted hidden sm:inline">civic-sector intelligence, sourced</span>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            <Link href="/feedback?subject=fecca-eccv" className="text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black hover:bg-bauhaus-canvas">★ Tell us what&apos;s useful →</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 sm:px-10 lg:px-16 py-10">
        {children}
      </main>
      <footer className="border-t-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <div className="text-sm font-black uppercase tracking-tight">CivicGraph</div>
              <p className="text-xs text-bauhaus-muted leading-relaxed mt-1">A Curious Tractor · civic-sector intelligence with citations</p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Link href="/feedback?subject=fecca-eccv" className="text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black hover:bg-white">★ Send feedback →</Link>
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-bauhaus-muted border-t border-white/20 pt-4">
            This is a CivicGraph deliverable. We&apos;re building this in public &mdash; tell us what hit, what missed, and what you&apos;d want next at <Link href="/feedback?subject=fecca-eccv" className="underline">/feedback</Link>.
          </div>
        </div>
      </footer>
    </div>
  );
}
