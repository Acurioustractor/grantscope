import type { Metadata } from 'next';
import './globals.css';
import { NavBar } from './components/nav';

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
        <footer className="border-t border-navy-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="font-bold text-lg text-navy-900 mb-2">GrantScope</div>
                <p className="text-sm text-navy-500 leading-relaxed">
                  Open source. Open data. Making Australian funding flows transparent and accessible to everyone.
                </p>
              </div>
              <div>
                <div className="font-semibold text-sm text-navy-700 mb-3">Explore</div>
                <ul className="space-y-2 text-sm">
                  <li><a href="/grants" className="text-navy-500 hover:text-navy-900 transition-colors">Government Grants</a></li>
                  <li><a href="/foundations" className="text-navy-500 hover:text-navy-900 transition-colors">Foundations</a></li>
                  <li><a href="/corporate" className="text-navy-500 hover:text-navy-900 transition-colors">Corporate Giving</a></li>
                  <li><a href="/community" className="text-navy-500 hover:text-navy-900 transition-colors">Community Orgs</a></li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-sm text-navy-700 mb-3">Data Sources</div>
                <ul className="space-y-2 text-sm text-navy-500">
                  <li>ACNC Charity Register</li>
                  <li>GrantConnect</li>
                  <li>data.gov.au</li>
                  <li>QLD Grants Finder</li>
                </ul>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-navy-200 text-center text-xs text-navy-400">
              Built by ACT &middot; Open source &middot; Data updated daily
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
