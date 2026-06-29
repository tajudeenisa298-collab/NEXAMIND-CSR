export const appEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "SupportFlow AI",
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE !== "false",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
};

export function hasSupabaseConfig() {
  return Boolean(appEnv.supabaseUrl && appEnv.supabaseAnonKey);
}

export function getEnvironmentStatus() {
  return [
    {
      key: "NEXT_PUBLIC_APP_NAME",
      label: "Application name",
      configured: Boolean(process.env.NEXT_PUBLIC_APP_NAME)
    },
    {
      key: "NEXT_PUBLIC_DEMO_MODE",
      label: "Demo mode",
      configured: process.env.NEXT_PUBLIC_DEMO_MODE !== undefined
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      label: "Supabase URL",
      configured: Boolean(appEnv.supabaseUrl)
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      label: "Supabase anon key",
      configured: Boolean(appEnv.supabaseAnonKey)
    },
    {
      key: "DEMO_MODE",
      label: "Server-side demo routing",
      configured: appEnv.demoMode
    },
    {
      key: "DEMO_MAKE_WEBHOOK_URL",
      label: "Demo Make.com workflow",
      configured: false
    },
    {
      key: "DEMO_SLACK_WEBHOOK_URL",
      label: "Demo Slack alerts",
      configured: false
    },
    {
      key: "DEMO_DISCORD_WEBHOOK_URL",
      label: "Demo Discord alerts",
      configured: false
    },
    {
      key: "DEMO_EMAIL_WEBHOOK_URL",
      label: "Demo email delivery",
      configured: false
    }
  ];
}
