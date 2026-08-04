import { describe, expect, it } from 'vitest';
import { isOrgWriteRole } from '@/app/api/org/_lib/auth';

describe('organisation write roles', () => {
  it('allows administrators and editors to mutate operational data', () => {
    expect(isOrgWriteRole('admin')).toBe(true);
    expect(isOrgWriteRole('editor')).toBe(true);
  });

  it('keeps viewers and unknown roles read-only', () => {
    expect(isOrgWriteRole('viewer')).toBe(false);
    expect(isOrgWriteRole('member')).toBe(false);
    expect(isOrgWriteRole('')).toBe(false);
  });
});
