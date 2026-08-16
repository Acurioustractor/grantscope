import { describe, expect, it } from 'vitest';
import { NON_RECIPIENT_NAMES, isRealRecipient, money } from './justice-money';

describe('isRealRecipient — the filter CLAUDE.md does not document', () => {
  it('rejects source-spreadsheet total rows', () => {
    // Found 2026-08-16. `measure_kind='grant'` does NOT exclude these: 44 rows out of 126,673
    // carry aggregate-shaped names and hold $8.09bn — 17.5% of the documented $46.1bn.
    for (const n of ['Total', 'total', ' TOTAL ', 'Totals', 'Grand Total', 'Subtotal']) {
      expect(isRealRecipient(n)).toBe(false);
    }
  });

  it('rejects placeholder recipients', () => {
    for (const n of ['Various', 'n/a', 'N/A', 'Unknown', 'TBC', 'Other']) {
      expect(isRealRecipient(n)).toBe(false);
    }
  });

  it('accepts real organisations, including ones containing a rejected word', () => {
    // Why this is an explicit set and not a /total/ pattern: excluding a real recipient
    // understates them on a public page.
    expect(isRealRecipient('Lifeline Community Care')).toBe(true);
    expect(isRealRecipient('Mission Australia')).toBe(true);
    expect(isRealRecipient('Total Care Youth Services Inc')).toBe(true);
    expect(isRealRecipient('Various Voices Aboriginal Corporation')).toBe(true);
  });

  it('rejects an absent name rather than counting it', () => {
    expect(isRealRecipient(null)).toBe(false);
    expect(isRealRecipient(undefined)).toBe(false);
    expect(isRealRecipient('')).toBe(false);
    expect(isRealRecipient('   ')).toBe(false);
  });

  it('holds the exclusion list lower-cased, or the trim/lower comparison silently fails', () => {
    for (const n of NON_RECIPIENT_NAMES) {
      expect(n).toBe(n.toLowerCase().trim());
    }
  });
});

describe('money', () => {
  it('formats at the scale a reader can hold', () => {
    expect(money(1_040_000_000)).toBe('$1.04bn');
    expect(money(30_100_000)).toBe('$30.1m');
    expect(money(8_700)).toBe('$9k');
    expect(money(412)).toBe('$412');
  });

  it('does not round a real figure up into a bigger unit', () => {
    expect(money(999_999)).toBe('$1000k');
    expect(money(1_000_000)).toBe('$1.0m');
  });
});
