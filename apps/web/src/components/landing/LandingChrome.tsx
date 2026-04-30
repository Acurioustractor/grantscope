import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Shared minimal chrome for public landing / marketing / conversion pages.
 *
 * Used by /discover, /feedback, /get-a-report, /pricing. Replaces the dense
 * 30-link global NavBar + 4-section footer with a focused 3-link header and
 * a tight footer. Goal: a stranger arriving from a LinkedIn share lands on
 * the page focused on (a) the report content / form, (b) what to do next,
 * with no buffet of internal app surfaces.
 *
 * The full app (NavBar, dense footer, /tracker / /alerts / /profile / etc.)
 * is exposed at /app or via login.
 */
export function LandingChrome({ children, currentPage }: { children: ReactNode; currentPage?: 'discover' | 'feedback' | 'report' | 'pricing' }) {
  return (
    <div className="min-h-screen flex flex-col bg-bauhaus-canvas">
      <header className="border-b-4 border-bauhaus-black bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-4 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-black text-bauhaus-black uppercase tracking-tight hover:underline">
            CivicGraph
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <Link href="/discover" className={`text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-bauhaus-black ${currentPage === 'discover' ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'}`} aria-current={currentPage === 'discover' ? 'page' : undefined}>Discover</Link>
            <Link href="/feedback" className={`text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-bauhaus-black ${currentPage === 'feedback' ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'}`} aria-current={currentPage === 'feedback' ? 'page' : undefined}>Feedback</Link>
            <Link href="/get-a-report?free=true" className={`text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-bauhaus-black ${currentPage === 'report' ? 'bg-bauhaus-black text-white' : 'bg-bauhaus-yellow text-bauhaus-black hover:bg-bauhaus-canvas'}`} aria-current={currentPage === 'report' ? 'page' : undefined}>★ Get a Report</Link>
            <Link href="/login" className="text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-bauhaus-black bg-white text-bauhaus-muted hover:text-bauhaus-black hover:bg-bauhaus-canvas">Login</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 sm:px-10 lg:px-16 py-10">
        {children}
      </main>
      <footer className="border-t-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-8">
          <div className="flex flex-wrap items-start justify-between gap-6 mb-4">
            <div className="max-w-md">
              <div className="text-sm font-black uppercase tracking-tight mb-1">CivicGraph</div>
              <p className="text-xs text-bauhaus-muted leading-relaxed">
                Civic-sector intelligence with citations. Built by{' '}
                <a href="/about/curious-tractor" className="underline hover:text-white">A Curious Tractor</a>. Reports use only public data sources.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Link href="/discover" className="text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-white text-white hover:bg-white hover:text-bauhaus-black">Reports</Link>
              <Link href="/feedback" className="text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-white text-white hover:bg-white hover:text-bauhaus-black">Send feedback</Link>
              <Link href="/get-a-report" className="text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black hover:bg-white">Get a Report →</Link>
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-bauhaus-muted border-t border-white/20 pt-4 flex flex-wrap items-center justify-between gap-3">
            <span>Track action rather than wait for others</span>
            <span>
              <a href="mailto:Benjamin@act.place" className="text-bauhaus-muted hover:text-white">Benjamin@act.place</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
