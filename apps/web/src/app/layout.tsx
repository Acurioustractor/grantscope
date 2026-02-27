import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GrantScope Australia',
  description: 'Open-source funding transparency platform — government grants, philanthropic foundations, corporate giving',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#1a1a2e', background: '#fafafa' }}>
        <nav style={{ borderBottom: '1px solid #e0e0e0', padding: '12px 24px', background: '#fff', display: 'flex', alignItems: 'center', gap: '24px' }}>
          <a href="/" style={{ fontWeight: 700, fontSize: '18px', textDecoration: 'none', color: '#1a1a2e' }}>
            GrantScope
          </a>
          <a href="/grants" style={{ textDecoration: 'none', color: '#555' }}>Grants</a>
          <a href="/foundations" style={{ textDecoration: 'none', color: '#555' }}>Foundations</a>
          <a href="/corporate" style={{ textDecoration: 'none', color: '#555' }}>Corporate Giving</a>
        </nav>
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
