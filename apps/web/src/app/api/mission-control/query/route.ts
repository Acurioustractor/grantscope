import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const BLOCKED_PATTERNS = /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY|VACUUM|REINDEX)\b/i;

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const sql = (body.sql ?? '').trim();

  if (!sql) {
    return NextResponse.json({ error: 'SQL query is required' }, { status: 400 });
  }

  // Must start with SELECT or WITH
  if (!/^(SELECT|WITH)\b/i.test(sql)) {
    return NextResponse.json({ error: 'Only SELECT queries are allowed' }, { status: 400 });
  }

  // Block mutation keywords
  if (BLOCKED_PATTERNS.test(sql)) {
    return NextResponse.json({ error: 'Query contains blocked keywords' }, { status: 400 });
  }

  // Block multiple statements
  const stripped = sql.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
  if (stripped.includes(';') && stripped.indexOf(';') < stripped.length - 1) {
    return NextResponse.json({ error: 'Multiple statements not allowed' }, { status: 400 });
  }

  const db = getServiceSupabase();
  const start = Date.now();

  try {
    // Wrap in a read-only transaction via RPC if available, otherwise direct
    const { data, error } = await db.rpc('exec_sql', { query: sql });

    if (error) {
      return NextResponse.json({
        error: error.message,
        hint: error.hint || null,
        duration: Date.now() - start,
      }, { status: 400 });
    }

    const rows = Array.isArray(data) ? data : [];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return NextResponse.json({
      columns,
      rows,
      rowCount: rows.length,
      duration: Date.now() - start,
    });
  } catch (err) {
    console.error('[mission-control/query]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Query execution failed',
      duration: Date.now() - start,
    }, { status: 500 });
  }
}
