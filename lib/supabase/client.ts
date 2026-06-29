import { createBrowserClient } from "@supabase/ssr";
import { appEnv, hasSupabaseConfig } from "@/lib/env";

export function getSupabaseBrowserClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  return createBrowserClient(appEnv.supabaseUrl, appEnv.supabaseAnonKey);
}

