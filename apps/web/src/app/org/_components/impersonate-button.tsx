'use client';

import { useState } from 'react';

export function ImpersonateButton({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false);

  async function impersonate() {
    setLoading(true);
    await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    window.location.href = '/home';
  }

  return (
    <button
      onClick={impersonate}
      disabled={loading}
      className="px-4 py-2.5 border-2 border-bauhaus-black text-bauhaus-black font-black uppercase tracking-widest text-[10px] hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-50"
    >
      {loading ? 'Loading...' : 'Impersonate'}
    </button>
  );
}
