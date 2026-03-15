/**
 * CivicGraph API client for the Goods project.
 *
 * Drop this file into any Node.js / Next.js project.
 * Requires: @supabase/supabase-js
 *
 * ENV vars needed:
 *   CIVICGRAPH_BASE_URL          (default: https://civicgraph.vercel.app)
 *   CIVICGRAPH_SUPABASE_URL      (default: https://tednluwflfhxyucgwigh.supabase.co)
 *   CIVICGRAPH_ANON_KEY          Supabase publishable key (sb_publishable_...)
 *   CIVICGRAPH_EMAIL             e.g. benjamin@act.place
 *   CIVICGRAPH_PASSWORD          account password
 */

import { createClient } from '@supabase/supabase-js';

const BASE_URL =
  process.env.CIVICGRAPH_BASE_URL || 'https://civicgraph.vercel.app';
const SUPABASE_URL =
  process.env.CIVICGRAPH_SUPABASE_URL ||
  'https://tednluwflfhxyucgwigh.supabase.co';

// ── Session cache ──────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const sb = createClient(SUPABASE_URL, process.env.CIVICGRAPH_ANON_KEY!);

  const { data, error } = await sb.auth.signInWithPassword({
    email: process.env.CIVICGRAPH_EMAIL!,
    password: process.env.CIVICGRAPH_PASSWORD!,
  });

  if (error || !data.session) {
    throw new Error(
      `CivicGraph auth failed: ${error?.message ?? 'no session'}`
    );
  }

  cachedToken = data.session.access_token;
  tokenExpiresAt = Date.now() + (data.session.expires_in - 300) * 1000;
  return cachedToken;
}

// ── Internal fetch helpers ─────────────────────────────────────
async function publicGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`CivicGraph ${res.status}: ${await res.text()}`);
  return res.json();
}

async function authPost<T = unknown>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `sb-tednluwflfhxyucgwigh-auth-token=${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`CivicGraph ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Public endpoints (no auth needed) ──────────────────────────

/** Search entities by name, ABN, state, type */
export async function searchEntities(params: {
  q?: string;
  abn?: string;
  state?: string;
  entity_type?: string;
  community_controlled?: boolean;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams({ type: 'entities' });
  if (params.q) qs.set('q', params.q);
  if (params.abn) qs.set('abn', params.abn);
  if (params.state) qs.set('state', params.state);
  if (params.entity_type) qs.set('entity_type', params.entity_type);
  if (params.community_controlled) qs.set('community_controlled', 'true');
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  return publicGet(`/api/data?${qs}`);
}

/** Search grants */
export async function searchGrants(params: {
  min_amount?: number;
  max_amount?: number;
  category?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams({ type: 'grants' });
  if (params.min_amount) qs.set('min_amount', String(params.min_amount));
  if (params.max_amount) qs.set('max_amount', String(params.max_amount));
  if (params.category) qs.set('category', params.category);
  if (params.limit) qs.set('limit', String(params.limit));
  return publicGet(`/api/data?${qs}`);
}

/** Search foundations */
export async function searchFoundations(params: {
  focus?: string;
  state?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams({ type: 'foundations' });
  if (params.focus) qs.set('focus', params.focus);
  if (params.state) qs.set('state', params.state);
  if (params.limit) qs.set('limit', String(params.limit));
  return publicGet(`/api/data?${qs}`);
}

/** Global search across entities, grants, foundations */
export async function globalSearch(q: string, limit = 20) {
  return publicGet(
    `/api/global-search?q=${encodeURIComponent(q)}&limit=${limit}`
  );
}

/** Analyse supplier ABNs for social impact — no auth needed */
export async function analyseSuppliers(
  abns: string[],
  values?: Record<string, number>
) {
  const res = await fetch(`${BASE_URL}/api/procurement/analyse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ abns, values }),
  });
  if (!res.ok) throw new Error(`CivicGraph ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Authenticated endpoints (procurement intelligence) ─────────

/** Discover suppliers by geography, type, certifications */
export async function discoverSuppliers(filters: {
  state?: string;
  postcode?: string;
  lga?: string;
  entity_types?: string[];
  remoteness?: string;
  community_controlled?: boolean;
  min_contracts?: number;
  limit?: number;
}) {
  return authPost('/api/tender-intelligence/discover', filters);
}

/** Bulk-enrich a supplier list (max 200 per request) */
export async function enrichSuppliers(
  suppliers: Array<{ name: string; abn?: string }>
) {
  return authPost('/api/tender-intelligence/enrich', { suppliers });
}

/** Score suppliers against Commonwealth procurement targets */
export async function checkCompliance(params: {
  suppliers: Array<{ name: string; abn?: string; contract_value?: number }>;
  total_contract_value: number;
  state?: string;
}) {
  return authPost('/api/tender-intelligence/compliance', params);
}

/** Generate a full 5-section Tender Intelligence Pack */
export async function generateTIPack(params: {
  state: string;
  lga?: string;
  total_contract_value?: number;
  existing_suppliers?: string;
}) {
  return authPost('/api/tender-intelligence/pack', params);
}
