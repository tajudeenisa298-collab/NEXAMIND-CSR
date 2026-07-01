import { getBackendConfigStatus } from "@/lib/server-env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type ExecutiveMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "default" | "success" | "warning";
};

export type ExecutiveInsight = {
  label: string;
  value: number;
  detail: string;
};

export type ExecutiveDashboard = {
  metrics: ExecutiveMetric[];
  sentiment: ExecutiveInsight[];
  commonIssues: ExecutiveInsight[];
  knowledgeGaps: ExecutiveInsight[];
  knowledgeCoverage: {
    score: number;
    documents: number;
    chunks: number;
    categories: number;
    detail: string;
  };
  automation: {
    successRate: number;
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
  };
  savings: {
    estimatedMonthlySavings: number;
    assumptions: string[];
  };
};

type IntelligenceRow = {
  conversation_id: string | null;
  intent: string;
  sentiment: string;
  retrieval_confidence: number | null;
  final_confidence: number | null;
  validation_status: string | null;
};

type ConversationRow = {
  id: string;
  status: string;
  takeover_status?: string | null;
  assigned_agent?: string | null;
  metadata?: Record<string, unknown> | null;
};

type AutomationRunRow = {
  conversation_id?: string | null;
  status: string;
  input?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

type TicketRow = {
  id: string;
  conversation_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

type KnowledgeDocumentRow = {
  category: string;
  status: string;
};

export function getExecutiveIntelligenceRuntimeStatus() {
  const backend = getBackendConfigStatus();

  return {
    configured: backend.supabaseConfigured,
    error: backend.supabaseConfigured
      ? null
      : {
          code: "executive_intelligence_not_configured",
          message: "Connect Supabase before using Executive Intelligence."
        }
  };
}

export async function getExecutiveDashboard(organizationId: string) {
  const runtime = getExecutiveIntelligenceRuntimeStatus();
  if (!runtime.configured) return runtimeError(runtime.error);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return executiveError("supabase_not_configured", "Supabase is not configured.", 503);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [conversationsResult, intelligenceResult, documentsResult, chunksResult, automationResult, ticketsResult] =
    await Promise.all([
      supabase
        .from("conversations")
        .select("id,status,takeover_status,assigned_agent,metadata")
        .eq("organization_id", organizationId)
        .gte("created_at", thirtyDaysAgo),
      supabase
        .from("message_intelligence")
        .select("conversation_id,intent,sentiment,retrieval_confidence,final_confidence,validation_status")
        .eq("organization_id", organizationId)
        .gte("created_at", thirtyDaysAgo),
      supabase
        .from("knowledge_documents")
        .select("category,status")
        .eq("organization_id", organizationId),
      supabase
        .from("knowledge_chunks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
      supabase
        .from("automation_runs")
        .select("conversation_id,status,input,metadata")
        .eq("organization_id", organizationId)
        .gte("created_at", thirtyDaysAgo),
      supabase
        .from("support_tickets")
        .select("id,conversation_id,metadata")
        .eq("organization_id", organizationId)
        .gte("created_at", thirtyDaysAgo)
    ]);

  const firstError = [
    conversationsResult.error,
    intelligenceResult.error,
    documentsResult.error,
    chunksResult.error,
    automationResult.error,
    ticketsResult.error
  ].find(Boolean);

  if (firstError) return executiveError("executive_dashboard_failed", firstError.message);

  const conversations = ((conversationsResult.data || []) as ConversationRow[]).filter((conversation) => !isDemoRecord(conversation));
  const realConversationIds = new Set(conversations.map((conversation) => conversation.id));
  const intelligence = ((intelligenceResult.data || []) as IntelligenceRow[]).filter(
    (row) => !row.conversation_id || realConversationIds.has(row.conversation_id)
  );
  const documents = (documentsResult.data || []) as KnowledgeDocumentRow[];
  const automationRuns = ((automationResult.data || []) as AutomationRunRow[]).filter(
    (run) => !isDemoAutomationRun(run) && (!run.conversation_id || realConversationIds.has(run.conversation_id))
  );
  const chunkCount = chunksResult.count || 0;
  const ticketCount = ((ticketsResult.data || []) as TicketRow[]).filter(
    (ticket) => !isDemoRecord(ticket) && (!ticket.conversation_id || realConversationIds.has(ticket.conversation_id))
  ).length;

  const supportVolume = conversations.length;
  const resolved = conversations.filter((conversation) => conversation.status === "resolved").length;
  const aiResolved = conversations.filter(
    (conversation) =>
      conversation.status === "resolved" &&
      (conversation.takeover_status === "ai_active" || !conversation.assigned_agent)
  ).length;
  const escalated = conversations.filter(
    (conversation) =>
      conversation.status === "escalated" ||
      conversation.takeover_status === "human_requested" ||
      conversation.takeover_status === "human_active"
  ).length;

  const aiResolutionRate = percentage(aiResolved, Math.max(resolved || supportVolume, 1));
  const escalationRate = percentage(escalated, supportVolume);
  const automationSuccess = calculateAutomation(automationRuns);
  const knowledgeCoverage = calculateKnowledgeCoverage(documents, chunkCount);
  const sentiment = summarizeByKey(intelligence, "sentiment");
  const commonIssues = summarizeByKey(intelligence, "intent");
  const knowledgeGaps = summarizeKnowledgeGaps(intelligence);
  const savings = calculateSavings({
    aiResolved,
    successfulAutomations: automationSuccess.successfulRuns,
    totalAiTurns: intelligence.length
  });

  return {
    ok: true as const,
    data: {
      metrics: [
        {
          label: "AI Resolution",
          value: `${aiResolutionRate}%`,
          detail: `${aiResolved} conversations resolved without human takeover`,
          tone: aiResolutionRate >= 60 ? "success" : aiResolutionRate >= 30 ? "default" : "warning"
        },
        {
          label: "Escalation",
          value: `${escalationRate}%`,
          detail: `${escalated} of ${supportVolume} conversations needed a human`,
          tone: escalationRate <= 20 ? "success" : escalationRate <= 40 ? "default" : "warning"
        },
        {
          label: "Support Volume",
          value: String(supportVolume),
          detail: "conversations in the last 30 days",
          tone: "default"
        },
        {
          label: "Knowledge Coverage",
          value: `${knowledgeCoverage.score}%`,
          detail: knowledgeCoverage.detail,
          tone: knowledgeCoverage.score >= 75 ? "success" : knowledgeCoverage.score >= 45 ? "default" : "warning"
        },
        {
          label: "Automation Success",
          value: `${automationSuccess.successRate}%`,
          detail: `${automationSuccess.successfulRuns} successful of ${automationSuccess.totalRuns} runs`,
          tone: automationSuccess.successRate >= 85 ? "success" : automationSuccess.successRate >= 60 ? "default" : "warning"
        },
        {
          label: "Estimated Savings",
          value: `$${savings.estimatedMonthlySavings.toLocaleString()}`,
          detail: "estimated monthly support cost avoided",
          tone: savings.estimatedMonthlySavings > 0 ? "success" : "default"
        },
        {
          label: "Tickets Created",
          value: String(ticketCount),
          detail: "human work items created by AI or agents",
          tone: "default"
        }
      ] satisfies ExecutiveMetric[],
      sentiment,
      commonIssues,
      knowledgeGaps,
      knowledgeCoverage,
      automation: automationSuccess,
      savings
    } satisfies ExecutiveDashboard
  };
}

function calculateAutomation(runs: AutomationRunRow[]) {
  const completed = runs.filter((run) => run.status !== "queued" && run.status !== "running");
  const successfulRuns = completed.filter((run) => run.status === "succeeded" || run.status === "skipped").length;
  const failedRuns = completed.filter((run) => run.status === "failed").length;

  return {
    successRate: percentage(successfulRuns, completed.length),
    totalRuns: completed.length,
    successfulRuns,
    failedRuns
  };
}

function calculateKnowledgeCoverage(documents: KnowledgeDocumentRow[], chunks: number) {
  const readyDocuments = documents.filter((document) => document.status === "ready").length;
  const categories = new Set(documents.map((document) => document.category).filter(Boolean)).size;
  const documentCoverage = percentage(readyDocuments, documents.length || 1);
  const depthScore = Math.min(100, Math.round(chunks / 50));
  const categoryScore = Math.min(100, categories * 14);
  const score = Math.round(documentCoverage * 0.45 + depthScore * 0.35 + categoryScore * 0.2);

  return {
    score,
    documents: readyDocuments,
    chunks,
    categories,
    detail: `${readyDocuments} ready docs, ${chunks} chunks, ${categories} categories`
  };
}

function summarizeByKey(rows: IntelligenceRow[], key: "intent" | "sentiment") {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const value = row[key] || "Unknown";
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, value]) => ({
      label,
      value,
      detail: `${percentage(value, rows.length)}% of AI-analyzed messages`
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

function summarizeKnowledgeGaps(rows: IntelligenceRow[]) {
  const gaps = new Map<string, { count: number; lowConfidence: number; validationIssues: number }>();

  rows.forEach((row) => {
    const hasGap =
      (row.retrieval_confidence ?? 1) < 0.55 ||
      (row.final_confidence ?? 1) < 0.6 ||
      row.validation_status === "warn" ||
      row.validation_status === "fail";
    if (!hasGap) return;

    const current = gaps.get(row.intent) || { count: 0, lowConfidence: 0, validationIssues: 0 };
    current.count += 1;
    if ((row.retrieval_confidence ?? 1) < 0.55 || (row.final_confidence ?? 1) < 0.6) current.lowConfidence += 1;
    if (row.validation_status === "warn" || row.validation_status === "fail") current.validationIssues += 1;
    gaps.set(row.intent, current);
  });

  return Array.from(gaps.entries())
    .map(([label, gap]) => ({
      label,
      value: gap.count,
      detail: `${gap.lowConfidence} low-confidence turns, ${gap.validationIssues} validation warnings`
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

function calculateSavings(input: { aiResolved: number; successfulAutomations: number; totalAiTurns: number }) {
  const savedByAiResolution = input.aiResolved * 8;
  const savedByAutomation = input.successfulAutomations * 5;
  const savedByCopilotDrafts = input.totalAiTurns * 2;

  return {
    estimatedMonthlySavings: savedByAiResolution + savedByAutomation + savedByCopilotDrafts,
    assumptions: [
      "$8 saved per AI-resolved conversation",
      "$5 saved per successful automation",
      "$2 saved per AI-assisted support turn"
    ]
  };
}

function percentage(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function isDemoRecord(row: { metadata?: Record<string, unknown> | null }) {
  return row.metadata?.demoGenerated === true;
}

function isDemoAutomationRun(row: AutomationRunRow) {
  return isDemoRecord(row) || row.input?.source === "demo_builder";
}

function runtimeError(error: { code: string; message: string } | null) {
  return {
    ok: false as const,
    status: 503,
    error: error || {
      code: "executive_intelligence_not_configured",
      message: "Executive Intelligence is not configured."
    }
  };
}

function executiveError(code: string, message: string, status = 500) {
  return {
    ok: false as const,
    status,
    error: {
      code,
      message
    }
  };
}
