import type { ActMatterDeskSnapshot } from '@/lib/services/act-matter-desk';

export type JusticeHubMatterId = 'qld-kickstarter-evidence';
export type JusticeHubMatterDeskSnapshot = ActMatterDeskSnapshot<JusticeHubMatterId>;

/**
 * First JusticeHub projection into the shared ACT Matter Desk.
 *
 * The source facts come from the existing Queensland youth justice announcement
 * register. Public program evidence is deliberately kept separate from provider,
 * community and young-person authority.
 */
export function buildJusticeHubMatterDesk(
  now = new Date(),
): JusticeHubMatterDeskSnapshot {
  return {
    project: {
      id: 'justicehub',
      label: 'JusticeHub',
      purpose: 'Public evidence for community-led youth justice alternatives and accountable reform.',
    },
    matterOrder: ['qld-kickstarter-evidence'],
    mode: 'read-only',
    assembledAt: now.toISOString(),
    matters: {
      'qld-kickstarter-evidence': {
        id: 'qld-kickstarter-evidence',
        projectId: 'justicehub',
        title: 'Kickstarter evidence library',
        placeLabel: 'Queensland',
        readAt: now.toISOString(),
        pathway: {
          position: 'verify',
          label: 'Verify',
          holds: 'The evidence boundary',
          disclaimer: 'A working evidence position, not a verdict on a provider or program.',
        },
        nextDecision:
          'Choose the first bounded provider cohort to verify before JusticeHub publishes or invites stories about what early intervention is achieving.',
        unresolvedQuestions: [
          'Which funded providers and delivery places can be resolved to authoritative public records?',
          'Who should define useful outcome evidence, and what must remain private, consent-held or community-held?',
        ],
        authority: {
          state: 'unknown',
          label: 'Community and young-person authority not yet connected',
          note: 'Government announcements establish public claims, not authority to interpret community experience or speak for young people.',
        },
        currentRequest: {
          state: 'unknown',
          label: 'No authorised contribution request is recorded',
          note: 'JusticeHub has an outreach intention, but no provider or community invitation is treated as accepted.',
        },
        evidence: {
          state: 'partial',
          conflictCount: 0,
          sourceCount: 6,
          humanReviewConnected: false,
          note: 'Budget and program sources establish the initiative. Provider, model, participant and outcome evidence remain incomplete.',
        },
        nextAction: {
          label: 'Resolve the first provider cohort to legal entities, places and public program claims.',
          owner: null,
          dueAt: null,
          source: 'qld-youth-justice-announcement-register',
        },
      },
    },
  };
}

