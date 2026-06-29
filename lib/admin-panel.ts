import { getBackendConfigStatus } from "@/lib/server-env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminCompany = {
  id: string;
  name: string;
  website: string;
  createdAt: string;
  crawlJobs: number;
  conversations: number;
  messages: number;
  estimatedOpenAiCost: number;
  status: "healthy" | "building" | "attention";
};

export type AdminDashboard = {
  totals: {
    companies: number;
    crawlJobs: number;
    failedBuilds: number;
    conversations: number;
    messages: number;
    totalTokens: number;
    estimatedOpenAiCost: number;
  };
  companies: AdminCompany[];
  recentBuilds: Array<{
    id: string;
    organizationId: string;
    companyName: string;
    website: string;
    status: string;
    pagesIndexed: number;
    error: string | null;
    startedAt: string;
    completedAt: string | null;
  }>;
  failedBuilds: Array<{
    id: string;
    companyName: string;
    website: string;
    error: string;
    startedAt: string;
  }>;
  apiUsage: {
    assistantMessages: number;
    totalTokens: number;
    averageLatencyMs: number;
    estimatedOpenAiCost: number;
  };
};

export async function getAdminDashboard() {
  const backend = getBackendConfigStatus();
  if (!backend.supabaseConfigured) {
    return {
      ok: false as const,
      status: 503,
      error: {
        code: "admin_not_configured",
        message: "Connect Supabase before using the Admin Panel."
      }
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      ok: false as const,
      status: 503,
      error: {
        code: "supabase_not_configured",
        message: "Supabase is not configured."
      }
    };
  }

  const [
    organizationsResult,
    crawlJobsResult,
    conversationsResult,
    messagesResult
  ] = await Promise.all([
    supabase.from("organizations").select("id,name,website,created_at").order("created_at", { ascending: false }),
    supabase.from("crawl_jobs").select("id,organization_id,website,status,pages_indexed,error,started_at,completed_at").order("started_at", { ascending: false }).limit(80),
    supabase.from("conversations").select("id,organization_id,status,created_at"),
    supabase.from("messages").select("id,organization_id,role,total_tokens,latency_ms,created_at")
  ]);

  const firstError = [
    organizationsResult.error,
    crawlJobsResult.error,
    conversationsResult.error,
    messagesResult.error
  ].find(Boolean);

  if (firstError) {
    return {
      ok: false as const,
      status: 500,
      error: {
        code: "admin_dashboard_failed",
        message: firstError.message
      }
    };
  }

  const organizations = organizationsResult.data || [];
  const crawlJobs = crawlJobsResult.data || [];
  const conversations = conversationsResult.data || [];
  const messages = messagesResult.data || [];
  const companyNameById = new Map(organizations.map((organization) => [organization.id, organization.name || organization.id]));
  const crawlJobsByOrg = countBy(crawlJobs, "organization_id");
  const conversationsByOrg = countBy(conversations, "organization_id");
  const messagesByOrg = countBy(messages, "organization_id");
  const tokensByOrg = sumBy(messages, "organization_id", "total_tokens");
  const totalTokens = sum(messages.map((message) => Number(message.total_tokens || 0)));
  const assistantMessages = messages.filter((message) => message.role === "assistant");
  const failedBuilds = crawlJobs.filter((job) => job.status === "failed");
  const buildingJobs = new Set(crawlJobs.filter((job) => job.status === "running").map((job) => job.organization_id));
  const failedOrgs = new Set(failedBuilds.map((job) => job.organization_id));

  const companies: AdminCompany[] = organizations.map((organization) => ({
    id: organization.id,
    name: organization.name || organization.id,
    website: organization.website || "",
    createdAt: organization.created_at,
    crawlJobs: crawlJobsByOrg.get(organization.id) || 0,
    conversations: conversationsByOrg.get(organization.id) || 0,
    messages: messagesByOrg.get(organization.id) || 0,
    estimatedOpenAiCost: estimateOpenAiCost(tokensByOrg.get(organization.id) || 0),
    status: buildingJobs.has(organization.id)
      ? "building"
      : failedOrgs.has(organization.id)
        ? "attention"
        : "healthy"
  }));

  return {
    ok: true as const,
    data: {
      totals: {
        companies: organizations.length,
        crawlJobs: crawlJobs.length,
        failedBuilds: failedBuilds.length,
        conversations: conversations.length,
        messages: messages.length,
        totalTokens,
        estimatedOpenAiCost: estimateOpenAiCost(totalTokens)
      },
      companies,
      recentBuilds: crawlJobs.slice(0, 20).map((job) => ({
        id: job.id,
        organizationId: job.organization_id,
        companyName: companyNameById.get(job.organization_id) || job.organization_id,
        website: job.website,
        status: job.status,
        pagesIndexed: job.pages_indexed || 0,
        error: job.error,
        startedAt: job.started_at,
        completedAt: job.completed_at
      })),
      failedBuilds: failedBuilds.slice(0, 12).map((job) => ({
        id: job.id,
        companyName: companyNameById.get(job.organization_id) || job.organization_id,
        website: job.website,
        error: job.error || "Build failed without a stored error.",
        startedAt: job.started_at
      })),
      apiUsage: {
        assistantMessages: assistantMessages.length,
        totalTokens,
        averageLatencyMs: Math.round(average(messages.map((message) => Number(message.latency_ms || 0)).filter(Boolean))),
        estimatedOpenAiCost: estimateOpenAiCost(totalTokens)
      }
    } satisfies AdminDashboard
  };
}

function countBy(rows: Record<string, any>[], key: string) {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row[key], (counts.get(row[key]) || 0) + 1));
  return counts;
}

function sumBy(rows: Record<string, any>[], key: string, valueKey: string) {
  const values = new Map<string, number>();
  rows.forEach((row) => values.set(row[key], (values.get(row[key]) || 0) + Number(row[valueKey] || 0)));
  return values;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return sum(values) / values.length;
}

function estimateOpenAiCost(tokens: number) {
  return Math.round(tokens * 0.0000006 * 100) / 100;
}
