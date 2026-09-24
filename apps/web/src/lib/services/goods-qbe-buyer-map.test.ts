import { describe, expect, it } from 'vitest';
import { QBE_BUYER_MAP } from './goods-qbe-buyer-map';
import { GOODS_SERVED_PLACES } from './goods-served-places';

describe('QBE_BUYER_MAP', () => {
  it('links an entity exactly when the match says it does', () => {
    for (const b of QBE_BUYER_MAP) expect(b.gsId === null).toBe(b.match === 'none');
  });

  it('gives every organisation at least one role in the Goods model', () => {
    for (const b of QBE_BUYER_MAP) expect(b.modelRoles.length, b.name).toBeGreaterThan(0);
  });

  it('never links two organisations to one entity', () => {
    const ids = QBE_BUYER_MAP.map((b) => b.gsId).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('served place regions', () => {
  it('puts the places Goods already serves in the QBE team\'s regions where they fall', () => {
    const region = (slug: string) => GOODS_SERVED_PLACES.find((p) => p.slug === slug)?.region;
    expect(region('tennant-creek')).toBe('Central Desert & Barkly');
    expect(region('maningrida')).toBe('North East Arnhem Land');
    expect(region('palm-island')).toBe('Cape York & Palm Island');
    expect(region('darwin')).toBeNull();
  });
});
