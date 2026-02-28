'use client';

import { useState } from 'react';

const links = [
  { href: '/grants', label: 'Grants' },
  { href: '/foundations', label: 'Foundations' },
  { href: '/corporate', label: 'Corporate' },
  { href: '/community', label: 'Community' },
  { href: '/reports', label: 'Reports', accent: true },
  { href: '/how-it-works', label: 'How It Works' },
];

export function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-navy-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <a href="/" className="font-bold text-lg text-navy-900 tracking-tight hover:text-navy-700 transition-colors">
            GrantScope
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  link.accent
                    ? 'text-danger hover:bg-danger-light'
                    : 'text-navy-600 hover:text-navy-900 hover:bg-navy-100'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 rounded-md text-navy-600 hover:bg-navy-100 transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-navy-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  link.accent
                    ? 'text-danger hover:bg-danger-light'
                    : 'text-navy-600 hover:text-navy-900 hover:bg-navy-100'
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
