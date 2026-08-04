import { describe, expect, it } from 'vitest';
import type { ActReviewRecord } from '@/app/org/[slug]/_components/act-record-review';
import { selectRelationalReviewMatters } from '@/lib/services/act-relational-review';

function reviewRecord(overrides: Partial<ActReviewRecord> = {}): ActReviewRecord {
  return {
    id: 'record',
    title: 'A matter',
    summary: 'A concrete Goods matter.',
    lane: 'grant',
    sourceLabel: 'Official source',
    sourceType: 'grant',
    sourceRef: 'source-1',
    sourceUrl: 'https://example.com/source',
    score: 99,
    project: 'Goods',
    projectCode: 'ACT-GD',
    role: 'lead',
    recommendedRole: 'lead',
    pathway: 'grant',
    amount: '$50,000',
    date: 'No date',
    nextAction: 'Understand the matter.',
    relationshipState: 'cold',
    readiness: 'ready',
    recommendedMove: 'apply_now',
    reason: 'A legacy ranked recommendation.',
    confidence: 99,
    evidenceGaps: [],
    tags: ['goods'],
    verification: {
      state: 'unverified',
      label: 'Verification needed',
      detail: 'No dated official verification is attached.',
      verifiedAt: null,
    },
    ...overrides,
  };
}

describe('selectRelationalReviewMatters', () => {
  const now = new Date('2026-07-28T09:00:00+08:00');

  it('uses deterministic attention conditions in their agreed order', () => {
    const queue = selectRelationalReviewMatters([
      reviewRecord({
        id: 'excluded-high-score',
        title: 'High score with no trigger',
        score: 100,
        confidence: 100,
      }),
      reviewRecord({
        id: 'revisit',
        title: 'Revisit',
        revisitAt: '2026-07-27',
      }),
      reviewRecord({
        id: 'gap',
        title: 'Evidence gap',
        evidenceGaps: ['community authority'],
      }),
      reviewRecord({
        id: 'deadline',
        title: 'Deadline',
        date: '15 Aug 2026',
      }),
      reviewRecord({
        id: 'changed',
        title: 'Changed evidence',
        discoveryState: 'changed',
        score: 1,
        confidence: 1,
        verification: {
          state: 'verified',
          label: 'Official source verified',
          detail: 'The official source changed.',
          verifiedAt: '2026-07-26T00:00:00Z',
        },
      }),
    ], now);

    expect(queue.map((item) => [item.record.id, item.trigger])).toEqual([
      ['changed', 'official_evidence_changed'],
      ['deadline', 'deadline_due'],
      ['gap', 'evidence_gap'],
      ['revisit', 'revisit_due'],
    ]);
  });

  it('does not treat an unverified changed signal as official evidence', () => {
    const queue = selectRelationalReviewMatters([
      reviewRecord({
        id: 'changed-but-unverified',
        discoveryState: 'changed',
      }),
    ], now);

    expect(queue).toEqual([]);
  });

  it('keeps the weekly queue to five even when more matters qualify', () => {
    const queue = selectRelationalReviewMatters(
      Array.from({ length: 7 }, (_, index) => reviewRecord({
        id: `gap-${index}`,
        title: `Gap ${index}`,
        evidenceGaps: [`unknown ${index}`],
      })),
      now,
    );

    expect(queue).toHaveLength(5);
    expect(queue.map((item) => item.record.id)).toEqual(['gap-0', 'gap-1', 'gap-2', 'gap-3', 'gap-4']);
  });

  it('excludes a near deadline after a human decision has been recorded', () => {
    const queue = selectRelationalReviewMatters([
      reviewRecord({
        id: 'decided-deadline',
        date: '12 Aug 2026',
        decisionMemory: {
          decision: 'apply',
          label: 'Apply',
          createdAt: '2026-07-27T00:00:00Z',
          reason: 'Current evidence is enough.',
        },
      }),
    ], now);

    expect(queue).toEqual([]);
  });

  it('does not repeatedly queue the same evidence gap after a human read', () => {
    const queue = selectRelationalReviewMatters([
      reviewRecord({
        id: 'reviewed-gap',
        evidenceGaps: ['Who has authority to apply?'],
        decisionMemory: {
          decision: 'review',
          label: 'Prior review',
          createdAt: '2026-07-27T00:00:00Z',
          reason: 'The authority question is still open.',
        },
      }),
    ], now);

    expect(queue).toEqual([]);
  });

  it('brings a reviewed matter back only for newer official evidence or a due revisit', () => {
    const reviewed = {
      decision: 'review' as const,
      label: 'Prior review',
      createdAt: '2026-07-27T00:00:00Z',
      reason: 'Wait for the official update.',
    };
    const verification = {
      state: 'verified' as const,
      label: 'Official source verified',
      detail: 'The official source changed.',
      verifiedAt: '2026-07-28T00:00:00Z',
    };

    const queue = selectRelationalReviewMatters([
      reviewRecord({
        id: 'older-change',
        discoveryState: 'changed',
        evidenceChangedAt: '2026-07-26T00:00:00Z',
        decisionMemory: reviewed,
        verification,
      }),
      reviewRecord({
        id: 'newer-change',
        discoveryState: 'changed',
        evidenceChangedAt: '2026-07-28T00:00:00Z',
        decisionMemory: reviewed,
        verification,
      }),
      reviewRecord({
        id: 'revisit-due',
        decisionMemory: reviewed,
        revisitAt: '2026-07-28',
      }),
    ], now);

    expect(queue.map((item) => [item.record.id, item.trigger])).toEqual([
      ['newer-change', 'official_evidence_changed'],
      ['revisit-due', 'revisit_due'],
    ]);
  });
});
