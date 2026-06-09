import { describe, it, expect } from 'vitest';
import {
  normalizeStatus,
  parseGovernanceNotes,
  BELONGING_RUNGS,
  stageToRung,
  resolveRung,
  rollupLadder,
} from '@/lib/services/goods-governance-shared';

describe('normalizeStatus', () => {
  it('maps transition wording to transitioning', () => {
    expect(normalizeStatus('transitioning (handover 26 Jun 2026)')).toBe('transitioning');
    expect(normalizeStatus('Transition director')).toBe('transitioning');
  });
  it('maps continuing/current/serving to continuing', () => {
    expect(normalizeStatus('continuing')).toBe('continuing');
    expect(normalizeStatus('Currently serving')).toBe('continuing');
  });
  it('maps incoming/joining/installing to incoming', () => {
    expect(normalizeStatus('incoming')).toBe('incoming');
    expect(normalizeStatus('being installed')).toBe('incoming');
  });
  it('defaults unknown for empty or unrecognised', () => {
    expect(normalizeStatus(null)).toBe('unknown');
    expect(normalizeStatus('')).toBe('unknown');
    expect(normalizeStatus('something else')).toBe('unknown');
  });
});

describe('parseGovernanceNotes', () => {
  it('extracts status, context and normalises status', () => {
    const notes = [
      'Status: continuing',
      'Context: Central Arrernte woman; Traditional Owner of Mparntwe (Alice Springs)',
      'Co-owner of Goods governance. Never laddered per OCAP.',
    ].join('\n');
    const out = parseGovernanceNotes(notes);
    expect(out.status).toBe('continuing');
    expect(out.statusLabel).toBe('continuing');
    expect(out.context).toBe('Central Arrernte woman; Traditional Owner of Mparntwe (Alice Springs)');
  });

  it('keeps the raw status label (with handover detail) but normalises to transitioning', () => {
    const out = parseGovernanceNotes('Status: transitioning (handover 26 Jun 2026)\nCo-owner of Goods governance.');
    expect(out.status).toBe('transitioning');
    expect(out.statusLabel).toBe('transitioning (handover 26 Jun 2026)');
    expect(out.context).toBeNull();
  });

  it('returns null context when the Context line is absent', () => {
    const out = parseGovernanceNotes('Status: continuing\nCo-owner of Goods governance.');
    expect(out.context).toBeNull();
  });

  it('is tolerant of empty / plain-text notes', () => {
    expect(parseGovernanceNotes(null)).toEqual({ status: 'unknown', statusLabel: null, context: null });
    expect(parseGovernanceNotes('just a note').status).toBe('unknown');
  });
});

describe('stageToRung', () => {
  it('maps the engagement ladder onto the 5 rungs', () => {
    expect(stageToRung('identified')).toBe('curious');
    expect(stageToRung('researching')).toBe('connected');
    expect(stageToRung('in_conversation')).toBe('connected');
    expect(stageToRung('proposal')).toBe('connected');
    expect(stageToRung('committed')).toBe('member');
    expect(stageToRung('repeat')).toBe('active');
  });
  it('treats dormant/declined/unknown/empty as off-ladder (null)', () => {
    expect(stageToRung('dormant')).toBeNull();
    expect(stageToRung('declined')).toBeNull();
    expect(stageToRung('made_up')).toBeNull();
    expect(stageToRung(null)).toBeNull();
  });
});

describe('resolveRung', () => {
  it('lets an explicit tier: tag win over the stage', () => {
    expect(resolveRung('identified', ['tier:steward'])).toBe('steward');
    expect(resolveRung('committed', ['role:funder', 'tier:active'])).toBe('active');
  });
  it('falls back to the stage when no valid tier tag is present', () => {
    expect(resolveRung('committed', ['tier:bogus'])).toBe('member');
    expect(resolveRung('identified', [])).toBe('curious');
    expect(resolveRung('dormant', null)).toBeNull();
  });
});

describe('rollupLadder', () => {
  it('buckets rows into all 5 rungs in order, caps examples, counts off-ladder', () => {
    const rows = [
      { stage: 'identified', tags: [], name: 'A' },
      { stage: 'identified', tags: [], name: 'B' },
      { stage: 'committed', tags: [], name: 'C' },
      { stage: 'repeat', tags: [], name: 'D' },
      { stage: 'proposal', tags: [], name: 'E' },
      { stage: 'dormant', tags: [], name: 'X' }, // off-ladder
      { stage: 'declined', tags: [], name: 'Y' }, // off-ladder
      { stage: 'identified', tags: ['tier:steward'], name: 'Steward1' }, // tag promotes
    ];
    const out = rollupLadder(rows);
    expect(out.rungs.map((r) => r.tier)).toEqual(['curious', 'connected', 'member', 'active', 'steward']);
    const by = Object.fromEntries(out.rungs.map((r) => [r.tier, r.count]));
    expect(by).toEqual({ curious: 2, connected: 1, member: 1, active: 1, steward: 1 });
    expect(out.offLadder).toBe(2);
    expect(out.total).toBe(6);
    expect(out.rungs[0].examples).toEqual(['A', 'B']);
  });

  it('caps examples at 4 even with many rows in a rung', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ stage: 'identified', tags: [], name: `n${i}` }));
    const out = rollupLadder(rows);
    expect(out.rungs[0].count).toBe(10);
    expect(out.rungs[0].examples).toHaveLength(4);
  });

  it('returns an all-zero ladder for no rows', () => {
    const out = rollupLadder([]);
    expect(out.total).toBe(0);
    expect(out.offLadder).toBe(0);
    expect(out.rungs).toHaveLength(5);
  });
});

describe('BELONGING_RUNGS', () => {
  it('is the canonical 5-rung ladder in order', () => {
    expect(BELONGING_RUNGS.map((r) => r.tier)).toEqual([
      'curious', 'connected', 'member', 'active', 'steward',
    ]);
  });
  it('carries a Goods-specific meaning for every rung', () => {
    for (const rung of BELONGING_RUNGS) {
      expect(rung.meaning.length).toBeGreaterThan(0);
      expect(rung.label.length).toBeGreaterThan(0);
    }
  });
});
