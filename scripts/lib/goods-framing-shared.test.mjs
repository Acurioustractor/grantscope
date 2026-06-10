/**
 * Tests for the Goods funder-framing pure helpers.
 * Run: node --test scripts/lib/goods-framing-shared.test.mjs
 *
 * Locks the matching contract (code OR name, leading-"The " strip,
 * contains-either-direction) and the SQL-escaping so a single quote in a
 * framing note can never break the generated UPDATE.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseName, namesMatch, fundsGoodsByCode, matchFunders,
  buildFraming, sqlEscape, buildUpdateSql,
} from './goods-framing-shared.mjs';

test('normaliseName strips leading "The ", lowercases, collapses whitespace', () => {
  assert.equal(normaliseName('The Snow Foundation'), 'snow foundation');
  assert.equal(normaliseName('  Centrecorp   Foundation '), 'centrecorp foundation');
  assert.equal(normaliseName(null), '');
});

test('namesMatch is case-insensitive, The-stripped, contains-either-direction', () => {
  assert.ok(namesMatch('Snow Foundation', 'The Snow Foundation'));
  assert.ok(namesMatch('Centrecorp', 'Centrecorp Foundation'));
  assert.ok(namesMatch('Centrecorp Foundation', 'centrecorp'));
  assert.ok(!namesMatch('Snow Foundation', 'Minderoo Foundation'));
  assert.ok(!namesMatch('', 'Snow Foundation'));
});

test('fundsGoodsByCode detects ACT-GD in projects_funded', () => {
  assert.ok(fundsGoodsByCode({ projects_funded: ['ACT-GD'] }));
  assert.ok(fundsGoodsByCode({ projects_funded: ['ACT-JH', 'ACT-GD'] }));
  assert.ok(!fundsGoodsByCode({ projects_funded: ['ACT-JH'] }));
  assert.ok(!fundsGoodsByCode({}));
});

test('matchFunders selects by code and by name, one match per row', () => {
  const funders = {
    snow: { name: 'The Snow Foundation', projects_funded: ['ACT-GD'], tone: 'a' },
    minderoo: { name: 'Minderoo Foundation', projects_funded: ['ACT-JH'], tone: 'b' },
    streetsmart: { name: 'StreetSmart Australia', projects_funded: ['ACT-JH'], tone: 'c' },
  };
  const rows = [
    { id: 'u1', display_name: 'Snow Foundation' },        // code + name → code
    { id: 'u2', display_name: 'StreetSmart Australia' },  // name only (no ACT-GD)
    { id: 'u3', display_name: 'Nobody In The Ledger' },   // no match
  ];
  const m = matchFunders(funders, rows);
  assert.equal(m.length, 2);
  const byId = Object.fromEntries(m.map((x) => [x.id, x]));
  assert.equal(byId.u1.slug, 'snow');
  assert.equal(byId.u1.matchedBy, 'code');
  assert.equal(byId.u2.slug, 'streetsmart');
  assert.equal(byId.u2.matchedBy, 'name');
  assert.equal(byId.u3, undefined);
});

test('buildFraming carries the rendered fields plus provenance', () => {
  const f = buildFraming('snow', {
    tone: 'values-driven',
    framing_notes: 'Lead with the closed-loop framing.',
    claims_to_lead_with: ['a', 'b'],
    claims_to_avoid: [],
    primary_contact: 'Sally Grimsley-Ballard',
    last_communicated_at: '2026-05-20',
  }, '2026-06-10T00:00:00.000Z');
  assert.equal(f.slug, 'snow');
  assert.equal(f.tone, 'values-driven');
  assert.deepEqual(f.claims_to_lead_with, ['a', 'b']);
  assert.deepEqual(f.claims_to_avoid, []);
  assert.equal(f.primary_contact, 'Sally Grimsley-Ballard');
  assert.equal(f.synced_at, '2026-06-10T00:00:00.000Z');
});

test('buildFraming defaults missing arrays/fields safely', () => {
  const f = buildFraming('x', {}, 'now');
  assert.deepEqual(f.claims_to_lead_with, []);
  assert.deepEqual(f.claims_to_avoid, []);
  assert.equal(f.tone, null);
  assert.equal(f.primary_contact, null);
});

test('sqlEscape doubles single quotes', () => {
  assert.equal(sqlEscape("O'Brien's notes"), "O''Brien''s notes");
  assert.equal(sqlEscape('no quotes'), 'no quotes');
});

test('buildUpdateSql escapes quotes inside framing JSON and ids', () => {
  const matches = [{
    id: 'abc-123',
    display_name: 'Snow Foundation',
    slug: 'snow',
    entry: { tone: "don't hand-wave", framing_notes: "it's built", claims_to_lead_with: [], claims_to_avoid: [] },
    matchedBy: 'code',
  }];
  const sql = buildUpdateSql(matches, 'now');
  assert.ok(sql.includes("WHERE id = 'abc-123';"));
  // No unescaped single quote survives inside the jsonb literal body.
  assert.ok(sql.includes("don''t hand-wave"));
  assert.ok(sql.includes("it''s built"));
  // The literal is well-formed: exactly one UPDATE line.
  assert.equal(sql.split('\n').filter((l) => l.startsWith('UPDATE ')).length, 1);
});
