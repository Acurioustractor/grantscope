'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { AccountDropdown } from './account-dropdown';
import { GlobalSearch } from './global-search';

const ADMIN_EMAILS = ['benjamin@act.place', 'hello@civicgraph.au'];

/* ── Logged-out: platform/marketing nav ── */
const publicLinks = [
  { href: '/tender-intelligence', label: 'Procurement' },
  { href: '/places', label: 'Places' },
  { href: '/entities', label: 'Entities' },
  { href: '/grants', label: 'Grants' },
  { href: '/reports', label: 'Reports' },
];

const megaMenuSections = [
  {
    title: 'Procurement Intelligence',
    links: [
      { href: '/tender-intelligence', label: 'Tender Intelligence', desc: 'Supplier discovery & compliance scoring' },
      { href: '/tender-intelligence#enrich', label: 'List Enrichment', desc: 'Upload & enrich supplier lists' },
      { href: '/tender-intelligence#pack', label: 'Intelligence Pack', desc: 'Full procurement analysis report' },
      { href: '/for/government', label: 'For Government', desc: 'Procurement officers & commissioners' },
    ],
  },
  {
    title: 'Allocation Intelligence',
    links: [
      { href: '/places', label: 'Place Packs', desc: 'Funding & providers by postcode' },
      { href: '/reports/funding-equity', label: 'Gap Analysis', desc: 'Where money doesn\'t match need' },
      { href: '/reports/youth-justice', label: 'Commissioning', desc: 'Youth justice deep analysis' },
      { href: '/power', label: 'Power Map', desc: 'Where the money flows' },
    ],
  },
  {
    title: 'Explore Data',
    links: [
      { href: '/grants', label: 'Grants', desc: 'Search 14k+ grant opportunities' },
      { href: '/foundations', label: 'Foundations', desc: '9,800+ giving foundations' },
      { href: '/charities', label: 'Charities', desc: '64,000+ charities' },
      { href: '/entities', label: 'Entity Graph', desc: '99K entities, 65K relationships' },
      { href: '/social-enterprises', label: 'Social Enterprises', desc: 'B Corps, indigenous & disability enterprises' },
      { href: '/dashboard', label: 'Dashboard', desc: 'Overview & key metrics' },
    ],
  },
  {
    title: 'Investigations',
    links: [
      { href: '/reports/donor-contractors', label: 'Donor-Contractors', desc: '140 entities, $80M donated, $4.7B in contracts' },
      { href: '/reports/cross-reference', label: '$74B Question', desc: 'Who gets government contracts?' },
      { href: '/reports/big-philanthropy', label: '$222 Billion', desc: 'Where charity money goes' },
      { href: '/reports/community-parity', label: 'Community Parity', desc: 'Who benefits, who misses out' },
    ],
  },
  {
    title: 'For',
    links: [
      { href: '/for/government', label: 'Government', desc: 'Procurement & commissioning intelligence' },
      { href: '/for/community', label: 'Community Orgs', desc: 'Find grants, track applications' },
      { href: '/for/funders', label: 'Funders', desc: 'Portfolio intelligence & discovery' },
      { href: '/for/researchers', label: 'Researchers', desc: 'Open data & living reports' },
    ],
  },
];

/* ── Logged-in: focused app nav ── */
const appLinks = [
  { href: '/home', label: 'Home' },
  { href: '/grants', label: 'Grants' },
  { href: '/tracker', label: 'My Grants' },
  { href: '/foundations', label: 'Foundations' },
  { href: '/alerts', label: 'Alerts' },
];

const exploreLinks = [
  { href: '/entities', label: 'Entities', desc: '99K organisations & relationships' },
  { href: '/places', label: 'Places', desc: 'Funding by postcode & region' },
  { href: '/tender-intelligence', label: 'Procurement', desc: 'Government contract intelligence' },
  { href: '/charities', label: 'Charities', desc: '64K charities directory' },
  { href: '/social-enterprises', label: 'Social Enterprises', desc: 'B Corps & Indigenous enterprises' },
  { href: '/reports', label: 'Reports', desc: 'Research & investigations' },
  { href: '/power', label: 'Power Map', desc: 'Where the money flows' },
];

const appMobileLinks = [
  { href: '/home', label: 'Home' },
  { href: '/grants', label: 'Search Grants' },
  { href: '/tracker', label: 'My Grants' },
  { href: '/foundations', label: 'Browse Foundations' },
  { href: '/foundations/tracker', label: 'My Foundations' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/profile', label: 'My Organisation' },
  { href: '/knowledge', label: 'Knowledge Wiki' },
  { href: '/settings', label: 'Settings' },
];

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const megaRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const exploreRef = useRef<HTMLDivElement>(null);
  const exploreBtnRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const isLoggedIn = !!userEmail;

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

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        exploreRef.current && !exploreRef.current.contains(e.target as Node) &&
        exploreBtnRef.current && !exploreBtnRef.current.contains(e.target as Node)
      ) {
        setExploreOpen(false);
      }
    }
    if (exploreOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [exploreOpen]);

  function isActive(href: string) {
    if (href === '/home') return pathname === '/home';
    return pathname.startsWith(href);
  }

  return (
    <nav className="bg-white border-b-4 border-bauhaus-black sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href={isLoggedIn ? '/home' : '/'} className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-bauhaus-red border-3 border-bauhaus-black flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-full"></div>
            </div>
            <span className="font-black text-xl tracking-tight text-bauhaus-black uppercase">CivicGraph</span>
          </a>

          {/* ═══ LOGGED-IN: focused app nav ═══ */}
          {!authLoading && isLoggedIn && (
            <div className="hidden md:flex items-center gap-0">
              {appLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                    isActive(link.href)
                      ? 'bg-bauhaus-black text-white'
                      : 'text-bauhaus-black hover:bg-bauhaus-black hover:text-white'
                  }`}
                >
                  {link.label}
                </a>
              ))}
              <button
                ref={exploreBtnRef}
                onClick={() => setExploreOpen(!exploreOpen)}
                className={`px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 ${
                  exploreOpen
                    ? 'bg-bauhaus-black text-white'
                    : 'text-bauhaus-muted hover:bg-bauhaus-black hover:text-white'
                }`}
              >
                Explore
                <svg className={`w-3 h-3 transition-transform ${exploreOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="square" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                onClick={() => setSearchOpen(true)}
                className="px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors flex items-center gap-1.5"
                aria-label="Search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="square" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[9px] font-black text-bauhaus-muted border border-bauhaus-black/20 ml-1">&#8984;K</kbd>
              </button>
              <div className="w-px h-6 bg-bauhaus-black/20 mx-1" />
              <AccountDropdown
                userEmail={userEmail}
                isAdmin={ADMIN_EMAILS.includes(userEmail)}
                onToggle={(open) => { if (open) setExploreOpen(false); }}
              />
            </div>
          )}

          {/* ═══ LOGGED-OUT: platform nav + mega menu ═══ */}
          {!authLoading && !isLoggedIn && (
            <div className="hidden md:flex items-center gap-0">
              {publicLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <button
                onClick={() => setSearchOpen(true)}
                className="px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors flex items-center gap-1.5"
                aria-label="Search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="square" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="hidden lg:inline">Search</span>
                <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[9px] font-black text-bauhaus-muted border border-bauhaus-black/20 ml-1">&#8984;K</kbd>
              </button>
              <div className="w-px h-6 bg-bauhaus-black/20 mx-1" />
              <a
                href="/mission-control"
                className="px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors"
              >
                Mission Control
              </a>
              <button
                ref={btnRef}
                onClick={() => { setMegaOpen(!megaOpen); }}
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
              <div className="w-px h-6 bg-bauhaus-black/20 mx-1" />
              <a
                href="/login"
                className="px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors"
              >
                Login
              </a>
            </div>
          )}

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

      {/* Logged-in: Explore dropdown */}
      {exploreOpen && isLoggedIn && (
        <div ref={exploreRef} className="hidden md:block border-t-4 border-bauhaus-black bg-white shadow-[0_8px_0_0_rgba(0,0,0,0.08)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid grid-cols-4 lg:grid-cols-7 gap-1">
              {exploreLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-3 py-3 hover:bg-bauhaus-canvas transition-colors group"
                  onClick={() => setExploreOpen(false)}
                >
                  <div className="text-sm font-black text-bauhaus-black group-hover:text-bauhaus-red transition-colors">{link.label}</div>
                  <div className="text-[11px] text-bauhaus-muted font-medium mt-0.5">{link.desc}</div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Desktop mega menu — only for logged-out visitors */}
      {megaOpen && !isLoggedIn && (
        <div ref={megaRef} className="hidden md:block border-t-4 border-bauhaus-black bg-white shadow-[0_8px_0_0_rgba(0,0,0,0.08)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-5 gap-8">
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

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t-4 border-bauhaus-black bg-white max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="px-4 py-4">
            {isLoggedIn ? (
              /* ── Logged-in mobile: focused app links ── */
              <div>
                {appMobileLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className={`block px-3 py-3 text-sm font-black uppercase tracking-widest border-b-2 border-bauhaus-black/10 transition-colors ${
                      isActive(link.href)
                        ? 'bg-bauhaus-black text-white'
                        : 'text-bauhaus-black hover:bg-bauhaus-black hover:text-white'
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
                <div className="mt-4 pt-4 border-t-2 border-bauhaus-black/20">
                  <h3 className="text-[10px] font-black text-bauhaus-muted uppercase tracking-[0.3em] mb-1 px-3">Explore</h3>
                  {exploreLinks.map((link) => (
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
                <div className="mt-4 pt-4 border-t-2 border-bauhaus-black/20">
                  <div className="px-3 py-2 text-[11px] font-bold text-bauhaus-muted truncate">{userEmail}</div>
                  {ADMIN_EMAILS.includes(userEmail!) && (
                    <a href="/ops/claims" className="block px-3 py-3 text-sm font-black uppercase tracking-widest text-bauhaus-red hover:bg-bauhaus-black hover:text-white border-b-2 border-bauhaus-black/10 transition-colors" onClick={() => setMobileOpen(false)}>
                      Admin
                    </a>
                  )}
                  <form action="/api/auth/signout" method="POST">
                    <button
                      type="submit"
                      className="w-full text-left px-3 py-3 text-sm font-black uppercase tracking-widest text-bauhaus-muted hover:bg-bauhaus-black hover:text-white transition-colors"
                    >
                      Sign Out
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              /* ── Logged-out mobile: full mega menu ── */
              <>
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
                <div className="mt-4 pt-4 border-t-2 border-bauhaus-black/20">
                  <a
                    href="/login"
                    className="block px-3 py-3 text-sm font-black uppercase tracking-widest text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    Login
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </nav>
  );
}
