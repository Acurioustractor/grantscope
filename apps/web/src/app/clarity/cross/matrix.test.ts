import { describe, expect, it } from 'vitest';
import { BUCKET_FILL, BUCKET_LABEL, DIAGONAL_MEANING, bucket, parseTab } from './types';

describe('the cross-section matrix', () => {
  it('falls back to the flow tab on anything unrecognised', () => {
    expect(parseTab(undefined)).toBe('flow');
    expect(parseTab('join')).toBe('join');
    expect(parseTab('../../etc/passwd')).toBe('flow');
  });

  it('buckets on a log scale, because the range runs 1 to 330,460', () => {
    expect(bucket(1)).toBe(0);
    expect(bucket(99)).toBe(0);
    expect(bucket(100)).toBe(1);
    expect(bucket(9_999)).toBe(1);
    expect(bucket(10_000)).toBe(2);
    expect(bucket(99_999)).toBe(2);
    // The two AusTender category hubs live up here: 330,460 and 274,675 edges.
    expect(bucket(330_460)).toBe(3);
  });

  it('has a fill and a label for every bucket', () => {
    expect(BUCKET_FILL).toHaveLength(4);
    expect(BUCKET_LABEL).toHaveLength(4);
  });

  it('never lets a diagonal cell read as self-funding', () => {
    // Each of these is a real relationship between two DIFFERENT organisations of
    // the same kind. If a type is added to the matrix without its own sentence
    // here, the UI falls back to a generic one that still refuses "self-funding".
    for (const meaning of Object.values(DIAGONAL_MEANING)) {
      expect(meaning).not.toMatch(/self-funding/i);
      expect(meaning.length).toBeGreaterThan(10);
    }
    expect(DIAGONAL_MEANING.person).toMatch(/board/i);
  });
});
