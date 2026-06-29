import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/server-env";

export function getSupabaseAdminClient() {
  if (!serverEnv.supabaseUrl || !serverEnv.supabaseServiceRoleKey) {
    return null;
  }

  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

