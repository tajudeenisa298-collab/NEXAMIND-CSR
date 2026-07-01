export const serverEnv = {
  demoMode: (process.env.DEMO_MODE || process.env.NEXT_PUBLIC_DEMO_MODE) === "true",
  ownerEmails: (process.env.NEXT_PUBLIC_OWNER_EMAILS || "isa@nexamind.example,isa@nexapixelai.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  productionHealthCheckToken: process.env.PRODUCTION_HEALTH_CHECK_TOKEN || "",
  chatModel: process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini",
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS || 1536),
  automationDryRun: process.env.AUTOMATION_DRY_RUN !== "false",
  makeWebhookUrl: process.env.MAKE_WEBHOOK_URL || "",
  genericWebhookUrl: process.env.AUTOMATION_WEBHOOK_URL || "",
  refundWorkflowWebhookUrl: process.env.REFUND_WORKFLOW_WEBHOOK_URL || "",
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || "",
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  emailWebhookUrl: process.env.EMAIL_WEBHOOK_URL || "",
  demoMakeWebhookUrl: process.env.DEMO_MAKE_WEBHOOK_URL || "",
  demoGenericWebhookUrl: process.env.DEMO_AUTOMATION_WEBHOOK_URL || "",
  demoRefundWorkflowWebhookUrl: process.env.DEMO_REFUND_WORKFLOW_WEBHOOK_URL || "",
  demoSlackWebhookUrl: process.env.DEMO_SLACK_WEBHOOK_URL || "",
  demoDiscordWebhookUrl: process.env.DEMO_DISCORD_WEBHOOK_URL || "",
  demoEmailWebhookUrl: process.env.DEMO_EMAIL_WEBHOOK_URL || "",
  demoNotificationInbox: process.env.DEMO_NOTIFICATION_INBOX || ""
};

export function getBackendConfigStatus() {
  return {
    supabaseConfigured: Boolean(serverEnv.supabaseUrl && serverEnv.supabaseServiceRoleKey),
    openaiConfigured: Boolean(serverEnv.openaiApiKey),
    missing: [
      !serverEnv.supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !serverEnv.supabaseAnonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
      !serverEnv.supabaseServiceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
      !serverEnv.openaiApiKey ? "OPENAI_API_KEY" : null
    ].filter(Boolean) as string[]
  };
}
