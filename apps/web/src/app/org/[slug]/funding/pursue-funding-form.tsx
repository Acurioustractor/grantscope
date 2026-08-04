'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PursueFundingForm({ projectCode, opportunityId, projectSlug, orgSlug }: { projectCode: string; opportunityId: string; projectSlug: string; orgSlug: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pursued, setPursued] = useState(false);

  async function submit(formData: FormData) {
    setPending(true); setMessage(null);
    try {
      const response = await fetch('/api/ops/funding/pursue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        projectCode, opportunityId,
        amountSought: Number(formData.get('amountSought')),
        applicantEntity: String(formData.get('applicantEntity') || ''),
        relationshipOwner: String(formData.get('relationshipOwner') || ''),
        nextAction: String(formData.get('nextAction') || ''),
        nextActionDue: String(formData.get('nextActionDue') || ''),
        grantscopeDecisionUrl: `/org/${orgSlug}/${projectSlug}/funding`,
        confirm: formData.get('confirm') === 'yes',
      }) });
      const payload = await response.json() as { error?: string; operation?: string; ghlOpportunityId?: string };
      if (!response.ok) throw new Error(payload.error || 'GHL handoff failed');
      setMessage(`GHL ${payload.operation}: ${payload.ghlOpportunityId}`);
      setPursued(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'GHL handoff failed'); }
    finally { setPending(false); }
  }

  async function createBrief() {
    setPending(true); setMessage(null);
    try { const response = await fetch('/api/ops/funding/notion-brief', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectCode, opportunityId, confirm: true }) }); const payload = await response.json() as { error?: string; operation?: string; pageUrl?: string }; if (!response.ok) throw new Error(payload.error || 'Notion brief failed'); setMessage(`Notion brief ${payload.operation}.`); if (payload.pageUrl) window.open(payload.pageUrl, '_blank', 'noopener,noreferrer'); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Notion brief failed'); } finally { setPending(false); }
  }

  return (
    <details className="mt-4 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]">
      <summary className="min-h-11 cursor-pointer list-none px-4 py-3 text-xs font-black uppercase tracking-wide text-[#183426]">Pursue → GHL</summary>
      <form action={submit} className="grid gap-3 border-t border-[#cbd5e1] p-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">Amount sought—not maximum<input name="amountSought" type="number" min="1" step="1" required className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3" /></label>
        <label className="text-xs font-semibold">Applicant entity<input name="applicantEntity" required className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3" /></label>
        <label className="text-xs font-semibold">Relationship owner<input name="relationshipOwner" required className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3" /></label>
        <label className="text-xs font-semibold">Next action due<input name="nextActionDue" type="date" required className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3" /></label>
        <label className="text-xs font-semibold sm:col-span-2">Next action<input name="nextAction" required className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3" /></label>
        <label className="flex min-h-11 items-center gap-3 text-xs sm:col-span-2"><input name="confirm" value="yes" type="checkbox" required className="h-5 w-5" />I confirm this exact ask, applicant, owner and next action should be written to GHL.</label>
        <button type="submit" disabled={pending} className="min-h-11 rounded bg-[#183426] px-4 py-3 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50 sm:col-span-2">{pending ? 'Writing…' : 'Confirm pursue'}</button>
        {pursued ? <button type="button" onClick={createBrief} disabled={pending} className="min-h-11 rounded border border-[#183426] bg-white px-4 py-3 text-xs font-black uppercase tracking-wide text-[#183426] disabled:opacity-50 sm:col-span-2">Create optional Notion brief</button> : null}
        {message ? <p role="status" className="text-xs text-[#475569] sm:col-span-2">{message}</p> : null}
      </form>
    </details>
  );
}
