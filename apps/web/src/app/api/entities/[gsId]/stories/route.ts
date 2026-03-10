import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET /api/entities/[gsId]/stories
 *
 * Fetches verified impact stories from Empathy Ledger for a CivicGraph entity.
 * Links via ABN — entity's ABN → EL organization's ABN → tenant stories.
 */

const EMPATHY_LEDGER_URL = process.env.EMPATHY_LEDGER_URL || 'https://empathyledger.com';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gsId: string }> }
) {
  const { gsId } = await params;

  // Look up the entity's ABN
  const supabase = getServiceSupabase();
  const { data: entity } = await supabase
    .from('gs_entities')
    .select('abn, canonical_name')
    .eq('gs_id', gsId)
    .single();

  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  if (!entity.abn) {
    return NextResponse.json({
      stories: [],
      count: 0,
      reason: 'Entity has no ABN — cannot link to Empathy Ledger',
    });
  }

  try {
    // Call Empathy Ledger's syndication API
    const res = await fetch(
      `${EMPATHY_LEDGER_URL}/api/syndication/grantscope?abn=${entity.abn}`,
      {
        headers: { 'x-api-key': 'grantscope' },
        next: { revalidate: 300 }, // Cache for 5 minutes
      }
    );

    if (!res.ok) {
      console.error(`EL API error for ${gsId}: ${res.status}`);
      return NextResponse.json({ stories: [], count: 0, error: 'Empathy Ledger unavailable' });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Empathy Ledger fetch error:', error);
    return NextResponse.json({ stories: [], count: 0, error: 'Empathy Ledger unreachable' });
  }
}
