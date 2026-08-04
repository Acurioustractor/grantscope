'use client';

import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type {
  GoodsCapitalBlock,
  GoodsFundingRoute,
  GoodsRouteAllocation,
} from '@/lib/services/goods-capital-workspace';
import {
  saveCommitmentEvidence,
  saveFundingRouteFacts,
  saveRouteAllocation,
} from '../capital/actions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
      {label}
      <span className="mt-1 block normal-case tracking-normal">{children}</span>
    </label>
  );
}

function Result({ result }: { result: { ok: boolean; message: string } | null }) {
  if (!result) return null;
  return (
    <div className={`mt-3 border-2 px-3 py-2 text-xs ${result.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800'}`} role="status">
      {result.message}
    </div>
  );
}

function Submit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="mt-4 inline-flex min-h-11 w-full items-center justify-center border-2 border-bauhaus-black bg-bauhaus-black px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-bauhaus-blue disabled:opacity-50">
      {pending ? 'Saving…' : children}
    </button>
  );
}

export function GoodsRouteControls({
  slug,
  route,
  blocks,
  allocations,
}: {
  slug: string;
  route: GoodsFundingRoute;
  blocks: GoodsCapitalBlock[];
  allocations: GoodsRouteAllocation[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const persisted = UUID.test(route.id) && blocks.every((block) => UUID.test(block.id));

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setResult(null);
    startTransition(async () => {
      const response = await action();
      setResult({ ok: response.ok, message: response.ok ? success : response.error ?? 'Could not save.' });
      if (response.ok) router.refresh();
    });
  }

  function submitFacts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('targetAmountAud'));
    run(() => saveFundingRouteFacts({
      slug,
      routeId: route.id,
      routeCode: route.routeCode,
      namedRoute: String(form.get('namedRoute') ?? ''),
      instrumentLabel: String(form.get('instrumentLabel') ?? ''),
      legalRecipientName: String(form.get('legalRecipientName') ?? ''),
      eligibilityState: String(form.get('eligibilityState') ?? 'unknown'),
      applicationState: String(form.get('applicationState') ?? 'researching'),
      targetAmountAud: Number.isFinite(amount) ? amount : null,
      askMade: form.get('askMade') === 'on',
      decisionDueAt: String(form.get('decisionDueAt') ?? ''),
      nextAction: String(form.get('nextAction') ?? ''),
      nextActionOwner: String(form.get('nextActionOwner') ?? ''),
      nextActionDue: String(form.get('nextActionDue') ?? ''),
    }), 'Route facts updated.');
  }

  function submitAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const proposed = Number(form.get('proposedAmountAud'));
    const accepted = Number(form.get('acceptedAmountAud'));
    run(() => saveRouteAllocation({
      slug,
      routeId: route.id,
      routeCode: route.routeCode,
      capitalBlockId: String(form.get('capitalBlockId') ?? ''),
      proposedAmountAud: Number.isFinite(proposed) && proposed > 0 ? proposed : null,
      acceptedAmountAud: Number.isFinite(accepted) && accepted > 0 ? accepted : null,
      restrictions: String(form.get('restrictions') ?? ''),
      allocationEvidenceRef: String(form.get('allocationEvidenceRef') ?? ''),
    }), 'Capital-block allocation saved.');
  }

  function submitCommitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('commitmentAmountAud'));
    run(() => saveCommitmentEvidence({
      slug,
      routeId: route.id,
      routeCode: route.routeCode,
      commitmentState: String(form.get('commitmentState') ?? 'none'),
      commitmentAmountAud: Number.isFinite(amount) && amount > 0 ? amount : null,
      evidenceForm: String(form.get('evidenceForm') ?? 'none'),
      evidenceRef: String(form.get('evidenceRef') ?? ''),
      matchAssessment: String(form.get('matchAssessment') ?? 'unknown'),
      matchAssessmentReason: String(form.get('matchAssessmentReason') ?? ''),
    }), 'Commitment evidence updated.');
  }

  if (!persisted) {
    return (
      <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs leading-5 text-bauhaus-muted">
        Apply the GOODS capital workspace migration before editing route facts, allocations or commitment evidence. The evidence-safe seed remains read-only so it cannot create false commitments.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Result result={result} />

      <details className="border-4 border-bauhaus-black bg-white" open>
        <summary className="cursor-pointer px-4 py-3 text-xs font-black uppercase tracking-widest">1. Route facts</summary>
        <form onSubmit={submitFacts} className="grid gap-3 border-t-2 border-bauhaus-black p-4 sm:grid-cols-2">
          <Field label="Named program / facility">
            <input name="namedRoute" defaultValue={route.namedRoute ?? ''} className="min-h-11 w-full border-2 border-bauhaus-black px-3 text-sm" />
          </Field>
          <Field label="Instrument">
            <input name="instrumentLabel" defaultValue={route.instrumentLabel ?? ''} className="min-h-11 w-full border-2 border-bauhaus-black px-3 text-sm" />
          </Field>
          <Field label="Legal recipient">
            <input name="legalRecipientName" defaultValue={route.legalRecipientName ?? ''} className="min-h-11 w-full border-2 border-bauhaus-black px-3 text-sm" />
          </Field>
          <Field label="Eligibility">
            <select name="eligibilityState" defaultValue={route.eligibilityState} className="min-h-11 w-full border-2 border-bauhaus-black bg-white px-3 text-sm">
              <option value="unknown">Unknown</option><option value="conditional">Conditional</option><option value="eligible">Eligible</option><option value="ineligible">Ineligible</option>
            </select>
          </Field>
          <Field label="Application state">
            <select name="applicationState" defaultValue={route.applicationState} className="min-h-11 w-full border-2 border-bauhaus-black bg-white px-3 text-sm">
              {['researching', 'concept', 'invited', 'drafting', 'ready', 'submitted', 'due_diligence', 'decided', 'withdrawn', 'closed'].map((state) => <option key={state} value={state}>{state.replaceAll('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Target amount (AUD)">
            <input name="targetAmountAud" type="number" min="0" defaultValue={route.targetAmountAud ?? ''} className="min-h-11 w-full border-2 border-bauhaus-black px-3 text-sm" />
          </Field>
          <Field label="Decision due">
            <input name="decisionDueAt" type="date" defaultValue={route.decisionDueAt?.slice(0, 10) ?? ''} className="min-h-11 w-full border-2 border-bauhaus-black px-3 text-sm" />
          </Field>
          <Field label="Next action owner">
            <input name="nextActionOwner" defaultValue={route.nextActionOwner ?? ''} className="min-h-11 w-full border-2 border-bauhaus-black px-3 text-sm" />
          </Field>
          <Field label="Next action due">
            <input name="nextActionDue" type="date" defaultValue={route.nextActionDue ?? ''} className="min-h-11 w-full border-2 border-bauhaus-black px-3 text-sm" />
          </Field>
          <label className="flex min-h-11 items-center gap-3 border-2 border-bauhaus-black/30 bg-bauhaus-canvas px-3 text-xs font-bold">
            <input name="askMade" type="checkbox" defaultChecked={Boolean(route.askMadeAt)} className="h-4 w-4" /> Ask has actually been made
          </label>
          <label className="sm:col-span-2 text-[10px] font-black uppercase tracking-widest">
            Next action
            <textarea name="nextAction" defaultValue={route.nextAction ?? ''} rows={3} className="mt-1 w-full border-2 border-bauhaus-black px-3 py-2 text-sm normal-case leading-5 tracking-normal" />
          </label>
          <div className="sm:col-span-2"><Submit pending={pending}>Save route facts</Submit></div>
        </form>
      </details>

      <details className="border-4 border-bauhaus-black bg-white">
        <summary className="cursor-pointer px-4 py-3 text-xs font-black uppercase tracking-widest">2. Allocate to a capital block</summary>
        <form onSubmit={submitAllocation} className="grid gap-3 border-t-2 border-bauhaus-black p-4 sm:grid-cols-2">
          <Field label="Capital block">
            <select name="capitalBlockId" className="min-h-11 w-full border-2 border-bauhaus-black bg-white px-3 text-sm" required>
              {blocks.map((block) => {
                const existing = allocations.find((allocation) => allocation.capitalBlockId === block.id);
                return <option key={block.id} value={block.id}>{block.name}{existing ? ` · ${existing.proposedAmountAud ?? 0} allocated` : ''}</option>;
              })}
            </select>
          </Field>
          <Field label="Proposed allocation (AUD)"><input name="proposedAmountAud" type="number" min="0" className="min-h-11 w-full border-2 border-bauhaus-black px-3 text-sm" /></Field>
          <Field label="Accepted allocation (AUD)"><input name="acceptedAmountAud" type="number" min="0" className="min-h-11 w-full border-2 border-bauhaus-black px-3 text-sm" /></Field>
          <Field label="Allocation evidence"><input name="allocationEvidenceRef" placeholder="Document name or URL" className="min-h-11 w-full border-2 border-bauhaus-black px-3 text-sm" /></Field>
          <label className="sm:col-span-2 text-[10px] font-black uppercase tracking-widest">Restrictions<textarea name="restrictions" rows={2} className="mt-1 w-full border-2 border-bauhaus-black px-3 py-2 text-sm normal-case tracking-normal" /></label>
          <div className="sm:col-span-2"><Submit pending={pending}>Save allocation</Submit></div>
        </form>
      </details>

      <details className="border-4 border-bauhaus-black bg-white">
        <summary className="cursor-pointer px-4 py-3 text-xs font-black uppercase tracking-widest">3. Record commitment evidence</summary>
        <form onSubmit={submitCommitment} className="grid gap-3 border-t-2 border-bauhaus-black p-4 sm:grid-cols-2">
          <Field label="Commitment state"><select name="commitmentState" defaultValue={route.commitmentState} className="min-h-11 w-full border-2 border-bauhaus-black bg-white px-3 text-sm">{['none', 'proposed', 'offered', 'accepted', 'fulfilled', 'changed', 'declined', 'released', 'contested'].map((state) => <option key={state} value={state}>{state}</option>)}</select></Field>
          <Field label="Commitment amount (AUD)"><input name="commitmentAmountAud" type="number" min="0" defaultValue={route.commitmentAmountAud ?? ''} className="min-h-11 w-full border-2 border-bauhaus-black px-3 text-sm" /></Field>
          <Field label="Evidence form"><select name="evidenceForm" defaultValue={route.commitmentEvidenceForm} className="min-h-11 w-full border-2 border-bauhaus-black bg-white px-3 text-sm"><option value="none">None</option><option value="verbal">Verbal</option><option value="email">Email</option><option value="letter">Letter</option><option value="executed_agreement">Executed agreement</option></select></Field>
          <Field label="Evidence reference"><input name="evidenceRef" defaultValue={route.commitmentEvidenceRef ?? ''} placeholder="Letter name, agreement or URL" className="min-h-11 w-full border-2 border-bauhaus-black px-3 text-sm" /></Field>
          <Field label="QBE match assessment"><select name="matchAssessment" defaultValue={route.matchAssessment} className="min-h-11 w-full border-2 border-bauhaus-black bg-white px-3 text-sm"><option value="unknown">Unknown</option><option value="eligible">Eligible</option><option value="ineligible">Ineligible</option></select></Field>
          <Field label="Assessment reason"><input name="matchAssessmentReason" defaultValue={route.matchAssessmentReason ?? ''} className="min-h-11 w-full border-2 border-bauhaus-black px-3 text-sm" /></Field>
          <div className="sm:col-span-2 border-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Accepted capital only counts as evidence-backed when an amount and a letter or executed agreement are recorded. QBE eligibility remains a separate written assessment.</div>
          <div className="sm:col-span-2"><Submit pending={pending}>Save commitment evidence</Submit></div>
        </form>
      </details>
    </div>
  );
}
