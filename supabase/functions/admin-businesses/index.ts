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

async function requireAdmin(token: string) {
  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) return { error: "Unauthorized" } as const;

  const { data } = await supabase
    .from("app_users")
    .select("role")
    .eq("openId", userData.user.id)
    .maybeSingle();

  if (!data || data.role !== "admin") {
    return { error: "Forbidden" } as const;
  }

  return { userId: userData.user.id } as const;
}

Deno.serve(async req => {
  const token = getBearerToken(req);
  if (!token) return new Response("Missing auth", { status: 401 });

  const adminCheck = await requireAdmin(token);
  if ("error" in adminCheck) {
    return new Response(adminCheck.error, {
      status: adminCheck.error === "Forbidden" ? 403 : 401,
    });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "pending";
    const { data, error } = await supabase
      .from("harvest_businesses")
      .select("*")
      .eq("status", status)
      .order("createdAt", { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ businesses: data ?? [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    const payload = await req.json();
    const { businessId, status } = payload ?? {};
    if (!businessId || !["approved", "rejected"].includes(status)) {
      return new Response("Invalid payload", { status: 400 });
    }

    const { data, error } = await supabase
      .from("harvest_businesses")
      .update({ status, updatedAt: new Date().toISOString() })
      .eq("id", businessId)
      .select()
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ business: data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
});
