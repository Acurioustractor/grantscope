import { describe, expect, it } from 'vitest';
import {
  GOODS_CLAIM_LEDGER,
  GOODS_DECISION_GATES,
  GOODS_FORMS,
  GOODS_MONEY_DOORS,
  GOODS_PLACE_PATHWAYS,
  deriveGoodsUnitEconomics,
} from '@/lib/services/goods-living-investment-model';

describe('deriveGoodsUnitEconomics', () => {
  it('keeps the verified price separate from the two cost paths', () => {
    const model = deriveGoodsUnitEconomics();

    expect(model.salePrice).toBe(750);
    expect(model.currentContribution).toBeCloseTo(65.21, 2);
    expect(model.pressedContribution).toBeCloseTo(324.26, 2);
    expect(model.contributionChange).toBeCloseTo(259.05, 2);
  });

  it('calculates the shared-network break-even from pressed contribution', () => {
    const model = deriveGoodsUnitEconomics();

    expect(model.pressedNetworkBreakEvenBeds).toBe(338);
  });

  it('does not claim a break-even when contribution is zero or negative', () => {
    expect(
      deriveGoodsUnitEconomics({
        salePrice: 400,
        pressedMarginalCost: 425.74,
      }).pressedNetworkBreakEvenBeds,
    ).toBeNull();
  });
});

describe('place-first pathways', () => {
  it('contains the four real pathways and no generic factory scenario', () => {
    expect(GOODS_PLACE_PATHWAYS.map((pathway) => pathway.id)).toEqual([
      'oonchiumpa',
      'utopia',
      'tennant-creek',
      'palm-island',
    ]);
  });

  it('treats Palm Island governance as unpriced work, never zero-cost work', () => {
    const palmIsland = GOODS_PLACE_PATHWAYS.find((pathway) => pathway.id === 'palm-island');

    expect(palmIsland?.capital.value).toBe('Not priced');
    expect(palmIsland?.operating.value).toMatch(/unpriced/i);
    expect(`${palmIsland?.capital.value} ${palmIsland?.operating.value}`).not.toContain('$0');
  });

  it('does not turn an older proposal into current community authority', () => {
    const tennantCreek = GOODS_PLACE_PATHWAYS.find((pathway) => pathway.id === 'tennant-creek');

    expect(tennantCreek?.proof.some((claim) => claim.status === 'open')).toBe(true);
    expect(tennantCreek?.caution).toMatch(/cannot be treated as a present request/i);
  });
});

describe('money and entity boundaries', () => {
  it('shows three money doors but only two current legal recipients', () => {
    expect(GOODS_MONEY_DOORS).toHaveLength(3);

    const currentForms = GOODS_FORMS.filter((form) => form.id !== 'community-enterprise');
    expect(currentForms).toHaveLength(2);

    const communityForm = GOODS_FORMS.find((form) => form.id === 'community-enterprise');
    expect(communityForm?.status).toBe('open');
    expect(communityForm?.legalState).toMatch(/not yet settled/i);
  });

  it('requires evidence before more money moves through every door', () => {
    expect(GOODS_MONEY_DOORS.every((door) => door.proofBeforeMore.length > 30)).toBe(true);
  });
});

describe('honesty gates', () => {
  it('keeps modelled need separate from signed demand', () => {
    const demandGate = GOODS_DECISION_GATES.find((gate) => gate.label === 'Demand');

    expect(demandGate?.status).toBe('open');
    expect(demandGate?.why).toMatch(/need is not a purchase order/i);
  });

  it('keeps the old 75–100 bed shortcut only as an explicitly retired claim', () => {
    const oldShortcut = GOODS_CLAIM_LEDGER.find((claim) => claim.value === '75–100 beds / year');

    expect(oldShortcut?.status).toBe('retired');
    expect(oldShortcut?.note).toMatch(/rent line/i);
  });

  it('does not present the workbook auto-build curve or placeholder capital stack as real', () => {
    const growthCurve = GOODS_CLAIM_LEDGER.find((claim) => claim.label === 'Spreadsheet growth curve');
    const capital = GOODS_CLAIM_LEDGER.find((claim) => claim.label === 'Capital stack');

    expect(growthCurve?.status).toBe('retired');
    expect(growthCurve?.note).toMatch(/no demand constraint/i);
    expect(capital?.value).toMatch(/\$0 signed/i);
    expect(capital?.note).toMatch(/placeholders, not commitments/i);
  });
});
