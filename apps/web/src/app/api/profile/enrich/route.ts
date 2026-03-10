import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

async function getOrgProfileId(db: ReturnType<typeof getServiceSupabase>, userId: string) {
  const { data: own } = await db
    .from('org_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (own) return own.id;

  const { data: member } = await db
    .from('org_members')
    .select('org_profile_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  return member?.org_profile_id || null;
}

export async function POST() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceSupabase();
  const orgId = await getOrgProfileId(db, user.id);
  if (!orgId) return NextResponse.json({ error: 'No org profile found' }, { status: 404 });

  // Get current profile
  const { data: profile } = await db
    .from('org_profiles')
    .select('name, abn, mission, focus_areas, geographic_focus, beneficiaries')
    .eq('id', orgId)
    .single();

  // Get recent knowledge chunks
  const { data: chunks } = await db
    .from('knowledge_chunks')
    .select('content, summary, topics, entities')
    .eq('org_profile_id', orgId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!chunks || chunks.length === 0) {
    return NextResponse.json({ error: 'No knowledge documents found. Upload some documents first.' }, { status: 400 });
  }

  const knowledgeContext = chunks
    .map((c: { content: string; summary: string | null; topics: string[] | null }) =>
      `${c.summary || c.content.slice(0, 300)}${c.topics?.length ? ` [Topics: ${c.topics.join(', ')}]` : ''}`
    )
    .join('\n\n');

  // Call Claude Haiku for enrichment suggestions
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are analysing documents uploaded by an Australian organisation to suggest profile enrichments.

Current profile:
${JSON.stringify(profile, null, 2)}

Knowledge from their uploaded documents:
${knowledgeContext.slice(0, 6000)}

Based on this knowledge, suggest profile updates. Return JSON only (no markdown):
{
  "current": { "mission": "...", "focus_areas": [...], "geographic_focus": "...", "beneficiaries": [...] },
  "suggested": { "mission": "suggested mission statement", "domains": ["domain1"], "geographic_focus": "suggested focus", "projects": ["project1"] },
  "confidence": 0.0-1.0,
  "reasoning": "why these suggestions"
}`,
      }],
    }),
  });

  const data = await response.json();
  const content = data.content?.[0]?.text || '{}';

  try {
    const suggestions = JSON.parse(content);
    return NextResponse.json(suggestions);
  } catch {
    return NextResponse.json({
      current: profile,
      suggested: {},
      confidence: 0,
      reasoning: 'Could not parse AI response',
    });
  }
}
