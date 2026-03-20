'use client';

import { useState, useRef, useEffect } from 'react';

interface AccountDropdownProps {
  userEmail: string;
  isAdmin: boolean;
  onToggle?: (open: boolean) => void;
}

const menuItems = [
  { href: '/profile', label: 'My Organisation', desc: 'Profile, ABN & focus areas' },
  { href: '/profile/matches', label: 'Matched Grants', desc: 'AI-matched grants for your org' },
  { href: '/profile/answers', label: 'Answer Bank', desc: 'Reusable Q&A from past applications' },
  { href: '/foundations/tracker', label: 'My Foundations', desc: 'Track foundation relationships' },
  { href: '/knowledge', label: 'Knowledge Wiki', desc: 'Documents, URLs & org intelligence' },
  { href: '/settings', label: 'Settings', desc: 'API keys & account' },
  { href: '/pricing', label: 'Billing & Plan', desc: 'Manage your subscription' },
];

const adminSections = [
  {
    heading: 'Super Admin',
    items: [
      { href: '/org', label: 'All Organisations' },
      { href: '/org/justicehub/intelligence', label: 'JH Command Center' },
      { href: '/graph', label: 'Network Graph' },
    ],
  },
  {
    heading: 'Ops & Health',
    items: [
      { href: '/ops', label: 'Ops Dashboard' },
      { href: '/ops/health', label: 'Data Health' },
      { href: '/ops/claims', label: 'Manage Claims' },
    ],
  },
  {
    heading: 'Data Browsers',
    items: [
      { href: '/dashboard', label: 'Data Observatory' },
      { href: '/mission-control', label: 'Mission Control' },
      { href: '/entities', label: 'Entity Graph' },
      { href: '/grants', label: 'Grants' },
      { href: '/foundations', label: 'Foundations' },
      { href: '/charities', label: 'Charities' },
      { href: '/places', label: 'Places' },
      { href: '/procurement', label: 'Procurement' },
      { href: '/social-enterprises', label: 'Social Enterprises' },
      { href: '/power', label: 'Power Map' },
    ],
  },
  {
    heading: 'Reports & Analysis',
    items: [
      { href: '/reports', label: 'All Reports' },
      { href: '/insights', label: 'Insights' },
      { href: '/benchmark', label: 'Benchmark' },
    ],
  },
];

export function AccountDropdown({ userEmail, isAdmin, onToggle }: AccountDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    onToggle?.(next);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={toggle}
        className={`px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 ${
          open
            ? 'bg-bauhaus-black text-white'
            : 'text-bauhaus-black hover:bg-bauhaus-black hover:text-white'
        }`}
      >
        <span className="truncate max-w-[140px]">{userEmail}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
          <path strokeLinecap="square" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-1 w-64 border-4 border-bauhaus-black bg-white bauhaus-shadow-sm z-50 max-h-[80vh] overflow-y-auto"
        >
          {menuItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block px-4 py-3 hover:bg-bauhaus-black hover:text-white transition-colors group"
              onClick={() => setOpen(false)}
            >
              <div className="text-xs font-black uppercase tracking-widest group-hover:text-white">{item.label}</div>
              <div className="text-[11px] text-bauhaus-muted group-hover:text-white/70 font-medium mt-0.5">{item.desc}</div>
            </a>
          ))}

          {isAdmin && (
            <>
              <div className="border-t-2 border-bauhaus-black/20" />
              <div className="px-4 py-2 bg-bauhaus-red/5">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Admin</div>
              </div>
              {adminSections.map((section) => (
                <div key={section.heading}>
                  <div className="px-4 pt-2 pb-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted/60">{section.heading}</div>
                  </div>
                  {section.items.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="block px-4 py-1.5 hover:bg-bauhaus-black hover:text-white transition-colors group"
                      onClick={() => setOpen(false)}
                    >
                      <div className="text-[11px] font-bold group-hover:text-white">{item.label}</div>
                    </a>
                  ))}
                </div>
              ))}
            </>
          )}

          <div className="border-t-2 border-bauhaus-black/20" />
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="w-full text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
