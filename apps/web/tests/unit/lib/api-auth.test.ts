import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ── Mocks ────────────────────────────────────────────────────────────
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServer: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

const mockServiceFrom = vi.fn();
vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: vi.fn(() => ({
    from: mockServiceFrom,
  })),
}));

// Must import after mocks are set up
const { requireAuth, requireModule, authenticateApiKey } = await import('@/lib/api-auth');

// ── Helpers ──────────────────────────────────────────────────────────
function fakeUser(id = 'user-1') {
  return { id, email: 'test@example.com' };
}

function mockProfile(plan: string | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: plan ? { subscription_plan: plan } : null,
    }),
  };
}

function mockApiKeyLookup(key: Record<string, unknown> | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: key }),
  };
}

function mockApiKeyUpdate() {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        then: vi.fn(),
      }),
    }),
  };
}

function fakeRequest(authHeader?: string) {
  return {
    headers: {
      get: (name: string) => name === 'authorization' ? authHeader ?? null : null,
    },
  } as unknown as import('next/server').NextRequest;
}

// ── Tests ────────────────────────────────────────────────────────────
describe('api-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('returns 401 when no session cookie', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const result = await requireAuth();
      expect(result.error).toBeDefined();

      const body = await result.error!.json();
      expect(result.error!.status).toBe(401);
      expect(body.error).toBe('Authentication required');
    });

    it('returns user and tier when authenticated', async () => {
      const user = fakeUser();
      mockGetUser.mockResolvedValue({ data: { user } });
      mockServiceFrom.mockReturnValue(mockProfile('funder'));

      const result = await requireAuth();
      expect(result.error).toBeUndefined();
      expect(result.user).toEqual(user);
      expect(result.tier).toBe('funder');
    });

    it('defaults to community tier when no org_profile', async () => {
      const user = fakeUser();
      mockGetUser.mockResolvedValue({ data: { user } });
      mockServiceFrom.mockReturnValue(mockProfile(null));

      const result = await requireAuth();
      expect(result.tier).toBe('community');
    });
  });

  describe('requireModule', () => {
    it('returns 403 when tier insufficient', async () => {
      const user = fakeUser();
      mockGetUser.mockResolvedValue({ data: { user } });
      mockServiceFrom.mockReturnValue(mockProfile('community'));

      // Community tier doesn't have 'procurement'
      const result = await requireModule('procurement');
      expect(result.error).toBeDefined();
      expect(result.error!.status).toBe(403);
    });

    it('returns user when tier has module', async () => {
      const user = fakeUser();
      mockGetUser.mockResolvedValue({ data: { user } });
      mockServiceFrom.mockReturnValue(mockProfile('organisation'));

      // Organisation tier has 'procurement'
      const result = await requireModule('procurement');
      expect(result.error).toBeUndefined();
      expect(result.user).toEqual(user);
    });

    it('includes upgrade URL in 403 response', async () => {
      const user = fakeUser();
      mockGetUser.mockResolvedValue({ data: { user } });
      mockServiceFrom.mockReturnValue(mockProfile('community'));

      const result = await requireModule('procurement');
      const body = await result.error!.json();
      expect(body.upgrade_url).toBe('/pricing');
      expect(body.module).toBe('procurement');
      expect(body.required_tier).toBeDefined();
    });
  });

  describe('authenticateApiKey', () => {
    it('returns 401 for missing Bearer header', async () => {
      const result = await authenticateApiKey(fakeRequest());
      expect(result.error!.status).toBe(401);
    });

    it('returns 401 for non-cg_ prefix', async () => {
      const result = await authenticateApiKey(fakeRequest('Bearer sk_12345'));
      expect(result.error!.status).toBe(401);
    });

    it('returns 401 for invalid key hash', async () => {
      // Mock: no key found for hash
      mockServiceFrom.mockReturnValue(mockApiKeyLookup(null));

      const result = await authenticateApiKey(fakeRequest('Bearer cg_invalid_key'));
      expect(result.error!.status).toBe(401);
      const body = await result.error!.json();
      expect(body.error).toBe('Invalid API key');
    });

    it('returns 403 for disabled key', async () => {
      const rawKey = 'cg_test_key_disabled';
      mockServiceFrom.mockReturnValue(
        mockApiKeyLookup({
          id: 'key-1',
          user_id: 'user-1',
          permissions: ['read'],
          rate_limit_per_hour: 100,
          enabled: false,
          expires_at: null,
        })
      );

      const result = await authenticateApiKey(fakeRequest(`Bearer ${rawKey}`));
      expect(result.error!.status).toBe(403);
      const body = await result.error!.json();
      expect(body.error).toBe('API key is disabled');
    });

    it('returns 403 for expired key', async () => {
      const rawKey = 'cg_test_key_expired';
      mockServiceFrom.mockReturnValue(
        mockApiKeyLookup({
          id: 'key-2',
          user_id: 'user-1',
          permissions: ['read'],
          rate_limit_per_hour: 100,
          enabled: true,
          expires_at: '2020-01-01T00:00:00Z', // Past date
        })
      );

      const result = await authenticateApiKey(fakeRequest(`Bearer ${rawKey}`));
      expect(result.error!.status).toBe(403);
      const body = await result.error!.json();
      expect(body.error).toBe('API key has expired');
    });

    it('returns success with permissions for valid key', async () => {
      const rawKey = 'cg_test_valid_key';

      // First call: api_keys lookup
      const apiKeyMock = mockApiKeyLookup({
        id: 'key-3',
        user_id: 'user-1',
        permissions: ['read', 'write'],
        rate_limit_per_hour: 1000,
        enabled: true,
        expires_at: null,
      });

      // Second call: org_profiles lookup
      const profileMock = mockProfile('enterprise');

      // Third call: api_keys update (fire and forget)
      const updateMock = mockApiKeyUpdate();

      let callCount = 0;
      mockServiceFrom.mockImplementation((table: string) => {
        callCount++;
        if (table === 'api_keys' && callCount === 1) return apiKeyMock;
        if (table === 'org_profiles') return profileMock;
        if (table === 'api_keys') return updateMock;
        return apiKeyMock;
      });

      const result = await authenticateApiKey(fakeRequest(`Bearer ${rawKey}`));
      expect(result.error).toBeUndefined();
      expect(result.userId).toBe('user-1');
      expect(result.keyId).toBe('key-3');
      expect(result.permissions).toEqual(['read', 'write']);
      expect(result.tier).toBe('enterprise');
    });
  });
});
