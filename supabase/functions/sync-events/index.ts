// Supabase Edge Function: Unified Sync Events
// Purpose: Central event bus for all communication syncing with AI enrichment
// Deploy: supabase functions deploy sync-events
// URL: https://tednluwflfhxyucgwigh.supabase.co/functions/v1/sync-events

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

// Event types we handle
type EventType = 'email' | 'calendar' | 'call' | 'sms' | 'voice_note' | 'discord' | 'signal' | 'whatsapp'
type Direction = 'inbound' | 'outbound' | 'internal'

interface SyncEvent {
  type: EventType
  direction: Direction
  subject?: string
  content_preview?: string
  summary?: string
  occurred_at: string
  source_system: string
  source_id: string
  source_thread_id?: string
  contact_email?: string
  contact_phone?: string
  contact_ghl_id?: string
  from_user?: string  // canonical name: 'ben', 'nic'
  to_users?: string[]
  sentiment?: string
  topics?: string[]
  action_items?: { text: string; assigned_to?: string; due_date?: string }[]
  waiting_for_response?: boolean
  response_needed_by?: 'us' | 'them' | 'none'
  // Voice note specific
  audio_url?: string
  transcript?: string
  duration_seconds?: number
}

interface BatchSyncRequest {
  events: SyncEvent[]
  source: string
  api_key?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const expectedApiKey = Deno.env.get('SYNC_API_KEY')

  // Validate API key if configured
  const providedKey = req.headers.get('x-api-key')
  if (expectedApiKey && providedKey !== expectedApiKey) {
    return new Response(JSON.stringify({ error: 'Invalid API key' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const body: BatchSyncRequest = await req.json()
    const { events, source } = body

    if (!events || !Array.isArray(events)) {
      return new Response(JSON.stringify({ error: 'Events array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[sync-events] Received ${events.length} events from ${source}`)

    const results = {
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    }

    for (const event of events) {
      try {
        // Check for duplicates
        const { data: existing } = await supabase
          .from('communications_history')
          .select('id')
          .eq('source_system', event.source_system)
          .eq('source_id', event.source_id)
          .single()

        if (existing) {
          console.log(`[sync-events] Skipping duplicate: ${event.source_system}/${event.source_id}`)
          results.skipped++
          continue
        }

        // Resolve contact if email/phone provided
        let ghlContactId = event.contact_ghl_id
        if (!ghlContactId && event.contact_email) {
          const { data: contact } = await supabase
            .from('ghl_contacts')
            .select('ghl_id')
            .eq('email', event.contact_email)
            .single()
          ghlContactId = contact?.ghl_id
        }
        if (!ghlContactId && event.contact_phone) {
          const { data: contact } = await supabase
            .from('ghl_contacts')
            .select('ghl_id')
            .ilike('phone', `%${event.contact_phone.replace(/\D/g, '').slice(-10)}%`)
            .single()
          ghlContactId = contact?.ghl_id
        }

        // Resolve user identities
        let fromIdentityId: string | null = null
        let toIdentityIds: string[] = []

        if (event.from_user) {
          const { data: identity } = await supabase
            .from('user_identities')
            .select('id')
            .eq('canonical_name', event.from_user)
            .single()
          fromIdentityId = identity?.id
        }

        if (event.to_users?.length) {
          const { data: identities } = await supabase
            .from('user_identities')
            .select('id')
            .in('canonical_name', event.to_users)
          toIdentityIds = identities?.map((i: { id: string }) => i.id) || []
        }

        // Generate AI enrichment if we have content but no summary
        let enrichedSummary = event.summary
        let enrichedTopics = event.topics
        let enrichedSentiment = event.sentiment
        let enrichedActionItems = event.action_items

        if (anthropicKey && event.content_preview && !event.summary) {
          const enrichment = await enrichWithAI(anthropicKey, event)
          enrichedSummary = enrichment.summary
          enrichedTopics = enrichment.topics
          enrichedSentiment = enrichment.sentiment
          enrichedActionItems = enrichment.action_items
        }

        // Insert communication record
        const commRecord = {
          ghl_contact_id: ghlContactId,
          channel: event.type,
          direction: event.direction,
          from_identity: fromIdentityId,
          to_identities: toIdentityIds.length ? toIdentityIds : null,
          subject: event.subject,
          content_preview: event.content_preview?.slice(0, 500),
          summary: enrichedSummary,
          sentiment: enrichedSentiment,
          topics: enrichedTopics,
          action_items: enrichedActionItems,
          waiting_for_response: event.waiting_for_response,
          response_needed_by: event.response_needed_by,
          source_system: event.source_system,
          source_id: event.source_id,
          source_thread_id: event.source_thread_id,
          occurred_at: event.occurred_at,
          enriched_at: enrichedSummary ? new Date().toISOString() : null,
        }

        const { error: insertError } = await supabase
          .from('communications_history')
          .insert(commRecord)

        if (insertError) {
          console.error(`[sync-events] Insert error:`, insertError)
          results.errors.push(`${event.source_id}: ${insertError.message}`)
          continue
        }

        results.created++

        // Handle voice notes separately
        if (event.type === 'voice_note' && event.audio_url) {
          await handleVoiceNote(supabase, event, fromIdentityId, ghlContactId)
        }

        results.processed++
      } catch (eventError) {
        console.error(`[sync-events] Event error:`, eventError)
        results.errors.push(`${event.source_id}: ${eventError.message}`)
      }
    }

    // Log sync operation
    await supabase.from('ghl_sync_log').insert({
      operation: 'sync_events',
      entity_type: 'communication',
      direction: 'inbound',
      status: results.errors.length ? 'partial' : 'success',
      triggered_by: source,
      records_processed: results.processed,
      records_created: results.created,
      records_skipped: results.skipped,
      records_failed: results.errors.length,
      error_message: results.errors.length ? results.errors.join('; ') : null,
      completed_at: new Date().toISOString(),
    })

    console.log(`[sync-events] Complete: ${results.processed} processed, ${results.created} created, ${results.skipped} skipped`)

    return new Response(JSON.stringify({
      success: true,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[sync-events] Fatal error:', error)

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// AI enrichment using Claude
async function enrichWithAI(apiKey: string, event: SyncEvent): Promise<{
  summary: string
  topics: string[]
  sentiment: string
  action_items: { text: string; assigned_to?: string }[]
}> {
  try {
    const prompt = `Analyze this ${event.type} communication and extract:
1. A one-sentence summary
2. Topics (as tags, e.g., "project:harvest", "funding", "meeting")
3. Sentiment (positive/neutral/negative/urgent)
4. Any action items mentioned

Communication:
Subject: ${event.subject || 'N/A'}
Content: ${event.content_preview || 'N/A'}

Respond in JSON format:
{
  "summary": "...",
  "topics": ["..."],
  "sentiment": "...",
  "action_items": [{"text": "...", "assigned_to": "..."}]
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      console.error('[sync-events] AI enrichment failed:', response.status)
      return { summary: '', topics: [], sentiment: 'neutral', action_items: [] }
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    return { summary: '', topics: [], sentiment: 'neutral', action_items: [] }
  } catch (error) {
    console.error('[sync-events] AI enrichment error:', error)
    return { summary: '', topics: [], sentiment: 'neutral', action_items: [] }
  }
}

// Handle voice note creation
async function handleVoiceNote(
  supabase: ReturnType<typeof createClient>,
  event: SyncEvent,
  recordedBy: string | null,
  contactId: string | null
): Promise<void> {
  try {
    const voiceNote = {
      source_channel: event.source_system,
      recorded_by: recordedBy,
      recorded_by_name: event.from_user,
      audio_url: event.audio_url,
      transcript: event.transcript,
      summary: event.summary,
      topics: event.topics,
      action_items: event.action_items,
      duration_seconds: event.duration_seconds,
      visibility: 'team',
      related_contact_id: contactId,
      recorded_at: event.occurred_at,
    }

    const { error } = await supabase
      .from('voice_notes')
      .insert(voiceNote)

    if (error) {
      console.error('[sync-events] Voice note insert error:', error)
    }
  } catch (error) {
    console.error('[sync-events] Voice note error:', error)
  }
}
