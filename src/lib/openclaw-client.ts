import { supabase } from "@/integrations/supabase/client";

function normalizeUrl(url: string): string {
  let u = url.trim();
  while (u.endsWith("/")) u = u.slice(0, -1);
  return u;
}

export function maskToken(token: string): string {
  if (!token || token.length < 8) return "***";
  return token.slice(0, 4) + "..." + token.slice(-4);
}

export function buildWsUrl(baseUrl: string): string {
  const normalized = normalizeUrl(baseUrl);
  if (normalized.startsWith("https://")) return normalized.replace("https://", "wss://");
  if (normalized.startsWith("http://")) return normalized.replace("http://", "ws://");
  return "ws://" + normalized;
}

export interface HealthCheckResult {
  success: boolean;
  error?: string;
  message: string;
  status?: number;
  data?: any;
  detail?: string;
}

/**
 * Checks OpenClaw health via backend edge function (avoids CORS/reachability issues).
 */
export async function checkHealth(baseUrl: string, token?: string): Promise<HealthCheckResult> {
  if (!baseUrl || baseUrl.trim() === "") {
    return { success: false, error: "url_missing", message: "Preencha a URL do OpenClaw." };
  }

  const normalized = normalizeUrl(baseUrl);
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    return { success: false, error: "url_invalid", message: "A URL deve começar com http:// ou https://." };
  }

  try {
    const { data, error } = await supabase.functions.invoke("openclaw-proxy", {
      body: { action: "health", base_url: normalized, token: token || "" },
    });

    if (error) {
      return {
        success: false,
        error: "edge_function_error",
        message: "Erro ao chamar o proxy. Verifique se a edge function está deployada.",
        detail: error.message,
      };
    }

    return data as HealthCheckResult;
  } catch (error) {
    return {
      success: false,
      error: "edge_function_error",
      message: "Erro ao chamar o proxy. Verifique se a edge function está deployada.",
      detail: error instanceof Error ? error.message : "unknown",
    };
  }
}

/**
 * Connect to OpenClaw Gateway via WebSocket (runtime use).
 */
export function connectGateway(
  baseUrl: string,
  token: string,
  onMessage?: (data: any) => void,
  onError?: (err: Event) => void,
  onClose?: () => void
): WebSocket | null {
  const wsUrl = buildWsUrl(baseUrl);

  try {
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Send auth on connect
      ws.send(JSON.stringify({ type: "auth", token }));
      console.log(`[OpenClawClient] WS connected to ${wsUrl}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch {
        onMessage?.(event.data);
      }
    };

    ws.onerror = (err) => {
      console.error("[OpenClawClient] WS error");
      onError?.(err);
    };

    ws.onclose = () => {
      console.log("[OpenClawClient] WS closed");
      onClose?.();
    };

    return ws;
  } catch (err) {
    console.error("[OpenClawClient] Failed to create WS:", err);
    return null;
  }
}
