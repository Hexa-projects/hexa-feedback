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
  // Remove trailing slashes
  while (u.endsWith("/")) u = u.slice(0, -1);
  return u;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, base_url, token } = await req.json();

    if (action === "health") {
      if (!base_url) {
        return new Response(
          JSON.stringify({ success: false, error: "url_missing", message: "URL do OpenClaw não informada." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const normalized = normalizeUrl(base_url);

      try {
        new URL(normalized);
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: "url_invalid", message: "URL inválida. Use http:// ou https://." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const healthUrl = `${normalized}/health`;
      console.log(`[openclaw-proxy] Health check → ${healthUrl} (token: ${token ? maskToken(token) : "none"})`);

      const MAX_RETRIES = 2;
      let lastError: string = "";

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);

          const headers: Record<string, string> = {};
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }

          const res = await fetch(healthUrl, {
            method: "GET",
            headers,
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (res.ok) {
            let body = null;
            try { body = await res.json(); } catch { body = await res.text(); }
            console.log(`[openclaw-proxy] Health OK (attempt ${attempt}):`, JSON.stringify(body));
            return new Response(
              JSON.stringify({
                success: true,
                status: res.status,
                data: body,
                message: "Conectado com sucesso",
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Auth errors - no retry
          if (res.status === 401 || res.status === 403) {
            const text = await res.text().catch(() => "");
            console.log(`[openclaw-proxy] Auth error ${res.status}: ${text}`);
            return new Response(
              JSON.stringify({
                success: false,
                error: "auth_error",
                status: res.status,
                message: "Token inválido ou ausente. Verifique a API Key no painel do OpenClaw.",
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          lastError = `HTTP ${res.status}`;
          const errText = await res.text().catch(() => "");
          console.log(`[openclaw-proxy] HTTP ${res.status} (attempt ${attempt}): ${errText}`);

        } catch (err: any) {
          if (err.name === "AbortError") {
            lastError = "timeout";
            console.log(`[openclaw-proxy] Timeout (attempt ${attempt})`);
          } else {
            lastError = err.message || "unknown";
            console.log(`[openclaw-proxy] Network error (attempt ${attempt}): ${lastError}`);
          }
        }

        // Backoff before retry
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }

      // All retries failed - classify error
      let errorType = "network_error";
      let message = "Gateway não respondeu (/health). Verifique se o OpenClaw está online.";

      if (lastError === "timeout") {
        errorType = "timeout";
        message = "Gateway não respondeu em 6 segundos. Verifique se está rodando e acessível.";
      } else if (lastError.includes("dns") || lastError.includes("ENOTFOUND") || lastError.includes("getaddrinfo")) {
        errorType = "dns_error";
        message = "Endereço não encontrado (DNS). Verifique o domínio ou IP.";
      } else if (lastError.includes("ECONNREFUSED") || lastError.includes("refused")) {
        errorType = "connection_refused";
        message = "Conexão recusada. O serviço pode estar parado na porta informada.";
      } else if (lastError.includes("ssl") || lastError.includes("tls") || lastError.includes("certificate") || lastError.includes("CERT")) {
        errorType = "tls_error";
        message = "Bloqueio TLS/certificado. Verifique o certificado SSL do servidor.";
      } else if (lastError.includes("private") || lastError.includes("100.") || lastError.includes("10.") || lastError.includes("192.168")) {
        errorType = "private_network";
        message = "Backend do HexaOS não alcança IP privado. Use URL pública HTTPS ou execute backend na mesma rede.";
      }

      return new Response(
        JSON.stringify({ success: false, error: errorType, message, detail: lastError }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "unknown_action", message: "Ação não reconhecida." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[openclaw-proxy] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "internal", message: "Erro interno no proxy." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
