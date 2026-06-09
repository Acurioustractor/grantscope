import { describe, it, expect } from 'vitest';
import {
  normalizeStatus,
  parseGovernanceNotes,
  BELONGING_RUNGS,
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
