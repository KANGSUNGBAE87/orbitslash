import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ ok: false, reason: "server_not_configured" }, 500);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return json({ ok: false, reason: "action_invalid" }, 400);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const coreUserId = await resolveCoreUserId(admin, supabaseUrl, anonKey, request.headers.get("Authorization"));
  if (!coreUserId) return json({ ok: false, reason: "identity_not_bound" }, 401);
  if (body.action === "list") {
    const { data, error } = await admin.from("orbitslash_entitlements").select("product_id").eq("core_user_id", coreUserId).is("revoked_at", null);
    if (error) return json({ ok: false, reason: "entitlement_read_failed" }, 500);
    return json({ ok: true, products: (data ?? []).map((row) => row.product_id).filter((id): id is string => typeof id === "string") });
  }
  // Client receipt claims are deliberately not persisted. Provider verifier setup is a release gate.
  if (body.action === "verifyReceipt") return json({ ok: false, reason: "receipt_provider_not_configured" }, 503);
  return json({ ok: false, reason: "action_invalid" }, 400);
});

async function resolveCoreUserId(admin: SupabaseClient, supabaseUrl: string, anonKey: string, header: string | null): Promise<string | null> {
  const token = /^Bearer\s+(.+)$/i.exec(header ?? "")?.[1];
  if (!token || token === anonKey) return null;
  const publicClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await publicClient.auth.getUser(token);
  if (!data.user?.id) return null;
  const { data: identity } = await admin.from("authmap_user_identities").select("core_user_id").eq("provider", "supabase_auth").eq("provider_user_id", data.user.id).maybeSingle();
  return typeof identity?.core_user_id === "string" ? identity.core_user_id : null;
}

function json(payload: unknown, status = 200): Response { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
