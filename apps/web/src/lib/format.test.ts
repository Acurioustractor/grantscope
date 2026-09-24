import { describe, expect, it } from 'vitest';
import { money } from './format';

describe('money, the one money format', () => {
  it('abbreviates by magnitude with one decimal for B and M', () => {
    expect(money(18_500_000_000)).toBe('$18.5B');
    expect(money(4_100_000)).toBe('$4.1M');
    expect(money(61_000)).toBe('$61K');
    expect(money(789)).toBe('$789');
  });

  it('shows zero as $0 and a missing value as a dash', () => {
    expect(money(0)).toBe('$0');
    expect(money(null)).toBe('—');
    expect(money(undefined)).toBe('—');
    expect(money(Number.NaN)).toBe('—');
  });

  it('keeps the sign on negatives', () => {
    expect(money(-2_500_000)).toBe('−$2.5M');
  });
});
