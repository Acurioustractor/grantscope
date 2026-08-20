import { describe, expect, it } from 'vitest';
import {
  givingLabel,
  measuredGivingOrderSql,
  grantmakingGivingSql,
  isGivingMeasured,
  isPlaceholderGiving,
} from './foundation-giving';

const fmt = (n: number) => `$${n.toLocaleString()}`;

describe('the four organisations that were ranked as top funders', () => {
  // Measured live 2026-08-21. Each was in the top seven of "foundations by giving".
  it.each([
    ['The University of Sydney', 'university', 340_674_255],
    ['Monash University', 'university', 273_722_000],
    ['Catholic Education Centre', 'religious_organisation', 281_472_122],
    ['Australian Red Cross Society', 'service_delivery', 265_670_000],
    ['Alice Springs Youth Accommodation & Support', 'service_delivery', 196_035_900],
  ])('%s is not a grantmaking figure', (_name, type, value) => {
    expect(isGivingMeasured(type, value)).toBe(false);
    expect(givingLabel(type, value, fmt)).toBe('Not a grantmaking figure');
  });

  // The first version of this module was a DENYLIST of three receiving types and it failed open:
  // `university` was not on it, so Sydney stayed top of the ranking at $340.7M while the Red Cross
  // was correctly removed. foundations.type has 27 values including legal_aid, hospital,
  // research_body and peak_body. An allowlist fails closed instead.
  it.each(['university', 'legal_aid', 'hospital', 'research_body', 'peak_body', 'a_type_nobody_has_added_yet'])(
    '%s counts as nothing until a human adds it',
    type => {
      expect(isGivingMeasured(type, 100_000_000)).toBe(false);
    },
  );

  // The control: a real grantmaker of comparable size must survive.
  it('Minderoo, a genuine grantmaker, survives', () => {
    expect(isGivingMeasured('trust', 273_817_719)).toBe(true);
    expect(givingLabel('trust', 273_817_719, fmt)).toBe('$273,817,719');
  });
});

describe('the placeholder floor', () => {
  // 9,217 of 10,190 non-null values sit on these three numbers.
  it.each([25_000, 100_000, 500_000])('%d is a placeholder, not a measurement', v => {
    expect(isPlaceholderGiving(v)).toBe(true);
    expect(isGivingMeasured('trust', v)).toBe(false);
    expect(givingLabel('trust', v, fmt)).toContain('placeholder');
  });

  // Deliberate: a foundation that genuinely gives $25,000 is treated as unmeasured rather than
  // guessed at. Understating certainty is the safe direction.
  it('a near-miss value is treated as real', () => {
    expect(isPlaceholderGiving(25_001)).toBe(false);
    expect(isGivingMeasured('trust', 25_001)).toBe(true);
  });
});

describe('absent figures', () => {
  it.each([null, undefined, 0])('%s renders as not recorded, never as zero giving', v => {
    expect(isGivingMeasured('trust', v as number | null)).toBe(false);
    expect(givingLabel('trust', v as number | null, fmt)).toBe('Giving not recorded');
  });
});

describe('the SQL predicate', () => {
  it('allowlists the grantmaking types and excludes all three placeholders', () => {
    const sql = grantmakingGivingSql('f');
    for (const t of ['grantmaker', 'private_ancillary_fund', 'trust']) {
      expect(sql).toContain(`'${t}'`);
    }
    expect(sql).not.toContain('university');
    for (const v of [25000, 100000, 500000]) expect(sql).toContain(String(v));
    expect(sql).toContain('f.total_giving_annual');
  });

  // A null type is not evidence of grantmaking. 316 foundations carry no type and NONE of them
  // holds a figure above $50M, so failing closed here costs nothing measurable and prevents the
  // next untyped ingest from ranking as a major funder.
  it('a missing type counts as nothing', () => {
    expect(isGivingMeasured(null, 4_000_000)).toBe(false);
    expect(givingLabel(null, 4_000_000, fmt)).toBe('Not a grantmaking figure');
  });
});

describe('the ordering expression demotes rather than excludes', () => {
  // Filtering a browse would drop a university foundation entirely, which is a second silent
  // error on top of the first. Every row stays; the unmeasured ones go last.
  it('nulls the unmeasured cases so they sort last, and keeps the row', () => {
    const sql = measuredGivingOrderSql('f');
    expect(sql).toContain('DESC NULLS LAST');
    expect(sql).toContain("'grantmaker'");
    expect(sql).toContain('25000');
    expect(sql).not.toContain('WHERE');
  });
});
