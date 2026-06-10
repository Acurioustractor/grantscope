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

  it('carries both delivered-bed counts (496 deployed and 520 assets-sync)', () => {
    const deployed = getCanonical('deployed_bed_units');
    const assetsSync = getCanonical('beds_delivered_assets_sync');
    expect(deployed?.value).toBe(496);
    expect(deployed?.claimLabel).toBe('verified');
    expect(assetsSync?.value).toBe(520);
    expect(assetsSync?.claimLabel).toBe('verified');
  });

  it('includes the reviewer-safe verified figures', () => {
    expect(getCanonical('served_communities')?.value).toBe(9);
    expect(getCanonical('hdpe_diverted_kg')?.value).toBe(2660);
    expect(getCanonical('receivables_paid')?.value).toBe(650910.79);
  });

  it('tags the cost band modelled and the scale figure target', () => {
    expect(getCanonical('production_cost_band')?.claimLabel).toBe('modelled');
    expect(getCanonical('scale_target_beds')?.claimLabel).toBe('target');
  });
});

describe('reconciliation flag', () => {
  it('needsReconciliation is true', () => {
    expect(needsReconciliation).toBe(true);
  });

  it('reconciliationNote names both definitions', () => {
    expect(reconciliationNote).toMatch(/496/);
    expect(reconciliationNote).toMatch(/520/);
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
    expect(canonical('deployed_bed_units').value).toBe(496);
  });
});
