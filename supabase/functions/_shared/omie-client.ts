import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export type OmieEndpoint = {
  module: "finance";
  endpoint: string;
  method: string;
  entityType: string;
  targetTable: string;
  itemsKey?: string;
};

export const OMIE_FINANCE_ENDPOINTS: OmieEndpoint[] = [
  {
    module: "finance",
    endpoint: "https://app.omie.com.br/api/v1/financas/contapagar/",
    method: "ListarContasPagar",
    entityType: "payable",
    targetTable: "omie_payables",
    itemsKey: "conta_pagar_cadastro",
  },
  {
    module: "finance",
    endpoint: "https://app.omie.com.br/api/v1/financas/contareceber/",
    method: "ListarContasReceber",
    entityType: "receivable",
    targetTable: "omie_receivables",
    itemsKey: "conta_receber_cadastro",
  },
  {
    module: "finance",
    endpoint: "https://app.omie.com.br/api/v1/financas/mf/",
    method: "ListarMovimentos",
    entityType: "financial_movement",
    targetTable: "omie_financial_movements",
    itemsKey: "movimentos",
  },
];

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

export async function requireFinanceAccess(req: Request): Promise<{ userId: string } | Response> {
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
  const { data: roles, error: rolesError } = await svc
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesError) return jsonResponse({ error: "role_check_failed" }, 500);
  const hasRole = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "gestor");
  if (hasRole) return { userId };
  const { data: profile } = await svc.from("profiles").select("setor").eq("id", userId).maybeSingle();
  if (profile?.setor === "Financeiro" || profile?.setor === "Diretoria") return { userId };
  return jsonResponse({ error: "forbidden" }, 403);
}

export function maskKey(key: string) {
  if (!key) return null;
  return key.length <= 6 ? "***" : `${key.slice(0, 4)}...${key.slice(-3)}`;
}

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function sanitizePayload(payload: Record<string, unknown>) {
  const copy = structuredClone(payload);
  delete (copy as any).app_key;
  delete (copy as any).app_secret;
  return copy;
}

export function extractRedundantCooldownSeconds(message = "") {
  if (!/REDUNDANT|redundante/i.test(message)) return null;
  const explicit = message.match(/Aguarde\s+(\d+)\s+segundos/i)?.[1];
  const parsed = explicit ? Number(explicit) : 60;
  return Number.isFinite(parsed) ? Math.max(parsed + 5, 65) : 65;
}

export function buildLockKey(endpoint: string, method: string, payloadHash: string) {
  return `${endpoint}|${method}|${payloadHash}`;
}

export async function acquireOmieLock(
  svc: SupabaseClient,
  jobId: string,
  endpoint: string,
  method: string,
  payloadHash: string,
  ttlSeconds = 90,
) {
  const lockKey = buildLockKey(endpoint, method, payloadHash);
  const { data, error } = await svc.rpc("omie_acquire_sync_lock", {
    _lock_key: lockKey,
    _job_id: jobId,
    _endpoint: endpoint,
    _method: method,
    _payload_hash: payloadHash,
    _ttl_seconds: ttlSeconds,
  });
  if (error) throw new Error(`lock_acquire_failed: ${error.message}`);
  return { lockKey, acquired: !!data?.[0]?.acquired, lockedUntil: data?.[0]?.locked_until as string | null };
}

export async function releaseOmieLock(svc: SupabaseClient, lockKey: string, jobId: string) {
  await svc.rpc("omie_release_sync_lock", { _lock_key: lockKey, _job_id: jobId });
}

export async function omieFetch(
  endpoint: string,
  method: string,
  param: Record<string, unknown>,
) {
  const body = {
    call: method,
    app_key: requiredEnv("OMIE_APP_KEY"),
    app_secret: requiredEnv("OMIE_APP_SECRET"),
    param: [param],
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = { raw: text };
  }
  if (!response.ok || data?.faultstring) {
    const faultstring = String(data?.faultstring ?? text ?? `HTTP ${response.status}`);
    const error: any = new Error(faultstring);
    error.status = response.status;
    error.faultcode = data?.faultcode ?? (response.ok ? "OMIE_FAULT" : `HTTP_${response.status}`);
    error.faultstring = faultstring;
    error.cooldownSeconds = extractRedundantCooldownSeconds(faultstring);
    error.raw = data;
    throw error;
  }
  return data;
}

export function getItems(body: any, explicitKey?: string): any[] {
  if (explicitKey && Array.isArray(body?.[explicitKey])) return body[explicitKey];
  if (Array.isArray(body)) return body;
  const key = body && typeof body === "object"
    ? Object.keys(body).find((k) => Array.isArray(body[k]))
    : null;
  return key ? body[key] : [];
}

function parseBrazilianDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    const num = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

export function normalizePayable(item: any) {
  const omieId = item?.codigo_lancamento_omie ?? item?.codigo_lancamento_integracao ?? item?.numero_documento_fiscal;
  return {
    omie_id: omieId ? String(omieId) : null,
    codigo_integracao: item?.codigo_lancamento_integracao ?? null,
    cliente_nome: item?.razao_social_fornecedor ?? item?.nome_fantasia_fornecedor ?? item?.fornecedor ?? null,
    cliente_documento: item?.cnpj_cpf_fornecedor ?? null,
    valor: pickNumber(item?.valor_documento, item?.valor_total, item?.valor),
    data_emissao: parseBrazilianDate(item?.data_emissao),
    data_vencimento: parseBrazilianDate(item?.data_vencimento),
    data_pagamento: parseBrazilianDate(item?.data_pagamento),
    status: item?.status_titulo ?? item?.status ?? null,
    categoria: item?.codigo_categoria ?? item?.categoria ?? null,
    departamento: item?.codigo_departamento ?? null,
    origem: "omie",
    raw_payload: item,
    sync_status: "synced",
    last_synced_at: new Date().toISOString(),
  };
}

export function normalizeReceivable(item: any) {
  const omieId = item?.codigo_lancamento_omie ?? item?.codigo_lancamento_integracao ?? item?.numero_documento_fiscal;
  return {
    omie_id: omieId ? String(omieId) : null,
    codigo_integracao: item?.codigo_lancamento_integracao ?? null,
    cliente_nome: item?.razao_social_cliente ?? item?.nome_fantasia_cliente ?? item?.cliente ?? null,
    cliente_documento: item?.cnpj_cpf_cliente ?? null,
    valor: pickNumber(item?.valor_documento, item?.valor_total, item?.valor),
    data_emissao: parseBrazilianDate(item?.data_emissao),
    data_vencimento: parseBrazilianDate(item?.data_vencimento),
    data_pagamento: parseBrazilianDate(item?.data_pagamento),
    status: item?.status_titulo ?? item?.status ?? null,
    categoria: item?.codigo_categoria ?? item?.categoria ?? null,
    departamento: item?.codigo_departamento ?? null,
    origem: "omie",
    raw_payload: item,
    sync_status: "synced",
    last_synced_at: new Date().toISOString(),
  };
}

export function normalizeMovement(item: any) {
  const omieId = item?.codigo_lancamento_omie ?? item?.codigo_lancamento_integracao ?? item?.numero_documento ?? crypto.randomUUID();
  return {
    omie_id: String(omieId),
    tipo: item?.tipo_documento ?? item?.tipo ?? null,
    cliente_nome: item?.razao_social ?? item?.cliente_fornecedor ?? item?.cliente ?? null,
    valor: pickNumber(item?.valor_documento, item?.valor_lancamento, item?.valor),
    data_movimento: parseBrazilianDate(item?.data_lancamento ?? item?.data_previsao ?? item?.data_emissao),
    status: item?.status_titulo ?? item?.status ?? null,
    origem: "omie",
    raw_payload: item,
    sync_status: "synced",
    last_synced_at: new Date().toISOString(),
  };
}

export function normalizeForTarget(targetTable: string, item: any) {
  if (targetTable === "omie_payables") return normalizePayable(item);
  if (targetTable === "omie_receivables") return normalizeReceivable(item);
  return normalizeMovement(item);
}

