import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockRequireModule = vi.fn();
const mockServiceFrom = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  requireModule: mockRequireModule,
}));

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: vi.fn(() => ({
    from: mockServiceFrom,
  })),
}));

// Import routes after mocks
const { DELETE, PATCH } = await import('@/app/api/keys/[keyId]/route');

// Helpers
function fakeUser(id = 'user-1') {
  return { id, email: 'test@example.com' };
}

function mockApiKeysDelete(deletedRows: number) {
  return {
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: deletedRows }),
      }),
    }),
  };
}

function mockApiKeysUpdate(updatedKey: Record<string, unknown> | null) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedKey }),
          }),
        }),
      }),
    }),
  };
}

describe('DELETE /api/keys/[keyId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireModule.mockResolvedValue({ error: { status: 401 } });

    const response = await DELETE(
      new Request('http://localhost/api/keys/key-1') as any,
      { params: Promise.resolve({ keyId: 'key-1' }) }
    );
    expect(response.status).toBe(401);
  });

  it('returns 403 when tier insufficient', async () => {
    mockRequireModule.mockResolvedValue({
      error: { status: 403, json: () => ({ error: 'Upgrade required' }) }
    });

    const response = await DELETE(
      new Request('http://localhost/api/keys/key-1') as any,
      { params: Promise.resolve({ keyId: 'key-1' }) }
    );
    expect(response.status).toBe(403);
  });

  it('deletes API key if it belongs to user', async () => {
    const user = fakeUser();
    mockRequireModule.mockResolvedValue({ user, tier: 'funder' });
    mockServiceFrom.mockReturnValue(mockApiKeysDelete(1));

    const response = await DELETE(
      new Request('http://localhost/api/keys/key-1') as any,
      { params: Promise.resolve({ keyId: 'key-1' }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('returns 404 if key not found or does not belong to user', async () => {
    const user = fakeUser();
    mockRequireModule.mockResolvedValue({ user, tier: 'funder' });
    mockServiceFrom.mockReturnValue(mockApiKeysDelete(0)); // No rows deleted

    const response = await DELETE(
      new Request('http://localhost/api/keys/key-999') as any,
      { params: Promise.resolve({ keyId: 'key-999' }) }
    );

    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/keys/[keyId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireModule.mockResolvedValue({ error: { status: 401 } });

    const response = await PATCH(
      new Request('http://localhost/api/keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated' }),
      }) as any,
      { params: Promise.resolve({ keyId: 'key-1' }) }
    );
    expect(response.status).toBe(401);
  });

  it('returns 403 when tier insufficient', async () => {
    mockRequireModule.mockResolvedValue({
      error: { status: 403, json: () => ({ error: 'Upgrade required' }) }
    });

    const response = await PATCH(
      new Request('http://localhost/api/keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated' }),
      }) as any,
      { params: Promise.resolve({ keyId: 'key-1' }) }
    );
    expect(response.status).toBe(403);
  });

  it('updates key name', async () => {
    const user = fakeUser();
    mockRequireModule.mockResolvedValue({ user, tier: 'funder' });

    const updatedKey = {
      id: 'key-1',
      name: 'Updated Key Name',
      enabled: true,
    };

    mockServiceFrom.mockReturnValue(mockApiKeysUpdate(updatedKey));

    const response = await PATCH(
      new Request('http://localhost/api/keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Key Name' }),
      }) as any,
      { params: Promise.resolve({ keyId: 'key-1' }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.name).toBe('Updated Key Name');
  });

  it('updates enabled status', async () => {
    const user = fakeUser();
    mockRequireModule.mockResolvedValue({ user, tier: 'funder' });

    const updatedKey = {
      id: 'key-1',
      name: 'Test Key',
      enabled: false,
    };

    mockServiceFrom.mockReturnValue(mockApiKeysUpdate(updatedKey));

    const response = await PATCH(
      new Request('http://localhost/api/keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ enabled: false }),
      }) as any,
      { params: Promise.resolve({ keyId: 'key-1' }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.enabled).toBe(false);
  });

  it('returns 404 if key not found or does not belong to user', async () => {
    const user = fakeUser();
    mockRequireModule.mockResolvedValue({ user, tier: 'funder' });
    mockServiceFrom.mockReturnValue(mockApiKeysUpdate(null));

    const response = await PATCH(
      new Request('http://localhost/api/keys/key-999', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated' }),
      }) as any,
      { params: Promise.resolve({ keyId: 'key-999' }) }
    );

    expect(response.status).toBe(404);
  });

  it('returns 400 when no valid fields provided', async () => {
    const user = fakeUser();
    mockRequireModule.mockResolvedValue({ user, tier: 'funder' });

    const response = await PATCH(
      new Request('http://localhost/api/keys/key-1', {
        method: 'PATCH',
        body: JSON.stringify({ invalid_field: 'value' }),
      }) as any,
      { params: Promise.resolve({ keyId: 'key-1' }) }
    );

    expect(response.status).toBe(400);
  });
});
