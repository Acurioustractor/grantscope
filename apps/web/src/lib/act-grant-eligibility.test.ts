import { describe, expect, it } from 'vitest';
import { entityVerdict, grantPlace, locationVerdict, projectEligibility, ACT_PROJECTS } from './act-grant-eligibility';

const g = (p: Partial<{ dgr_required: boolean | null; accepts_pty_ltd: boolean | null; geography: string | null; place: unknown }>) => ({
  dgr_required: null, accepts_pty_ltd: null, geography: null, place: null, ...p,
});

describe('grantPlace', () => {
  it('prefers metadata.place', () => {
    expect(grantPlace('AU-WA', { state: 'QLD', lga_name: 'Sunshine Coast' })).toMatchObject({ known: true, states: ['QLD'], lgas: [{ lga: 'Sunshine Coast' }] });
  });
  it('parses geography code lists, national wins', () => {
    expect(grantPlace('AU-WA, AU-National, International', null).national).toBe(true);
    expect(grantPlace('AU-ACT, AU-NSW', null).states).toEqual(['ACT', 'NSW']);
    expect(grantPlace('VIC', null).states).toEqual(['VIC']);
  });
  it('is unknown when nothing parses', () => {
    expect(grantPlace('', null).known).toBe(false);
    expect(grantPlace('NZ', null).known).toBe(false);
  });
});

describe('locationVerdict', () => {
  const harvest = ACT_PROJECTS.harvest.area;
  const jh = ACT_PROJECTS.justicehub.area;
  const goods = ACT_PROJECTS.goods.area;
  it('matches Sunshine Coast for Harvest, ignoring "Council" wording', () => {
    expect(locationVerdict(harvest, grantPlace(null, { state: 'QLD', lga_name: 'Sunshine Coast Council' }))).toBe('yes');
  });
  it('refuses a different council for a one-place project', () => {
    expect(locationVerdict(harvest, grantPlace(null, { state: 'QLD', lga_name: 'Fraser Coast' }))).toBe('no');
  });
  it('same council name in another state is not a match', () => {
    expect(locationVerdict(harvest, grantPlace(null, { state: 'NSW', lga_name: 'Sunshine Coast' }))).toBe('no');
  });
  it('a QLD-wide grant covers Harvest; a WA grant does not', () => {
    expect(locationVerdict(harvest, grantPlace('AU-QLD', null))).toBe('yes');
    expect(locationVerdict(harvest, grantPlace('AU-WA', null))).toBe('no');
  });
  it('national projects get unknown, not no, on state or council grants', () => {
    expect(locationVerdict(jh, grantPlace('AU-WA', null))).toBe('unknown');
    expect(locationVerdict(jh, grantPlace(null, { state: 'WA', lga_name: 'Perth' }))).toBe('unknown');
    expect(locationVerdict(jh, grantPlace('AU-National', null))).toBe('yes');
  });
  it('Goods covers NT, QLD, WA but not VIC', () => {
    expect(locationVerdict(goods, grantPlace('AU-NT', null))).toBe('yes');
    expect(locationVerdict(goods, grantPlace('AU-VIC', null))).toBe('no');
  });
});

describe('entityVerdict', () => {
  it('DGR-required grants: only Butterfly', () => {
    const grant = g({ dgr_required: true });
    expect(entityVerdict('butterfly', grant)).toBe('yes');
    expect(entityVerdict('pty', grant)).toBe('no');
    expect(entityVerdict('akt', grant)).toBe('no');
  });
  it('accepts_pty_ltd decides the Pty only', () => {
    expect(entityVerdict('pty', g({ accepts_pty_ltd: false }))).toBe('no');
    expect(entityVerdict('pty', g({ accepts_pty_ltd: true }))).toBe('yes');
    expect(entityVerdict('akt', g({ accepts_pty_ltd: true }))).toBe('unknown');
  });
  it('nothing recorded is unknown', () => {
    expect(entityVerdict('pty', g({}))).toBe('unknown');
  });
});

describe('projectEligibility', () => {
  it('JusticeHub cannot use a DGR-only grant (no Butterfly for JH)', () => {
    expect(projectEligibility('justicehub', g({ dgr_required: true, geography: 'AU-National' })).overall).toBe('no');
  });
  it('Harvest can use a DGR-only Sunshine Coast grant via Butterfly', () => {
    const e = projectEligibility('harvest', g({ dgr_required: true, place: { state: 'QLD', lga_name: 'Sunshine Coast' } }));
    expect(e.overall).toBe('yes');
    expect(e.entities.find((x) => x.verdict === 'yes')?.entity).toBe('butterfly');
  });
  it('location no overrides entity yes', () => {
    expect(projectEligibility('farm', g({ accepts_pty_ltd: true, geography: 'AU-VIC' })).overall).toBe('no');
  });
  it('unknown stays unknown', () => {
    expect(projectEligibility('contained', g({ geography: 'AU-National' })).overall).toBe('unknown');
  });
});
