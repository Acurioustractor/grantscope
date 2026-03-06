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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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
                  <li><a href="/social-enterprises" className="text-bauhaus-muted hover:text-white transition-colors">Social Enterprises</a></li>
                  <li><a href="/corporate" className="text-bauhaus-muted hover:text-white transition-colors">Corporate Giving</a></li>
                </ul>
              </div>
              <div>
                <div className="font-black text-xs text-bauhaus-yellow mb-3 uppercase tracking-widest">Research</div>
                <ul className="space-y-2 text-sm">
                  <li><a href="/reports" className="text-bauhaus-muted hover:text-white transition-colors">All Reports</a></li>
                  <li><a href="/reports/big-philanthropy" className="text-bauhaus-muted hover:text-white transition-colors">$222 Billion</a></li>
                  <li><a href="/reports/community-parity" className="text-bauhaus-muted hover:text-white transition-colors">Community Parity</a></li>
                  <li><a href="/reports/community-power" className="text-bauhaus-muted hover:text-white transition-colors">Community Power</a></li>
                  <li><a href="/reports/social-enterprise" className="text-bauhaus-muted hover:text-white transition-colors">Social Enterprise</a></li>
                </ul>
              </div>
              <div>
                <div className="font-black text-xs text-bauhaus-yellow mb-3 uppercase tracking-widest">For</div>
                <ul className="space-y-2 text-sm">
                  <li><a href="/for/funders" className="text-bauhaus-muted hover:text-white transition-colors">Funders</a></li>
                  <li><a href="/for/philanthropy" className="text-bauhaus-muted hover:text-white transition-colors">Philanthropy</a></li>
                  <li><a href="/for/corporate" className="text-bauhaus-muted hover:text-white transition-colors">Corporates & Sponsors</a></li>
                  <li><a href="/for/social-enterprises" className="text-bauhaus-muted hover:text-white transition-colors">Social Enterprises</a></li>
                  <li><a href="/for/community" className="text-bauhaus-muted hover:text-white transition-colors">Community Orgs</a></li>
                  <li><a href="/pricing" className="text-bauhaus-muted hover:text-white transition-colors">Pricing</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t-2 border-white/10 text-center text-xs text-bauhaus-muted uppercase tracking-widest">
              Built by ACT &middot; Open source &middot; Data updated daily
              <a href="/investors" className="ml-4 text-white/20 hover:text-white/60 transition-colors">Investors</a>
              <a href="/ops/health" className="ml-4 text-white/20 hover:text-white/60 transition-colors">&middot;</a>
            </div>
          </div>
        </footer>
        <ChatDrawer />
      </body>
    </html>
  );
}
