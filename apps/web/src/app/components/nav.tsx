'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AccountDropdown } from './account-dropdown';
import { GlobalSearch } from './global-search';
import type { Tier, Module } from '@/lib/subscription';
import { hasModule, TIER_LABELS, MODULE_LABELS, minimumTier } from '@/lib/subscription';

const ADMIN_EMAILS = ['benjamin@act.place', 'hello@civicgraph.au'];

/* ─── Public (logged-out) nav ─────────────────────────────── */

const publicLinks = [
  { href: '/ask', label: 'Ask' },
  { href: '/tender-intelligence', label: 'Procurement' },
  { href: '/places', label: 'Places' },
  { href: '/entities', label: 'Entities' },
  { href: '/grants', label: 'Grants' },
  { href: '/reports', label: 'Reports' },
  { href: '/developers', label: 'API' },
];

const megaMenuSections = [
  {
    title: 'Decision Tools',
    links: [
      { href: '/ask', label: 'Ask CivicGraph', desc: 'Natural language queries across all datasets' },
      { href: '/evidence', label: 'Evidence Synthesis', desc: 'ALMA evidence analysis and synthesis' },
      { href: '/scenarios', label: 'Scenario Modelling', desc: 'What-if allocation analysis' },
    ],
  },
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
      { href: '/grants', label: 'Grants', desc: 'Search live grant opportunities' },
      { href: '/foundations', label: 'Foundations', desc: 'Search giving foundations and programs' },
      { href: '/charities', label: 'Charities', desc: 'Search Australian charities' },
      { href: '/entities', label: 'Entity Graph', desc: 'National entity graph across contracts, grants, and donations' },
      { href: '/social-enterprises', label: 'Social Enterprises', desc: 'B Corps, indigenous & disability enterprises' },
      { href: '/dashboard', label: 'Dashboard', desc: 'Overview & key metrics' },
    ],
  },
  {
    title: 'Investigations',
    links: [
      { href: '/reports/power-concentration', label: 'Power Index', desc: '82K entities scored across 7 datasets' },
      { href: '/reports/political-money', label: 'Political Money', desc: 'Who funds politics & what they get back' },
      { href: '/reports/donor-contractors', label: 'Donor-Contractors', desc: 'Entities that both donate and hold government contracts' },
      { href: '/reports/cross-reference', label: '$74B Question', desc: 'Who gets government contracts?' },
      { href: '/reports/big-philanthropy', label: '$222 Billion', desc: 'Where charity money goes' },
      { href: '/reports/community-parity', label: 'Community Parity', desc: 'Who benefits, who misses out' },
      { href: '/reports/who-runs-australia', label: 'Who Runs Australia?', desc: 'Boards, donations, lobbying & contracts' },
      { href: '/reports/funding-deserts', label: 'Funding Deserts', desc: 'Where disadvantage meets underinvestment' },
      { href: '/reports/data-health', label: 'Data Health', desc: 'Coverage & completeness across 7 systems' },
      { href: '/reports/tax-transparency', label: 'Tax Transparency', desc: 'Government contracts vs tax paid' },
      { href: '/reports/exec-remuneration', label: 'Exec Remuneration', desc: 'Executive pay vs service delivery' },
      { href: '/reports/board-interlocks', label: 'Board Interlocks', desc: 'Who controls Australia\'s charities?' },
      { href: '/reports/charity-contracts', label: 'Charity Contracts', desc: 'Charity exec pay vs government contracts' },
      { href: '/reports/influence-network', label: 'Influence Network', desc: 'Lobby, donate, win contracts — the cycle' },
      { href: '/reports/desert-overhead', label: 'Desert Overhead', desc: 'Exec pay in disadvantaged areas' },
      { href: '/reports/community-efficiency', label: 'ACCO Efficiency', desc: 'Community-controlled orgs deliver more with less' },
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

/* ─── Workspace module nav (logged-in) ─────────────────────── */

type NavModule = {
  id: string;
  label: string;
  href: string;
  module?: Module;              // if gated
  children?: { label: string; href: string }[];
};

const workspaceModules: NavModule[] = [
  { id: 'home', label: 'Dashboard', href: '/home' },
  {
    id: 'grants',
    label: 'Grants',
    href: '/grants',
    module: 'grants',
    children: [
      { label: 'Search', href: '/grants' },
      { label: 'Matched', href: '/profile/matches' },
      { label: 'Tracker', href: '/tracker' },
      { label: 'Foundations', href: '/foundations' },
      { label: 'Foundation Tracker', href: '/foundations/tracker' },
      { label: 'Alerts', href: '/alerts' },
    ],
  },
  {
    id: 'procurement',
    label: 'Procurement',
    href: '/tender-intelligence',
    module: 'procurement',
    children: [
      { label: 'Discover', href: '/tender-intelligence' },
      { label: 'Supply Chain', href: '/goods-intelligence' },
    ],
  },
  {
    id: 'allocation',
    label: 'Allocation',
    href: '/places',
    module: 'allocation',
    children: [
      { label: 'Places', href: '/places' },
      { label: 'Gap Analysis', href: '/reports/funding-equity' },
      { label: 'Power Map', href: '/power' },
    ],
  },
  {
    id: 'research',
    label: 'Research',
    href: '/reports',
    module: 'research',
    children: [
      { label: 'Reports', href: '/reports' },
      { label: 'Ask', href: '/ask' },
      { label: 'Evidence', href: '/evidence' },
      { label: 'Scenarios', href: '/scenarios' },
      { label: 'Entities', href: '/entities' },
      { label: 'Charities', href: '/charities' },
      { label: 'Social Enterprises', href: '/social-enterprises' },
      { label: 'Network Graph', href: '/graph' },
    ],
  },
  {
    id: 'relationships',
    label: 'Relationships',
    href: '/org',
    module: 'relationships',
    children: [
      { label: 'My Org', href: '/org' },
      { label: 'Contacts', href: '/org/__SLUG__/contacts' },
      { label: 'Knowledge Wiki', href: '/knowledge' },
    ],
  },
];

/* ─── Admin nav items ──────────────────────────────────────── */

const adminLinks = [
  { href: '/ops', label: 'Ops' },
  { href: '/mission-control', label: 'Mission Control' },
  { href: '/goods-intelligence', label: 'Supply Chain' },
];

/* ─── Component ────────────────────────────────────────────── */

interface NavBarProps {
  initialUserEmail: string | null;
  subscriptionTier?: Tier;
  isImpersonating?: boolean;
  orgSlug?: string | null;
}

export function NavBar({ initialUserEmail, subscriptionTier = 'community', isImpersonating = false, orgSlug = null }: NavBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userEmail] = useState<string | null>(initialUserEmail);
  const megaRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const isLoggedIn = !!userEmail;
  const isAdmin = isLoggedIn && ADMIN_EMAILS.includes(userEmail);
  const tier = subscriptionTier;

  // Resolve org-slug-dependent links (hide links that need a slug when none is available)
  const resolvedModules = workspaceModules.map(mod => {
    if (!mod.children) return mod;
    return {
      ...mod,
      children: mod.children.filter(child => {
        if (child.href.includes('__SLUG__') && !orgSlug) return false;
        return true;
      }).map(child => ({
        ...child,
        href: orgSlug ? child.href.replace('__SLUG__', orgSlug) : child.href,
      })),
    };
  });

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

  function isActive(href: string) {
    if (href === '/home') return pathname === '/home';
    return pathname.startsWith(href);
  }

  /** Find the active top-level module for showing sub-nav */
  function activeModule(): NavModule | null {
    for (const mod of resolvedModules) {
      if (mod.children) {
        for (const child of mod.children) {
          if (pathname.startsWith(child.href)) return mod;
        }
      }
      if (pathname.startsWith(mod.href)) return mod;
    }
    return null;
  }

  const currentModule = activeModule();

  // ─── LOGGED-IN: Unified workspace nav ──────────────────────
  if (isLoggedIn) {
    return (
      <>
        <nav className="sticky top-0 z-50" style={{ background: 'var(--ws-surface-1)' }}>
          <div className="px-5 flex items-center h-12">
            {/* Logo */}
            <a href="/home" className="flex items-center gap-2.5 mr-8 shrink-0">
              <div className="w-6 h-6 bg-[#D02020] flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-white rounded-full" />
              </div>
              <span className="text-[14px] font-bold tracking-tight" style={{ color: 'var(--ws-text)' }}>CivicGraph</span>
            </a>

            {/* Module tabs — bottom-border indicator pattern (Linear/Vercel) */}
            <div className="flex items-center gap-0 h-12">
              {resolvedModules.map(mod => {
                const locked = mod.module && !hasModule(tier, mod.module);
                const active = currentModule?.id === mod.id || (mod.id === 'home' && pathname === '/home');
                return (
                  <a
                    key={mod.id}
                    href={locked ? '/pricing' : mod.href}
                    className="relative px-3 h-12 flex items-center text-[13px] font-medium transition-colors"
                    style={{
                      color: locked
                        ? 'var(--ws-text-tertiary)'
                        : active
                          ? 'var(--ws-text)'
                          : 'var(--ws-text-secondary)',
                    }}
                    title={locked ? `Requires ${TIER_LABELS[minimumTier(mod.module!)]} tier` : undefined}
                  >
                    {mod.label}
                    {locked && (
                      <svg className="inline-block ml-1 w-3 h-3 opacity-40" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/>
                      </svg>
                    )}
                    {/* Active indicator — 2px bottom bar */}
                    {active && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full" style={{ background: 'var(--ws-accent)' }} />
                    )}
                  </a>
                );
              })}
            </div>

            {/* Right side */}
            <div className="ml-auto flex items-center gap-2">
              {/* Tier badge */}
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md" style={{
                color: tier === 'enterprise' ? 'var(--ws-accent)' : 'var(--ws-text-tertiary)',
                background: tier === 'enterprise' ? 'rgba(37,99,235,0.08)' : 'var(--ws-surface-2)',
              }}>
                {TIER_LABELS[tier]}
              </span>

              {/* Admin links — hidden when impersonating */}
              {isAdmin && !isImpersonating && adminLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-[11px] font-medium px-2 py-1 rounded-md transition-colors"
                  style={{
                    color: isActive(link.href) ? 'var(--ws-red)' : 'var(--ws-text-tertiary)',
                    background: isActive(link.href) ? 'rgba(220,38,38,0.06)' : 'transparent',
                  }}
                >
                  {link.label}
                </a>
              ))}

              {/* Search */}
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors"
                style={{ color: 'var(--ws-text-secondary)', background: 'var(--ws-surface-2)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <kbd className="hidden lg:inline text-[10px] font-medium" style={{ color: 'var(--ws-text-tertiary)' }}>&#8984;K</kbd>
              </button>

              {/* Account */}
              <WorkspaceAccountMenu userEmail={userEmail} isAdmin={isAdmin} isImpersonating={isImpersonating} />
            </div>
          </div>

          {/* Bottom border — always visible */}
          <div className="h-px" style={{ background: 'var(--ws-border)' }} />

          {/* Sub-nav for active module */}
          {currentModule?.children && (
            <div className="px-5 flex items-center gap-1 h-10 border-b" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}>
              <span className="text-[11px] font-semibold uppercase tracking-wide mr-2 pr-3 border-r" style={{ color: 'var(--ws-text-tertiary)', borderColor: 'var(--ws-border)' }}>
                {currentModule.label}
              </span>
              {currentModule.children.map(child => {
                const active = pathname.startsWith(child.href);
                return (
                  <a
                    key={child.href}
                    href={child.href}
                    className="px-2.5 py-1.5 text-[12px] font-medium rounded-md transition-colors"
                    style={{
                      color: active ? 'var(--ws-text)' : 'var(--ws-text-secondary)',
                      background: active ? 'var(--ws-surface-2)' : 'transparent',
                    }}
                  >
                    {child.label}
                  </a>
                );
              })}
            </div>
          )}
        </nav>
        <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      </>
    );
  }

  // ─── LOGGED-OUT: Bauhaus public nav ────────────────────────
  return (
    <nav className="bg-white border-b-4 border-bauhaus-black sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-bauhaus-red border-3 border-bauhaus-black flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-full"></div>
            </div>
            <span className="font-black text-xl tracking-tight text-bauhaus-black uppercase">CivicGraph</span>
          </a>

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
          </div>
        </div>
      )}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </nav>
  );
}

/* ─── Workspace account menu (editorial style) ────────────── */

function WorkspaceAccountMenu({ userEmail, isAdmin, isImpersonating = false }: { userEmail: string; isAdmin: boolean; isImpersonating?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors"
        style={{
          color: open ? 'var(--ws-accent)' : 'var(--ws-text-secondary)',
          background: open ? 'rgba(37,99,235,0.06)' : 'transparent',
        }}
      >
        <span className="text-[12px] font-medium truncate max-w-[120px]">{userEmail.split('@')[0]}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div ref={ref} className="absolute right-0 top-full mt-1 w-56 rounded-lg border shadow-lg z-50 overflow-hidden" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--ws-border)' }}>
            <div className="text-[12px] font-medium truncate" style={{ color: 'var(--ws-text)' }}>{userEmail}</div>
          </div>

          {[
            { href: '/profile', label: 'My Organisation' },
            { href: '/profile/matches', label: 'Matched Grants' },
            { href: '/profile/answers', label: 'Answer Bank' },
            { href: '/knowledge', label: 'Knowledge Wiki' },
            { href: '/settings', label: 'Settings' },
            { href: '/pricing', label: 'Billing & Plan' },
          ].map(item => (
            <a
              key={item.href}
              href={item.href}
              className="block px-3 py-2 text-[12px] font-medium transition-colors"
              style={{ color: 'var(--ws-text-secondary)' }}
              onClick={() => setOpen(false)}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--ws-surface-2)'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; }}
            >
              {item.label}
            </a>
          ))}

          {isAdmin && !isImpersonating && (
            <>
              <div className="border-t" style={{ borderColor: 'var(--ws-border)' }}>
                <div className="px-3 py-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#E63946' }}>Super Admin</div>
                </div>
                {[
                  { href: '/org', label: 'All Organisations' },
                  { href: '/org/justicehub/intelligence', label: 'JH Command Center' },
                  { href: '/mission-control', label: 'Mission Control' },
                  { href: '/graph', label: 'Network Graph' },
                  { href: '/ops', label: 'Ops Dashboard' },
                  { href: '/ops/health', label: 'Data Health' },
                ].map(item => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="block px-3 py-1.5 text-[12px] font-medium transition-colors"
                    style={{ color: 'var(--ws-text-secondary)' }}
                    onClick={() => setOpen(false)}
                    onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--ws-surface-2)'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; }}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </>
          )}

          <div className="border-t" style={{ borderColor: 'var(--ws-border)' }}>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="w-full text-left px-3 py-2 text-[12px] font-medium transition-colors"
                style={{ color: 'var(--ws-text-tertiary)' }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--ws-surface-2)'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; }}
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
