'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function PromoteNotionButton({ grantId, initialUrl, projectCode, fundingBlockIds, onPromoted }: { grantId: string; initialUrl?: string | null; projectCode?: string; fundingBlockIds?: string[]; onPromoted?: (url: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pageUrl, setPageUrl] = useState(initialUrl || null);
  const [error, setError] = useState<string | null>(null);
  if (pageUrl) return <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-black text-bauhaus-blue hover:underline">In Notion <span aria-hidden="true">↗</span></a>;

  async function promote() {
    setBusy(true); setError(null);
    try {
      const response = await fetch('/api/goods/grants/promote-notion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grantId, projectCode, fundingBlockIds }) });
      const result = await response.json() as { pageUrl?: string; error?: string };
      if (!response.ok || !result.pageUrl) throw new Error(result.error || 'Promotion failed');
      setPageUrl(result.pageUrl); onPromoted?.(result.pageUrl); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Promotion failed'); }
    finally { setBusy(false); }
  }

  return <span className="inline-flex max-w-56 flex-col items-start gap-1">
    <button type="button" onClick={promote} disabled={busy} title="Promote this qualified opportunity to the canonical Notion database" className="inline-flex items-center gap-1 border-2 border-bauhaus-black bg-bauhaus-yellow px-2 py-1 font-black uppercase hover:bg-bauhaus-black hover:text-white disabled:opacity-50">
      {busy && <span aria-hidden="true" className="size-3 animate-spin border-2 border-current border-r-transparent" />}
      {busy ? 'Promoting' : 'Promote'}
    </button>
    {error && <span className="whitespace-normal text-[9px] font-bold leading-tight text-bauhaus-red">{error}</span>}
  </span>;
}
