'use client';

import { useState } from 'react';

type RelationshipActionState = 'new_signal' | 'ready_to_reply' | 'meeting_needed' | 'proposal_path' | 'waiting' | 'parked';
type RelationshipActionKind = 'partner_path' | 'research' | 'later';

export interface RelationshipActionRecord {
  id: string;
  name: string;
  organisation: string | null;
  state: RelationshipActionState;
  lane: string;
  recommendedAsk: string;
  whyNow: string;
  sourceEvidence: string;
  tags: string[];
}

interface ActionReceipt {
  id?: string;
  status?: string;
  nextStep?: string;
  warnings?: string[];
  error?: string;
  detail?: string;
  externalWrites?: Array<{ system: string; id: string; status: string }>;
}

function projectCodeFor(record: RelationshipActionRecord): string {
  const text = [record.lane, ...record.tags].join(' ').toLowerCase();
  if (text.includes('act-gd') || text.includes('goods') || text.includes('procurement')) return 'ACT-GD';
  if (text.includes('act-hv') || text.includes('harvest') || text.includes('artlands') || text.includes('arts')) return 'ACT-HV';
  if (text.includes('act-jh') || text.includes('justice')) return 'ACT-JH';
  if (text.includes('act-el') || text.includes('empathy')) return 'ACT-EL';
  if (text.includes('act-cg') || text.includes('civicgraph')) return 'ACT-CG';
  return 'ACT';
}

function projectNameFor(code: string): string {
  if (code === 'ACT-GD') return 'Goods on Country';
  if (code === 'ACT-HV') return 'Harvest / Arts';
  if (code === 'ACT-JH') return 'JusticeHub';
  if (code === 'ACT-EL') return 'Empathy Ledger';
  if (code === 'ACT-CG') return 'CivicGraph';
  return 'A Curious Tractor';
}

function pathwayFor(lane: string): 'foundation' | 'procurement' | 'buyer' | 'capital' | 'relationship' | 'monitor' {
  if (lane === 'foundation') return 'foundation';
  if (lane === 'procurement') return 'procurement';
  if (lane === 'capital') return 'capital';
  if (lane === 'buyer') return 'buyer';
  if (lane === 'relationship' || lane === 'arts' || lane === 'justice' || lane === 'governance') return 'relationship';
  return 'monitor';
}

function primaryLabel(state: RelationshipActionState): string {
  if (state === 'meeting_needed') return 'Record meeting';
  if (state === 'proposal_path') return 'Record path';
  if (state === 'new_signal') return 'Qualify';
  if (state === 'waiting') return 'Follow up';
  return 'Record reply';
}

function primaryKind(state: RelationshipActionState): RelationshipActionKind {
  if (state === 'new_signal' || state === 'waiting') return 'research';
  return 'partner_path';
}

function buildPayload(record: RelationshipActionRecord, orgProfileId: string, kind: RelationshipActionKind) {
  const projectCode = projectCodeFor(record);
  const projectName = projectNameFor(projectCode);
  const pathway = kind === 'later' ? 'monitor' : pathwayFor(record.lane);
  const sourceRef = record.id.replace(/^context:/, '');
  const title = `${record.name}${record.organisation ? ` / ${record.organisation}` : ''}`;
  const nextAction = kind === 'later'
    ? `Park relationship action for now. ${record.recommendedAsk}`
    : record.recommendedAsk;

  return {
    kind,
    signalId: record.id,
    orgProfileId,
    signal: {
      id: record.id,
      title,
      source: 'crm',
      sourceRef,
      sourceUrl: null,
      lane: record.lane === 'foundation' || record.lane === 'procurement' || record.lane === 'capital'
        ? record.lane
        : 'relationship',
      project: projectName,
      projects: [projectName],
      organisation: record.organisation,
      amount: null,
      deadline: null,
    },
    route: {
      id: record.id,
      signalId: record.id,
      title,
      source: 'crm',
      sourceRef,
      sourceUrl: null,
      project: projectName,
      project_code: projectCode,
      project_name: projectName,
      pathway,
      recommended_role: pathway === 'procurement' ? 'contractor' : 'partner',
      evidence_gaps: kind === 'later' ? ['relationship timing'] : ['owner', 'next touch outcome'],
      next_action: nextAction,
      ghl: {
        recommendedPipeline: pathway === 'procurement' ? 'Procurement' : 'Relationships',
        suggestedStage: kind === 'later' ? 'Parked' : 'Next touch',
        existingOpportunityId: null,
        contactId: null,
        tags: record.tags,
      },
    },
    note: `${nextAction} Why now: ${record.whyNow} Evidence: ${record.sourceEvidence}`,
    targetSystem: 'civicgraph',
    confirmWrite: false,
    reason: record.whyNow,
    evidenceGaps: kind === 'later' ? ['relationship timing'] : ['owner', 'next touch outcome'],
  };
}

export function ActRelationshipActionButtons({
  record,
  orgProfileId,
}: {
  record: RelationshipActionRecord;
  orgProfileId: string;
}) {
  const [pending, setPending] = useState<RelationshipActionKind | null>(null);
  const [receipt, setReceipt] = useState<ActionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: RelationshipActionKind) {
    setPending(kind);
    setReceipt(null);
    setError(null);
    try {
      const response = await fetch('/api/opportunity-intelligence/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(record, orgProfileId, kind)),
      });
      const body = (await response.json()) as ActionReceipt;
      if (!response.ok) {
        setError(body.detail || body.error || `Action failed with ${response.status}`);
      } else {
        setReceipt(body);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setPending(null);
    }
  }

  const primary = primaryKind(record.state);

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => run(primary)}
          disabled={pending !== null}
          className="min-h-10 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-left text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
        >
          {pending === primary ? 'Recording...' : primaryLabel(record.state)}
        </button>
        <button
          type="button"
          onClick={() => run('research')}
          disabled={pending !== null}
          className="min-h-10 rounded-md border border-[var(--ws-border)] bg-white px-2 text-left text-xs font-semibold text-[var(--ws-text)] hover:bg-[var(--ws-surface-2)] disabled:cursor-wait disabled:opacity-60"
        >
          {pending === 'research' ? 'Recording...' : 'Task'}
        </button>
        <button
          type="button"
          onClick={() => run('later')}
          disabled={pending !== null}
          className="min-h-10 rounded-md border border-stone-200 bg-stone-50 px-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:cursor-wait disabled:opacity-60"
        >
          {pending === 'later' ? 'Recording...' : 'Park'}
        </button>
      </div>
      {receipt ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs leading-relaxed text-emerald-800">
          <div className="font-semibold">Recorded: {receipt.status ?? 'planned'}</div>
          {receipt.externalWrites?.length ? (
            <div className="mt-1">{receipt.externalWrites.map((write) => `${write.system} ${write.status}`).join(', ')}</div>
          ) : null}
          {receipt.nextStep ? <div className="mt-1">{receipt.nextStep}</div> : null}
          {receipt.warnings?.[0] ? <div className="mt-1">{receipt.warnings[0]}</div> : null}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-2 py-2 text-xs leading-relaxed text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
