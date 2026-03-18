import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mock dependencies
const mockRequireModule = vi.fn();
const mockGetUser = vi.fn();
const mockServiceFrom = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  requireModule: mockRequireModule,
}));

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServer: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: vi.fn(() => ({
    from: mockServiceFrom,
  })),
}));

// Import routes after mocks
const { GET, POST } = await import('@/app/api/keys/route');

// Helpers
function fakeUser(id = 'user-1') {
  return { id, email: 'test@example.com' };
}

function mockApiKeysSelect(keys: Array<Record<string, unknown>>) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: keys }),
  };
}

function mockApiKeysInsert(insertedKey: Record<string, unknown>) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: insertedKey }),
      }),
    }),
  };
}

describe('GET /api/keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireModule.mockResolvedValue({ error: { status: 401 } });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns 403 when tier insufficient (no api module)', async () => {
    mockRequireModule.mockResolvedValue({
      error: { status: 403, json: () => ({ error: 'Upgrade required' }) }
    });

    const response = await GET();
    expect(response.status).toBe(403);
  });

  it('returns list of user API keys', async () => {
    const user = fakeUser();
    mockRequireModule.mockResolvedValue({ user, tier: 'funder' });

    const mockKeys = [
      {
        id: 'key-1',
        key_prefix: 'cg_abc123',
        name: 'Production Key',
        enabled: true,
        created_at: '2024-01-01T00:00:00Z',
        last_used_at: '2024-01-15T00:00:00Z',
        rate_limit_per_hour: 1000,
        expires_at: null,
      },
      {
        id: 'key-2',
        key_prefix: 'cg_def456',
        name: 'Dev Key',
        enabled: false,
        created_at: '2024-01-02T00:00:00Z',
        last_used_at: null,
        rate_limit_per_hour: 100,
        expires_at: '2025-01-01T00:00:00Z',
      },
    ];

    mockServiceFrom.mockReturnValue(mockApiKeysSelect(mockKeys));

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.keys).toHaveLength(2);
    expect(body.keys[0].id).toBe('key-1');
    expect(body.keys[0].key_hash).toBeUndefined(); // Should not return hash
  });
});

describe('POST /api/keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireModule.mockResolvedValue({ error: { status: 401 } });

    const request = new Request('http://localhost/api/keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Key' }),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(401);
  });

  it('returns 403 when tier insufficient', async () => {
    mockRequireModule.mockResolvedValue({
      error: { status: 403, json: () => ({ error: 'Upgrade required' }) }
    });

    const request = new Request('http://localhost/api/keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Key' }),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(403);
  });

  it('creates API key with cg_ prefix and returns raw key once', async () => {
    const user = fakeUser();
    mockRequireModule.mockResolvedValue({ user, tier: 'funder' });

    const mockInsertedKey = {
      id: 'new-key-id',
      user_id: user.id,
      key_prefix: 'cg_abc123',
      name: 'New Test Key',
      enabled: true,
      created_at: '2024-01-01T00:00:00Z',
      rate_limit_per_hour: 1000,
    };

    mockServiceFrom.mockReturnValue(mockApiKeysInsert(mockInsertedKey));

    const request = new Request('http://localhost/api/keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Test Key' }),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.key).toBeDefined();
    expect(body.key).toMatch(/^cg_[a-f0-9]{64}$/); // cg_ + 64 hex chars (32 bytes)
    expect(body.key_prefix).toBe('cg_abc123');
    expect(body.id).toBe('new-key-id');
    expect(body.name).toBe('New Test Key');
  });

  it('stores SHA-256 hash not raw key', async () => {
    const user = fakeUser();
    mockRequireModule.mockResolvedValue({ user, tier: 'funder' });

    let capturedInsert: Record<string, unknown> = {};
    const mockInsert = {
      insert: vi.fn((data: Record<string, unknown>) => {
        capturedInsert = data;
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'key-id', key_prefix: 'cg_test', name: 'Test' },
            }),
          }),
        };
      }),
    };

    mockServiceFrom.mockReturnValue(mockInsert);

    const request = new Request('http://localhost/api/keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Key' }),
    });

    await POST(request as any);

    expect(capturedInsert.key_hash).toBeDefined();
    expect(capturedInsert.key_hash).toHaveLength(64); // SHA-256 hex = 64 chars
    expect(capturedInsert.key_prefix).toMatch(/^cg_[a-f0-9]{8}$/);
  });

  it('returns 400 when name is missing', async () => {
    const user = fakeUser();
    mockRequireModule.mockResolvedValue({ user, tier: 'funder' });

    const request = new Request('http://localhost/api/keys', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain('name');
  });
});
