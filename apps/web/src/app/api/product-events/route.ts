import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { recordProductEvents, type ProductEventType } from '@/lib/product-events';

const ALLOWED_EVENT_TYPES = new Set<ProductEventType>([
  'upgrade_prompt_viewed',
  'upgrade_cta_clicked',
]);

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const eventType = body?.eventType as ProductEventType | undefined;
  const source = typeof body?.source === 'string' ? body.source.trim().slice(0, 80) : null;
  const metadata = typeof body?.metadata === 'object' && body?.metadata !== null
    ? body.metadata as Record<string, unknown>
    : {};

  if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: 'Invalid event type.' }, { status: 400 });
  }

  await recordProductEvents([
    {
      userId: user.id,
      eventType,
      metadata: {
        source,
        ...metadata,
      },
    },
  ]);

  return NextResponse.json({ ok: true });
}
