// Shared helpers for RD Station CRM (v1) edge functions using Private/Instance Token.
// - Token encryption (AES-GCM using RD_TOKEN_ENC_KEY)
// - Authenticated fetch (?token=...) with retry/backoff and pagination

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const RD_CRM_V1_BASE = "https://crm.rdstation.com/api/v1";

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

// ---------------- Private Token ----------------

export async function getPrivateToken(svc?: SupabaseClient): Promise<string> {
  const client = svc ?? serviceRoleClient();
  const { data } = await client
    .from("crm_integrations")
    .select("private_token_enc")
    .eq("provider", "rd_station")
    .maybeSingle();
  if (data?.private_token_enc) {
    try {
      const tok = await decryptSecret(data.private_token_enc as string);
      if (tok) return tok;
    } catch (_) { /* fall through */ }
  }
  const envTok = Deno.env.get("RD_STATION_PRIVATE_TOKEN") ?? "";
  if (envTok) return envTok;
  throw new Error("rd_private_token_not_configured");
}

// ---------------- HTTP wrapper ----------------

export async function rdFetch(
  svc: SupabaseClient,
  path: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<Response> {
  const token = await getPrivateToken(svc);
  const base = path.startsWith("http") ? path : `${RD_CRM_V1_BASE}${path}`;
  const url = new URL(base);
  url.searchParams.set("token", token);
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    const wait = 2 ** attempt * 500 + Math.random() * 300;
    await new Promise((r) => setTimeout(r, wait));
    return rdFetch(svc, path, init, attempt + 1);
  }
  return res;
}

// ---------------- Pagination (CRM v1) ----------------
// v1 returns `{ <resource>: [...], has_more, total, page, limit }` on most endpoints.

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
    let items: T[] | undefined;
    if (itemsKey && Array.isArray(body?.[itemsKey])) {
      items = body[itemsKey];
    } else if (Array.isArray(body)) {
      items = body as T[];
    } else if (body && typeof body === "object") {
      // Auto-detect the first array field in the response.
      const firstArrayKey = Object.keys(body).find((k) => Array.isArray((body as any)[k]));
      if (firstArrayKey) items = (body as any)[firstArrayKey];
    }
    if (!items || items.length === 0) return;
    yield items;
    const hasMore = typeof body?.has_more === "boolean" ? body.has_more : items.length >= limit;
    if (!hasMore) return;
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
