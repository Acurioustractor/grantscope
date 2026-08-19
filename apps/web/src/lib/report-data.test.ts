import { describe, it, expect } from 'vitest';
import { resultUnavailable, reportDataUnavailable, rowsOrNull } from './report-data';

/**
 * Locks the distinction that the 2026-08-19 zero-serving reports lost: a query that ran and
 * matched nothing is NOT the same as a query that never ran.
 */
describe('report data availability', () => {
  it('treats a null data payload as unavailable — this is the snapshot client', () => {
    // Exactly what reportSnapshotSupabase returns: no data, and no error to notice either.
    expect(resultUnavailable({ data: null, error: null })).toBe(true);
  });

  it('treats an empty array as a real, measured zero', () => {
    expect(resultUnavailable({ data: [], error: null })).toBe(false);
    expect(rowsOrNull({ data: [], error: null })).toEqual([]);
  });

  it('treats an error as unavailable even when data is present', () => {
    expect(resultUnavailable({ data: [{ a: 1 }], error: { code: 'SQL_RPC_DISABLED' } })).toBe(true);
  });

  it('treats a missing or undefined result as unavailable', () => {
    expect(resultUnavailable(null)).toBe(true);
    expect(resultUnavailable(undefined)).toBe(true);
    expect(resultUnavailable({})).toBe(true);
  });

  it('rowsOrNull returns null rather than [] when the query never ran', () => {
    // The whole bug in one assertion: `|| []` here is what printed "0 LGAs scored".
    expect(rowsOrNull({ data: null, error: null })).toBeNull();
  });

  it('a page is unavailable if ANY dependency is, not only if all are', () => {
    expect(reportDataUnavailable([{ data: [{ a: 1 }] }, { data: null, error: null }])).toBe(true);
    expect(reportDataUnavailable([{ data: [{ a: 1 }] }, { data: [] }])).toBe(false);
  });
});
