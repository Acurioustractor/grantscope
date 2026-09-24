import { describe, expect, it } from 'vitest';
import { classifyPurchase, communityRole, groupPurchases } from './goods-demand-map';

// Every case below is a real contract title seen while vetting on 2026-09-24.
describe('classifyPurchase', () => {
  it.each([
    ['Darwin - Supply and Delivery of 150 Mattresses', 'NT Department of Education and Training - Regional Services'],
    ['Standing Order for provision of whitegoods and furniture Cooktown Housing 2.10.18 to 1.4.19', 'QH_Torres and Cape Hospital and Health Service'],
    ['Supply and Delivery of Household Furniture/Whitegoods for Two Houses in Borroloola and Wad', 'NT Territory Families - Families and Regional Services'],
    ['Alice Springs - Supply, delivery and installation of Forty (40) king single ensemble beds', 'NT Department of Health - Central Australia Health Service'],
  ])('keeps household: %s', (title, buyer) => {
    expect(classifyPurchase(title, buyer)).toBe('household');
  });

  it.each([
    ['Supply and Delivery of 250 Mattresses for Prison Expansion', 'NT Department of the Attorney-General and Justice - Custodial Services'],
    ['Provision of Fire Retardant Mattresses to Queensland Correctional centres', 'Queensland Corrective Services'],
    ['Darwin - Supply and Delivery of 5 x Secure Care Beds & Mattresses for Yirra House', 'NT Territory Families - Youth Justice'],
  ])('sets custodial apart: %s', (title, buyer) => {
    expect(classifyPurchase(title, buyer)).toBe('custodial');
  });

  it.each([
    'Katherine Region - Repairs and Maintenance of Roadside Furniture for a Period of 36 Months',
    'East Arnhem Region - Galiwinku - Construction of 5 X 4 and 4 X 6 Bed Dwellings',
    'All of NT - Supply and Delivery of Adult Hospital Beds for a Period of 60 Months',
    'Casuarina Bus Interchange - Alterations to Fencing and Garden Beds',
    'Alice Springs Region - Utopia Airstrip -  Install Reno Mattress',
    'Yulara - Construction of Additional Sludge Drying Beds',
    'Darwin - Supply Delivery and Installation of Office Pod and Associated Furniture',
  ])('drops a non-bed: %s', (title) => {
    expect(classifyPurchase(title, 'Any buyer')).toBeNull();
  });
});

describe('communityRole', () => {
  it('reads the role from the name, first match wins', () => {
    expect(communityRole('Anyinginyi Health Aboriginal Corporation')).toBe('health service');
    expect(communityRole('Aboriginal Hostels Limited')).toBe('hostel / accommodation');
    expect(communityRole('Homeland School Company')).toBe('homelands / resource centre');
    expect(communityRole('Barkly Regional Council')).toBe('council');
    expect(communityRole('Arnhem Land Progress Aboriginal Corporation')).toBe('community store');
    expect(communityRole('Some Pastoral Company')).toBeNull();
  });
});

describe('groupPurchases', () => {
  it('groups by buyer, drops duplicates and non-beds, keeps custodial apart', () => {
    const rows = [
      { buyer: 'A', title: '150 Mattresses', value: 100, date: '2024-11-06', source: 'austender' as const },
      { buyer: 'A', title: '150 Mattresses', value: 100, date: '2024-11-06', source: 'austender' as const },
      { buyer: 'A', title: 'Roadside Furniture', value: 9999, date: '2025-01-01', source: 'austender' as const },
      { buyer: 'Corrective Services', title: 'Mattresses', value: 50, date: null, source: 'qld-tenders' as const },
    ];
    const g = groupPurchases(rows);
    expect(g.household).toHaveLength(1);
    expect(g.household[0].total).toBe(100);
    expect(g.household[0].purchases).toHaveLength(1);
    expect(g.custodial.map((c) => c.buyer)).toEqual(['Corrective Services']);
  });
});
