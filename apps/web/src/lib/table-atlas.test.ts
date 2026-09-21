import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KEY_COLUMN, ORG_COLUMN, linkStatus } from './table-atlas';

// The atlas and the CI guard must agree on what "linked" means.
describe('table atlas linkage rule', () => {
  const guard = readFileSync(join(__dirname, '../../../../scripts/check-table-linkage.mjs'), 'utf8');

  it('uses the guard\'s patterns', () => {
    expect(guard).toContain(`const ORG = \`'${ORG_COLUMN}'\``);
    expect(guard).toContain(`const KEY = \`'${KEY_COLUMN}'\``);
  });

  it('classifies', () => {
    const base = { kind: 'r', key_columns: null, org_columns: null, fk_to_keyed: null, object: 'x' };
    expect(linkStatus({ ...base, key_columns: ['abn'] }).kind).toBe('keyed');
    expect(linkStatus({ ...base, org_columns: ['funder_name'], fk_to_keyed: ['organizations'] }).kind).toBe('via_fk');
    expect(linkStatus({ ...base, org_columns: ['funder_name'], object: 'fellows' }).kind).toBe('unlinked_exempt');
    expect(linkStatus({ ...base, org_columns: ['funder_name'], object: 'act_person_roles' }).kind).toBe('unlinked_accepted');
    expect(linkStatus({ ...base, org_columns: ['funder_name'], object: 'brand_new' }).kind).toBe('unlinked_new');
    expect(linkStatus({ ...base }).kind).toBe('no_organisations');
    expect(linkStatus({ ...base, kind: 'v' }).kind).toBe('not_a_table');
  });
});
