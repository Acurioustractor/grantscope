'use client';

import { useState } from 'react';

const links = [
  { href: '/dashboard', label: 'Dashboard', accent: true },
  { href: '/grants', label: 'Grants' },
  { href: '/foundations', label: 'Foundations' },
  { href: '/corporate', label: 'Corporate' },
  { href: '/community', label: 'Community' },
  { href: '/simulator', label: 'Simulator' },
  { href: '/reports', label: 'Reports' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/process', label: 'Process' },
  { href: '/tracker', label: 'Tracker', accent: true },
  { href: '/ops', label: 'Ops', accent: true },
];

export function NavBar() {
  const [open, setOpen] = useState(false);

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

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                  link.accent
                    ? 'text-bauhaus-red hover:bg-bauhaus-red hover:text-white'
                    : 'text-bauhaus-black hover:bg-bauhaus-black hover:text-white'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              {open ? (
                <path strokeLinecap="square" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="square" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t-4 border-bauhaus-black bg-white">
          <div className="px-4 py-3 space-y-0">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`block px-3 py-3 text-sm font-black uppercase tracking-widest border-b-2 border-bauhaus-black/10 transition-colors ${
                  link.accent
                    ? 'text-bauhaus-red hover:bg-bauhaus-red hover:text-white'
                    : 'text-bauhaus-black hover:bg-bauhaus-black hover:text-white'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
