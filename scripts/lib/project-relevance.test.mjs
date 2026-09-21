/**
 * Tests for the per-project fit scorers.
 * Run: node --test scripts/lib/project-relevance.test.mjs
 *
 * Locks the reason this file exists: opportunity-intelligence.ts's PROJECT_LENSES
 * bare-substring keywords ('data', 'land', 'tour', 'story') tag unrelated grants.
 * These scorers require a specific TIER_1 phrase before a lone thematic word can tag.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreGrantForProject, scoreGrantForAllProjects, applyProjectTags, PROJECT_CODES, PROJECT_TAG_THRESHOLD, rubricQualifies, countRubricFits, RUBRIC_FIT_AT, RUBRIC_CONFIDENCE_AT } from './project-relevance.mjs';

test('a real youth justice diversion grant scores at/above threshold for justicehub', () => {
  const { score, signals } = scoreGrantForProject('justicehub', {
    name: 'Youth Justice Diversion Program Grants',
    provider: 'NSW Department of Communities and Justice',
    description: 'Funding for restorative justice and youth mentoring programs to reduce recidivism.',
  });
  assert.ok(score >= PROJECT_TAG_THRESHOLD, `expected >= ${PROJECT_TAG_THRESHOLD}, got ${score}`);
  assert.ok(signals.tier1_hits.length > 0);
});

test('a generic "justice" mention without shape does not tag justicehub', () => {
  const { score } = scoreGrantForProject('justicehub', {
    name: 'Access to Justice Legal Aid Fund',
    provider: 'Attorney-General\'s Department',
    description: 'General legal aid funding for community legal centres.',
  });
  assert.ok(score < PROJECT_TAG_THRESHOLD, `expected < ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('a bushfire land-recovery grant does not tag farm despite the word "land"', () => {
  const { score, signals } = scoreGrantForProject('farm', {
    name: 'Bushfire-Affected Land Recovery Fund',
    provider: 'NSW Government',
    description: 'Grants to landholders to recover fencing and farm infrastructure after bushfires.',
  });
  assert.equal(signals.tier1_hits.length, 0);
  assert.ok(score < PROJECT_TAG_THRESHOLD, `expected < ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('a regenerative agriculture / landcare grant tags farm', () => {
  const { score } = scoreGrantForProject('farm', {
    name: 'Landcare Regenerative Agriculture Grants',
    provider: 'Queensland Government',
    description: 'Supporting regenerative farming and soil health projects on Queensland farms.',
    geography: 'AU-QLD',
  });
  assert.ok(score >= PROJECT_TAG_THRESHOLD, `expected >= ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('"wind farm" infrastructure grant is disqualified from farm', () => {
  const { score, signals } = scoreGrantForProject('farm', {
    name: 'Regional Wind Farm Community Benefit Fund',
    provider: 'Clean Energy Council',
    description: 'Community benefit payments from wind farm developments, land access agreements.',
  });
  assert.ok(signals.disqualifier_hits.includes('wind farm'));
  assert.ok(score < PROJECT_TAG_THRESHOLD, `expected < ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('a study/sports tour grant does not tag contained despite the word "tour"', () => {
  const { score, signals } = scoreGrantForProject('contained', {
    name: 'Regional Sports Tour Travel Grants',
    provider: 'Sport Australia',
    description: 'Support for junior sports teams to tour regional competitions.',
  });
  assert.equal(signals.tier1_hits.length, 0);
  assert.ok(score < PROJECT_TAG_THRESHOLD, `expected < ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('a touring shipping-container exhibition grant tags contained', () => {
  const { score } = scoreGrantForProject('contained', {
    name: 'Immersive Touring Exhibition Fund',
    provider: 'Australia Council for the Arts',
    description: 'Support for a shipping container exhibition touring regional galleries.',
  });
  assert.ok(score >= PROJECT_TAG_THRESHOLD, `expected >= ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('a data-analytics grant does not falsely tag empathy-ledger via "ledger"', () => {
  const { score, signals } = scoreGrantForProject('empathy-ledger', {
    name: 'Small Business Accounting Software Grant',
    provider: 'Department of Industry',
    description: 'Grants to upgrade general ledger and bookkeeping software.',
  });
  assert.ok(signals.disqualifier_hits.includes('general ledger'));
  assert.ok(score < PROJECT_TAG_THRESHOLD, `expected < ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('an indigenous data sovereignty storytelling grant tags empathy-ledger', () => {
  const { score } = scoreGrantForProject('empathy-ledger', {
    name: 'Indigenous Data Sovereignty and Digital Storytelling Grant',
    provider: 'Lowitja Institute',
    description: 'Supporting community-led digital storytelling and consent-based data platforms.',
  });
  assert.ok(score >= PROJECT_TAG_THRESHOLD);
});

test('a wine/grape harvest festival grant does not tag harvest', () => {
  const { score, signals } = scoreGrantForProject('harvest', {
    name: 'Regional Wine Harvest Festival Grant',
    provider: 'Tourism Victoria',
    description: 'Funding for the annual grape harvest festival celebrations.',
  });
  assert.ok(signals.disqualifier_hits.length > 0);
  assert.ok(score < PROJECT_TAG_THRESHOLD, `expected < ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('a community food security garden grant tags harvest', () => {
  const { score } = scoreGrantForProject('harvest', {
    name: 'Community Food Security and Garden Grants',
    provider: 'Queensland Government',
    description: 'Grants for community gardens and food rescue programs to improve food security.',
    geography: 'AU-QLD',
  });
  assert.ok(score >= PROJECT_TAG_THRESHOLD);
});

test('closed grants score lower than the same grant open', () => {
  const grant = {
    name: 'Youth Justice Diversion Program Grants',
    description: 'Restorative justice and youth mentoring.',
  };
  const open = scoreGrantForProject('justicehub', grant);
  const closed = scoreGrantForProject('justicehub', { ...grant, closes_at: '2020-01-01' });
  assert.ok(closed.score < open.score);
});

test('scoreGrantForAllProjects returns only projects at/above threshold, highest first', () => {
  const results = scoreGrantForAllProjects({
    name: 'Youth Justice Restorative Diversion Fund',
    description: 'Restorative justice diversion program for young people.',
  });
  assert.ok(results.length >= 1);
  assert.equal(results[0].project, 'justicehub');
  for (let i = 1; i < results.length; i++) assert.ok(results[i - 1].score >= results[i].score);
});

test('ACT Government shared round description does not falsely tag an unrelated sibling grant', () => {
  // Real row, verified 2026-09-14: one boilerplate description lists every category the round
  // covers ("...Child protection and youth justice...Support for veterans and their families...").
  const { score, signals } = scoreGrantForProject('justicehub', {
    name: 'Support for veterans and their families',
    provider: 'ACT Government',
    source: 'ACT Government',
    description: 'Aboriginal and Torres Strait Islander peoples Child protection and youth justice Community service providers Domestic, family and sexual violence Families Gambling harm Honours and awards LGBTIQA+ communities Multicultural communities Older Canberrans People with disability Support for veterans and their families Women Youth',
  });
  assert.equal(signals.tier1_hits.length, 0);
  assert.ok(score < PROJECT_TAG_THRESHOLD, `expected < ${PROJECT_TAG_THRESHOLD}, got ${score}`);
});

test('a genuine ACT Government justice grant still tags via its name', () => {
  const { score } = scoreGrantForProject('justicehub', {
    name: 'Youth Justice Restorative Program Grants',
    provider: 'ACT Government',
    source: 'ACT Government',
    description: 'Aboriginal and Torres Strait Islander peoples Child protection and youth justice Gambling harm Older Canberrans Women Youth',
  });
  assert.ok(score >= PROJECT_TAG_THRESHOLD);
});

test('unknown project throws', () => {
  assert.throws(() => scoreGrantForProject('not-a-project', {}));
});

test('applyProjectTags tags a fresh high-scoring justicehub grant and logs the add', () => {
  const row = { aligned_projects: [], project_relevance: {} };
  const results = { justicehub: { score: 60, signals: { tier1_hits: ['youth justice'] } } };
  const { tagged, changes, relevance } = applyProjectTags(row, results, '2026-09-14T00:00:00Z');
  assert.ok(tagged.includes(PROJECT_CODES.justicehub));
  assert.equal(changes.justicehub.change, 'added');
  assert.equal(relevance.justicehub.score, 60);
});

test('applyProjectTags untags a project whose score dropped below threshold on rescore', () => {
  const row = { aligned_projects: [PROJECT_CODES.farm], project_relevance: { farm: { score: 55 } } };
  const results = { farm: { score: 10, signals: {} } };
  const { tagged, changes } = applyProjectTags(row, results, '2026-09-14T00:00:00Z');
  assert.ok(!tagged.includes(PROJECT_CODES.farm));
  assert.equal(changes.farm.change, 'removed');
  assert.equal(changes.farm.previous_score, 55);
});

test('applyProjectTags leaves unrelated tags (e.g. ACT-GD) alone', () => {
  const row = { aligned_projects: ['ACT-GD'], project_relevance: {} };
  const results = { harvest: { score: 5, signals: {} } };
  const { tagged } = applyProjectTags(row, results);
  assert.deepEqual(tagged, ['ACT-GD']);
});

test('applyProjectTags is a no-op (no changes) when nothing crosses the threshold either way', () => {
  const row = { aligned_projects: [], project_relevance: {} };
  const results = { farm: { score: 10, signals: {} }, harvest: { score: 5, signals: {} } };
  const { tagged, changes } = applyProjectTags(row, results);
  assert.deepEqual(tagged, []);
  assert.deepEqual(changes, {});
});

// ── Regression cases from the 2026-09-21 JEV sweep of the rejected pool ──────
// Each of these was a REAL open grant the keyword scorer threw away. The stored
// scores at the time are in the comments; all five now clear the threshold.
// Do not delete a keyword these depend on without replacing the coverage.

test('youth-crime rounds reach the JusticeHub threshold (was 2/30)', () => {
  // NSW Premier's Department, $5M each, close 2026-11-30. The description is
  // procurement boilerplate with no justice vocabulary, so the NAME is the only signal.
  for (const town of ['Kempsey', 'Tamworth']) {
    const { score, signals } = scoreGrantForProject('justicehub', {
      name: `Strengthening Efforts to Reduce Youth Crime - ${town}`,
      source: "NSW Government — Premier's Department",
      description: 'Funding will be allocated through a structured assessment process. Local stakeholders will identify, develop and prioritise projects that respond to community need, build on existing services and improve outcomes for young people.',
    });
    assert.ok(score >= PROJECT_TAG_THRESHOLD, `${town} scored ${score}`);
    assert.ok(signals.tier1_hits.includes('youth crime'));
  }
});

test('"Bail and Remand Support" reaches the JusticeHub threshold (was 8/30)', () => {
  // 'bail support' was already tier1 but never matched: these are substring tests,
  // and "Bail and Remand Support" does not contain "bail support".
  const { score, signals } = scoreGrantForProject('justicehub', {
    name: 'Aboriginal Justice Agreement Bail and Remand Support Program - Grants RFA 003/25-26',
    source: 'Victorian Government',
    description: 'The Aboriginal Justice Agreement (AJA) Bail and Remand Support Grants Program will support Aboriginal community organisations.',
  });
  assert.ok(score >= PROJECT_TAG_THRESHOLD, `scored ${score}`);
  assert.ok(signals.tier1_hits.includes('bail and remand'));
});

test('"Regional Arts Touring" reaches the Contained threshold (was 0/30)', () => {
  const { score, signals } = scoreGrantForProject('contained', {
    name: '2026 Regional Arts Touring Round 2',
    source: 'NSW Government — Create NSW',
    description: 'This grant round is open to individual artists, arts and cultural workers, groups and organisations who are touring arts and cultural work across regional NSW.',
  });
  assert.ok(score >= PROJECT_TAG_THRESHOLD, `scored ${score}`);
  assert.ok(signals.tier1_hits.includes('arts touring'));
});

test('the Contained keywords stay narrow: no craft fairs, no orchestra tours', () => {
  // Both of these were produced by looser drafts and measured against all 26,840
  // rows before being rejected. If a future widening reintroduces them, this fails.
  const craftFair = scoreGrantForProject('contained', {
    name: "Lord Mayor's Community Fund - Marchant — Art and Craft Exhibitions at Hypermarket Shopping Centre",
    description: 'Rental assistance to enable Arts and Crafts Exhibitions at a local shopping centre.',
  });
  assert.ok(craftFair.score < PROJECT_TAG_THRESHOLD, `craft fair scored ${craftFair.score}`);

  const orchestra = scoreGrantForProject('contained', {
    name: 'Playing Queensland Fund — Queensland Youth Orchestras',
    description: 'Support for touring performances by Queensland Youth Orchestras to regional venues.',
  });
  assert.ok(orchestra.score < PROJECT_TAG_THRESHOLD, `orchestra tour scored ${orchestra.score}`);
});

test('"Visions of Australia" is a KNOWN keyword blind spot, not a bug to widen for', () => {
  // The national touring-exhibition fund. Its wording ("development and touring of
  // quality exhibitions") cannot be matched by any substring that does not also
  // catch craft fairs or orchestra tours. The JEV rubric sweep rates it 2.88/3.
  // This test exists so the blind spot is deliberate and visible, not forgotten.
  const { score } = scoreGrantForProject('contained', {
    name: 'Visions of Australia - Round 23',
    source: 'grantconnect',
    description: 'The Visions of Australia Program provides funding to support the development and touring of quality exhibitions around Australia.',
  });
  assert.ok(score < PROJECT_TAG_THRESHOLD, `scored ${score} — if this now passes, check what keyword widened and what else it caught`);
});

test('a council grant in the home LGA is still NOT a thematic match', () => {
  // SCC Major Grants (Sunshine Coast Council, Harvest and Farm's only LGA) scores 0.
  // That is CORRECT for a theme scorer — it is a geography signal, and forcing it
  // through tier1 would defeat the `shaped` gate. Recorded so nobody "fixes" it here.
  const { score } = scoreGrantForProject('harvest', {
    name: 'SCC Major Grants',
    description: "The Sunshine Coast Council's Major Grants program supports not-for-profit organisations in Australia to deliver one-off projects, events, and activities that provide broad community benefit.",
  });
  assert.ok(score < PROJECT_TAG_THRESHOLD, `scored ${score}`);
});


// ── Rubric signal (JEV) merged with the keyword signal ──────────────────────

const META_OK = { organisation_fundable: 0.9 };

test('rubricQualifies needs fit, confidence and an organisation-fundable grant', () => {
  assert.ok(rubricQualifies({ score: 2.5, confidence: 0.9 }, META_OK));
  assert.ok(!rubricQualifies({ score: 2.4, confidence: 0.9 }, META_OK), 'below fit threshold');
  assert.ok(!rubricQualifies({ score: 2.5, confidence: 0.3 }, META_OK), 'model not committing');
  assert.ok(!rubricQualifies({ score: 2.5, confidence: 0.9 }, { organisation_fundable: 0.1 }), 'scholarship');
  assert.ok(!rubricQualifies({ score: 2.9, confidence: 1, geography_excluded: true }, META_OK), 'out of area');
  assert.ok(!rubricQualifies(null, META_OK), 'never scored');
});

test('a rubric-only fit tags the grant even when the keyword score is zero', () => {
  // This is the whole point: "Visions of Australia" scores 0 on keywords and 2.88 on the rubric.
  const row = {
    aligned_projects: [],
    project_relevance: { rubric_meta: META_OK, contained: { rubric: { score: 2.88, confidence: 0.95 } } },
  };
  const results = { contained: { score: 0, signals: {} } };
  const { tagged, changes, relevance } = applyProjectTags(row, results);
  assert.ok(tagged.includes(PROJECT_CODES.contained));
  assert.equal(changes.contained.by, 'rubric');
  assert.equal(relevance.contained.tagged_by, 'rubric');
});

test('a keyword rescore does NOT destroy a stored rubric verdict', () => {
  // applyProjectTags replaces the whole per-project object. If `rubric` is not
  // carried across, every keyword rescore silently wipes the second signal and
  // the grant falls off the desk with no trace.
  const row = {
    aligned_projects: [PROJECT_CODES.contained],
    project_relevance: { rubric_meta: META_OK, contained: { score: 0, rubric: { score: 2.88, confidence: 0.95 } } },
  };
  const results = { contained: { score: 0, signals: { tier1_hits: [] } } };
  const { tagged, relevance } = applyProjectTags(row, results);
  assert.deepEqual(relevance.contained.rubric, { score: 2.88, confidence: 0.95 });
  assert.ok(tagged.includes(PROJECT_CODES.contained), 'still tagged after a keyword-only rescore');
});

test('a generic community-grants programme is suppressed on the rubric signal', () => {
  // Measured: a grant "plausible" for 3+ unrelated projects is a generic small-grants
  // round, informative for none of them. 9 such grants produced 48 of 76 candidate rows.
  const rubric = { score: 2.7, confidence: 0.9 };
  const row = {
    aligned_projects: [],
    project_relevance: {
      rubric_meta: META_OK,
      justicehub: { rubric }, harvest: { rubric }, farm: { rubric }, contained: { rubric },
    },
  };
  assert.equal(countRubricFits(row.project_relevance), 4);
  const results = Object.fromEntries(Object.keys(PROJECT_CODES).map(p => [p, { score: 0, signals: {} }]));
  const { tagged } = applyProjectTags(row, results);
  assert.deepEqual(tagged, [], 'no project should be tagged by a generic programme');
});

test('keyword tagging still works with no rubric present at all', () => {
  // Back-compat: every row predates the rubric until it is scored.
  const row = { aligned_projects: [], project_relevance: {} };
  const results = { justicehub: { score: 45, signals: {} } };
  const { tagged, changes, relevance } = applyProjectTags(row, results);
  assert.ok(tagged.includes(PROJECT_CODES.justicehub));
  assert.equal(changes.justicehub.by, 'keyword');
  assert.equal(relevance.justicehub.rubric, undefined);
});

test('both signals agreeing is recorded as "both"', () => {
  const row = {
    aligned_projects: [],
    project_relevance: { rubric_meta: META_OK, justicehub: { rubric: { score: 2.84, confidence: 0.99 } } },
  };
  const results = { justicehub: { score: 56, signals: {} } };
  const { changes } = applyProjectTags(row, results);
  assert.equal(changes.justicehub.by, 'both');
});

test('losing BOTH signals untags the grant', () => {
  const row = {
    aligned_projects: [PROJECT_CODES.farm],
    project_relevance: { rubric_meta: META_OK, farm: { score: 55, rubric: { score: 0.4, confidence: 0.9 } } },
  };
  const results = { farm: { score: 10, signals: {} } };
  const { tagged, changes } = applyProjectTags(row, results);
  assert.ok(!tagged.includes(PROJECT_CODES.farm));
  assert.equal(changes.farm.change, 'removed');
});
