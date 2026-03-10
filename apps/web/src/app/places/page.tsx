'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const FundingGapMap = dynamic(() => import('./funding-gap-map').then(m => ({ default: m.FundingGapMap })), {
  ssr: false,
  loading: () => (
    <div className="w-full border-4 border-bauhaus-black flex items-center justify-center" style={{ height: 550 }}>
      <div className="text-bauhaus-muted font-black text-sm uppercase tracking-widest animate-pulse">
        Loading map...
      </div>
    </div>
  ),
});

export default function PlacesPage() {
  const [postcode, setPostcode] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = postcode.trim().replace(/\D/g, '');
    if (cleaned.length === 4) {
      router.push(`/places/${cleaned}`);
    }
  };

  return (
    <div>
      <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Home
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black">Community Funding Map</h1>
        <p className="mt-2 text-bauhaus-muted font-medium leading-relaxed max-w-2xl">
          Search any postcode to see where money goes — and who&apos;s missing. Click any circle on the map to explore a community&apos;s funding landscape.
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-0 border-4 border-bauhaus-black max-w-lg">
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="Enter a postcode (e.g. 4000)"
            maxLength={4}
            pattern="\d{4}"
            className="flex-1 px-4 py-3 text-lg font-bold text-bauhaus-black placeholder:text-bauhaus-muted/50 focus:outline-none"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-bauhaus-black text-white font-black text-sm uppercase tracking-widest hover:bg-bauhaus-blue transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Map */}
      <section className="mb-8">
        <FundingGapMap />
      </section>

      {/* About */}
      <section className="bg-bauhaus-canvas border-4 border-bauhaus-black p-6 max-w-3xl">
        <h2 className="text-sm font-black text-bauhaus-black mb-3 uppercase tracking-widest">
          What is a Funding Gap Pack?
        </h2>
        <div className="space-y-3 text-sm font-medium text-bauhaus-muted leading-relaxed">
          <p>
            A funding gap pack shows you the complete picture of government grants, contracts, and political donations flowing into any postcode — and highlights where community-controlled organisations are missing from the funding landscape.
          </p>
          <p>
            We cross-reference ACNC charity data, AusTender contracts, AEC political donations, ORIC Indigenous corporations, and justice funding records to build a comprehensive view of money flows at the community level.
          </p>
          <p>
            <strong className="text-bauhaus-black">Free for communities.</strong> This data should be accessible to the people it affects most. Institutional users can access premium features through our <Link href="/pricing" className="text-bauhaus-blue hover:underline">paid tiers</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
