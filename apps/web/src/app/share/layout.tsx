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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-bauhaus-black uppercase tracking-tight">CivicGraph</span>
            <span className="text-xs font-mono text-bauhaus-muted hidden sm:inline">civic-sector intelligence, sourced</span>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            <Link href="/pricing" className="text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-canvas">How it works</Link>
            <Link href="/get-a-report?free=true&src=share" className="text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black hover:bg-bauhaus-canvas">★ First 5 Free</Link>
            <Link href="/get-a-report?budget=2500&src=share" className="text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-bauhaus-black bg-bauhaus-black text-white hover:bg-bauhaus-red">Get a Report →</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        {children}
      </main>
      <footer className="border-t-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <div className="text-sm font-black uppercase tracking-tight">CivicGraph</div>
              <p className="text-xs text-bauhaus-muted leading-relaxed mt-1">A Curious Tractor · civic-sector intelligence with citations</p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Link href="/pricing" className="text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-white text-white hover:bg-white hover:text-bauhaus-black">Pricing</Link>
              <Link href="/get-a-report" className="text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black hover:bg-white">Request a Report →</Link>
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-bauhaus-muted border-t border-white/20 pt-4">
            This is a CivicGraph deliverable. The full network graph, watchlists, sector dashboards, and cross-org intelligence layer are available via paid tiers. <Link href="/pricing" className="underline">See pricing →</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
