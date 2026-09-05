// Supabase Edge Function for GHL Webhooks
// Deploy: supabase functions deploy ghl-webhook
// URL: https://tednluwflfhxyucgwigh.supabase.co/functions/v1/ghl-webhook
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// GHL workflow webhooks send `tags` as a comma-separated string (not an array)
// and dates as epoch-millisecond numbers (not ISO). The DB columns expect an
// array and a timestamp, so the raw values crash the upsert. Normalize both.
function normalizeTags(t) {
  if (Array.isArray(t)) return t;
  if (typeof t === 'string') return t.split(',').map((s)=>s.trim()).filter(Boolean);
  return [];
}
function normalizeDate(d) {
  if (d === null || d === undefined || d === '') return null;
  if (typeof d === 'number') return new Date(d).toISOString();
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
Deno.serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ghlLocationId = Deno.env.get('GHL_LOCATION_ID') || 'agzsSZWgovjwgpcoASWG';
  const supabase = createClient(supabaseUrl, supabaseKey);
  try {
    const payload = await req.json();
    // Log raw payload for debugging
    console.log(`📥 GHL Webhook raw payload:`, JSON.stringify(payload));
    // Detect event type - GHL workflows may not include type, so we infer from payload
    let eventType = payload.type || payload.event || 'unknown';
    // GHL workflow webhook sends contact data with fields like contact_id, first_name, etc.
    // If we detect contact fields, treat it as a contact event
    const hasContactData = payload.contact_id || payload.id || payload.email || payload.first_name;
    const hasOpportunityData = payload.opportunity_id || payload.pipeline_id || payload.monetary_value;
    if (eventType === 'unknown' && hasContactData) {
      eventType = 'ContactUpdate' // Default to update since contact likely exists
      ;
    }
    if (eventType === 'unknown' && hasOpportunityData) {
      eventType = 'OpportunityUpdate';
    }
    console.log(`📥 GHL Webhook event type: ${eventType}`);
    let result = {
      handled: false,
      eventType
    };
    // Handle contact events
    // GHL workflow sends contact data directly in payload with fields like:
    // id, contact_id, first_name, last_name, email, phone, etc.
    if (eventType.toLowerCase().includes('contact') || hasContactData) {
      // Try multiple possible locations for contact data
      const contact = payload.data?.contact || payload.contact || payload;
      // GHL workflow uses different field names - normalize them
      const contactId = contact.id || contact.contact_id || payload.id || payload.contact_id;
      const firstName = contact.firstName || contact.first_name;
      const lastName = contact.lastName || contact.last_name;
      const email = contact.email;
      const phone = contact.phone;
      const companyName = contact.companyName || contact.company_name;
      const tags = normalizeTags(contact.tags);
      const dateAdded = normalizeDate(contact.dateAdded || contact.date_added || contact.dateCreated || contact.date_created);
      const dateUpdated = normalizeDate(contact.dateUpdated || contact.date_updated);
      console.log(`📥 Processing contact: ${contactId} - ${firstName} ${lastName} - ${email}`);
      if (eventType.includes('Delete')) {
        await supabase.from('ghl_contacts').update({
          sync_status: 'deleted',
          updated_at: new Date().toISOString()
        }).eq('ghl_id', contactId);
        result = {
          handled: true,
          action: 'contact_deleted',
          contactId
        };
      } else if (contactId) {
        const contactData = {
          ghl_id: contactId,
          ghl_location_id: ghlLocationId,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          company_name: companyName,
          tags: tags,
          custom_fields: contact.customFields || contact.custom_fields || {},
          ghl_created_at: dateAdded,
          ghl_updated_at: dateUpdated || new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          sync_status: 'synced'
        };
        console.log(`📥 Upserting contact data:`, JSON.stringify(contactData));
        const { error } = await supabase.from('ghl_contacts').upsert(contactData, {
          onConflict: 'ghl_id'
        });
        if (error) {
          console.error(`❌ Supabase upsert error:`, error);
          throw error;
        }
        result = {
          handled: true,
          action: 'contact_synced',
          contactId
        };
      } else {
        console.log(`⚠️ No contact ID found in payload`);
      }
    }
    // Handle opportunity events
    if (eventType.toLowerCase().includes('opportunity')) {
      const opp = payload.data?.opportunity || payload.opportunity || payload;
      const oppData = {
        ghl_id: opp.id,
        ghl_contact_id: opp.contactId,
        ghl_pipeline_id: opp.pipelineId,
        ghl_stage_id: opp.pipelineStageId,
        name: opp.name,
        pipeline_name: opp.pipelineName,
        stage_name: opp.pipelineStageName || opp.stageName,
        status: opp.status,
        monetary_value: opp.monetaryValue,
        custom_fields: opp.customFields || {},
        assigned_to: opp.assignedTo,
        ghl_created_at: normalizeDate(opp.dateAdded),
        ghl_updated_at: normalizeDate(opp.dateUpdated) || new Date().toISOString(),
        last_synced_at: new Date().toISOString()
      };
      await supabase.from('ghl_opportunities').upsert(oppData, {
        onConflict: 'ghl_id'
      });
      result = {
        handled: true,
        action: 'opportunity_synced',
        opportunityId: opp.id
      };
    }
    // Handle communication events (update last_contact_date)
    if (eventType.toLowerCase().includes('message') || eventType.toLowerCase().includes('call') || eventType.toLowerCase().includes('appointment')) {
      const contactId = payload.contactId || payload.data?.contactId;
      if (contactId) {
        await supabase.from('ghl_contacts').update({
          last_contact_date: new Date().toISOString()
        }).eq('ghl_id', contactId);
        result = {
          handled: true,
          action: 'contact_touched',
          contactId
        };
      }
    }
    // Log to sync_log
    await supabase.from('ghl_sync_log').insert({
      operation: eventType,
      entity_type: result.contactId ? 'contact' : result.opportunityId ? 'opportunity' : 'unknown',
      entity_id: result.contactId || result.opportunityId || null,
      direction: 'ghl_to_supabase',
      status: 'success',
      triggered_by: 'webhook',
      records_processed: 1,
      completed_at: new Date().toISOString()
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Webhook error:', error);
    // Log error
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from('ghl_sync_log').insert({
      operation: 'webhook_error',
      entity_type: 'unknown',
      direction: 'ghl_to_supabase',
      status: 'error',
      error_message: error.message,
      triggered_by: 'webhook',
      completed_at: new Date().toISOString()
    }).catch(()=>{});
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
