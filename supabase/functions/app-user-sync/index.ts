import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const adminOpenIds = (Deno.env.get("ADMIN_OPEN_IDS") ?? "")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean);
const ownerOpenId = (Deno.env.get("OWNER_OPEN_ID") ?? "").trim();

const supabase = createClient(supabaseUrl, serviceRoleKey);

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

Deno.serve(async req => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const token = getBearerToken(req);
  if (!token) return new Response("Missing auth", { status: 401 });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = userData.user;
  const openId = user.id;
  const existing = await supabase
    .from("app_users")
    .select("role")
    .eq("openId", openId)
    .maybeSingle();

  const shouldBeAdmin =
    (ownerOpenId && ownerOpenId === openId) || adminOpenIds.includes(openId);

  const role = existing.data?.role === "admin" || shouldBeAdmin ? "admin" : "user";
  const loginMethod =
    user.app_metadata?.provider ?? user.app_metadata?.providers?.[0] ?? null;

  const { data, error } = await supabase
    .from("app_users")
    .upsert(
      {
        openId,
        name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        email: user.email ?? null,
        loginMethod,
        role,
        updatedAt: new Date().toISOString(),
        lastSignedIn: new Date().toISOString(),
      },
      { onConflict: "openId" }
    )
    .select()
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ user: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
