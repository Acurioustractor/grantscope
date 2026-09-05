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

Deno.serve(async req => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const token = getBearerToken(req);
  if (!token) return new Response("Missing auth", { status: 401 });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });

  const payload = await req.json();
  const businessId = payload?.businessId;
  if (!businessId) return new Response("Missing businessId", { status: 400 });

  const { data, error } = await supabase
    .from("harvest_businesses")
    .update({ userOpenId: userData.user.id, updatedAt: new Date().toISOString() })
    .eq("id", businessId)
    .is("userOpenId", null)
    .eq("status", "approved")
    .select()
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!data) {
    return new Response(JSON.stringify({ error: "Unable to claim business" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ business: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
