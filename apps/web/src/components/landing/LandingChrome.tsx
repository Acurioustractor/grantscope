import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Shared minimal chrome for public landing / marketing / conversion pages.
 *
 * Used by /discover, /feedback, /get-a-report, /pricing. Wraps page content
 * in the Bauhaus canvas + a focused footer. The global NavBar (root layout)
 * provides top navigation; we don't render a second header here.
 */
export function LandingChrome({ children, currentPage: _currentPage }: { children: ReactNode; currentPage?: 'discover' | 'changes' | 'feedback' | 'report' | 'pricing' | 'account' }) {
  return (
    <div className="min-h-screen flex flex-col bg-bauhaus-canvas">
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
