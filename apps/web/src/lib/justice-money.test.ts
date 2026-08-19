import { describe, expect, it } from 'vitest';
import { GRANT_FILTER_SQL, NON_RECIPIENT_NAMES, donationFilterSql, grantFilterSql, isRealRecipient, money } from './justice-money';

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


describe('grantFilterSql — the predicate raw exec_sql call sites must not retype', () => {
  it('carries all three filters', () => {
    const sql = grantFilterSql();
    expect(sql).toContain("measure_kind = 'grant'");
    expect(sql).toContain('is_aggregate IS NOT TRUE');
    expect(sql).toContain("'total'");
  });

  it('prefixes every column when given an alias, so it can be dropped into an aliased query', () => {
    const sql = grantFilterSql('jf');
    expect(sql).toContain("jf.measure_kind = 'grant'");
    expect(sql).toContain('jf.is_aggregate IS NOT TRUE');
    expect(sql).toContain('lower(btrim(jf.recipient_name))');
    // No bare column may survive — a missed prefix is an ambiguous-column error at query time
    // in some queries and, worse, resolves to the WRONG table's column in others.
    expect(sql).not.toMatch(/(?<!\.)\bmeasure_kind\b/);
    expect(sql).not.toMatch(/(?<!\.)\bis_aggregate\b/);
    expect(sql).not.toMatch(/(?<!\.)\brecipient_name\b/);
  });

  it('exports the unaliased form as a constant', () => {
    expect(GRANT_FILTER_SQL).toBe(grantFilterSql());
  });

  it('lists every non-recipient name', () => {
    for (const n of NON_RECIPIENT_NAMES) expect(grantFilterSql()).toContain(`'${n}'`);
  });
});

describe('donationFilterSql', () => {
  it("keeps only 'donation received' — 'other receipt' is 85% of the dollars and is not donations", () => {
    expect(donationFilterSql()).toBe("receipt_type = 'donation received'");
    expect(donationFilterSql('pd')).toBe("pd.receipt_type = 'donation received'");
  });
});
