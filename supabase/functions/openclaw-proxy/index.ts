import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function maskToken(token: string): string {
  if (!token || token.length < 8) return "***";
  return token.slice(0, 4) + "..." + token.slice(-4);
}

function normalizeUrl(url: string): string {
  let u = url.trim();
  while (u.endsWith("/")) u = u.slice(0, -1);
  return u;
}

function isPrivateHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(hostname)) return true;
  return false;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, base_url, token } = await req.json();

    if (action !== "health") {
      return jsonResponse({ success: false, error: "unknown_action", message: "Ação não reconhecida." }, 400);
    }

    if (!base_url) {
      return jsonResponse({ success: false, error: "url_missing", message: "URL do OpenClaw não informada." });
    }

    const normalized = normalizeUrl(base_url);
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(normalized);
    } catch {
      return jsonResponse({ success: false, error: "url_invalid", message: "URL inválida. Use http:// ou https://." });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return jsonResponse({ success: false, error: "url_invalid", message: "URL inválida. Use http:// ou https://." });
    }

    if (isPrivateHostname(parsedUrl.hostname)) {
      console.log(`[openclaw-proxy] Private network blocked → ${parsedUrl.hostname} (token: ${token ? maskToken(token) : "none"})`);
      return jsonResponse({
        success: false,
        error: "private_network",
        message:
          `Backend do HexaOS não alcança IP privado ${parsedUrl.hostname}. Use URL pública HTTPS/WSS ou execute backend na mesma rede privada.`,
        detail: "private_host_detected",
      });
    }

    const healthUrl = `${normalized}/health`;
    console.log(`[openclaw-proxy] Health check → ${healthUrl} (token: ${token ? maskToken(token) : "none"})`);

    const maxRetries = 2;
    let lastError = "";

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(healthUrl, {
          method: "GET",
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (res.ok) {
          let body: unknown = null;
          try {
            body = await res.json();
          } catch {
            body = await res.text();
          }

          console.log(`[openclaw-proxy] Health OK (attempt ${attempt})`);
          return jsonResponse({
            success: true,
            status: res.status,
            data: body,
            message: "Conectado com sucesso",
          });
        }

        if (res.status === 401 || res.status === 403) {
          console.log(`[openclaw-proxy] Auth error ${res.status}`);
          return jsonResponse({
            success: false,
            error: "auth_error",
            status: res.status,
            message: "Token inválido ou ausente",
          });
        }

        lastError = `HTTP ${res.status}`;
        console.log(`[openclaw-proxy] HTTP ${res.status} (attempt ${attempt})`);
      } catch (err: any) {
        if (err.name === "AbortError") {
          lastError = "timeout";
          console.log(`[openclaw-proxy] Timeout (attempt ${attempt})`);
        } else {
          lastError = err?.message || "unknown";
          console.log(`[openclaw-proxy] Network error (attempt ${attempt}): ${lastError}`);
        }
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    let errorType = "network_error";
    let message = "Gateway não respondeu (/health)";

    if (lastError === "timeout") {
      errorType = "timeout";
      message = "Gateway não respondeu (/health)";
    } else if (lastError.includes("dns") || lastError.includes("ENOTFOUND") || lastError.includes("getaddrinfo")) {
      errorType = "dns_error";
      message = "Gateway não respondeu (/health)";
    } else if (lastError.includes("ECONNREFUSED") || lastError.includes("refused")) {
      errorType = "connection_refused";
      message = "Gateway não respondeu (/health)";
    } else if (lastError.toLowerCase().includes("ssl") || lastError.toLowerCase().includes("tls") || lastError.toLowerCase().includes("certificate") || lastError.includes("CERT")) {
      errorType = "tls_error";
      message = "Bloqueio TLS/certificado";
    }

    return jsonResponse({
      success: false,
      error: errorType,
      message,
      detail: lastError,
    });
  } catch (err) {
    console.error("[openclaw-proxy] Unexpected error:", err);
    return jsonResponse({ success: false, error: "internal", message: "Erro interno no proxy." }, 500);
  }
});
