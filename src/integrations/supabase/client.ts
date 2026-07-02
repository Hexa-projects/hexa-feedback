import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://fevmcjnaeuxydmxmkarw.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_uOdvt5QQul8ubyvvm212ZQ_6NwX7nqP";

// Note: generic <Database> intentionally omitted to preserve existing
// untyped `.from()` usage across the codebase. Runtime behavior is unchanged.
export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
) as ReturnType<typeof createClient>;
