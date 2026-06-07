import { permanentRedirect } from 'next/navigation';

/**
 * Superseded by the need-first search front door at /suppliers
 * (buyer-wedge move 2, 2026-06-08). Forwards q/state so old links keep working.
 */
export default async function LegacySupplierFinderPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.state) qs.set('state', params.state);
  const suffix = qs.toString();
  permanentRedirect(`/suppliers${suffix ? `?${suffix}` : ''}`);
}
