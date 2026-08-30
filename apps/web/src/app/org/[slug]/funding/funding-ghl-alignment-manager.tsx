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

type ReviewQueue = {
  summary: { total: number; recommended: number; ambiguous: number; none: number };
  projects: Array<{ code: string; name: string }>;
  items: Array<{
    ghlOpportunityId: string;
    opportunityName: string;
    classification: string;
    notionUrl: string | null;
    contact: { name: string | null; company: string | null; tags: string[]; projects: string[] } | null;
    suggestions: Array<{
      projectCode: string;
      projectName: string;
      confidence: number;
      verdict: 'recommended' | 'possible';
      evidence: Array<{ source: string; weight: number; detail: string }>;
    }>;
    recommendation: 'recommended' | 'ambiguous' | 'none';
  }>;
} | null;

export function FundingGhlAlignmentManager({
  latestRun,
  reviewQueue,
}: {
  latestRun: LatestRun;
  reviewQueue: ReviewQueue;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [choices, setChoices] = useState<Record<string, string>>(() => Object.fromEntries(
    (reviewQueue?.items || []).map(item => [item.ghlOpportunityId, item.suggestions[0]?.projectCode || ''])
  ));

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

  function selectRecommended() {
    const nextSelected: Record<string, boolean> = {};
    const nextChoices = { ...choices };
    for (const item of reviewQueue?.items || []) {
      if (item.recommendation !== 'recommended' || !item.suggestions[0]) continue;
      nextSelected[item.ghlOpportunityId] = true;
      nextChoices[item.ghlOpportunityId] = item.suggestions[0].projectCode;
    }
    setSelected(nextSelected);
    setChoices(nextChoices);
  }

  async function approveSelected() {
    const assignments = (reviewQueue?.items || []).flatMap(item => (
      selected[item.ghlOpportunityId] && choices[item.ghlOpportunityId]
        ? [{ ghlOpportunityId: item.ghlOpportunityId, projectCode: choices[item.ghlOpportunityId] }]
        : []
    ));
    if (!assignments.length) {
      setMessage('Select at least one reviewed project assignment.');
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch('/api/ops/funding/ghl-alignment/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: true, assignments }),
      });
      const payload = await response.json() as { applied?: number; failed?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Funding review batch failed');
      setMessage(`Applied ${payload.applied || 0} reviewed assignments; ${payload.failed || 0} failed safely.`);
      setSelected({});
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Funding review batch failed');
    } finally {
      setPending(false);
    }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;

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
      {reviewQueue?.items.length ? (
        <details className="rounded-lg border border-[#b8d2c5] bg-[#f8fafc]">
          <summary className="cursor-pointer list-none p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-[#183426]">Review all {reviewQueue.summary.total} project assignments</p>
                <p className="mt-1 text-xs text-[#64748b]">
                  {reviewQueue.summary.recommended} recommended · {reviewQueue.summary.ambiguous} ambiguous · {reviewQueue.summary.none} without evidence
                </p>
              </div>
              <span className="rounded-full bg-[#e7ef65] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#183426]">Open bulk queue</span>
            </div>
          </summary>
          <div className="border-t border-[#dbe4df] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-3xl text-xs leading-5 text-[#64748b]">
                Suggestions are evidence, not assignments. Select only the rows you have reviewed; approval writes the Notion relation first, then the governed sync applies GHL.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectRecommended}
                  disabled={pending}
                  className="min-h-11 rounded-lg border border-[#183426] bg-white px-4 py-3 text-xs font-black uppercase tracking-wide text-[#183426] disabled:opacity-60"
                >
                  Select {reviewQueue.summary.recommended} recommended
                </button>
                <button
                  type="button"
                  onClick={approveSelected}
                  disabled={pending || selectedCount === 0}
                  className="min-h-11 rounded-lg bg-[#183426] px-4 py-3 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50"
                >
                  {pending ? 'Applying reviewed batch…' : `Approve ${selectedCount} selected`}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-[#dbe4df] bg-white">
              <table className="w-full min-w-[920px] text-left text-xs">
                <thead className="bg-[#f1f8f5] text-[10px] uppercase tracking-wide text-[#475569]">
                  <tr>
                    <th className="px-3 py-3">Use</th>
                    <th className="px-3 py-3">GHL grant</th>
                    <th className="px-3 py-3">Contact context</th>
                    <th className="px-3 py-3">Evidence-ranked suggestion</th>
                    <th className="px-3 py-3">Reviewed project</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {reviewQueue.items.map(item => {
                    const top = item.suggestions[0];
                    const selectedProject = choices[item.ghlOpportunityId] || '';
                    return (
                      <tr key={item.ghlOpportunityId} className={selected[item.ghlOpportunityId] ? 'bg-[#f7fee7]' : ''}>
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={Boolean(selected[item.ghlOpportunityId])}
                            disabled={!selectedProject || pending}
                            onChange={event => setSelected(current => ({ ...current, [item.ghlOpportunityId]: event.target.checked }))}
                            aria-label={`Approve project assignment for ${item.opportunityName}`}
                            className="h-5 w-5 accent-[#183426]"
                          />
                        </td>
                        <td className="max-w-xs px-3 py-3 align-top">
                          <p className="font-bold text-[#0f172a]">{item.opportunityName}</p>
                          <p className="mt-1 font-mono text-[9px] uppercase text-[#64748b]">{item.classification.replaceAll('_', ' ')}</p>
                          {item.notionUrl ? <a href={item.notionUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-[#1f734f] hover:underline">Notion page ↗</a> : null}
                        </td>
                        <td className="max-w-xs px-3 py-3 align-top text-[#475569]">
                          <p className="font-semibold">{item.contact?.name || item.contact?.company || 'No linked contact context'}</p>
                          {item.contact?.company && item.contact.company !== item.contact.name ? <p>{item.contact.company}</p> : null}
                          {item.contact?.projects.length ? <p className="mt-1 font-mono text-[9px]">Projects: {item.contact.projects.join(', ')}</p> : null}
                        </td>
                        <td className="max-w-sm px-3 py-3 align-top">
                          <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                            item.recommendation === 'recommended'
                              ? 'bg-[#dcfce7] text-[#166534]'
                              : item.recommendation === 'ambiguous'
                                ? 'bg-[#fef3c7] text-[#92400e]'
                                : 'bg-[#e2e8f0] text-[#475569]'
                          }`}>
                            {item.recommendation}
                          </span>
                          {top ? (
                            <>
                              <p className="mt-2 font-bold">{top.projectCode} · {top.projectName} · {Math.round(top.confidence * 100)}%</p>
                              <ul className="mt-1 grid gap-1 text-[10px] leading-4 text-[#64748b]">
                                {top.evidence.slice(0, 2).map(evidence => <li key={`${evidence.source}:${evidence.detail}`}>{evidence.detail}</li>)}
                              </ul>
                            </>
                          ) : <p className="mt-2 text-[#64748b]">No defensible automated suggestion.</p>}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <select
                            value={selectedProject}
                            disabled={pending}
                            onChange={event => {
                              const projectCode = event.target.value;
                              setChoices(current => ({ ...current, [item.ghlOpportunityId]: projectCode }));
                              if (!projectCode) setSelected(current => ({ ...current, [item.ghlOpportunityId]: false }));
                            }}
                            className="min-h-11 w-full min-w-48 rounded border border-[#cbd5e1] bg-white px-3 py-2 font-semibold text-[#183426]"
                          >
                            <option value="">Choose project…</option>
                            {reviewQueue.projects.map(project => (
                              <option key={project.code} value={project.code}>{project.code} · {project.name}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      ) : null}
      {message ? <p role="status" className="text-xs font-semibold text-[#1f734f]">{message}</p> : null}
    </div>
  );
}
