import { describe, it, expect } from 'vitest';
import {
  CANONICAL_NUMBERS,
  CLAIM_LABEL_MEANINGS,
  needsReconciliation,
  reconciliationNote,
  getCanonical,
  canonical,
  type ClaimLabel,
} from '@/lib/services/goods-canonical-numbers';
import { PITCH_SPINE, PITCH_SPINE_FACTS } from '@/lib/services/goods-pitch-content';

const VALID_LABELS: ClaimLabel[] = ['verified', 'modelled', 'target', 'future'];

describe('CANONICAL_NUMBERS', () => {
  it('has well-formed entries: non-empty key/label/unit/asOf/definition/source', () => {
    for (const n of CANONICAL_NUMBERS) {
      expect(n.key.length).toBeGreaterThan(0);
      expect(n.label.length).toBeGreaterThan(0);
      expect(n.unit.length).toBeGreaterThan(0);
      expect(n.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.definition.length).toBeGreaterThan(0);
      expect(n.source.length).toBeGreaterThan(0);
      expect(['number', 'string']).toContain(typeof n.value);
    }
  });

  it('has unique keys', () => {
    const keys = CANONICAL_NUMBERS.map((n) => n.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every claimLabel is in the valid taxonomy', () => {
    for (const n of CANONICAL_NUMBERS) {
      expect(VALID_LABELS).toContain(n.claimLabel);
    }
  });

  it('carries the current deployed-bed total and product composition', () => {
    const deployed = getCanonical('deployed_bed_units');
    const stretch = getCanonical('stretch_beds_deployed');
    const basket = getCanonical('basket_beds_deployed');
    expect(deployed?.value).toBe(540);
    expect(deployed?.claimLabel).toBe('verified');
    expect(stretch?.value).toBe(177);
    expect(basket?.value).toBe(363);
    expect(Number(stretch?.value) + Number(basket?.value)).toBe(deployed?.value);
  });

  it('includes the current community and washer definitions', () => {
    expect(getCanonical('washers_in_community')?.value).toBe(22);
    expect(getCanonical('washers_in_community')?.definition).toMatch(/manual per-community ruling/i);
    expect(getCanonical('washers_in_community')?.definition).toMatch(/not row-derived/i);
    expect(getCanonical('served_communities')?.value).toBe(11);
    expect(getCanonical('distinct_communities_touched')?.value).toBe(12);
  });

  it('labels the 3,540 kg design-mass calculation as modelled, not measured diversion', () => {
    const designMass = getCanonical('stretch_design_mass_kg');
    expect(designMass?.value).toBe(3540);
    expect(designMass?.claimLabel).toBe('modelled');
    expect(designMass?.definition).toMatch(/177 deployed Stretch Beds x 20 kg/);
    expect(designMass?.definition).toMatch(/not a weighbridge measurement/i);
  });

  it('retains the reviewer-safe verified finance figures', () => {
    expect(getCanonical('receivables_paid')?.value).toBe(650910.79);
  });

  it('tags the cost band modelled and the scale figure target', () => {
    expect(getCanonical('production_cost_band')?.claimLabel).toBe('modelled');
    expect(getCanonical('scale_target_beds')?.claimLabel).toBe('target');
  });
});

describe('reconciliation flag', () => {
  it('needsReconciliation is false under the 2026-07-25 Goods canon', () => {
    expect(needsReconciliation).toBe(false);
  });

  it('reconciliationNote documents the current composition and caveats', () => {
    expect(reconciliationNote).toMatch(/540/);
    expect(reconciliationNote).toMatch(/363 Basket/);
    expect(reconciliationNote).toMatch(/177 Stretch/);
    expect(reconciliationNote).toMatch(/22 washers/);
    expect(reconciliationNote).toMatch(/11 communities/);
    expect(reconciliationNote).toMatch(/12 distinct/);
    expect(reconciliationNote).toMatch(/3,540 kg/);
    expect(reconciliationNote).toMatch(/not a weighbridge/);
    expect(reconciliationNote).toMatch(/RECONCILED/);
  });
});

describe('CLAIM_LABEL_MEANINGS', () => {
  it('has a one-phrase meaning for every valid label', () => {
    for (const label of VALID_LABELS) {
      expect(CLAIM_LABEL_MEANINGS[label].length).toBeGreaterThan(0);
    }
  });
});

describe('lookup helpers', () => {
  it('getCanonical returns undefined for unknown keys', () => {
    expect(getCanonical('nope')).toBeUndefined();
  });

  it('canonical throws for unknown keys', () => {
    expect(() => canonical('nope')).toThrow();
    expect(canonical('deployed_bed_units').value).toBe(540);
  });
});

describe('public pitch canon', () => {
  it('uses the current footprint and carries the two material caveats', () => {
    expect(PITCH_SPINE).toMatch(/540 beds deployed/);
    expect(PITCH_SPINE).toMatch(/177 Stretch Beds and 363 Basket Beds/);
    expect(PITCH_SPINE).toMatch(/22 washers in community.*manual ruling/);
    expect(PITCH_SPINE).toMatch(/3,540 kg.*not a weighed diversion total/);
    expect(PITCH_SPINE).not.toMatch(/\b(?:496|520)\b|2,660 kg|41 washers/);
  });

  it('labels calculated Stretch design mass as modelled', () => {
    const designMass = PITCH_SPINE_FACTS.find((fact) => fact.value === '3,540 kg');
    expect(designMass?.claimLabel).toBe('modelled');
  });
});
