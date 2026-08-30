import { describe, expect, it } from 'vitest';
import { rankFundingAlignmentSuggestions } from './funding-ghl-alignment-review';

const projects = [
  { code: 'ACT-GD', name: 'Goods', slug: 'goods', description: null },
  { code: 'ACT-HV', name: 'Harvest', slug: 'harvest', description: null },
];

const profiles = [
  { project_code: 'ACT-GD', project_label: 'Goods on Country', theme_keywords: ['manufacturing', 'community'] },
  { project_code: 'ACT-HV', project_label: 'Harvest', theme_keywords: ['food systems', 'community'] },
];

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    ghl_opportunity_id: 'opp-1',
    ghl_opportunity_name: 'A funding opportunity',
    classification: 'missing_project_relation',
    notion_funding_page_url: null,
    evidence: {},
    ...overrides,
  };
}

describe('funding alignment review suggestions', () => {
  it('ranks an explicit legacy Notion relation as strong review evidence', () => {
    const suggestions = rankFundingAlignmentSuggestions({
      candidate: candidate({
        classification: 'title_collision',
        evidence: { titleCollisions: [{ relatedProjects: [{ code: 'ACT-GD' }] }] },
      }),
      contact: null,
      projects,
      profiles,
      recommendations: [],
      contactHistory: [],
    });
    expect(suggestions[0]).toMatchObject({ projectCode: 'ACT-GD', confidence: 0.99, verdict: 'recommended' });
    expect(suggestions[0].evidence[0].source).toBe('notion_collision');
  });

  it('keeps multiple contact project tags as competing options for human review', () => {
    const suggestions = rankFundingAlignmentSuggestions({
      candidate: candidate(),
      contact: {
        ghl_id: 'contact-1',
        full_name: 'Community partner',
        company_name: null,
        tags: ['project:act-gd', 'project:act-hv'],
        projects: [],
      },
      projects,
      profiles,
      recommendations: [],
      contactHistory: [],
    });
    expect(suggestions.map(suggestion => suggestion.projectCode)).toEqual(['ACT-GD', 'ACT-HV']);
    expect(suggestions[0].confidence).toBe(suggestions[1].confidence);
  });

  it('does not turn generic community language into a project suggestion', () => {
    const suggestions = rankFundingAlignmentSuggestions({
      candidate: candidate({ ghl_opportunity_name: 'Community Impact Grants' }),
      contact: null,
      projects,
      profiles,
      recommendations: [],
      contactHistory: [],
    });
    expect(suggestions).toEqual([]);
  });

  it('uses an explicit project name in the opportunity title', () => {
    const suggestions = rankFundingAlignmentSuggestions({
      candidate: candidate({ ghl_opportunity_name: 'Regional Business Gateways — Harvest' }),
      contact: null,
      projects,
      profiles,
      recommendations: [],
      contactHistory: [],
    });
    expect(suggestions[0]).toMatchObject({ projectCode: 'ACT-HV', confidence: 0.95, verdict: 'recommended' });
  });
});
