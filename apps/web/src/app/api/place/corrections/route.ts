import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = rateLimit();

const schema = z.object({
  page_route: z.string().min(1).max(200),
  lga_name: z.string().max(120).optional(),
  message: z.string().min(3).max(4000),
  contact: z.string().max(320).optional(),
  // Honeypot. Real people never see this field; anything in it is a bot.
  website: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const limited = limiter(request);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Bots that fill the honeypot get a success they cannot learn from.
  if (parsed.data.website) {
    return NextResponse.json({ ok: true });
  }

  try {
    const supabase = getServiceSupabase();
    const { error } = await supabase.from('place_corrections').insert({
      page_route: parsed.data.page_route,
      lga_name: parsed.data.lga_name ?? null,
      message: parsed.data.message,
      contact: parsed.data.contact || null,
    });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('place correction insert failed:', error);
    // The form falls back to email on this status; do not lose the correction.
    return NextResponse.json({ error: 'Could not record the correction' }, { status: 503 });
  }
}
