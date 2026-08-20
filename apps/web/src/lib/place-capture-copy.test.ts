import { describe, expect, it } from 'vitest';
import { divergenceNote, isConcentrated } from './place-capture-copy';
import { tallyCapture, type CapturePlace } from './grant-place-capture';

const place = (over: Partial<CapturePlace>): CapturePlace => ({
  place: 'Somewhere',
  state: 'QLD',
  remoteness: 'Very Remote Australia',
  biggestAwardShare: null,
  ...tallyCapture([]),
  ...over,
});

describe('what the place-capture section says', () => {
  // Ashburton, measured live 2026-08-21: 13% of dollars, 48% of awards, one grant 56% of the money.
  it('says the money leaves when the grants stay', () => {
    const ashburton = place({ pctDollarsLocal: 13, pctAwardsLocal: 48, biggestAwardShare: 56 });
    expect(divergenceNote(ashburton)).toBe('money-leaves');
    expect(isConcentrated(ashburton)).toBe(true);
  });

  // Litchfield, measured live: 98% of dollars, 87% of awards — the other direction, and real.
  it('says the grants leave when the money stays', () => {
    expect(divergenceNote(place({ pctDollarsLocal: 98, pctAwardsLocal: 87 }))).toBe('grants-leave');
  });

  // Huon Valley, measured live: 98% and 96%. Two close figures need no sentence.
  it('stays quiet when the two shares agree', () => {
    expect(divergenceNote(place({ pctDollarsLocal: 98, pctAwardsLocal: 96 }))).toBeNull();
  });

  it('fires the concentration warning below the floor of the worst-capturing councils', () => {
    // The twelve worst measured 2026-08-21 ran 38%-96%. The warning must fire before a place
    // reaches that shape, not once it is already there.
    expect(isConcentrated(place({ biggestAwardShare: 38 }))).toBe(true);
    expect(isConcentrated(place({ biggestAwardShare: 29 }))).toBe(false);
  });

  // Not held is not "not concentrated" — but there is nothing honest to say, so it stays silent
  // rather than implying the money is spread.
  it('does not warn when concentration is unknown', () => {
    expect(isConcentrated(place({ biggestAwardShare: null }))).toBe(false);
  });
});
