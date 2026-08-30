'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApplicantRouteOption } from '@/lib/services/funding-applicant-registry';

export function PursueFundingForm({ projectCode, opportunityId, projectSlug, orgSlug, applicantRoutes, ghlUsers }: { projectCode: string; opportunityId: string; projectSlug: string; orgSlug: string; applicantRoutes: ApplicantRouteOption[]; ghlUsers: Array<{ id: string; name: string; email: string | null }> }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pursued, setPursued] = useState(false);
  const [notionUrl, setNotionUrl] = useState<string | null>(null);
  const eligibleRoutes = applicantRoutes.filter(route => route.eligible);
  const selectedRouteId = eligibleRoutes.find(route => route.isDefault)?.routeId || eligibleRoutes[0]?.routeId || '';

  async function submit(formData: FormData) {
    setPending(true); setMessage(null);
    try {
      const response = await fetch('/api/ops/funding/pursue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        projectCode, opportunityId,
        amountSought: Number(formData.get('amountSought')),
        applicantRouteId: String(formData.get('applicantRouteId') || ''),
        relationshipOwnerId: String(formData.get('relationshipOwnerId') || ''),
        funderContactEmail: String(formData.get('funderContactEmail') || ''),
        nextAction: String(formData.get('nextAction') || ''),
        nextActionDue: String(formData.get('nextActionDue') || ''),
        grantscopeDecisionUrl: `/org/${orgSlug}/${projectSlug}/funding`,
        confirm: formData.get('confirm') === 'yes',
      }) });
      const payload = await response.json() as {
        error?: string;
        operation?: string;
        ghlOpportunityId?: string;
        notionBrief?: { operation?: string; pageUrl?: string } | null;
        notionWarning?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'GHL handoff failed');
      const briefUrl = payload.notionBrief?.pageUrl || null;
      setNotionUrl(briefUrl);
      setMessage(
        briefUrl
          ? `GHL ${payload.operation}. Notion application workspace ${payload.notionBrief?.operation}.`
          : `GHL ${payload.operation}. Notion needs attention: ${payload.notionWarning || 'workspace was not created'}`
      );
      setPursued(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'GHL handoff failed'); }
    finally { setPending(false); }
  }

  async function createBrief() {
    setPending(true); setMessage(null);
    try { const response = await fetch('/api/ops/funding/notion-brief', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectCode, opportunityId, confirm: true }) }); const payload = await response.json() as { error?: string; operation?: string; pageUrl?: string }; if (!response.ok) throw new Error(payload.error || 'Notion brief failed'); setMessage(`Notion application workspace ${payload.operation}.`); setNotionUrl(payload.pageUrl || null); if (payload.pageUrl) window.open(payload.pageUrl, '_blank', 'noopener,noreferrer'); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Notion brief failed'); } finally { setPending(false); }
  }

  return (
    <details className="mt-4 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]">
      <summary className="min-h-11 cursor-pointer list-none px-4 py-3 text-xs font-black uppercase tracking-wide text-[#183426]">Pursue → GHL</summary>
      <form action={submit} className="grid gap-3 border-t border-[#cbd5e1] p-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">Amount sought—not maximum<input name="amountSought" type="number" min="1" step="1" required className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3" /></label>
        <label className="text-xs font-semibold">Canonical applicant route<select name="applicantRouteId" required defaultValue={selectedRouteId} disabled={!eligibleRoutes.length} className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3 disabled:bg-[#e2e8f0]">
          {!eligibleRoutes.length ? <option value="">No eligible route</option> : null}
          {applicantRoutes.map(route => <option key={route.routeId} value={route.routeId} disabled={!route.eligible}>{route.entityName} · {route.routeType} · ABN {route.abn || 'missing'}{route.dgrStatus === 'endorsed' ? ' · DGR' : ''}{route.eligible ? '' : ' · blocked'}</option>)}
        </select></label>
        <label className="text-xs font-semibold">Native GHL owner<select name="relationshipOwnerId" required defaultValue="" disabled={!ghlUsers.length} className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3 disabled:bg-[#e2e8f0]">
          <option value="" disabled>{ghlUsers.length ? 'Select the accountable owner' : 'GHL users unavailable'}</option>
          {ghlUsers.map(user => <option key={user.id} value={user.id}>{user.name}{user.email ? ` · ${user.email}` : ''}</option>)}
        </select></label>
        <label className="text-xs font-semibold">Funder or relationship email<input name="funderContactEmail" type="email" required className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3" /></label>
        <label className="text-xs font-semibold">Next action due<input name="nextActionDue" type="date" required className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3" /></label>
        <label className="text-xs font-semibold sm:col-span-2">Next action<input name="nextAction" required className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3" /></label>
        {applicantRoutes.some(route => !route.eligible) ? <div className="rounded border border-[#f59e0b] bg-[#fffbeb] p-3 text-[11px] leading-5 text-[#92400e] sm:col-span-2">{applicantRoutes.filter(route => !route.eligible).map(route => <p key={route.routeId}><strong>{route.entityName}:</strong> {route.blockers.join(' ')}</p>)}</div> : null}
        <label className="flex min-h-11 items-center gap-3 text-xs sm:col-span-2"><input name="confirm" value="yes" type="checkbox" required disabled={!eligibleRoutes.length || !ghlUsers.length} className="h-5 w-5" />I confirm this exact ask, canonical applicant route, native GHL owner and next action should be written to GHL.</label>
        <button type="submit" disabled={pending || !eligibleRoutes.length || !ghlUsers.length} className="min-h-11 rounded bg-[#183426] px-4 py-3 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50 sm:col-span-2">{pending ? 'Writing…' : !eligibleRoutes.length ? 'Applicant route required' : !ghlUsers.length ? 'GHL contract required' : 'Confirm pursue'}</button>
        {pursued && !notionUrl ? <button type="button" onClick={createBrief} disabled={pending} className="min-h-11 rounded border border-[#183426] bg-white px-4 py-3 text-xs font-black uppercase tracking-wide text-[#183426] disabled:opacity-50 sm:col-span-2">Retry Notion workspace</button> : null}
        {notionUrl ? <a href={notionUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#183426] underline sm:col-span-2">Open the Notion application workspace</a> : null}
        {message ? <p role="status" className="text-xs text-[#475569] sm:col-span-2">{message}</p> : null}
      </form>
    </details>
  );
}
