import type { Metadata } from 'next';
import './globals.css';
import { NavBar } from './components/nav';
import { ChatDrawer } from './components/chat-drawer';

export const metadata: Metadata = {
  title: 'GrantScope Australia',
  description: 'Open-source funding transparency platform — government grants, philanthropic foundations, corporate giving',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t-4 border-bauhaus-black mt-16 bg-bauhaus-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="font-black text-lg text-white uppercase tracking-tight mb-2">GrantScope</div>
                <p className="text-sm text-bauhaus-muted leading-relaxed">
                  Open source. Open data. Making Australian funding flows transparent and accessible to everyone.
                </p>
              </div>
              <div>
                <div className="font-black text-xs text-bauhaus-yellow mb-3 uppercase tracking-widest">Explore</div>
                <ul className="space-y-2 text-sm">
                  <li><a href="/grants" className="text-bauhaus-muted hover:text-white transition-colors">Government Grants</a></li>
                  <li><a href="/foundations" className="text-bauhaus-muted hover:text-white transition-colors">Foundations</a></li>
                  <li><a href="/charities" className="text-bauhaus-muted hover:text-white transition-colors">All Charities</a></li>
                  <li><a href="/corporate" className="text-bauhaus-muted hover:text-white transition-colors">Corporate Giving</a></li>
                  <li><a href="/charities?enriched=1" className="text-bauhaus-muted hover:text-white transition-colors">Enriched Profiles</a></li>
                </ul>
              </div>
              <div>
                <div className="font-black text-xs text-bauhaus-yellow mb-3 uppercase tracking-widest">Data Sources</div>
                <ul className="space-y-2 text-sm text-bauhaus-muted">
                  <li>ACNC Charity Register</li>
                  <li>GrantConnect &middot; ARC &middot; NHMRC</li>
                  <li>All 8 state/territory portals</li>
                  <li>data.gov.au &middot; business.gov.au</li>
                </ul>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t-2 border-white/10 text-center text-xs text-bauhaus-muted uppercase tracking-widest">
              Built by ACT &middot; Open source &middot; Data updated daily
              <a href="/ops/health" className="ml-4 text-white/20 hover:text-white/60 transition-colors">&middot;</a>
            </div>
          </div>
        </footer>
        <ChatDrawer />
      </body>
    </html>
  );
}
