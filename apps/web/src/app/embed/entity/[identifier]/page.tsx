import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  CivicGraphEntityCard,
  type CivicGraphEntityCardData,
} from '@/components/civicgraph-entity-card';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CivicGraph Entity Card',
  robots: { index: false, follow: false },
};

/**
 * Iframe-embed route for the CivicGraph entity card.
 *
 * Usage in Empathy Ledger, Goods, or partner sites:
 *   <iframe src="https://civicgraph.com.au/embed/entity/12345678901"
 *           style="width:100%; height:280px; border:0;" />
 *
 * Accepts ABN (11 digits) or gs_id. Returns a minimal HTML shell with only
 * the card so it renders cleanly inside an iframe at any width.
 */
export default async function EntityEmbedPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;

  const origin = process.env.NEXT_PUBLIC_SITE_URL
    || process.env.VERCEL_URL
    || 'http://localhost:3003';
  const baseUrl = origin.startsWith('http') ? origin : `https://${origin}`;

  let data: CivicGraphEntityCardData | null = null;
  try {
    const res = await fetch(
      `${baseUrl}/api/data/entity/${encodeURIComponent(identifier)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      if (res.status === 404) notFound();
      throw new Error(`Upstream ${res.status}`);
    }
    data = await res.json();
  } catch {
    notFound();
  }

  if (!data) notFound();

  return (
    <main className="min-h-screen bg-transparent p-2">
      <CivicGraphEntityCard data={data} variant="full" />
    </main>
  );
}
