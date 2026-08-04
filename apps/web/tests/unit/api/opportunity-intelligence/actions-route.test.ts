import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mockRequireModule = vi.fn();
const mockRequireOrgWriteAccess = vi.fn();
const mockCreateAction = vi.fn();
const mockValidateAction = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  requireModule: mockRequireModule,
}));

vi.mock('@/app/api/org/_lib/auth', () => ({
  requireOrgWriteAccess: mockRequireOrgWriteAccess,
}));

vi.mock('@/lib/opportunity-intelligence', () => ({
  createOpportunityIntelligenceAction: mockCreateAction,
  validateOpportunityActionRequest: mockValidateAction,
}));

const { POST } = await import('@/app/api/opportunity-intelligence/actions/route');

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/opportunity-intelligence/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/opportunity-intelligence/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireModule.mockResolvedValue({ user: { id: 'user-1' }, tier: 'funder' });
    mockCreateAction.mockResolvedValue({ status: 'written', id: 'receipt-1' });
    mockValidateAction.mockReturnValue(null);
  });

  it('requires tracker module access', async () => {
    mockRequireModule.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const response = await POST(request({ kind: 'research' }) as never);

    expect(response.status).toBe(401);
    expect(mockCreateAction).not.toHaveBeenCalled();
  });

  it('rejects a caller-supplied organisation without access', async () => {
    mockRequireOrgWriteAccess.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    );

    const response = await POST(request({ kind: 'research', orgProfileId: 'org-other' }) as never);

    expect(response.status).toBe(403);
    expect(mockRequireOrgWriteAccess).toHaveBeenCalledWith('org-other');
    expect(mockCreateAction).not.toHaveBeenCalled();
  });

  it('allows an authorised organisation action', async () => {
    mockRequireOrgWriteAccess.mockResolvedValue({
      userId: 'user-1',
      orgProfileId: 'org-act',
      role: 'owner',
      serviceDb: {},
    });

    const response = await POST(request({ kind: 'research', orgProfileId: 'org-act' }) as never);

    expect(response.status).toBe(200);
    expect(mockCreateAction).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'research', orgProfileId: 'org-act' }),
      { userId: 'user-1' },
    );
  });

  it('rejects an incomplete relational review before any write', async () => {
    mockValidateAction.mockReturnValue('judgment.whatChanged is required');

    const response = await POST(
      request({
        kind: 'record_review',
        orgProfileId: 'org-act',
        judgment: { nextMove: 'listen' },
      }) as never,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'judgment.whatChanged is required' });
    expect(mockRequireOrgWriteAccess).not.toHaveBeenCalled();
    expect(mockCreateAction).not.toHaveBeenCalled();
  });

  it('passes a minimal authorised relational review to the append-only action service', async () => {
    mockRequireOrgWriteAccess.mockResolvedValue({
      userId: 'user-1',
      orgProfileId: 'org-act',
      role: 'owner',
      serviceDb: {},
    });
    const body = {
      kind: 'record_review',
      orgProfileId: 'org-act',
      signal: {
        id: 'goods:qbe',
        title: 'QBE relationship review',
        source: 'goods',
        sourceRef: 'qbe',
        sourceUrl: null,
        lane: 'relationship',
        project: 'goods',
        projects: ['goods'],
        organisation: 'QBE',
        amount: null,
        deadline: null,
      },
      judgment: {
        whatChanged: 'QBE confirmed the relationship is active, while the current funding terms remain unknown.',
        nextMove: 'verify',
        nextLearningQuestion: 'Who can confirm the current terms?',
      },
    };

    const response = await POST(request(body) as never);

    expect(response.status).toBe(200);
    expect(mockRequireOrgWriteAccess).toHaveBeenCalledWith('org-act');
    expect(mockCreateAction).toHaveBeenCalledWith(body, { userId: 'user-1' });
  });
});
