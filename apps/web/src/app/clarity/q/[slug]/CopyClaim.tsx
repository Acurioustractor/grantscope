'use client';

import { useState } from 'react';

/**
 * [ COPY THE CLAIM ]
 *
 * The point of this button is that the sentence which leaves the building is the sentence the
 * registry approved, with its caveat and its exclusion filter attached. Copying just the number
 * is how "85.1% of organisations have no evidence" ends up in a deck, which is a claim about
 * those organisations rather than about this database.
 *
 * The composed text is built here rather than server-side only because the user may have nothing
 * but the clipboard — no download, no share link, no round trip.
 */
export default function CopyClaim({
  claim,
  headline,
  headlineSub,
  caveat,
  exclusions,
  coverage,
  computedAt,
  url,
}: {
  claim: string;
  headline: string | null;
  headlineSub: string | null;
  caveat: string;
  exclusions: string;
  coverage: string | null;
  computedAt: string | null;
  url: string;
}) {
  const [copied, setCopied] = useState(false);

  const text = [
    headline ? `${headline}${headlineSub ? ` — ${headlineSub}` : ''}` : null,
    claim,
    '',
    `CAVEAT: ${caveat}`,
    `FILTER (deterministic, not a sample): ${exclusions}`,
    coverage ? `COVERAGE: ${coverage}` : null,
    computedAt ? `COMPUTED: ${computedAt.slice(0, 16).replace('T', ' ')} UTC` : null,
    `SOURCE: CivicGraph ${url}`,
  ]
    .filter((l) => l !== null)
    .join('\n');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="border-2 border-bauhaus-black bg-bauhaus-white px-3 py-1.5 font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-yellow"
    >
      {copied ? 'Copied with its caveat' : 'Copy the claim'}
    </button>
  );
}
