'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

  // Featured regions — high-gap areas to highlight
  const featuredRegions = [
    { postcode: '4000', label: 'Brisbane CBD', state: 'QLD' },
    { postcode: '4825', label: 'Mount Isa', state: 'QLD' },
    { postcode: '0870', label: 'Alice Springs', state: 'NT' },
    { postcode: '6725', label: 'Broome', state: 'WA' },
    { postcode: '4680', label: 'Gladstone', state: 'QLD' },
    { postcode: '2350', label: 'Armidale', state: 'NSW' },
    { postcode: '4870', label: 'Cairns', state: 'QLD' },
    { postcode: '2800', label: 'Orange', state: 'NSW' },
  ];

  return (
    <div className="max-w-3xl">
      <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Home
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black">Community Funding Map</h1>
        <p className="mt-2 text-bauhaus-muted font-medium leading-relaxed">
          Search any postcode to see where money goes — and who&apos;s missing. Understand the funding landscape for any community in Australia.
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-0 border-4 border-bauhaus-black">
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

      {/* Featured Regions */}
      <section>
        <h2 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
          Explore Regions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {featuredRegions.map((r) => (
            <Link
              key={r.postcode}
              href={`/places/${r.postcode}`}
              className="border-2 border-bauhaus-black/20 p-3 hover:border-bauhaus-black hover:bg-bauhaus-canvas transition-colors"
            >
              <div className="text-lg font-black text-bauhaus-black">{r.postcode}</div>
              <div className="text-xs font-bold text-bauhaus-muted">{r.label}</div>
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">{r.state}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="mt-8 bg-bauhaus-canvas border-4 border-bauhaus-black p-6">
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
