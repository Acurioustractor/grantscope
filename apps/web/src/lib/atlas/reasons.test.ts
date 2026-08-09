// The reason registry is a contract with the database: the six codes here
// are exactly the lga_source stamps the 2026-08 placement migrations wrote.
// A code drifting out of sync fails loudly here, not silently on the map.

import { describe, expect, it } from 'vitest';
import {
  beyondCouncilRows,
  COUNCIL_REASON_COLUMNS,
  reasonLabel,
  reasonRows,
  scopeReasonRows,
  totalOf,
  UNPLACED_REASONS,
  type StateReasonCount,
} from './reasons';

describe('the reason registry', () => {
  it('pins the six lga_source codes the migrations stamp', () => {
    expect(UNPLACED_REASONS.map(r => r.code).sort()).toEqual([
      'no_postcode',
      'no_state',
      'postcode_unmapped_in_abs',
      'state_conflict',
      'unknown_postcode',
      'unresolved_multi_lga_postcode',
    ]);
  });

  it('every label is plain words, no codes leaking through', () => {
    for (const r of UNPLACED_REASONS) {
      expect(r.label.length).toBeGreaterThan(5);
      expect(r.label).not.toMatch(/_/);
      expect(r.label).toBe(r.label.toLowerCase());
    }
  });

  it('only postcode-less and unrecognised-postcode records are impossible per council', () => {
    const impossible = UNPLACED_REASONS.filter(r => !r.councilPossible)
      .map(r => r.code)
      .sort();
    expect(impossible).toEqual(['no_postcode', 'unknown_postcode']);
  });

  it('labels a code it has not met honestly instead of dropping it', () => {
    expect(reasonLabel('future_code')).toBe('future code');
  });
});

describe('per-council rows', () => {
  it('sorts biggest first and drops empty or broken counts', () => {
    const rows = reasonRows({
      unresolved_multi_lga_postcode: 312,
      state_conflict: 40,
      postcode_unmapped_in_abs: 0,
      no_state: Number.NaN,
    });
    expect(rows.map(r => r.code)).toEqual(['unresolved_multi_lga_postcode', 'state_conflict']);
    expect(rows[0].label).toBe('postcode spans several councils');
  });

  it('tolerates payloads from before the reason codes existed', () => {
    expect(reasonRows(null)).toEqual([]);
    expect(reasonRows(undefined)).toEqual([]);
  });
});

describe('scoping the live tally', () => {
  const tally: StateReasonCount[] = [
    { state: 'SA', reason: 'unresolved_multi_lga_postcode', n: 5592 },
    { state: 'SA', reason: 'no_postcode', n: 1065 },
    { state: 'QLD', reason: 'no_postcode', n: 5360 },
    { state: null, reason: 'no_postcode', n: 262506 },
    { state: null, reason: 'no_state', n: 7 },
  ];

  it('ALL sums every state including records with no state at all', () => {
    const rows = scopeReasonRows(tally, 'ALL');
    expect(rows.find(r => r.code === 'no_postcode')?.n).toBe(1065 + 5360 + 262506);
    expect(rows.find(r => r.code === 'no_state')?.n).toBe(7);
  });

  it('a state filter shows that state alone', () => {
    const rows = scopeReasonRows(tally, 'SA');
    expect(rows.map(r => r.code)).toEqual(['unresolved_multi_lga_postcode', 'no_postcode']);
    expect(totalOf(rows)).toBe(5592 + 1065);
  });

  it('beyond-council rows name only what no council can ever count', () => {
    expect(beyondCouncilRows(tally, 'SA').map(r => r.code)).toEqual(['no_postcode']);
  });

  it('a missing tally yields no rows, never a crash', () => {
    expect(scopeReasonRows(undefined, 'ALL')).toEqual([]);
    expect(beyondCouncilRows(null, 'SA')).toEqual([]);
  });
});

describe('export columns', () => {
  it('one column per council-possible reason, raw code in the header', () => {
    expect(COUNCIL_REASON_COLUMNS.map(c => c.header)).toEqual([
      'unplaced_unresolved_multi_lga_postcode',
      'unplaced_postcode_unmapped_in_abs',
      'unplaced_state_conflict',
      'unplaced_no_state',
    ]);
  });
});
