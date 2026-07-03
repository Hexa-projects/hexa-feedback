// Shared helpers for RD Station CRM v2 edge functions.
// - Token encryption (AES-GCM using RD_TOKEN_ENC_KEY)
// - OAuth token refresh with rotation
// - Authenticated fetch with retry/backoff and pagination

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const RD_API_BASE = "https://api.rd.services";
export const RD_AUTH_TOKEN_URL = `${RD_API_BASE}/auth/token`;
export const RD_AUTH_DIALOG_URL = `${RD_API_BASE}/auth/dialog`;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function requiredEnv(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  throw new Error(`${names[0]} not configured`);
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function serviceRoleClient(): SupabaseClient {
  return createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function requireAdmin(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "unauthorized" }, 401);
  const anon = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await anon.auth.getClaims(token);
  if (error || !data?.claims?.sub) return jsonResponse({ error: "unauthorized" }, 401);
  const userId = data.claims.sub as string;
  const svc = serviceRoleClient();
  const { data: role, error: roleError } = await svc.rpc("is_rd_admin", { _user: userId });
  if (!role && roleError) console.warn("is_rd_admin RPC failed; using user_roles fallback", roleError.message);
  if (!role) {
    const { data: roles, error: rolesError } = await svc
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesError) {
      console.error("RD admin role fallback failed", rolesError.message);
      return jsonResponse({ error: "role_check_failed" }, 500);
    }
    const allowed = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "gestor");
    if (!allowed) return jsonResponse({ error: "forbidden" }, 403);
  }
  return { userId };
}

// ---------------- Encryption (AES-GCM, key derived from RD_TOKEN_ENC_KEY) ----------------

async function getCryptoKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("RD_TOKEN_ENC_KEY") ?? "";
  const bytes = new TextEncoder().encode(raw);
  // Hash to 32 bytes so key length is always valid.
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plain);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc));
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv, 0);
  out.set(cipher, iv.length);
  return btoa(String.fromCharCode(...out));
}

export async function decryptSecret(payload: string): Promise<string> {
  const key = await getCryptoKey();
  const bin = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const iv = bin.slice(0, 12);
  const data = bin.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
}

// ---------------- OAuth ----------------

export function redirectUri(): string {
  return `${requiredEnv("SUPABASE_URL")}/functions/v1/rd-oauth-callback`;
}

export async function exchangeCode(code: string) {
  const res = await fetch(RD_AUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: Deno.env.get("RD_STATION_CLIENT_ID"),
      client_secret: Deno.env.get("RD_STATION_CLIENT_SECRET"),
      code,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

export async function refreshTokens(refreshToken: string) {
  const res = await fetch(RD_AUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: Deno.env.get("RD_STATION_CLIENT_ID"),
      client_secret: Deno.env.get("RD_STATION_CLIENT_SECRET"),
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`refresh failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

export async function getAccessToken(svc: SupabaseClient): Promise<string> {
  const { data, error } = await svc
    .from("crm_external_accounts")
    .select("id, access_token_enc, refresh_token_enc, expires_at")
    .eq("provider", "rd_station")
    .maybeSingle();
  if (error) throw error;
  if (!data?.access_token_enc || !data?.refresh_token_enc) throw new Error("rd_not_connected");

  const expiresAt = data.expires_at ? new Date(data.expires_at as string).getTime() : 0;
  const needsRefresh = expiresAt - Date.now() < 5 * 60 * 1000;
  if (!needsRefresh) return decryptSecret(data.access_token_enc);

  const currentRefresh = await decryptSecret(data.refresh_token_enc);
  const fresh = await refreshTokens(currentRefresh);
  const newAccess = await encryptSecret(fresh.access_token);
  const newRefresh = await encryptSecret(fresh.refresh_token);
  const newExpiresAt = new Date(Date.now() + fresh.expires_in * 1000).toISOString();
  await svc
    .from("crm_external_accounts")
    .update({
      access_token_enc: newAccess,
      refresh_token_enc: newRefresh,
      expires_at: newExpiresAt,
    })
    .eq("provider", "rd_station");
  return fresh.access_token;
}

// ---------------- HTTP wrapper ----------------

export async function rdFetch(
  svc: SupabaseClient,
  path: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<Response> {
  const token = await getAccessToken(svc);
  const url = path.startsWith("http") ? path : `${RD_API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    const wait = 2 ** attempt * 500 + Math.random() * 300;
    await new Promise((r) => setTimeout(r, wait));
    return rdFetch(svc, path, init, attempt + 1);
  }
  return res;
}

export async function* rdPaginate<T = any>(
  svc: SupabaseClient,
  path: string,
  extraParams: Record<string, string> = {},
  itemsKey?: string,
): AsyncGenerator<T[]> {
  let page = 1;
  const limit = 200;
  while (true) {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit), ...extraParams });
    const res = await rdFetch(svc, `${path}?${qs}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GET ${path} failed: ${res.status} ${text.slice(0, 500)}`);
    }
    const body = await res.json();
    const items: T[] = itemsKey ? body[itemsKey] : (Array.isArray(body) ? body : body.deals ?? body.contacts ?? body.organizations ?? body.tasks ?? body.users ?? body.pipelines ?? body.stages ?? body.custom_fields ?? body.sources ?? body.lost_reasons ?? body.products ?? []);
    if (!items || items.length === 0) return;
    yield items;
    if (items.length < limit) return;
    page += 1;
    if (page > 500) return; // hard safety
  }
}

// ---------------- Logging helper ----------------

export async function logSync(
  svc: SupabaseClient,
  jobId: string | null,
  entity: string | null,
  level: "info" | "warn" | "error",
  message: string,
  context: Record<string, unknown> = {},
) {
  try {
    await svc.from("rd_sync_logs").insert({ job_id: jobId, entity, level, message, context });
  } catch (_) { /* never crash the sync */ }
}
