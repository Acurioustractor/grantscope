import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, report_slug, source } = body;

    if (!email || !report_slug) {
      return NextResponse.json({ error: 'Email and report_slug required' }, { status: 400 });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Check for existing entry (dedup)
    const { data: existing } = await supabase
      .from('report_leads')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .eq('report_slug', report_slug)
      .limit(1)
      .single();

    if (existing) {
      return NextResponse.json({ status: 'already_registered' });
    }

    const { error } = await supabase.from('report_leads').insert({
      email: email.toLowerCase().trim(),
      report_slug,
      source: source || 'dataset_download',
    });

    if (error) {
      console.error('Failed to save report lead:', error);
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }

    return NextResponse.json({ status: 'ok' });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
