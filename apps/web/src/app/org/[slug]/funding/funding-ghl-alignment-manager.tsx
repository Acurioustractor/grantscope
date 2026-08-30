'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type LatestRun = {
  status?: string;
  ghl_opportunities?: number;
  inbox_pages_created?: number;
  mappings_applied?: number;
  already_aligned?: number;
  blocked?: number;
  completed_at?: string | null;
} | null;

export function FundingGhlAlignmentManager({ latestRun }: { latestRun: LatestRun }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runAlignment() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch('/api/ops/funding/ghl-alignment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const payload = await response.json() as {
        alignment?: { mappingsApplied?: number; inboxPagesCreated?: number; blocked?: number } | null;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'Funding alignment failed');
      if (!payload.alignment) {
        setMessage('A scheduled sync is already running. No second alignment was started.');
      } else {
        setMessage(
          `Aligned ${payload.alignment.mappingsApplied || 0}, created ${payload.alignment.inboxPagesCreated || 0} inbox pages, blocked ${payload.alignment.blocked || 0} unsafe matches.`
        );
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Funding alignment failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">
        {[
          ['GHL grants', latestRun?.ghl_opportunities || 0],
          ['Inbox created', latestRun?.inbox_pages_created || 0],
          ['Applied', latestRun?.mappings_applied || 0],
          ['Already aligned', latestRun?.already_aligned || 0],
          ['Needs review', latestRun?.blocked || 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded bg-[#f1f8f5] p-3">
            <dt className="text-[#64748b]">{label}</dt>
            <dd className="mt-1 text-lg font-black text-[#183426]">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-xs leading-5 text-[#64748b]">
          Assign the <strong>🗂️ Projects</strong> relation in Notion. The next run applies the canonical project code to GHL. Title collisions and conflicting codes remain blocked for review.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="https://app.notion.com/p/bfa94a53aceb47fab99b63c52b8077b6?v=5da2023ea9344e63a27f6a0faae45d23"
            target="_blank"
            rel="noreferrer"
            className="min-h-11 rounded-lg border border-[#b8d2c5] bg-white px-4 py-3 text-xs font-black uppercase tracking-wide text-[#183426]"
          >
            Open Notion inbox ↗
          </a>
          <button
            type="button"
            onClick={runAlignment}
            disabled={pending}
            className="min-h-11 rounded-lg bg-[#183426] px-4 py-3 text-xs font-black uppercase tracking-wide text-white disabled:opacity-60"
          >
            {pending ? 'Aligning all grants…' : 'Run portfolio alignment'}
          </button>
        </div>
      </div>
      {message ? <p role="status" className="text-xs font-semibold text-[#1f734f]">{message}</p> : null}
    </div>
  );
}
