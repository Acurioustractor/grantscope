import { describe, expect, it } from 'vitest';
import { parseAllocationFilters, summariseAllocation, type AllocationRow } from './allocation';

const row = (o: Partial<AllocationRow>): AllocationRow => ({
  lga_code: '1', lga_name: 'A', state: 'QLD', remoteness: null, population: 1000, irsd_decile: 5, min_irsd_decile: 5,
  org_count: 1, community_controlled: 0, charities_reporting: 0, charity_revenue: 0, charity_gov_revenue: 0, charity_donations: 0,
  charity_fte: 0, cw_grant_count: 0, cw_grant_value_24m: 0, cw_delivery_count: 0, cw_delivery_value_24m: 0, cw_recipient_24m_with_delivery: 0, cw_delivery_stated_pct: null, jf_grant_count: 0, jf_grant_value: 0, contract_value_24m: 0, unplaced_sharing_postcodes: 0,
  charities_tracked: 0, charities_shrinking: 0, charities_growing: 0, charities_lapsed: 0, charities_gov_dependent: 0, charities_three_year_deficit: 0, shrinking_revenue_lost: 0, shrinking_share_pct: null,
  gov_revenue_per_head: 0, donations_per_head: 0, cw_grants_24m_per_head: 0, cw_delivery_24m_per_head: 0, orgs_per_10k: 0, placed_share_pct: 100, ...o,
});

describe('parseAllocationFilters', () => {
  it('falls back to defaults on anything unrecognised', () => {
    expect(parseAllocationFilters({ state: 'XX', sort: 'drop table', decile: '99', remoteness: 'Mars' }))
      .toEqual({ state: '', remoteness: '', decile: '', sort: 'need' });
  });
  it('keeps recognised values', () => {
    expect(parseAllocationFilters({ state: 'NT', sort: 'sure', decile: '1-2' }).sort).toBe('sure');
    expect(parseAllocationFilters({ state: 'NT' }).state).toBe('NT');
  });
});

describe('summariseAllocation', () => {
  it('counts disadvantaged councils below the median government dollars per head', () => {
    const rows = [
      row({ irsd_decile: 1, gov_revenue_per_head: 10 }),
      row({ irsd_decile: 2, gov_revenue_per_head: 500 }),
      row({ irsd_decile: 8, gov_revenue_per_head: 100 }),
      row({ irsd_decile: 1, gov_revenue_per_head: null }),
    ];
    const s = summariseAllocation(rows);
    expect(s.median_gov_per_head).toBe(100);
    // decile 1 at $10 and decile 1 with no figure (treated as 0) are under the median; decile 2 at $500 is not.
    expect(s.under_median_disadvantaged).toBe(2);
    expect(s.population).toBe(4000);
  });
});
