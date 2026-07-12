import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mockRequireModule = vi.fn();
const mockRequireOrgWriteAccess = vi.fn();
const mockCreateAction = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  requireModule: mockRequireModule,
}));

vi.mock('@/app/api/org/_lib/auth', () => ({
  requireOrgWriteAccess: mockRequireOrgWriteAccess,
}));

vi.mock('@/lib/opportunity-intelligence', () => ({
  createOpportunityIntelligenceAction: mockCreateAction,
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
});
