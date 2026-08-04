import { describe, expect, it } from 'vitest';
import { actionCreatesPipeline, resolveActOpportunityProject } from './act-opportunity-handoff';

const projects = [
  { code: 'ACT-GD', name: 'Goods', slug: 'goods' },
  { code: 'ACT-HV', name: 'Harvest', slug: 'harvest' },
  { code: 'ACT-JH', name: 'JusticeHub', slug: 'justicehub' },
];

describe('ACT opportunity handoff', () => {
  it('keeps an explicit project code', () => {
    expect(resolveActOpportunityProject({
      title: 'Any opening', summary: '', project: 'ACT', projectCode: 'ACT-JH', tags: [],
    }, projects)?.slug).toBe('justicehub');
  });

  it('resolves a strong project phrase', () => {
    expect(resolveActOpportunityProject({
      title: 'Remote housing procurement round', summary: 'Essential goods supply chain', project: 'ACT', projectCode: 'ACT', tags: [],
    }, projects)?.slug).toBe('goods');
  });

  it('leaves a generic grant unassigned for a human decision', () => {
    expect(resolveActOpportunityProject({
      title: 'Community grant program', summary: 'Supports community organisations', project: 'Community', projectCode: 'ACT', tags: ['grant'],
    }, projects)).toBeNull();
  });

  it('distinguishes pipeline-writing decisions from memory-only decisions', () => {
    expect(actionCreatesPipeline('apply_path')).toBe(true);
    expect(actionCreatesPipeline('later')).toBe(false);
    expect(actionCreatesPipeline('no')).toBe(false);
  });
});
