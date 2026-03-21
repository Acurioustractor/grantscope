import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * CivicScope data API — query civic intelligence data.
 *
 * Endpoints:
 *   ?table=statements&limit=20&minister=Janetzki
 *   ?table=hansard&limit=20&speaker=Smith&date=2026-03-20
 *   ?table=alerts&limit=20&severity=high
 *   ?table=spending&limit=20&department=Justice
 *   ?table=diaries&limit=20&minister=Miles
 *   ?table=stats  — aggregate counts across all civic tables
 *   ?search=youth+justice  — full-text search across statements + hansard
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const table = params.get('table') || 'stats';
  const limit = Math.min(parseInt(params.get('limit') || '20'), 100);
  const offset = parseInt(params.get('offset') || '0');
  const search = params.get('search');
  const db = getServiceSupabase();

  try {
    if (search) {
      return NextResponse.json(await fullTextSearch(db, search, limit));
    }

    switch (table) {
      case 'statements':
        return NextResponse.json(await queryStatements(db, params, limit, offset));
      case 'hansard':
        return NextResponse.json(await queryHansard(db, params, limit, offset));
      case 'alerts':
        return NextResponse.json(await queryAlerts(db, params, limit, offset));
      case 'spending':
        return NextResponse.json(await querySpending(db, params, limit, offset));
      case 'diaries':
        return NextResponse.json(await queryDiaries(db, params, limit, offset));
      case 'stats':
        return NextResponse.json(await getStats(db));
      default:
        return NextResponse.json({ error: `Unknown table: ${table}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

type DB = ReturnType<typeof getServiceSupabase>;

async function queryStatements(db: DB, params: URLSearchParams, limit: number, offset: number) {
  let query = db
    .from('civic_ministerial_statements')
    .select('id, source_id, headline, minister_name, portfolio, published_at, summary, topics, mentioned_locations, linked_funding_ids, linked_intervention_ids, source_url')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const minister = params.get('minister');
  if (minister) query = query.ilike('minister_name', `%${minister}%`);

  const topic = params.get('topic');
  if (topic) query = query.contains('topics', [topic]);

  const { data, error } = await query;
  if (error) throw error;
  return { table: 'statements', count: data?.length || 0, data };
}

async function queryHansard(db: DB, params: URLSearchParams, limit: number, offset: number) {
  let query = db
    .from('civic_hansard')
    .select('id, sitting_date, speaker_name, speaker_party, speaker_electorate, speaker_role, speech_type, subject, summary, topics, source_url')
    .order('sitting_date', { ascending: false })
    .range(offset, offset + limit - 1);

  const speaker = params.get('speaker');
  if (speaker) query = query.ilike('speaker_name', `%${speaker}%`);

  const date = params.get('date');
  if (date) query = query.eq('sitting_date', date);

  const type = params.get('type');
  if (type) query = query.eq('speech_type', type);

  const { data, error } = await query;
  if (error) throw error;
  return { table: 'hansard', count: data?.length || 0, data };
}

async function queryAlerts(db: DB, params: URLSearchParams, limit: number, offset: number) {
  let query = db
    .from('civic_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const severity = params.get('severity');
  if (severity) query = query.eq('severity', severity);

  const type = params.get('type');
  if (type) query = query.eq('alert_type', type);

  const { data, error } = await query;
  if (error) throw error;
  return { table: 'alerts', count: data?.length || 0, data };
}

async function querySpending(db: DB, params: URLSearchParams, limit: number, offset: number) {
  let query = db
    .from('civic_consultancy_spending')
    .select('*')
    .order('financial_year', { ascending: false })
    .range(offset, offset + limit - 1);

  const dept = params.get('department');
  if (dept) query = query.ilike('department', `%${dept}%`);

  const fy = params.get('financial_year');
  if (fy) query = query.eq('financial_year', fy);

  const { data, error } = await query;
  if (error) throw error;
  return { table: 'spending', count: data?.length || 0, data };
}

async function queryDiaries(db: DB, params: URLSearchParams, limit: number, offset: number) {
  let query = db
    .from('civic_ministerial_diaries')
    .select('*')
    .order('meeting_date', { ascending: false })
    .range(offset, offset + limit - 1);

  const minister = params.get('minister');
  if (minister) query = query.ilike('minister_name', `%${minister}%`);

  const org = params.get('organisation');
  if (org) query = query.ilike('organisation', `%${org}%`);

  const { data, error } = await query;
  if (error) throw error;
  return { table: 'diaries', count: data?.length || 0, data };
}

async function fullTextSearch(db: DB, search: string, limit: number) {
  const tsQuery = search.split(/\s+/).join(' & ');

  const [stmts, hansard] = await Promise.all([
    db.from('civic_ministerial_statements')
      .select('id, headline, minister_name, published_at, source_url')
      .textSearch('headline', tsQuery, { type: 'websearch' })
      .limit(limit),
    db.from('civic_hansard')
      .select('id, sitting_date, speaker_name, subject, source_url')
      .textSearch('subject', tsQuery, { type: 'websearch' })
      .limit(limit),
  ]);

  return {
    search,
    statements: stmts.data || [],
    hansard: hansard.data || [],
    total: (stmts.data?.length || 0) + (hansard.data?.length || 0),
  };
}

async function getStats(db: DB) {
  const [statements, hansard, alerts, spending, diaries, rti] = await Promise.all([
    db.from('civic_ministerial_statements').select('id', { count: 'exact', head: true }),
    db.from('civic_hansard').select('id', { count: 'exact', head: true }),
    db.from('civic_alerts').select('id', { count: 'exact', head: true }),
    db.from('civic_consultancy_spending').select('id', { count: 'exact', head: true }),
    db.from('civic_ministerial_diaries').select('id', { count: 'exact', head: true }),
    db.from('civic_rti_disclosures').select('id', { count: 'exact', head: true }),
  ]);

  return {
    tables: {
      civic_ministerial_statements: statements.count || 0,
      civic_hansard: hansard.count || 0,
      civic_alerts: alerts.count || 0,
      civic_consultancy_spending: spending.count || 0,
      civic_ministerial_diaries: diaries.count || 0,
      civic_rti_disclosures: rti.count || 0,
    },
    total: (statements.count || 0) + (hansard.count || 0) + (alerts.count || 0) +
           (spending.count || 0) + (diaries.count || 0) + (rti.count || 0),
    last_updated: new Date().toISOString(),
  };
}
