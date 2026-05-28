'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type {
  GoodsCostAllocationDecision,
  GoodsCostAllocationScope,
  GoodsCostEvidence,
} from '@/lib/services/goods-cost-evidence';

type AllocationRow = GoodsCostEvidence['costAllocationRows'][number];

const decisionLabels: Record<GoodsCostAllocationDecision, string> = {
  needs_allocation: 'needs allocation',
  include_direct: 'direct cost',
  show_separately: 'ACT support',
  exclude: 'exclude',
  needs_receipt: 'needs receipt',
  needs_review: 'needs review',
};

const actionButtons: Array<{
  label: string;
  decision: GoodsCostAllocationDecision;
  allocationScope: GoodsCostAllocationScope;
  note: string;
}> = [
  {
    label: 'Use in last 50',
    decision: 'include_direct',
    allocationScope: 'last_50',
    note: 'Marked for the last-50-bed direct-cost sheet.',
  },
  {
    label: 'Direct later',
    decision: 'include_direct',
    allocationScope: 'current_batch',
    note: 'Direct Goods cost, but not allocated to the last-50 sheet yet.',
  },
  {
    label: 'ACT support',
    decision: 'show_separately',
    allocationScope: 'shared_service',
    note: 'Keep separate from delivered unit cost.',
  },
  {
    label: 'Need receipt',
    decision: 'needs_receipt',
    allocationScope: 'unallocated',
    note: 'Needs receipt or attachment before use.',
  },
  {
    label: 'Exclude',
    decision: 'exclude',
    allocationScope: 'unallocated',
    note: 'Do not use in Goods direct-cost calculation.',
  },
];

function treatmentClass(decision: GoodsCostAllocationDecision) {
  if (decision === 'include_direct') return 'border-emerald-600 bg-emerald-50 text-emerald-700';
  if (decision === 'show_separately') return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
  if (decision === 'exclude') return 'border-bauhaus-red bg-red-50 text-bauhaus-red';
  if (decision === 'needs_receipt' || decision === 'needs_review') return 'border-orange-500 bg-orange-50 text-orange-700';
  return 'border-gray-300 bg-gray-50 text-gray-700';
}

export function GoodsCostAllocationTable({ rows }: { rows: AllocationRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localDecisions, setLocalDecisions] = useState<Record<string, GoodsCostAllocationDecision>>({});

  async function saveDecision(
    row: AllocationRow,
    decision: GoodsCostAllocationDecision,
    allocationScope: GoodsCostAllocationScope,
    notes: string,
  ) {
    setSavingKey(row.lineFingerprint);
    setError(null);

    const response = await fetch('/api/goods/cost-allocation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineFingerprint: row.lineFingerprint,
        lineIndex: row.lineIndex,
        xeroInvoiceId: row.xeroInvoiceId,
        invoice: row.invoice,
        supplier: row.supplier,
        accountCode: row.accountCode,
        account: row.account,
        description: row.description,
        amount: row.amount,
        category: row.category,
        decision,
        allocationScope,
        notes,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSavingKey(null);
      setError(payload?.detail || payload?.error || 'Could not save allocation decision.');
      return;
    }

    setLocalDecisions((current) => ({ ...current, [row.lineFingerprint]: decision }));
    setSavingKey(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="overflow-x-auto">
      {error ? (
        <div className="border-b border-bauhaus-red bg-red-50 p-3 text-sm font-black text-bauhaus-red">{error}</div>
      ) : null}
      <table className="min-w-[1520px] w-full border-collapse text-left text-xs">
        <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-500">
          <tr>
            <th className="border-b border-r border-gray-200 p-3">Supplier / invoice</th>
            <th className="border-b border-r border-gray-200 p-3">Amount</th>
            <th className="border-b border-r border-gray-200 p-3">Category</th>
            <th className="border-b border-r border-gray-200 p-3">Decision</th>
            <th className="border-b border-r border-gray-200 p-3">Allocated?</th>
            <th className="border-b border-r border-gray-200 p-3">Proof</th>
            <th className="border-b border-gray-200 p-3">Save treatment</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => {
              const decision = localDecisions[row.lineFingerprint] ?? row.currentDecision;
              const disabled = savingKey === row.lineFingerprint || isPending;
              return (
                <tr key={row.lineFingerprint} className="align-top">
                  <td className="border-b border-r border-gray-200 p-3">
                    <div className="text-sm font-black text-bauhaus-black">{row.supplier}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
                      {row.invoice} · {row.date}
                    </div>
                    <div className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-600">{row.description}</div>
                    <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-400">{row.account}</div>
                  </td>
                  <td className="border-b border-r border-gray-200 p-3 text-sm font-black tabular-nums text-bauhaus-blue">
                    {row.amount}
                  </td>
                  <td className="border-b border-r border-gray-200 p-3">
                    <span className="border border-gray-300 bg-gray-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gray-700">
                      {row.category}
                    </span>
                  </td>
                  <td className="border-b border-r border-gray-200 p-3">
                    <div className={`inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${treatmentClass(decision)}`}>
                      {decisionLabels[decision]}
                    </div>
                    <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {row.allocationScope.replaceAll('_', ' ')}
                    </div>
                  </td>
                  <td className="border-b border-r border-gray-200 p-3 font-black leading-relaxed text-bauhaus-black">
                    {row.batchStatus}
                  </td>
                  <td className="border-b border-r border-gray-200 p-3">
                    <span
                      className={
                        row.proofStatus === 'Xero attachment'
                          ? 'border border-emerald-600 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700'
                          : 'border border-orange-500 bg-orange-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-orange-700'
                      }
                    >
                      {row.proofStatus}
                    </span>
                  </td>
                  <td className="border-b border-gray-200 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {actionButtons.map((button) => (
                        <button
                          key={button.label}
                          type="button"
                          disabled={disabled}
                          onClick={() => saveDecision(row, button.decision, button.allocationScope, button.note)}
                          className="border border-gray-300 bg-white px-2 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black hover:border-bauhaus-blue hover:bg-link-light disabled:cursor-wait disabled:opacity-50"
                        >
                          {savingKey === row.lineFingerprint ? 'Saving' : button.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7} className="border-b border-gray-200 p-4 text-sm text-gray-600">
                No Xero line items are ready for allocation review.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
