import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, serviceRoleKey);

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

const allowedFields = new Set([
  "name",
  "description",
  "address",
  "phone",
  "email",
  "website",
  "facebook",
  "instagram",
  "imageUrl",
]);

Deno.serve(async req => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const token = getBearerToken(req);
  if (!token) return new Response("Missing auth", { status: 401 });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });

  const payload = await req.json();
  const businessId = payload?.businessId;
  if (!businessId) return new Response("Missing businessId", { status: 400 });

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (allowedFields.has(key) && value !== undefined) {
      updates[key] = value;
    }
  }
  updates.updatedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("harvest_businesses")
    .update(updates)
    .eq("id", businessId)
    .eq("userOpenId", userData.user.id)
    .select()
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!data) {
    return new Response(JSON.stringify({ error: "Business not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ business: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
