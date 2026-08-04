import { describe, expect, it } from 'vitest';
import { buildJusticeHubMatterDesk } from '@/lib/services/justicehub-matter-desk';

describe('buildJusticeHubMatterDesk', () => {
  it('uses the shared matter contract without converting public evidence into authority', () => {
    const desk = buildJusticeHubMatterDesk(new Date('2026-07-29T00:00:00.000Z'));
    const matter = desk.matters['qld-kickstarter-evidence'];

    expect(desk.project.id).toBe('justicehub');
    expect(matter.pathway.position).toBe('verify');
    expect(matter.evidence).toMatchObject({
      state: 'partial',
      sourceCount: 6,
      humanReviewConnected: false,
    });
    expect(matter.authority.state).toBe('unknown');
    expect(matter.currentRequest.state).toBe('unknown');
    expect(matter.nextAction.owner).toBeNull();
  });
});

