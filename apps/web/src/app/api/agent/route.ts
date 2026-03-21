import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { esc, validateAbn } from '@/lib/sql';
import { rateLimit } from '@/lib/rate-limit';
import { validateApiKey, logUsage, InvalidApiKeyError, type ApiKeyInfo } from '@/lib/api-key';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Anonymous rate limit: 20 req/min (IP-based)
const anonLimiter = rateLimit({ max: 20 });
// Keyed rate limit: per-key limit (default 60/min), still IP-based as fallback
const keyedLimiter = rateLimit({ max: 120 });

const ACTIONS = ['search', 'entity', 'power_index', 'funding_deserts', 'revolving_door', 'ask'] as const;

const schema = z.object({
  action: z.enum(ACTIONS),
  query: z.string().max(500).optional(),
  gs_id: z.string().max(100).optional(),
  abn: z.string().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  state: z.string().max(5).optional(),
  min_systems: z.coerce.number().int().min(1).max(7).optional().default(1),
});

type ActionResult = {
  data: unknown;
  meta: { action: string; cached: boolean; timestamp: string; response_ms?: number };
};

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';
}

function ok(action: string, data: unknown, responseMs: number, cache = 300): NextResponse {
  const body: ActionResult = {
    data,
    meta: { action, cached: cache > 0, timestamp: new Date().toISOString(), response_ms: responseMs },
  };
  const res = NextResponse.json(body);
  if (cache > 0) {
    res.headers.set('Cache-Control', `public, s-maxage=${cache}, stale-while-revalidate=${cache * 2}`);
  }
  return res;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = getIp(request);

  // --- API Key validation ---
  let apiKey: ApiKeyInfo | null = null;
  try {
    apiKey = await validateApiKey(request);
  } catch (err) {
    if (err instanceof InvalidApiKeyError) {
      return NextResponse.json(
        { error: 'Invalid or revoked API key. Check your Authorization header.' },
        { status: 401 },
      );
    }
    throw err;
  }

  // --- Rate limiting (key-aware) ---
  if (apiKey) {
    // Keyed request — use higher ceiling as fallback
    const limited = keyedLimiter(request);
    if (limited) {
      logUsage(apiKey.id, 'rate_limited', Date.now() - startTime, 429, ip);
      return limited;
    }
  } else {
    // Anonymous request — tighter limit
    const limited = anonLimiter(request);
    if (limited) {
      logUsage(null, 'rate_limited', Date.now() - startTime, 429, ip);
      return limited;
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      error: 'Invalid parameters',
      details: parsed.error.flatten().fieldErrors,
      available_actions: ACTIONS,
    }, { status: 400 });
  }

  const { action, query, gs_id, abn, limit, state, min_systems } = parsed.data;
  const supabase = getServiceSupabase();

  try {
    switch (action) {
      // --- Entity search by name or ABN ---
      case 'search': {
        if (!query || query.length < 2) {
          return NextResponse.json({ error: 'query required (min 2 chars)' }, { status: 400 });
        }

        const abnClean = query.replace(/\s/g, '');
        const isABN = !!validateAbn(abnClean);
        const stateFilter = state ? `AND UPPER(ge.state) = '${esc(state.toUpperCase())}'` : '';

        const sql = isABN
          ? `SELECT ge.gs_id, ge.canonical_name, ge.abn, ge.entity_type, ge.sector,
                    ge.state, ge.lga_name, ge.is_community_controlled,
                    pi.power_score, pi.system_count, pi.total_dollar_flow
             FROM gs_entities ge
             LEFT JOIN mv_entity_power_index pi ON pi.id = ge.id
             WHERE ge.abn = '${esc(abnClean)}'
             LIMIT ${limit}`
          : `SELECT ge.gs_id, ge.canonical_name, ge.abn, ge.entity_type, ge.sector,
                    ge.state, ge.lga_name, ge.is_community_controlled,
                    pi.power_score, pi.system_count, pi.total_dollar_flow
             FROM gs_entities ge
             LEFT JOIN mv_entity_power_index pi ON pi.id = ge.id
             WHERE UPPER(ge.canonical_name) LIKE '%${esc(query.toUpperCase())}%' ${stateFilter}
             ORDER BY pi.power_score DESC NULLS LAST
             LIMIT ${limit}`;

        const { data, error } = await supabase.rpc('exec_sql', { query: sql });
        if (error) throw error;
        const responseMs = Date.now() - startTime;
        logUsage(apiKey?.id ?? null, action, responseMs, 200, ip);
        return ok('search', data || [], responseMs);
      }

      // --- Full entity profile ---
      case 'entity': {
        if (!gs_id && !abn) {
          return NextResponse.json({ error: 'gs_id or abn required' }, { status: 400 });
        }

        const entityWhere = gs_id ? `ge.gs_id = '${esc(gs_id)}'` : `ge.abn = '${esc(abn!)}'`;

        const { data: entity, error: entityErr } = await supabase.rpc('exec_sql', {
          query: `SELECT ge.gs_id, ge.canonical_name, ge.abn, ge.entity_type, ge.sector,
                         ge.state, ge.postcode, ge.lga_name, ge.remoteness,
                         ge.is_community_controlled, ge.seifa_irsd_decile,
                         ge.latest_revenue, ge.latest_assets,
                         pi.power_score, pi.system_count,
                         pi.in_procurement, pi.in_justice_funding, pi.in_political_donations,
                         pi.in_charity_registry, pi.in_foundation, pi.in_alma_evidence, pi.in_ato_transparency,
                         pi.procurement_dollars, pi.justice_dollars, pi.donation_dollars,
                         pi.total_dollar_flow, pi.contract_count, pi.distinct_govt_buyers
                  FROM gs_entities ge
                  LEFT JOIN mv_entity_power_index pi ON pi.id = ge.id
                  WHERE ${entityWhere}
                  LIMIT 1`,
        });
        if (entityErr) throw entityErr;

        if (!entity || (entity as unknown[]).length === 0) {
          const responseMs = Date.now() - startTime;
          logUsage(apiKey?.id ?? null, action, responseMs, 404, ip);
          return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
        }

        // Get board members
        const entityRow = (entity as Record<string, unknown>[])[0];
        const entityGsId = entityRow.gs_id as string;

        const { data: board } = await supabase.rpc('exec_sql', {
          query: `SELECT person_name, role_type, appointment_date, cessation_date
                  FROM person_roles
                  WHERE entity_id = (SELECT id FROM gs_entities WHERE gs_id = '${esc(entityGsId)}' LIMIT 1)
                  ORDER BY cessation_date IS NULL DESC, appointment_date DESC
                  LIMIT 20`,
        });

        const responseMs = Date.now() - startTime;
        logUsage(apiKey?.id ?? null, action, responseMs, 200, ip);
        return ok('entity', { entity: entityRow, board: board || [] }, responseMs);
      }

      // --- Power index leaderboard ---
      case 'power_index': {
        const stateFilter = state ? `AND UPPER(state) = '${esc(state.toUpperCase())}'` : '';

        const { data, error } = await supabase.rpc('exec_sql', {
          query: `SELECT gs_id, canonical_name, entity_type, abn, state,
                         is_community_controlled, system_count, power_score,
                         procurement_dollars, justice_dollars, donation_dollars,
                         total_dollar_flow
                  FROM mv_entity_power_index
                  WHERE system_count >= ${min_systems} ${stateFilter}
                  ORDER BY power_score DESC NULLS LAST
                  LIMIT ${limit}`,
        });
        if (error) throw error;
        const responseMs = Date.now() - startTime;
        logUsage(apiKey?.id ?? null, action, responseMs, 200, ip);
        return ok('power_index', data || [], responseMs);
      }

      // --- Funding deserts ---
      case 'funding_deserts': {
        const stateFilter = state ? `WHERE UPPER(state) = '${esc(state.toUpperCase())}'` : '';

        const { data, error } = await supabase.rpc('exec_sql', {
          query: `SELECT lga_name, state, remoteness,
                         avg_irsd_decile, indexed_entities,
                         procurement_dollars, justice_dollars, total_dollar_flow,
                         community_controlled_entities, ndis_participants,
                         desert_score
                  FROM mv_funding_deserts
                  ${stateFilter}
                  ORDER BY desert_score DESC NULLS LAST
                  LIMIT ${limit}`,
        });
        if (error) throw error;
        const responseMs = Date.now() - startTime;
        logUsage(apiKey?.id ?? null, action, responseMs, 200, ip);
        return ok('funding_deserts', data || [], responseMs);
      }

      // --- Revolving door ---
      case 'revolving_door': {
        const { data, error } = await supabase.rpc('exec_sql', {
          query: `SELECT canonical_name, revolving_door_score, influence_vectors,
                         total_donated, total_contracts, total_funded,
                         parties_funded, is_community_controlled
                  FROM mv_revolving_door
                  ORDER BY revolving_door_score DESC NULLS LAST
                  LIMIT ${limit}`,
        });
        if (error) throw error;
        const responseMs = Date.now() - startTime;
        logUsage(apiKey?.id ?? null, action, responseMs, 200, ip);
        return ok('revolving_door', data || [], responseMs);
      }

      // --- Natural language query (proxies to /api/ask) ---
      case 'ask': {
        if (!query) {
          return NextResponse.json({ error: 'query required for ask action' }, { status: 400 });
        }

        // Forward to the ask API internally
        const askUrl = new URL('/api/ask', request.url);
        const askRes = await fetch(askUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: query }),
        });

        const askData = await askRes.json();
        if (!askRes.ok) {
          const responseMs = Date.now() - startTime;
          logUsage(apiKey?.id ?? null, action, responseMs, askRes.status, ip);
          return NextResponse.json({ error: askData.error || 'Query failed', details: askData.details }, { status: askRes.status });
        }

        const responseMs = Date.now() - startTime;
        logUsage(apiKey?.id ?? null, action, responseMs, 200, ip);
        return ok('ask', {
          question: askData.question,
          explanation: askData.explanation,
          results: askData.results,
          count: askData.count,
          generated_sql: askData.generated_sql,
        }, responseMs, 0); // Don't cache AI queries
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}`, available_actions: ACTIONS }, { status: 400 });
    }
  } catch (err) {
    const responseMs = Date.now() - startTime;
    logUsage(apiKey?.id ?? null, action, responseMs, 500, ip);
    console.error(`[/api/agent] ${action} error:`, err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET returns API documentation
export async function GET() {
  return NextResponse.json({
    name: 'CivicGraph Agent API',
    version: '1.1',
    description: 'Structured intelligence on Australian government spending, procurement, political donations, charities, and community organisations. 560K entities, 1.5M relationships, 770K contracts.',
    endpoint: '/api/agent',
    method: 'POST',
    authentication: {
      type: 'Bearer token',
      header: 'Authorization: Bearer cg_live_...',
      alternative: 'x-api-key: cg_live_...',
      note: 'API key optional during beta. Anonymous requests limited to 20/min. Keyed requests get 60/min+.',
    },
    rate_limit: {
      anonymous: '20 requests/minute',
      authenticated: '60+ requests/minute (configurable per key)',
    },
    actions: {
      search: {
        description: 'Search entities by name or ABN',
        params: { query: 'string (required)', state: 'AU state code (optional)', limit: 'number 1-50 (default 10)' },
        example: { action: 'search', query: 'Commonwealth Bank' },
      },
      entity: {
        description: 'Full entity profile with power score, cross-system presence, and board members',
        params: { gs_id: 'string (or abn)' },
        example: { action: 'entity', abn: '48123123124' },
      },
      power_index: {
        description: 'Top entities ranked by cross-system power score (7 systems: procurement, justice, donations, charity, foundation, evidence, tax)',
        params: { limit: 'number 1-50', state: 'AU state', min_systems: 'number 1-7' },
        example: { action: 'power_index', limit: 10, min_systems: 3 },
      },
      funding_deserts: {
        description: 'Most underserved local government areas ranked by desert_score (high disadvantage, low funding)',
        params: { limit: 'number 1-50', state: 'AU state' },
        example: { action: 'funding_deserts', state: 'NT', limit: 10 },
      },
      revolving_door: {
        description: 'Entities with multiple influence vectors (lobbying + donations + contracts)',
        params: { limit: 'number 1-50' },
        example: { action: 'revolving_door', limit: 10 },
      },
      ask: {
        description: 'Natural language query — converts your question to SQL, executes it, and returns results with AI explanation',
        params: { query: 'string (required)' },
        example: { action: 'ask', query: 'How much does QLD spend on youth justice?' },
      },
    },
    data_sources: [
      'AusTender (federal contracts)',
      'AEC (political donations)',
      'ACNC (charity register)',
      'ATO (tax transparency)',
      'ORIC (Indigenous corporations)',
      'Justice funding (state/federal)',
      'ALMA (evidence-based interventions)',
      'ABR (Australian Business Register)',
      'Lobbying Register',
      'Person roles (board members, directors)',
    ],
    coverage: {
      entities: '560K+',
      relationships: '1.5M+',
      contracts: '770K+',
      donations: '312K+',
      justice_funding: '71K+',
      charities: '66K+',
      foundations: '10.8K+',
    },
  });
}
