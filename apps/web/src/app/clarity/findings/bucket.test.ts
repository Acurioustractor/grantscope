import { describe, expect, it } from 'vitest';
import { AGE_OUT_DAYS, bucketOf, type FindingRow } from './types';

const base: FindingRow = {
  id: 1,
  detector: 'orphan',
  subject_object_key: 'x',
  column_name: '',
  title: 't',
  evidence: {},
  proposed_at: '2026-08-01T00:00:00Z',
  last_seen_at: '2026-08-01T00:00:00Z',
  verdict: null,
  verdict_by: null,
  verdict_at: null,
  verdict_reason: null,
};

describe('bucketOf', () => {
  const now = new Date('2026-08-16T00:00:00Z');

  it('a verdict wins over age — confirmed never expires', () => {
    const old = { ...base, proposed_at: '2020-01-01T00:00:00Z' };
    expect(bucketOf({ ...old, verdict: 'confirmed' }, now)).toBe('confirmed');
    expect(bucketOf({ ...old, verdict: 'dismissed' }, now)).toBe('dismissed');
  });

  it('fresh unadjudicated is open; past the window it ages out', () => {
    expect(bucketOf(base, now)).toBe('open');
    const cutoff = new Date(now.getTime() - (AGE_OUT_DAYS + 1) * 86400000).toISOString();
    expect(bucketOf({ ...base, proposed_at: cutoff }, now)).toBe('aged_out');
  });

  it('the boundary day is still open', () => {
    const exactly = new Date(now.getTime() - AGE_OUT_DAYS * 86400000).toISOString();
    expect(bucketOf({ ...base, proposed_at: exactly }, now)).toBe('open');
  });
});
