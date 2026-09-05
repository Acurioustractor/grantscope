const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";
const DEFAULT_HARVEST_INBOX_PIPELINE_ID = "ggQw10DuH0XRji6keimS";
const DEFAULT_HARVEST_INBOX_NEW_STAGE_ID = "2eded979-7439-407d-89b6-762499b56658";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function upsertHarvestInboxOpportunity(input: {
  apiKey: string;
  locationId: string;
  contactId: string;
  name: string;
  source: string;
}) {
  const pipelineId = Deno.env.get("GHL_HARVEST_INBOX_PIPELINE_ID") || DEFAULT_HARVEST_INBOX_PIPELINE_ID;
  const pipelineStageId = Deno.env.get("GHL_HARVEST_INBOX_NEW_STAGE_ID") || DEFAULT_HARVEST_INBOX_NEW_STAGE_ID;

  await fetch(`${GHL_API_BASE}/opportunities/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${input.apiKey}`,
      Version: GHL_API_VERSION,
    },
    body: JSON.stringify({
      pipelineId,
      locationId: input.locationId,
      contactId: input.contactId,
      name: input.name,
      status: "open",
      pipelineStageId,
      monetaryValue: 0,
      source: input.source,
    }),
  });
}

// Conversations API uses an older version header. Pushes the form message into
// the contact's GHL Conversations thread so the GHL inbox is the triage desk.
const GHL_CONVERSATIONS_API_VERSION = "2021-04-15";
const GHL_INBOX_EMAIL = "hi@act.place";

async function addInboundFormMessage(input: {
  apiKey: string;
  locationId: string;
  contactId: string;
  fromEmail?: string;
  subject: string;
  html: string;
}) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${input.apiKey}`,
    Version: GHL_CONVERSATIONS_API_VERSION,
  };
  let conversationId: string | undefined;
  const searchRes = await fetch(
    `${GHL_API_BASE}/conversations/search?locationId=${input.locationId}&contactId=${input.contactId}`,
    { headers },
  );
  if (searchRes.ok) {
    const data = await searchRes.json();
    conversationId = data?.conversations?.[0]?.id;
  }
  if (!conversationId) {
    const createRes = await fetch(`${GHL_API_BASE}/conversations/`, {
      method: "POST",
      headers,
      body: JSON.stringify({ locationId: input.locationId, contactId: input.contactId }),
    });
    if (createRes.ok) {
      const created = await createRes.json();
      conversationId = created?.conversation?.id ?? created?.id;
    }
  }
  if (!conversationId) {
    console.error("inbox message: no conversation for", input.contactId);
    return;
  }
  const msgRes = await fetch(`${GHL_API_BASE}/conversations/messages/inbound`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "Email",
      conversationId,
      emailTo: GHL_INBOX_EMAIL,
      emailFrom: input.fromEmail || GHL_INBOX_EMAIL,
      subject: input.subject,
      html: input.html,
    }),
  });
  if (!msgRes.ok) {
    console.error("inbox message failed:", msgRes.status, await msgRes.text());
  }
}

// Tag mappings for each submission type
const TYPE_TAGS: Record<string, string[]> = {
  volunteer: ["interest:volunteer", "role:volunteer", "harvest-website"],
  idea: ["community-idea", "harvest-website"],
  residency: ["residency-applicant", "harvest-website"],
  "business-interest": ["business-interest", "harvest-website"],
  "workshop-suggestion": ["workshop-suggestion", "harvest-website"],
  "story-feature": ["story-feature", "harvest-website"],
  "venue-enquiry": ["venue-enquiry", "harvest-website"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("GHL_API_KEY") ?? Deno.env.get("GHL_TOKEN");
  const locationId = Deno.env.get("GHL_LOCATION_ID");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const payload = await req.json();
  const { type, email, name, ...fields } = payload;

  if (
    typeof type !== "string" ||
    !Object.hasOwn(TYPE_TAGS, type) ||
    !email ||
    !name
  ) {
    return jsonResponse({ success: false, error: "Type, name and email are required." }, 400);
  }
  if (
    typeof name !== "string" || name.trim().length > 120 ||
    typeof email !== "string" || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return jsonResponse({ success: false, error: "Enter a valid name and email." }, 400);
  }

  // 1. Store in Supabase FIRST so a GHL outage can never lose the message.
  // One table for every submission type; type-specific fields live in payload jsonb.
  let submissionId: string | null = null;
  if (supabaseUrl && supabaseKey) {
    try {
      const dbRes = await fetch(`${supabaseUrl}/rest/v1/community_submissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          type,
          name,
          email,
          phone: fields.phone ?? null,
          payload: fields,
        }),
      });
      if (dbRes.ok) {
        const rows = await dbRes.json();
        submissionId = rows?.[0]?.id ?? null;
      } else {
        console.error("community-submit: DB insert failed", dbRes.status, await dbRes.text());
      }
    } catch (err) {
      console.error("community-submit: DB insert threw", err);
    }
  }

  // 2. Upsert contact in GHL
  let ghlContactId: string | null = null;
  if (apiKey && locationId) {
    const tags = [...(TYPE_TAGS[type] ?? ["harvest-website"]), "harvest-inbox", "project:act-hv"];
    if (fields.residencyType) tags.push(`residency-${fields.residencyType}`);
    if (fields.ideaType) tags.push(`idea-${fields.ideaType}`);
    if (fields.interestType) tags.push(`biz-${fields.interestType}`);
    if (fields.helpType) tags.push(`pod:${String(fields.helpType).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`);
    if (fields.sourceCampaign) tags.push(`source:campaign:${String(fields.sourceCampaign).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`);
    if (fields.sourceContent) tags.push(`source:content:${String(fields.sourceContent).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`);

    const nameParts = String(name).trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.slice(1).join(" ") || undefined;

    try {
      const ghlRes = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          Version: GHL_API_VERSION,
        },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          phone: fields.phone ?? undefined,
          locationId,
          source: `Harvest | ${type}`,
        }),
      });
      if (ghlRes.ok) {
        const ghlData = await ghlRes.json();
        ghlContactId = ghlData?.contact?.id ?? null;
      } else {
        console.error("community-submit: GHL upsert failed", ghlRes.status, await ghlRes.text());
      }
    } catch (err) {
      console.error("community-submit: GHL upsert threw", err);
    }

    if (ghlContactId) {
      try {
        await fetch(`${GHL_API_BASE}/contacts/${ghlContactId}/tags`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
            Version: GHL_API_VERSION,
          },
          body: JSON.stringify({ tags }),
        });
      } catch {
        // Non-critical
      }

      const noteLines = [`**${type.toUpperCase()} submission from website**`];
      if (fields.title) noteLines.push(`**Title:** ${fields.title}`);
      if (fields.description) noteLines.push(`**Description:** ${fields.description}`);
      if (fields.message) noteLines.push(`**Message:** ${fields.message}`);
      if (fields.businessName) noteLines.push(`**Business:** ${fields.businessName}`);
      if (fields.portfolioUrl) noteLines.push(`**Portfolio:** ${fields.portfolioUrl}`);
      if (fields.durationWeeks) noteLines.push(`**Duration:** ${fields.durationWeeks} weeks`);
      if (fields.eventType) noteLines.push(`**Event type:** ${fields.eventType}`);
      const preferredDate = fields.eventDate ?? fields.date;
      if (preferredDate) noteLines.push(`**Preferred date:** ${preferredDate}`);
      if (fields.guests) noteLines.push(`**Expected guests:** ${fields.guests}`);

      try {
        await fetch(`${GHL_API_BASE}/contacts/${ghlContactId}/notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
            Version: GHL_API_VERSION,
          },
          body: JSON.stringify({ body: noteLines.join("\n\n") }),
        });
      } catch {
        // Non-critical
      }

      try {
        await upsertHarvestInboxOpportunity({
          apiKey,
          locationId,
          contactId: ghlContactId,
          name: `${String(name).trim()} - ${type}`,
          source: `Harvest | ${type}`,
        });
      } catch {
        // Non-critical
      }

      try {
        await addInboundFormMessage({
          apiKey,
          locationId,
          contactId: ghlContactId,
          fromEmail: String(email),
          subject: `${type} submission from ${String(name).trim()}`,
          html: [
            `<p><strong>${escapeHtml(String(type).toUpperCase())} submission (website)</strong></p>`,
            fields.title ? `<p>Title: ${escapeHtml(fields.title)}</p>` : "",
            fields.businessName ? `<p>Business: ${escapeHtml(fields.businessName)}</p>` : "",
            fields.eventType ? `<p>Event type: ${escapeHtml(fields.eventType)}</p>` : "",
            preferredDate ? `<p>Preferred date: ${escapeHtml(preferredDate)}</p>` : "",
            fields.guests ? `<p>Expected guests: ${escapeHtml(fields.guests)}</p>` : "",
            fields.description ? `<p>${escapeHtml(fields.description).replace(/\n/g, "<br>")}</p>` : "",
            fields.message ? `<p>${escapeHtml(fields.message).replace(/\n/g, "<br>")}</p>` : "",
            fields.portfolioUrl ? `<p>Portfolio: ${escapeHtml(fields.portfolioUrl)}</p>` : "",
          ].join(""),
        });
      } catch (err) {
        console.error("inbox message failed (community submit):", err);
      }

      const workflowId = Deno.env.get("GHL_COMMUNITY_SUBMIT_WORKFLOW_ID");
      if (workflowId) {
        try {
          await fetch(`${GHL_API_BASE}/contacts/${ghlContactId}/workflow/${workflowId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
              "Authorization": `Bearer ${apiKey}`,
              "Version": GHL_API_VERSION,
            },
          });
        } catch {
          // Non-critical
        }
      }
    }
  }

  // 3. Mark the stored row as synced once GHL has the contact.
  if (submissionId && ghlContactId && supabaseUrl && supabaseKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/community_submissions?id=eq.${submissionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ ghl_contact_id: ghlContactId, ghl_synced: true }),
      });
    } catch {
      // Non-critical: the row exists, the sync flag is best-effort
    }
  }

  // 4. Honest result: success only if the message is actually stored somewhere.
  if (!submissionId && !ghlContactId) {
    return jsonResponse(
      {
        success: false,
        error:
          "We could not save your message just now. Please try again, or email hello@theharvestwitta.com.au.",
      },
      502,
    );
  }

  return jsonResponse({ success: true, contactId: ghlContactId, submissionId });
});
