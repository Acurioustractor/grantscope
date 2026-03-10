'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const CapitalMap = dynamic(
  () => import('@/app/power/capital-map').then(m => ({ default: m.CapitalMap })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] bg-bauhaus-canvas border-4 border-bauhaus-black flex items-center justify-center">
        <div className="text-bauhaus-muted font-black text-sm uppercase tracking-widest animate-pulse">
          Loading Community Capital Map...
        </div>
      </div>
    ),
  }
);

export function FundingGapMapLoader() {
  const router = useRouter();

  return (
    <CapitalMap
      onSelectSA2={(sa2Code) => {
        if (sa2Code) router.push(`/power?sa2=${sa2Code}`);
      }}
    />
  );
}
