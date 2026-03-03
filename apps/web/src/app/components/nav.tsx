'use client';

import { useState, useRef, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

const primaryLinks = [
  { href: '/grants', label: 'Grants' },
  { href: '/foundations', label: 'Foundations' },
  { href: '/charities', label: 'Charities' },
  { href: '/corporate', label: 'Corporate' },
];

const megaMenuSections = [
  {
    title: 'Explore',
    links: [
      { href: '/grants', label: 'Grants', desc: 'Search 14k+ grant opportunities' },
      { href: '/foundations', label: 'Foundations', desc: '9,800+ giving foundations' },
      { href: '/charities', label: 'Charities', desc: '64,000+ charities, 500+ enriched profiles' },
      { href: '/corporate', label: 'Corporate Giving', desc: 'ASX200 philanthropy' },
    ],
  },
  {
    title: 'Analyse',
    links: [
      { href: '/dashboard', label: 'Dashboard', desc: 'Overview & key metrics' },
      { href: '/reports', label: 'Reports', desc: 'Living data investigations' },
      { href: '/charities/insights', label: 'Insights', desc: 'Charity sector visualisations' },
      { href: '/simulator', label: 'Simulator', desc: 'Funding scenario modelling' },
      { href: '/tracker', label: 'Tracker', desc: 'Grant application tracking' },
    ],
  },
  {
    title: 'Research',
    links: [
      { href: '/reports/big-philanthropy', label: '$222 Billion', desc: 'Where charity money goes' },
      { href: '/reports/community-parity', label: 'Community Parity', desc: 'Who benefits, who misses out' },
      { href: '/reports/community-power', label: 'Community Power', desc: 'Alternatives to grant dependency' },
      { href: '/reports/power-dynamics', label: 'Power Dynamics', desc: 'Concentration & inequality' },
    ],
  },
  {
    title: 'About',
    links: [
      { href: '/how-it-works', label: 'How It Works', desc: 'Architecture & data sources' },
      { href: '/process', label: 'Process', desc: 'Our methodology' },
      { href: '/profile', label: 'Profile', desc: 'Your organisation profile' },
      { href: '/ops', label: 'Ops', desc: 'Operational status' },
      { href: '/architecture', label: 'Architecture', desc: 'System design' },
    ],
  },
];

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const megaRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        megaRef.current && !megaRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setMegaOpen(false);
      }
    }
    if (megaOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [megaOpen]);

  return (
    <nav className="bg-white border-b-4 border-bauhaus-black sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-bauhaus-red border-3 border-bauhaus-black flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-full"></div>
            </div>
            <span className="font-black text-xl tracking-tight text-bauhaus-black uppercase">GrantScope</span>
          </a>

          {/* Desktop nav — primary links + mega menu trigger */}
          <div className="hidden md:flex items-center gap-0">
            {primaryLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="w-px h-6 bg-bauhaus-black/20 mx-1" />
            <a
              href="/dashboard"
              className="px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors"
            >
              Dashboard
            </a>
            <button
              ref={btnRef}
              onClick={() => setMegaOpen(!megaOpen)}
              className={`px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 ${
                megaOpen
                  ? 'bg-bauhaus-black text-white'
                  : 'text-bauhaus-black hover:bg-bauhaus-black hover:text-white'
              }`}
            >
              More
              <svg className={`w-3 h-3 transition-transform ${megaOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="square" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {!authLoading && (
              <>
                <div className="w-px h-6 bg-bauhaus-black/20 mx-1" />
                {userEmail ? (
                  <div className="flex items-center gap-2">
                    <span className="px-2 text-[10px] font-bold text-bauhaus-muted truncate max-w-[140px]">{userEmail}</span>
                    <form action="/api/auth/signout" method="POST">
                      <button
                        type="submit"
                        className="px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:bg-bauhaus-black hover:text-white transition-colors"
                      >
                        Sign Out
                      </button>
                    </form>
                  </div>
                ) : (
                  <a
                    href="/login"
                    className="px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors"
                  >
                    Login
                  </a>
                )}
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => { setMobileOpen(!mobileOpen); setMegaOpen(false); }}
            className="md:hidden p-2 text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              {mobileOpen ? (
                <path strokeLinecap="square" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="square" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Desktop mega menu */}
      {megaOpen && (
        <div ref={megaRef} className="hidden md:block border-t-4 border-bauhaus-black bg-white shadow-[0_8px_0_0_rgba(0,0,0,0.08)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-4 gap-8">
              {megaMenuSections.map((section) => (
                <div key={section.title}>
                  <h3 className="text-[10px] font-black text-bauhaus-muted uppercase tracking-[0.3em] mb-3">{section.title}</h3>
                  <div className="space-y-0">
                    {section.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        className="block px-3 py-2.5 -mx-3 hover:bg-bauhaus-canvas transition-colors group"
                        onClick={() => setMegaOpen(false)}
                      >
                        <div className="text-sm font-black text-bauhaus-black group-hover:text-bauhaus-red transition-colors">{link.label}</div>
                        <div className="text-xs text-bauhaus-muted font-medium">{link.desc}</div>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile menu — full grouped layout */}
      {mobileOpen && (
        <div className="md:hidden border-t-4 border-bauhaus-black bg-white max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="px-4 py-4">
            {megaMenuSections.map((section) => (
              <div key={section.title} className="mb-4 last:mb-0">
                <h3 className="text-[10px] font-black text-bauhaus-muted uppercase tracking-[0.3em] mb-1 px-3">{section.title}</h3>
                {section.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="block px-3 py-3 text-sm font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white border-b-2 border-bauhaus-black/10 transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ))}
            {!authLoading && (
              <div className="mt-4 pt-4 border-t-2 border-bauhaus-black/20">
                {userEmail ? (
                  <div className="px-3">
                    <div className="text-[10px] font-bold text-bauhaus-muted mb-2 truncate">{userEmail}</div>
                    <form action="/api/auth/signout" method="POST">
                      <button
                        type="submit"
                        className="w-full text-left px-3 py-3 text-sm font-black uppercase tracking-widest text-bauhaus-muted hover:bg-bauhaus-black hover:text-white transition-colors"
                      >
                        Sign Out
                      </button>
                    </form>
                  </div>
                ) : (
                  <a
                    href="/login"
                    className="block px-3 py-3 text-sm font-black uppercase tracking-widest text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    Login
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
