import { describe, expect, it } from 'vitest';
import { resolveGhlStamps } from './act-desk-ghl';

describe('resolveGhlStamps', () => {
  const mirror = [{ id: '11111111-2222-3333-4444-555555555555', ghl_id: 'abcDEF1234567890ghij' }];

  it('resolves a GHL id and a mirror UUID to the live GHL id', () => {
    const out = resolveGhlStamps(['abcDEF1234567890ghij', '11111111-2222-3333-4444-555555555555'], mirror);
    expect(out.get('abcDEF1234567890ghij')).toBe('abcDEF1234567890ghij');
    expect(out.get('11111111-2222-3333-4444-555555555555')).toBe('abcDEF1234567890ghij');
  });

  it('drops a stamp with no synced mirror row: a deleted opp is not in GHL', () => {
    expect(resolveGhlStamps(['deadDEAD1234567890xx'], mirror).size).toBe(0);
  });
});
