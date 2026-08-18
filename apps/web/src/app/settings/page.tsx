'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import Link from 'next/link';

export default function SettingsPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">Loading...</div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="border-4 border-bauhaus-black p-12 text-center max-w-md">
          <h1 className="text-3xl font-black uppercase tracking-widest mb-4">Sign In Required</h1>
          <p className="text-bauhaus-muted mb-6">Your account and quick links.</p>
          <Link href="/auth/login" className="inline-block bg-bauhaus-black text-white px-8 py-3 font-bold uppercase tracking-wider hover:bg-bauhaus-red transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
        {/* Header */}
        <h1 className="text-4xl font-black uppercase tracking-widest mb-2">Settings</h1>
        <p className="text-bauhaus-muted mb-8">Account: {user.email}</p>

        {/* Quick Links */}
        <section>
          <h2 className="text-2xl font-black uppercase tracking-wider mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/alerts" className="border-2 border-bauhaus-black p-4 text-center hover:bg-gray-50 transition-colors">
              <p className="font-bold uppercase tracking-wider text-sm">Alerts</p>
              <p className="text-xs text-bauhaus-muted">Grant notifications</p>
            </Link>
            <Link href="/tracker" className="border-2 border-bauhaus-black p-4 text-center hover:bg-gray-50 transition-colors">
              <p className="font-bold uppercase tracking-wider text-sm">My Grants</p>
              <p className="text-xs text-bauhaus-muted">Track applications</p>
            </Link>
            <Link href="/grants" className="border-2 border-bauhaus-black p-4 text-center hover:bg-gray-50 transition-colors">
              <p className="font-bold uppercase tracking-wider text-sm">Search</p>
              <p className="text-xs text-bauhaus-muted">Find grants</p>
            </Link>
            <Link href="/entities" className="border-2 border-bauhaus-black p-4 text-center hover:bg-gray-50 transition-colors">
              <p className="font-bold uppercase tracking-wider text-sm">Entities</p>
              <p className="text-xs text-bauhaus-muted">Organisation dossiers</p>
            </Link>
          </div>
        </section>
    </div>
  );
}
