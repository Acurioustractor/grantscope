import { describe, expect, it } from 'vitest';
import { classifyFundingAlignment } from './funding-ghl-alignment';

const activeProjectCodes = ['ACT-GD', 'ACT-JH'];

describe('funding GHL and Notion alignment authority', () => {
  it('permits only one exact page with one explicit canonical project code', () => {
    expect(classifyFundingAlignment({
      exactPageCount: 1,
      titleCollisionPageIds: [],
      relatedProjectCodes: ['ACT-GD'],
      activeProjectCodes,
      currentProjectCode: null,
    })).toEqual({ classification: 'safe_exact', status: 'pending', projectCode: 'ACT-GD' });
  });

  it('treats a title match as a collision rather than project evidence', () => {
    expect(classifyFundingAlignment({
      exactPageCount: 0,
      titleCollisionPageIds: ['notion-page-1'],
      relatedProjectCodes: ['ACT-GD'],
      activeProjectCodes,
      currentProjectCode: null,
    })).toEqual({ classification: 'title_collision', status: 'blocked', projectCode: null });
  });

  it('blocks a page related to multiple project codes', () => {
    expect(classifyFundingAlignment({
      exactPageCount: 1,
      titleCollisionPageIds: [],
      relatedProjectCodes: ['ACT-GD', 'ACT-JH'],
      activeProjectCodes,
      currentProjectCode: null,
    })).toEqual({ classification: 'multiple_project_codes', status: 'blocked', projectCode: null });
  });

  it('blocks multiple relations even when duplicate project pages carry the same code', () => {
    expect(classifyFundingAlignment({
      exactPageCount: 1,
      titleCollisionPageIds: [],
      relatedProjectCodes: ['ACT-GD', 'ACT-GD'],
      activeProjectCodes,
      currentProjectCode: null,
    })).toEqual({ classification: 'multiple_project_codes', status: 'blocked', projectCode: null });
  });

  it('blocks an exact page until a project relation is explicitly chosen', () => {
    expect(classifyFundingAlignment({
      exactPageCount: 1,
      titleCollisionPageIds: [],
      relatedProjectCodes: [],
      activeProjectCodes,
      currentProjectCode: null,
    })).toEqual({ classification: 'missing_project_relation', status: 'blocked', projectCode: null });
  });

  it('blocks a conflicting project already present in GHL', () => {
    expect(classifyFundingAlignment({
      exactPageCount: 1,
      titleCollisionPageIds: [],
      relatedProjectCodes: ['ACT-GD'],
      activeProjectCodes,
      currentProjectCode: 'ACT-JH',
    })).toEqual({ classification: 'conflict', status: 'blocked', projectCode: 'ACT-GD' });
  });
});
