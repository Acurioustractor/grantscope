'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { TriageGrantRow } from '@/lib/services/goods-grants-triage';
import { PromoteNotionButton } from './promote-notion-button';

function money(value: number | null) {
  if (!value || value <= 0) return '—';
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${Math.round(value / 1e3)}K`;
  return `$${Math.round(value)}`;
}

function Deadline({ days }: { days: number | null }) {
  if (days == null) return <span className="text-[10px] font-bold text-gray-400">rolling / undated</span>;
  const colour = days <= 14 ? 'bg-bauhaus-red text-white' : days <= 45 ? 'bg-bauhaus-yellow' : 'bg-bauhaus-canvas border-2 border-bauhaus-black/20';
  return <span className={`px-1.5 py-0.5 font-mono text-[10px] font-black uppercase ${colour}`}>{days === 0 ? 'today' : `${days}d`}</span>;
}

function promotionWarnings(grant: TriageGrantRow) {
  return [
    !grant.lastVerifiedAt ? 'Verification date missing' : null,
    grant.lastVerifiedAt && Date.now() - new Date(grant.lastVerifiedAt).getTime() > 30 * 86_400_000 ? 'Verification is older than 30 days' : null,
    (grant.goodsScore ?? 0) < 60 ? 'Goods fit is below 60' : null,
    !grant.acceptsPtyLtd && !grant.dgrRequired ? 'Applicant route needs confirmation' : null,
    !grant.url ? 'Official source URL missing' : null,
  ].filter(Boolean) as string[];
}

const PROJECTS = [
  ['ACT', 'ACT-wide'], ['ACT-GD', 'Goods on Country'], ['ACT-JH', 'JusticeHub'],
  ['ACT-EL', 'Empathy Ledger'], ['ACT-CG', 'CivicGraph'], ['ACT-HV', 'The Harvest'], ['ACT-CT', 'Contained'],
] as const;

const DISMISSAL_REASONS = [
  ['wrong_project', 'Wrong project'], ['wrong_geography', 'Wrong geography'], ['ineligible_entity', 'Ineligible entity'],
  ['unsupported_costs', 'Does not fund what we need'], ['amount_too_small', 'Amount too small'],
  ['founder_load', 'Too much effort for likely return'], ['duplicate', 'Duplicate'], ['stale_or_closed', 'Stale or closed'],
  ['not_strategic', 'Not strategically relevant'], ['other', 'Other'],
] as const;

export function GrantReviewTable({ grants, orgProfileId, fundingBlocks }: { grants: TriageGrantRow[]; orgProfileId: string; fundingBlocks: Array<{ id: string; code: string; name: string; amountMinAud: number; amountMaxAud: number }> }) {
  const router = useRouter();
  const [selected, setSelected] = useState<TriageGrantRow | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [projectCode, setProjectCode] = useState('ACT-GD');
  const [fundingBlockIds, setFundingBlockIds] = useState<string[]>([]);
  const [dismissalReason, setDismissalReason] = useState('not_strategic');

  async function reject(grant: TriageGrantRow, reasonCode = 'not_strategic', decisionProjectCode = 'ACT-GD') {
    setRejecting(true); setError(null); setNotice(null);
    try {
      const response = await fetch('/api/goods/grants/not-relevant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grantId: grant.id, orgProfileId, reasonCode, projectCode: decisionProjectCode }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Could not record decision');
      setRemovedIds(ids => [...ids, grant.id]); setSelected(null); setNotice(`Dismissed: ${grant.name}`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not record decision'); }
    finally { setRejecting(false); }
  }

  async function restore(grant: TriageGrantRow) {
    setRejecting(true); setError(null); setNotice(null);
    try {
      const response = await fetch('/api/goods/grants/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grantId: grant.id, orgProfileId }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Could not restore opportunity');
      setRemovedIds(ids => [...ids, grant.id]); setSelected(null); setNotice(`Restored for review: ${grant.name}`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not restore opportunity'); }
    finally { setRejecting(false); }
  }

  return <>
    {notice && <div role="status" className="mb-3 flex items-center justify-between border-2 border-bauhaus-black bg-bauhaus-yellow p-3 text-xs font-black uppercase"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification" className="ml-3 text-lg leading-none">×</button></div>}
    {error && !selected && <div role="alert" className="mb-3 border-2 border-bauhaus-red bg-red-50 p-3 text-xs font-bold text-bauhaus-red">{error}</div>}
    <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
      <table className="w-full min-w-[760px] text-xs">
        <thead className="bg-bauhaus-black text-white"><tr>{['Due', 'Opportunity', 'Fit', 'Amount', 'Route', 'Decision'].map(label => <th key={label} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">{label}</th>)}</tr></thead>
        <tbody>{grants.filter(grant => !removedIds.includes(grant.id)).length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">Nothing matches this view.</td></tr> : grants.filter(grant => !removedIds.includes(grant.id)).map((grant, index) => <tr key={grant.id} onClick={() => { setSelected(grant); setError(null); setProjectCode('ACT-GD'); setFundingBlockIds([]); setDismissalReason('not_strategic'); }} className={`${index % 2 ? 'bg-bauhaus-canvas' : ''} cursor-pointer hover:bg-bauhaus-yellow/30`}>
          <td className="border-b border-gray-300 px-2 py-2"><Deadline days={grant.daysToDeadline} /></td>
          <td className="max-w-xl border-b border-gray-300 px-3 py-3"><span className="block font-black">{grant.name}</span><span className="mt-1 block text-[10px] text-bauhaus-muted">{grant.provider || 'Provider unknown'} · {grant.geography}</span></td>
          <td className="border-b border-gray-300 px-2 py-2 font-mono font-black">{grant.goodsScore ?? '—'}</td>
          <td className="border-b border-gray-300 px-2 py-2 font-mono">{grant.amountMax ? `${money(grant.amountMin)}–${money(grant.amountMax)}` : money(grant.amountMin)}</td>
          <td className="border-b border-gray-300 px-2 py-2">{grant.dgrRequired ? 'Via Butterfly' : grant.acceptsPtyLtd ? 'Pty OK' : 'Check'}</td>
          <td className="border-b border-gray-300 px-2 py-2" onClick={event => event.stopPropagation()}>
            <div className="flex min-w-44 flex-wrap gap-1">
              {grant.reviewState === 'dismissed' ? (
                <button type="button" onClick={() => restore(grant)} disabled={rejecting} className="border-2 border-bauhaus-black bg-white px-2 py-1 text-[9px] font-black uppercase hover:bg-bauhaus-blue hover:text-white">Restore</button>
              ) : <>
                <PromoteNotionButton grantId={grant.id} initialUrl={grant.notionPageUrl} />
                {!grant.notionPageUrl && <button type="button" onClick={() => reject(grant)} disabled={rejecting} className="border-2 border-bauhaus-black bg-white px-2 py-1 text-[9px] font-black uppercase hover:bg-bauhaus-red hover:text-white">Not relevant</button>}
              </>}
            </div>
          </td>
        </tr>)}</tbody>
      </table>
    </div>

    {selected && <div className="fixed inset-0 z-50 bg-bauhaus-black/40" onClick={() => setSelected(null)}>
      <aside role="dialog" aria-modal="true" aria-label={selected.name} onClick={event => event.stopPropagation()} className="ml-auto flex h-full w-full max-w-xl flex-col overflow-y-auto border-l-4 border-bauhaus-black bg-white shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between border-b-4 border-bauhaus-black bg-bauhaus-yellow p-5">
          <div><p className="text-[10px] font-black uppercase tracking-widest">Grant review</p><h2 className="mt-2 text-xl font-black uppercase leading-tight">{selected.name}</h2></div>
          <button type="button" onClick={() => setSelected(null)} aria-label="Close grant details" className="size-9 border-2 border-bauhaus-black bg-white text-xl font-black">×</button>
        </div>
        <div className="flex-1 space-y-6 p-5">
          <div className="grid grid-cols-2 gap-px border-2 border-bauhaus-black bg-bauhaus-black">
            {[['Provider', selected.provider || 'Unknown'], ['Fit', selected.goodsScore ?? 'Unscored'], ['Amount', selected.amountMax ? `${money(selected.amountMin)}–${money(selected.amountMax)}` : money(selected.amountMin)], ['Deadline', selected.deadline || 'Rolling / unknown'], ['Geography', selected.geography], ['Applicant', selected.dgrRequired ? 'Butterfly Movement Ltd' : selected.acceptsPtyLtd ? 'A Curious Tractor Pty Ltd' : 'Needs confirmation']].map(([label, value]) => <div key={String(label)} className="bg-white p-3"><p className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</p><p className="mt-1 font-bold">{value}</p></div>)}
          </div>
          <section><h3 className="text-xs font-black uppercase tracking-widest">About</h3><p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">{selected.description || 'No description has been captured yet.'}</p></section>
          <section><h3 className="text-xs font-black uppercase tracking-widest">Eligibility and requirements</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-bauhaus-muted">{selected.requirementsSummary || 'Requirements still need verification.'}</p></section>
          {!selected.notionPageUrl && <section className="space-y-4 border-t-4 border-bauhaus-black pt-5">
            {promotionWarnings(selected).length > 0 && <div className="border-2 border-bauhaus-black bg-bauhaus-yellow p-3">
              <p className="text-[10px] font-black uppercase tracking-widest">Promotion warnings</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs font-bold">{promotionWarnings(selected).map(warning => <li key={warning}>{warning}</li>)}</ul>
              <p className="mt-2 text-[10px] font-bold">These remain attached to the promotion record. They do not prevent a human decision to promote.</p>
            </div>}
            <div>
              <label htmlFor="grant-project" className="text-xs font-black uppercase tracking-widest">ACT project</label>
              <select id="grant-project" value={projectCode} onChange={event => { setProjectCode(event.target.value); if (event.target.value !== 'ACT-GD') setFundingBlockIds([]); }} className="mt-2 w-full border-2 border-bauhaus-black bg-white p-2 text-sm font-bold">
                {PROJECTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            {projectCode === 'ACT-GD' && <div>
              <p className="text-xs font-black uppercase tracking-widest">Goods funding blocks</p>
              <div className="mt-2 divide-y-2 divide-bauhaus-black border-2 border-bauhaus-black">
                {fundingBlocks.map(block => <label key={block.id} className="flex cursor-pointer items-start gap-3 p-3 hover:bg-bauhaus-canvas">
                  <input type="checkbox" checked={fundingBlockIds.includes(block.id)} onChange={() => setFundingBlockIds(ids => ids.includes(block.id) ? ids.filter(id => id !== block.id) : [...ids, block.id])} className="mt-0.5 size-4 accent-black" />
                  <span><span className="block text-xs font-black uppercase">{block.name}</span><span className="text-[10px] text-bauhaus-muted">{money(block.amountMinAud)}–{money(block.amountMaxAud)} required</span></span>
                </label>)}
              </div>
              <p className="mt-2 text-[10px] font-bold text-bauhaus-muted">Selecting blocks creates a Goods funding matter and route. Exact allocation amounts remain for human review.</p>
            </div>}
            <div>
              <label htmlFor="dismissal-reason" className="text-xs font-black uppercase tracking-widest">If dismissing, why?</label>
              <select id="dismissal-reason" value={dismissalReason} onChange={event => setDismissalReason(event.target.value)} className="mt-2 w-full border-2 border-bauhaus-black bg-white p-2 text-sm font-bold">
                {DISMISSAL_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </section>}
          <p className="text-xs font-bold text-bauhaus-muted">Last verified: {selected.lastVerifiedAt ? new Date(selected.lastVerifiedAt).toLocaleDateString('en-AU') : 'not recorded'}</p>
          {selected.url && <a href={selected.url} target="_blank" rel="noopener noreferrer" className="inline-block border-b-2 border-bauhaus-black font-black">Open official source ↗</a>}
          {error && <p className="border-2 border-bauhaus-red bg-red-50 p-3 text-xs font-bold text-bauhaus-red">{error}</p>}
        </div>
        <div className="sticky bottom-0 flex flex-wrap gap-3 border-t-4 border-bauhaus-black bg-white p-5">
          {selected.reviewState === 'dismissed' ? (
            <button type="button" onClick={() => restore(selected)} disabled={rejecting} className="border-2 border-bauhaus-black bg-white px-3 py-2 text-xs font-black uppercase hover:bg-bauhaus-blue hover:text-white disabled:opacity-50">{rejecting ? 'Saving' : 'Restore'}</button>
          ) : <>
            <PromoteNotionButton grantId={selected.id} initialUrl={selected.notionPageUrl} projectCode={projectCode} fundingBlockIds={fundingBlockIds} onPromoted={() => setNotice(`Promoted: ${selected.name}`)} />
            {!selected.notionPageUrl && <button type="button" onClick={() => reject(selected, dismissalReason, projectCode)} disabled={rejecting} className="border-2 border-bauhaus-black bg-white px-3 py-2 text-xs font-black uppercase hover:bg-bauhaus-red hover:text-white disabled:opacity-50">{rejecting ? 'Saving' : 'Not relevant'}</button>}
          </>}
        </div>
      </aside>
    </div>}
  </>;
}
