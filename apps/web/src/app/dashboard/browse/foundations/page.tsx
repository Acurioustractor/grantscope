import { redirect } from 'next/navigation';

/**
 * The index moved to its public URL, /foundations, and kept the Shell layout with it.
 *
 * It lived here and at /foundations simultaneously — two indexes over identical data, one a thin
 * config over the shared browser and one bespoke. The shared one won; putting it at the
 * already-ranked public URL rather than redirecting that URL here keeps the link equity and
 * stops a visitor's entry point reading as "dashboard".
 *
 * Temporary (307): nothing has burned this path, and the detail page below it still lives here.
 */
export default async function MovedBrowseFoundations({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Keep the query string: a filter or sort link built against the old path must land filtered, not reset.
  const sp = await searchParams;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string' && v) p.set(k, v);
  const s = p.toString();
  redirect(`/foundations${s ? `?${s}` : ''}`);
}
