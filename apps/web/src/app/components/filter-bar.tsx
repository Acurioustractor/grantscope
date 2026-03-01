'use client';

import { useState } from 'react';

export function FilterBar({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden w-full px-4 py-2.5 bg-white border-4 border-bauhaus-black text-xs font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas mb-0"
      >
        {open ? 'Hide Filters' : 'Filters'}
      </button>
      {/* Desktop: always visible. Mobile: toggled */}
      <div className={`${open ? 'block' : 'hidden'} md:block`}>
        {children}
      </div>
    </div>
  );
}
