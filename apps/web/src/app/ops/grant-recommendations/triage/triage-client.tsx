'use client';

import { useMemo, useState, useTransition } from 'react';
import { FunderDossier, type FunderContext } from '../funder-dossier';

export interface TriageRow {
  id: string;
  name: string;
  description: string | null;
  funder_name: string | null;
  source_url: string | null;
  application_url: string | null;
  deadline: string | null;
  min_grant_amount: number | null;
  max_grant_amount: number | null;
  focus_areas: string[] | null;
  keywords: string[] | null;
  jurisdictions: string[] | null;
  eligible_org_types: string[] | null;
  scrape_source: string | null;
  opportunity_type: string | null;
  verification_status: string | null;
  verification_notes: string | null;
  raw_data: Record<string, unknown> | null;
}

const TYPE_OPTIONS: Array<{ value: string; label: string; classes: string; hint: string }> = [
  { value: 'open_grant', label: 'Open Grant', classes: 'bg-green-600 text-white', hint: 'Public app channel, current round verified' },
  { value: 'invitation_only', label: 'Invite Only', classes: 'bg-bauhaus-yellow text-bauhaus-black', hint: 'Funder does not accept unsolicited' },
  { value: 'placeholder', label: 'Placeholder', classes: 'bg-gray-300 text-bauhaus-black', hint: 'Real funder, no current round visible' },
  { value: 'award', label: 'Award', classes: 'bg-gray-400 text-white', hint: 'Recognition, not a fundable program' },
  { value: 'policy_framework', label: 'Policy', classes: 'bg-bauhaus-red text-white', hint: 'Strategy / plan, not a grant channel' },
  { value: 'partnership', label: 'Partnership', classes: 'bg-bauhaus-red text-white', hint: 'Partnership program, not a grant' },
  { value: 'tender', label: 'Tender', classes: 'bg-bauhaus-red text-white', hint: 'Procurement, not a grant' },
];

function formatAmount(min: number | null, max: number | null): string {
  if (min != null && max != null) return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  if (max != null) return `≤ $${max.toLocaleString()}`;
  if (min != null) return `≥ $${min.toLocaleString()}`;
  return '—';
}

export function TriageClient({
  rows,
  contexts,
}: {
  rows: TriageRow[];
  contexts: FunderContext[];
}) {
  const [currentRows, setCurrentRows] = useState<TriageRow[]>(rows);

  const contextByFunder = useMemo(() => {
    const m = new Map<string, FunderContext>();
    for (const c of contexts) {
      m.set(c.funder_name, c);
      for (const alias of c.funder_aliases ?? []) m.set(alias, c);
    }
    return m;
  }, [contexts]);
  const [funderFilter, setFunderFilter] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [recentlyClassified, setRecentlyClassified] = useState<Map<string, string>>(new Map());

  const funders = useMemo(() => {
    const set = new Set<string>();
    for (const r of currentRows) if (r.funder_name) set.add(r.funder_name);
    return Array.from(set).sort();
  }, [currentRows]);

  const filtered = useMemo(() => {
    if (!funderFilter) return currentRows;
    return currentRows.filter((r) => r.funder_name === funderFilter);
  }, [currentRows, funderFilter]);

  async function classify(id: string, type: string) {
    setPendingId(id);
    startTransition(async () => {
      try {
        const res = await fetch('/api/ops/grant-recommendations/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opportunity_id: id, opportunity_type: type }),
        });
        if (!res.ok) throw new Error(await res.text());
        // Remove from the list (it's no longer unverified)
        setCurrentRows((prev) => prev.filter((r) => r.id !== id));
        setRecentlyClassified((prev) => new Map(prev).set(id, type));
      } catch (err) {
        console.error(err);
        alert(`Classify failed: ${(err as Error).message}`);
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight">
            Triage Promoted Opportunities
          </h1>
          <div className="text-sm text-bauhaus-muted mt-1">
            Classify rows from <span className="font-mono">grant_opportunities</span> promoted into{' '}
            <span className="font-mono">alma</span>. Only{' '}
            <span className="font-black">Open Grant</span> rows surface in /ops/grant-recommendations.
          </div>
        </div>
        <a
          href="/ops/grant-recommendations"
          className="px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-white hover:bg-bauhaus-canvas"
        >
          ← Recommendations
        </a>
      </div>

      {currentRows.length === 0 ? (
        <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-8 text-center">
          <div className="text-sm font-black uppercase tracking-widest text-bauhaus-muted">
            No unverified rows. Run the promotion script to add more candidates:
          </div>
          <div className="font-mono text-xs mt-3 text-bauhaus-black">
            node --env-file=.env scripts/promote-grant-opportunities-to-alma.mjs --limit=50
          </div>
        </div>
      ) : (
        <>
          <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-4 mb-6 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs font-black uppercase tracking-widest">Funder:</label>
              <select
                value={funderFilter}
                onChange={(e) => setFunderFilter(e.target.value)}
                className="border-2 border-bauhaus-black bg-white px-2 py-1 text-sm font-mono max-w-xs"
              >
                <option value="">All ({currentRows.length})</option>
                {funders.map((f) => (
                  <option key={f} value={f}>
                    {f} ({currentRows.filter((r) => r.funder_name === f).length})
                  </option>
                ))}
              </select>
            </div>
            <div className="ml-auto text-xs font-mono text-bauhaus-muted">
              {filtered.length} shown · {recentlyClassified.size} classified this session
            </div>
          </div>

          <div className="space-y-3">
            {filtered.map((row) => {
              const isLoading = pendingId === row.id && isPending;
              return (
                <div
                  key={row.id}
                  className="border-4 border-bauhaus-black bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <a
                        href={row.source_url ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-black text-bauhaus-black hover:text-bauhaus-blue text-sm leading-tight"
                      >
                        {row.name} ↗
                      </a>
                      <div className="text-xs text-bauhaus-muted mt-1">
                        {row.funder_name ?? 'Unknown funder'}
                      </div>
                    </div>
                    <div className="text-xs font-mono text-right shrink-0">
                      <div>{formatAmount(row.min_grant_amount, row.max_grant_amount)}</div>
                      <div className="text-bauhaus-muted">
                        {row.deadline ? new Date(row.deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : 'Rolling'}
                      </div>
                    </div>
                  </div>

                  {row.funder_name && (
                    <div className="mb-3">
                      <FunderDossier context={contextByFunder.get(row.funder_name) ?? null} />
                    </div>
                  )}

                  {row.description && (
                    <div className="text-xs text-bauhaus-black bg-bauhaus-canvas p-2 mb-3 line-clamp-3">
                      {row.description}
                    </div>
                  )}

                  {(row.focus_areas?.length ?? 0) > 0 && (
                    <div className="flex gap-1 flex-wrap mb-3">
                      {(row.focus_areas ?? []).slice(0, 8).map((fa) => (
                        <span key={fa} className="px-1.5 py-0.5 text-[10px] bg-bauhaus-canvas border border-bauhaus-black/30">
                          {fa}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-1 flex-wrap">
                    {TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => classify(row.id, opt.value)}
                        disabled={isLoading}
                        title={opt.hint}
                        className={`px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black hover:opacity-80 disabled:opacity-50 ${opt.classes}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
