/**
 * Tests for the one definition of an entity id.
 * Run: node --test scripts/lib/gs-id.test.mjs
 *
 * Locks the two #324 defects so they cannot come back:
 *   - an invalid ABN must NOT mint an entity (abn '0' merged Saxonvale with an unrelated company
 *     across 2,959 edges)
 *   - the fallback must be deterministic (the old one was Date.now(), a duplicate generator)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGsId, isValidAbn, isValidAcn, nameHash } from './gs-id.mjs';

test('accepts real ABNs, with or without spacing', () => {
  assert.equal(isValidAbn('51824753556'), true);
  assert.equal(isValidAbn('51 824 753 556'), true);
  assert.equal(isValidAbn('53004085616'), true);
});

test('rejects the junk that reached production', () => {
  // Every one of these is a real value currently sitting in gs_entities.abn.
  for (const junk of ['0', '#N/A', '#VALUE!', '(blank)', '', '054687035', '1010000462']) {
    assert.equal(isValidAbn(junk), false, `${junk} must not validate`);
  }
});

test('rejects an 11-digit number that fails the checksum', () => {
  assert.equal(isValidAbn('12345678901'), false);
});

test('an invalid ABN falls through instead of minting an entity', () => {
  // The Saxonvale case: abn '0' must not win over the government buyer id.
  assert.equal(makeGsId({ abn: '0', buyer_id: 'B123' }), 'AU-GOV-B123');
  assert.equal(makeGsId({ abn: '#VALUE!', name: 'Some Agency' }), makeGsId({ name: 'Some Agency' }));
});

test('a valid ABN wins over everything else', () => {
  assert.equal(makeGsId({ abn: '51 824 753 556', buyer_id: 'B1', name: 'X' }), 'AU-ABN-51824753556');
});

test('name ids are deterministic across case and whitespace', () => {
  assert.equal(nameHash('Department of Finance'), nameHash('  department of FINANCE '));
  assert.equal(makeGsId({ name: 'Department of Finance' }), makeGsId({ name: 'DEPARTMENT OF FINANCE' }));
});

test('no identifier throws rather than inventing a clock-based id', () => {
  assert.throws(() => makeGsId({}), /no usable identifier/);
  assert.throws(() => makeGsId({ name: '   ' }), /no usable identifier/);
});

test('ACN is length-checked', () => {
  assert.equal(isValidAcn('004085616'), true);
  assert.equal(isValidAcn('12345'), false);
  assert.equal(makeGsId({ acn: '004085616' }), 'AU-ACN-004085616');
});
