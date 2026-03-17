'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StartPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      const res = await fetch('/api/start', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create session');
      const data = await res.json();
      router.push(`/start/${data.id}`);
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b-4 border-bauhaus-black px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black uppercase tracking-widest text-bauhaus-black">
              CivicGraph
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mt-0.5">
              Innovation Guide
            </p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-wider text-bauhaus-black leading-tight">
            Turn your idea into<br />
            <span className="text-bauhaus-red">a real organisation</span>
          </h2>

          <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-xl mx-auto">
            Our AI guide will help you understand the landscape, find the right
            structure, match evidence-based approaches, and connect you with
            funding — all backed by real Australian data.
          </p>

          <div className="mt-10 flex flex-col items-center gap-6">
            <button
              onClick={handleStart}
              disabled={loading}
              className="bg-bauhaus-black text-white px-10 py-4 text-lg font-black uppercase tracking-widest
                hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all
                border-4 border-bauhaus-black hover:border-gray-800"
            >
              {loading ? 'Starting...' : 'Start Your Journey'}
            </button>

            <p className="text-xs text-gray-400 max-w-sm">
              Free. No account required. Your session is saved so you can come back anytime.
            </p>
          </div>

          {/* Feature cards */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <FeatureCard
              number="01"
              title="Understand the Landscape"
              description="See what already exists. 100,000+ organisations, mapped and connected."
            />
            <FeatureCard
              number="02"
              title="Find Your Structure"
              description="Charity, social enterprise, ORIC, co-op — get a personalised recommendation."
            />
            <FeatureCard
              number="03"
              title="Match Funding"
              description="18,000+ grants, 10,800+ foundations, and evidence-based approaches from ALMA."
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-gray-400">
          <p>Powered by CivicGraph — Decision Infrastructure for Government & Social Sector</p>
          <p>Data: ACNC, AusTender, ALMA, GrantConnect, ATO</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="border-2 border-gray-200 p-5 hover:border-bauhaus-black transition-colors">
      <p className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-red">{number}</p>
      <h3 className="text-sm font-black uppercase tracking-wider text-bauhaus-black mt-2">{title}</h3>
      <p className="text-xs text-gray-500 mt-2 leading-relaxed">{description}</p>
    </div>
  );
}
