'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useShortlist } from './shortlist-context';

/**
 * Floating shortlist pill — the visible thread of the buyer flow. Appears the
 * moment a buyer adds their first supplier and follows them across pages, with
 * a one-click path into the Tender Intelligence Pack. Hidden on the tender-pack
 * page itself (where the shortlist is already in view).
 */
export function ShortlistBar() {
  const { count, hydrated, clear } = useShortlist();
  const pathname = usePathname();

  if (!hydrated || count === 0) return null;
  if (pathname?.startsWith('/procurement/tender-pack')) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-stretch border-4 border-bauhaus-black bg-bauhaus-black shadow-[6px_6px_0_rgba(18,18,18,0.25)]">
      <Link
        href="/procurement/tender-pack"
        className="group flex items-center gap-3 px-5 py-3 hover:bg-bauhaus-blue transition-colors"
      >
        <span className="flex h-7 min-w-7 items-center justify-center bg-bauhaus-yellow px-2 text-sm font-black text-bauhaus-black">
          {count}
        </span>
        <span className="text-xs font-black uppercase tracking-widest text-white">
          {count === 1 ? 'Supplier' : 'Suppliers'} in tender pack
        </span>
        <span className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow group-hover:translate-x-1 transition-transform">
          Build pack →
        </span>
      </Link>
      <button
        type="button"
        onClick={clear}
        title="Clear shortlist"
        className="border-l-4 border-white/20 px-3 text-white/50 hover:bg-bauhaus-red hover:text-white transition-colors text-sm font-black"
      >
        ✕
      </button>
    </div>
  );
}
