import { supabase } from "@/integrations/supabase/client";

export function maskToken(token: string): string {
  if (!token || token.length < 8) return "***";
  return token.slice(0, 4) + "..." + token.slice(-4);
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
 * P2P Health Check — calls the project's own Edge Function directly
 * instead of routing through an external gateway.
 */
export async function checkHealth(baseUrl: string, token?: string): Promise<HealthCheckResult> {
  if (!baseUrl || baseUrl.trim() === "") {
    return { success: false, error: "url_missing", message: "Preencha a URL da Edge Function." };
  }

  // For P2P mode, we call our own sync edge function with a health action
  try {
    const { data, error } = await supabase.functions.invoke("openclaw-sync", {
      body: { action: "health_check" },
    });

    if (error) {
      return {
        success: false,
        error: "edge_function_error",
        message: "Erro ao chamar a Edge Function de sync.",
        detail: error.message,
      };
    }

    return data as HealthCheckResult;
  } catch (error) {
    return {
      success: false,
      error: "edge_function_error",
      message: "Erro ao chamar a Edge Function de sync.",
      detail: error instanceof Error ? error.message : "unknown",
    };
  }
}
