import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { parseValidationReviewCsv } from '@/lib/validation-reviews';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data upload.' }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No CSV file uploaded.' }, { status: 400 });
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'CSV file is too large. Max 2MB.' }, { status: 400 });
  }

  const csvText = await file.text();
  const { rowsParsed, validRows } = parseValidationReviewCsv(csvText);

  if (rowsParsed === 0) {
    return NextResponse.json({ error: 'CSV contained no review rows.' }, { status: 400 });
  }

  if (validRows.length === 0) {
    return NextResponse.json({ error: 'CSV rows were present but none were valid review rows.' }, { status: 400 });
  }

  const db = getServiceSupabase();
  const { error } = await db
    .from('validation_reviews')
    .upsert(validRows, { onConflict: 'row_key' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    imported: validRows.length,
    rowsParsed,
  });
}
