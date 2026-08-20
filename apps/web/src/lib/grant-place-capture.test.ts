import { describe, expect, it } from 'vitest';
import {
  CAPTURE_MIN_AWARDS,
  CAPTURE_MIN_DOLLARS,
  MULTI_SITE_SENTINEL,
  buildPostcodeLgaIndex,
  isCapturableAward,
  isTrustworthyLocality,
  rankWorstCapturing,
  tallyCapture,
  type CaptureAward,
  type CapturePlace,
} from './grant-place-capture';

const award = (over: Partial<Parameters<typeof isCapturableAward>[0]> = {}) => ({
  delivery_postcode: '4816',
  value_aud: 100_000,
  recipient_name: 'Real Org Inc',
  ...over,
});

describe('exclusion 1 — multi-site grants are not a place', () => {
  it("refuses the literal string 'Multiple'", () => {
    expect(isCapturableAward(award({ delivery_postcode: MULTI_SITE_SENTINEL }))).toBe(false);
  });

  it('refuses it with surrounding whitespace too', () => {
    expect(isCapturableAward(award({ delivery_postcode: ' Multiple ' }))).toBe(false);
  });

  // The 4.5x error: admitted, 'Multiple' equals no recipient postcode, so every one of the
  // 5,978 rows counts as delivered off-site and cross-state leakage reads $17.79bn
  // instead of $3.95bn.
  it('excluded rows are not counted as delivered off-site', () => {
    const multi: CaptureAward = {
      value: 19_550_000_000,
      deliveryPlace: MULTI_SITE_SENTINEL,
      deliveryState: null,
      recipientPlace: 'Sydney',
      recipientState: 'NSW',
    };
    const admitted = tallyCapture([multi]);
    expect(admitted.localDollars).toBe(0);

    const excluded = tallyCapture([multi].filter(a => a.deliveryPlace !== MULTI_SITE_SENTINEL));
    expect(excluded.dollars).toBe(0);
    expect(excluded.pctDollarsLocal).toBe(0);
  });

  it('a real postcode is admitted', () => {
    expect(isCapturableAward(award())).toBe(true);
  });
});

describe('exclusion 2 — aggregates and non-positive values', () => {
  it.each(['Total', 'TOTALS', 'various', 'n/a', '(blank)', '   '])(
    'refuses the aggregate-shaped recipient name %j',
    name => {
      expect(isCapturableAward(award({ recipient_name: name }))).toBe(false);
    },
  );

  it.each([0, -1, null])('refuses a non-positive value %j', value_aud => {
    expect(isCapturableAward(award({ value_aud }))).toBe(false);
  });

  it('refuses an award with no delivery postcode at all', () => {
    expect(isCapturableAward(award({ delivery_postcode: null }))).toBe(false);
  });
});

describe('exclusion 3 — a postcode touching two councils resolves to none', () => {
  it('refuses rather than picking one', () => {
    const index = buildPostcodeLgaIndex([
      { postcode: '2620', locality: 'Queanbeyan', lga_name: 'Queanbeyan-Palerang' },
      { postcode: '2620', locality: 'Hume', lga_name: 'Snowy Monaro' },
    ]);
    expect(index.has('2620')).toBe(false);
  });

  it('keeps a postcode whose rows all name one council', () => {
    const index = buildPostcodeLgaIndex([
      { postcode: '4680', locality: 'Gladstone', lga_name: 'Gladstone' },
      { postcode: '4680', locality: 'Barney Point', lga_name: 'Gladstone' },
    ]);
    expect(index.get('4680')).toBe('Gladstone');
  });
});

describe('exclusion 4 — SA3-shaped postcode_geo rows carry wrong councils', () => {
  it('refuses the Croydon artefact', () => {
    // 4816 is Palm Island money. postcode_geo records it as locality
    // 'Townsville - South' with lga_name 'Croydon', ~900km away, which made
    // Croydon QLD the worst-capturing council in the country on $72.9M.
    expect(isTrustworthyLocality('Townsville - South')).toBe(false);
    const index = buildPostcodeLgaIndex([
      { postcode: '4816', locality: 'Townsville - South', lga_name: 'Croydon' },
      { postcode: '4816', locality: 'Palm Island', lga_name: 'Palm Island' },
    ]);
    // The bad row is refused BEFORE the single-council test, so the postcode
    // still resolves — and resolves to the right council.
    expect(index.get('4816')).toBe('Palm Island');
  });

  it('keeps ordinary locality names', () => {
    expect(isTrustworthyLocality('Alice Springs')).toBe(true);
    expect(isTrustworthyLocality(null)).toBe(false);
  });

  it('a postcode left with no trustworthy row resolves to nothing', () => {
    const index = buildPostcodeLgaIndex([
      { postcode: '4816', locality: 'Townsville - South', lga_name: 'Croydon' },
    ]);
    expect(index.size).toBe(0);
  });
});

describe('the measure', () => {
  const here = (value: number): CaptureAward => ({
    value,
    deliveryPlace: 'Palm Island',
    deliveryState: 'QLD',
    recipientPlace: 'Palm Island',
    recipientState: 'QLD',
  });
  const sameState = (value: number): CaptureAward => ({
    value,
    deliveryPlace: 'Palm Island',
    deliveryState: 'QLD',
    recipientPlace: 'Brisbane',
    recipientState: 'QLD',
  });
  const interstate = (value: number): CaptureAward => ({
    value,
    deliveryPlace: 'Palm Island',
    deliveryState: 'QLD',
    recipientPlace: 'Sydney',
    recipientState: 'NSW',
  });
  const unresolved = (value: number): CaptureAward => ({
    value,
    deliveryPlace: 'Palm Island',
    deliveryState: 'QLD',
    recipientPlace: null,
    recipientState: null,
  });

  it('counts same-council as captured and different-council as not', () => {
    const t = tallyCapture([here(10), sameState(10)]);
    expect(t.localAwards).toBe(1);
    expect(t.pctAwardsLocal).toBe(50);
  });

  it('separates regional centralisation from interstate extraction', () => {
    const t = tallyCapture([sameState(100), interstate(300)]);
    expect(t.sameStateElsewhereDollars).toBe(100);
    expect(t.crossStateDollars).toBe(300);
  });

  // The finding the whole module exists to carry: nationally 85.1% of awards
  // but 59.6% of dollars stay local. A surface showing one measure misleads.
  it('the two measures are computed independently and can diverge', () => {
    const t = tallyCapture([here(1), here(1), here(1), sameState(97)]);
    expect(t.pctAwardsLocal).toBe(75);
    expect(t.pctDollarsLocal).toBe(3);
  });

  it('unresolved recipients are their own bucket, not off-site', () => {
    const t = tallyCapture([here(50), unresolved(50)]);
    expect(t.unresolvedDollars).toBe(50);
    expect(t.sameStateElsewhereDollars).toBe(0);
    expect(t.crossStateDollars).toBe(0);
    // Resolved base says everything measured stayed put...
    expect(t.pctDollarsLocal).toBe(100);
    // ...the wider base says half the money left, which is the gloomier
    // reading and the source of the headline 59.6%.
    expect(t.pctDollarsLocalOfBase).toBe(50);
  });

  it('an empty set reports zeroes rather than dividing by zero', () => {
    const t = tallyCapture([]);
    expect(t.pctAwardsLocal).toBe(0);
    expect(t.pctDollarsLocal).toBe(0);
    expect(Number.isFinite(t.pctDollarsLocalOfBase)).toBe(true);
  });
});

describe('ranked lists are thresholded', () => {
  const place = (over: Partial<CapturePlace>): CapturePlace => ({
    place: 'Somewhere',
    state: 'QLD',
    remoteness: null,
    ...tallyCapture([]),
    ...over,
  });

  it('a single large grant in a tiny council cannot top the table', () => {
    const noise = place({
      place: 'Tiny Shire',
      resolvedAwards: 1,
      resolvedDollars: 300_000_000,
      pctDollarsLocal: 0,
    });
    const real = place({
      place: 'Wangaratta',
      resolvedAwards: 400,
      resolvedDollars: 258_000_000,
      pctDollarsLocal: 8.3,
    });
    const ranked = rankWorstCapturing([noise, real]);
    expect(ranked.map(p => p.place)).toEqual(['Wangaratta']);
  });

  it('thresholds default from the module, not the caller', () => {
    expect(CAPTURE_MIN_AWARDS).toBeGreaterThan(1);
    expect(CAPTURE_MIN_DOLLARS).toBeGreaterThan(0);
    const justUnder = place({
      resolvedAwards: CAPTURE_MIN_AWARDS - 1,
      resolvedDollars: CAPTURE_MIN_DOLLARS * 10,
    });
    expect(rankWorstCapturing([justUnder])).toEqual([]);
  });

  it('ranks by awards when asked', () => {
    const common = { resolvedAwards: 100, resolvedDollars: CAPTURE_MIN_DOLLARS * 2 };
    const a = place({ place: 'A', ...common, pctAwardsLocal: 20, pctDollarsLocal: 90 });
    const b = place({ place: 'B', ...common, pctAwardsLocal: 90, pctDollarsLocal: 20 });
    expect(rankWorstCapturing([a, b], { by: 'awards' })[0].place).toBe('A');
    expect(rankWorstCapturing([a, b], { by: 'dollars' })[0].place).toBe('B');
  });
});
