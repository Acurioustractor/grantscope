import { describe, expect, it } from 'vitest';
import { entityHref } from './entity-href';

describe('entityHref', () => {
  it('links to the public entity page by gs_id', () => {
    expect(entityHref({ gsId: 'AU-ORIC-8123', abn: '12345678901', name: 'X' })).toBe('/entity/AU-ORIC-8123');
  });

  it('falls back to the ABN form when there is no gs_id', () => {
    expect(entityHref({ abn: '12 345 678 901', name: 'X' })).toBe('/entity/AU-ABN-12345678901');
  });

  it('never links a placeholder or malformed ABN; searches the name instead', () => {
    expect(entityHref({ abn: '00000000000', name: 'Acme Pty Ltd' })).toBe('/search?q=Acme%20Pty%20Ltd');
    expect(entityHref({ abn: 'Exempt-NonAustralianEntity', name: 'Acme' })).toBe('/search?q=Acme');
  });

  it('never produces a login-only /org link', () => {
    expect(entityHref({ name: 'Anything' })).not.toMatch(/^\/org\//);
  });
});
