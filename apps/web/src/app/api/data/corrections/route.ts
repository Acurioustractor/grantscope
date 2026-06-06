import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDirectServiceSupabase } from '@/lib/supabase';
import { rateLimit } from '@/lib/rate-limit';
import { GIVING_SCHEMA_VERSION, correctionUrl, withCorsHeaders } from '@/lib/giving-commons';

export const dynamic = 'force-dynamic';

const limiter = rateLimit({ windowMs: 60_000, max: 10 });

const correctionSchema = z.object({
  target_type: z.string().trim().min(2).max(80),
  target_id: z.string().trim().max(200).optional().nullable(),
  claim_url: z.string().trim().max(1000).optional().nullable(),
  submitter_name: z.string().trim().min(2).max(160),
  submitter_email: z.string().email().max(240),
  submitter_org: z.string().trim().max(240).optional().nullable(),
  requested_change: z.string().trim().min(20).max(5000),
  evidence_url: z.string().trim().max(1000).optional().nullable(),
  evidence_text: z.string().trim().max(5000).optional().nullable(),
  right_of_reply: z.boolean().optional().default(false),
});

function cleanOptional(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: withCorsHeaders() });
}

export async function POST(request: Request) {
  const limited = limiter(request);
  if (limited) {
    withCorsHeaders(limited.headers);
    return limited;
  }

  const origin = new URL(request.url).origin;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: withCorsHeaders() },
    );
  }

  const parsed = correctionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400, headers: withCorsHeaders() },
    );
  }

  const payload = parsed.data;
  const targetId = cleanOptional(payload.target_id);
  const claimUrl = cleanOptional(payload.claim_url);

  if (!targetId && !claimUrl) {
    return NextResponse.json(
      { error: 'Provide target_id or claim_url' },
      { status: 400, headers: withCorsHeaders() },
    );
  }

  const db = getDirectServiceSupabase();
  const { data, error } = await db
    .from('data_corrections')
    .insert({
      target_type: payload.target_type,
      target_id: targetId,
      claim_url: claimUrl,
      submitter_name: payload.submitter_name,
      submitter_email: payload.submitter_email,
      submitter_org: cleanOptional(payload.submitter_org),
      requested_change: payload.requested_change,
      evidence_url: cleanOptional(payload.evidence_url),
      evidence_text: cleanOptional(payload.evidence_text),
      right_of_reply: payload.right_of_reply,
      status: 'new',
    })
    .select('id, created_at')
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Correction submission failed', detail: error.message },
      { status: 500, headers: withCorsHeaders() },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      schema_version: GIVING_SCHEMA_VERSION,
      id: data?.id,
      reference_id: data?.id,
      created_at: data?.created_at,
      correction_url: correctionUrl(origin),
    },
    { headers: withCorsHeaders() },
  );
}
