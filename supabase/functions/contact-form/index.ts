const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";
const DEFAULT_HARVEST_INBOX_PIPELINE_ID = "ggQw10DuH0XRji6keimS";
const DEFAULT_HARVEST_INBOX_NEW_STAGE_ID = "2eded979-7439-407d-89b6-762499b56658";
// The existing "Message" custom field (contact.message). Populated so the ACT
// notification workflow email can render the submitter's message via {{ contact.message }}.
const DEFAULT_CONTACT_MESSAGE_FIELD_ID = "ceJz9FUf8dE4fmvnPDKd";

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

  const response = await fetch(`${GHL_API_BASE}/opportunities/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${input.apiKey}`,
      "Version": GHL_API_VERSION,
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GHL opportunity upsert failed with status ${response.status}: ${errorText}`);
  }
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

Deno.serve(async req => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("GHL_API_KEY") ?? Deno.env.get("GHL_TOKEN");
  const locationId = Deno.env.get("GHL_LOCATION_ID");
  if (!apiKey || !locationId) {
    return jsonResponse({
      success: false,
      error: "Contact service is not configured.",
    }, 500);
  }

  const payload = await req.json();
  const { name, email, subject, message, subscribe } = payload;

  if (!name || !email || !message) {
    return jsonResponse({ success: false, error: "Name, email and message are required" }, 400);
  }
  if (
    typeof name !== "string" || name.trim().length > 120 ||
    typeof email !== "string" || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof message !== "string" || message.length > 10_000 ||
    (subject != null && (typeof subject !== "string" || subject.length > 200))
  ) {
    return jsonResponse({ success: false, error: "Enter a valid name, email and message." }, 400);
  }

  // Parse name into first/last
  const nameParts = String(name).trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || undefined;
  const lastName = nameParts.slice(1).join(" ") || undefined;
  const tags = [
    "contact-form",
    "harvest-website",
    "harvest-inbox",
    "act-inquiry", // ACT-wide inquiry marker the shared notification workflow triggers on
    "project:act-hv",
    ...(subscribe ? ["comms:harvest-newsletter"] : []),
  ];

  // Fold the subject into the message so the single "Message" field carries the
  // full context the notification email needs.
  const messageFieldValue = subject
    ? `Subject: ${subject}\n\n${message}`
    : String(message);
  const messageFieldId =
    Deno.env.get("GHL_CONTACT_MESSAGE_FIELD_ID") || DEFAULT_CONTACT_MESSAGE_FIELD_ID;

  // Create/update contact in GHL
  const contactResponse = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "Version": GHL_API_VERSION,
    },
    body: JSON.stringify({
      email,
      firstName,
      lastName,
      locationId,
      source: "Harvest | Contact",
      // Populate contact.message so the ACT notification workflow email can show
      // what the person actually wrote (via {{ contact.message }}), not just their address.
      customFields: [{ id: messageFieldId, value: messageFieldValue }],
    }),
  });

  if (!contactResponse.ok) {
    let errorMessage = "Failed to process contact. Please try again.";
    try {
      const errorData = await contactResponse.json();
      errorMessage = errorData?.message ?? errorMessage;
    } catch {
      // ignore
    }
    return jsonResponse({ success: false, error: errorMessage }, contactResponse.status);
  }

  const contactData = await contactResponse.json();
  const contactId = contactData?.contact?.id;
  let opportunityCreated = false;
  let opportunityError: string | undefined;

  if (contactId) {
    try {
      await fetch(`${GHL_API_BASE}/contacts/${contactId}/tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "Version": GHL_API_VERSION,
        },
        body: JSON.stringify({ tags }),
      });
    } catch {
      // Tag failure shouldn't block the message.
    }

    // Add a note to the contact with the message
    await fetch(`${GHL_API_BASE}/contacts/${contactId}/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Version": GHL_API_VERSION,
      },
      body: JSON.stringify({
        body: `**Website Contact Form**\n\n**Subject:** ${subject || "No subject"}\n\n**Message:**\n${message}`,
      }),
    });

    try {
      await addInboundFormMessage({
        apiKey,
        locationId,
        contactId,
        fromEmail: String(email),
        subject: subject ? `Contact form: ${subject}` : `Contact form message from ${String(name).trim()}`,
        html: `<p><strong>Website contact form</strong></p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
      });
    } catch (error) {
      console.error("inbox message failed (contact form):", error);
    }

    try {
      await upsertHarvestInboxOpportunity({
        apiKey,
        locationId,
        contactId,
        name: `${String(name).trim()} - Contact form`,
        source: "Harvest | Contact",
      });
      opportunityCreated = true;
    } catch (error) {
      opportunityError = error instanceof Error ? error.message : "GHL opportunity upsert failed";
      console.error("GHL contact opportunity upsert failed:", error);
    }
  }

  // Trigger GHL workflow for contact form auto-reply. The message should still
  // be saved if GHL workflow enrolment has a temporary issue.
  let workflowTriggered = false;
  let workflowError: string | undefined;
  const workflowId = Deno.env.get("GHL_CONTACT_FORM_WORKFLOW_ID");
  if (workflowId && contactId) {
    try {
      const workflowResponse = await fetch(`${GHL_API_BASE}/contacts/${contactId}/workflow/${workflowId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "Version": GHL_API_VERSION,
        },
      });

      if (workflowResponse.ok) {
        workflowTriggered = true;
      } else {
        const errorText = await workflowResponse.text();
        workflowError = `Workflow trigger failed with status ${workflowResponse.status}`;
        console.error("GHL contact workflow trigger failed:", workflowResponse.status, errorText);
      }
    } catch (error) {
      workflowError = error instanceof Error ? error.message : "Workflow trigger failed";
      console.error("GHL contact workflow trigger failed:", error);
    }
  } else if (!workflowId) {
    workflowError = "GHL_CONTACT_FORM_WORKFLOW_ID is not configured";
    console.error(workflowError);
  }

  return jsonResponse({
    success: true,
    contactId,
    opportunityCreated,
    workflowTriggered,
    ...(opportunityError ? { opportunityError } : {}),
    ...(workflowError ? { workflowError } : {}),
  });
});
