import { describe, expect, it } from 'vitest';
import { isInternalActIdentity } from '@/lib/act-internal-identities';

describe('isInternalActIdentity', () => {
  it('excludes Benjamin Knight from external relationship queues by name', () => {
    expect(isInternalActIdentity({ name: 'benjamin knight', organisation: 'axt' })).toBe(true);
  });

  it('excludes ACT founders by email even when the imported name is malformed', () => {
    expect(isInternalActIdentity({ name: 'B Knight', email: 'Benjamin@ACT.Place' })).toBe(true);
    expect(isInternalActIdentity({ name: 'Nicholas', email: 'nicholas@act.place' })).toBe(true);
  });

  it('keeps genuine external relationships', () => {
    expect(isInternalActIdentity({ name: 'Audrey Deemal', organisation: 'The Butterfly Movement Ltd' })).toBe(false);
    expect(isInternalActIdentity({ name: 'April Long', organisation: 'SMART Recovery Australia' })).toBe(false);
  });
});
