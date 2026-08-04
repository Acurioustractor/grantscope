import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProfile } from '../sync-project-funding-profiles.mjs';

test('funding profile validator requires canonical identity and common sections', () => {
  const errors = validateProfile({
    identity: {},
    fundingNeed: { blocks: [] },
    unresolvedDecisions: [],
  });
  assert.ok(errors.includes('Missing canonical org project ID'));
  assert.ok(errors.includes('Missing section: entities'));
});
