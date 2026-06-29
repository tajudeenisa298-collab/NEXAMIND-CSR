import { getBackendConfigStatus } from "@/lib/server-env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type AiResponseReview = {
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  customerName: string | null;
  createdAt: string;
  response: string;
  overallQualityScore: number;
  retrievalQuality: number;
  confidenceScore: number;
  hallucinationRisk: "low" | "medium" | "high";
  validationStatus: "pass" | "warn" | "fail" | "unknown";
  knowledgeSourcesUsed: Array<{
    title: string;
    sourceUrl: string;
    score: number;
    snippet: string;
  }>;
  suggestedImprovements: string[];
  replaySteps: Array<{
    title: string;
    detail: string;
    sortOrder: number;
  }>;
  feedbackCount: number;
};

export type AiImprovementDashboard = {
  reviews: AiResponseReview[];
  summary: {
    averageQuality: number;
    responsesReviewed: number;
    highRiskResponses: number;
    savedImprovements: number;
  };
};

type SaveImprovementInput = {
  organizationId: string;
  conversationId: string;
  messageId: string;
  reviewerName?: string;
  originalResponse: string;
  improvedResponse: string;
  improvementNotes: string;
  promptGuidance: string;
  qualityScore?: number;
};

export function getAiImprovementRuntimeStatus() {
  const backend = getBackendConfigStatus();

  return {
    configured: backend.supabaseConfigured,
    error: backend.supabaseConfigured
      ? null
      : {
          code: "ai_improvement_not_configured",
          message: "Connect Supabase before using the AI Improvement Center."
        }
  };
}

export async function getAiImprovementDashboard(organizationId: string) {
  const runtime = getAiImprovementRuntimeStatus();
  if (!runtime.configured) return runtimeError(runtime.error);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return improvementError("supabase_not_configured", "Supabase is not configured.", 503);

  const { data: messages, error } = await supabase
    .from("messages")
    .select(
      "id,conversation_id,content,sources,confidence,retrieval_confidence,reasoning_confidence,final_confidence,retrieval_score,documents_used,validation_status,validation_results,created_at,conversations(title,customer_name)"
    )
    .eq("organization_id", organizationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) return improvementError("reviews_failed", error.message);

  const responseIds = (messages || []).map((message) => message.id as string);
  const [replayResult, feedbackResult] = await Promise.all([
    responseIds.length
      ? supabase
          .from("conversation_replay_steps")
          .select("message_id,title,detail,sort_order")
          .in("message_id", responseIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    responseIds.length
      ? supabase
          .from("ai_response_feedback")
          .select("message_id")
          .eq("organization_id", organizationId)
          .in("message_id", responseIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (replayResult.error) return improvementError("replay_failed", replayResult.error.message);
  if (feedbackResult.error) return improvementError("feedback_failed", feedbackResult.error.message);

  const replayByMessage = groupBy(replayResult.data || [], "message_id");
  const feedbackCounts = new Map<string, number>();
  (feedbackResult.data || []).forEach((feedback: Record<string, any>) => {
    feedbackCounts.set(feedback.message_id, (feedbackCounts.get(feedback.message_id) || 0) + 1);
  });

  const reviews = (messages || []).map((message) =>
    buildReview(message, replayByMessage.get(message.id as string) || [], feedbackCounts.get(message.id as string) || 0)
  );
  const resolvedReviews = reviews.length ? reviews : createDemoReviews(organizationId);
  const highRiskResponses = reviews.filter((review) => review.hallucinationRisk === "high" || review.validationStatus === "fail").length;
  const savedImprovements = Array.from(feedbackCounts.values()).reduce((sum, count) => sum + count, 0);
  const averageQuality = resolvedReviews.length
    ? Math.round(resolvedReviews.reduce((sum, review) => sum + review.overallQualityScore, 0) / resolvedReviews.length)
    : 0;

  return {
    ok: true as const,
    data: {
      reviews: resolvedReviews,
      summary: {
        averageQuality,
        responsesReviewed: resolvedReviews.length,
        highRiskResponses: reviews.length
          ? highRiskResponses
          : resolvedReviews.filter((review) => review.hallucinationRisk === "high").length,
        savedImprovements
      }
    } satisfies AiImprovementDashboard
  };
}

export async function saveAiImprovement(input: SaveImprovementInput) {
  const runtime = getAiImprovementRuntimeStatus();
  if (!runtime.configured) return runtimeError(runtime.error);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return improvementError("supabase_not_configured", "Supabase is not configured.", 503);

  if (!input.improvedResponse.trim()) return improvementError("missing_improved_response", "Write the improved response before saving.", 400);
  if (!input.improvementNotes.trim()) return improvementError("missing_improvement_notes", "Add improvement notes before saving.", 400);

  const { data, error } = await supabase
    .from("ai_response_feedback")
    .insert({
      organization_id: input.organizationId,
      conversation_id: input.conversationId,
      message_id: input.messageId,
      reviewer_name: input.reviewerName || "Admin",
      original_response: input.originalResponse,
      improved_response: input.improvedResponse,
      improvement_notes: input.improvementNotes,
      prompt_guidance: input.promptGuidance,
      quality_score: typeof input.qualityScore === "number" ? input.qualityScore / 100 : null,
      metadata: {
        source: "ai_improvement_center",
        savedAt: new Date().toISOString()
      }
    })
    .select("*")
    .single();

  if (error || !data) return improvementError("save_improvement_failed", error?.message || "Unable to save improvement.");

  return {
    ok: true as const,
    data: {
      id: data.id,
      createdAt: data.created_at
    }
  };
}

function buildReview(message: Record<string, any>, replaySteps: Record<string, any>[], feedbackCount: number): AiResponseReview {
  const validation = message.validation_results || {};
  const retrievalQuality = scoreToPercent(Number(message.retrieval_confidence ?? message.retrieval_score ?? 0));
  const confidenceScore = scoreToPercent(Number(message.final_confidence ?? message.confidence ?? 0));
  const hallucinationRisk = validation.hallucinationRisk || validation.hallucination_risk || inferHallucinationRisk(validation, retrievalQuality);
  const validationStatus = message.validation_status || validation.status || "unknown";
  const sourceCount = Array.isArray(message.sources) ? message.sources.length : 0;
  const citationScore = sourceCount ? Math.min(100, sourceCount * 15) : 0;
  const validationPenalty = validationStatus === "fail" ? 24 : validationStatus === "warn" ? 12 : 0;
  const hallucinationPenalty = hallucinationRisk === "high" ? 18 : hallucinationRisk === "medium" ? 8 : 0;
  const overallQualityScore = clampPercent(
    Math.round(retrievalQuality * 0.32 + confidenceScore * 0.38 + citationScore * 0.18 + 12 - validationPenalty - hallucinationPenalty)
  );
  const conversation = Array.isArray(message.conversations) ? message.conversations[0] : message.conversations;

  return {
    messageId: message.id,
    conversationId: message.conversation_id,
    conversationTitle: conversation?.title || "Support conversation",
    customerName: conversation?.customer_name || null,
    createdAt: message.created_at,
    response: message.content,
    overallQualityScore,
    retrievalQuality,
    confidenceScore,
    hallucinationRisk,
    validationStatus,
    knowledgeSourcesUsed: normalizeSources(message.sources),
    suggestedImprovements: suggestImprovements({
      validation,
      validationStatus,
      hallucinationRisk,
      retrievalQuality,
      confidenceScore,
      sourceCount,
      response: message.content
    }),
    replaySteps: replaySteps.map((step) => ({
      title: step.title,
      detail: step.detail,
      sortOrder: step.sort_order
    })),
    feedbackCount
  };
}

function createDemoReviews(organizationId: string): AiResponseReview[] {
  const now = new Date().toISOString();

  return [
    {
      messageId: `demo_review_${organizationId}_credits`,
      conversationId: `demo_conversation_${organizationId}_credits`,
      conversationTitle: "Credits missing after upgrade",
      customerName: "Maya Chen",
      createdAt: now,
      response:
        "Your credits may take a few minutes to sync after a plan upgrade. Please check Billing > Credits and refresh your workspace. If the balance still looks wrong, send us your account email and invoice ID so support can review it.",
      overallQualityScore: 92,
      retrievalQuality: 95,
      confidenceScore: 91,
      hallucinationRisk: "low",
      validationStatus: "pass",
      knowledgeSourcesUsed: [
        {
          title: "Credits FAQ",
          sourceUrl: "https://picxstudio.com/faq",
          score: 0.98,
          snippet: "Credits can take several minutes to synchronize after billing changes."
        },
        {
          title: "Billing Policy",
          sourceUrl: "https://picxstudio.com/billing",
          score: 0.94,
          snippet: "Billing updates and invoices are available from workspace settings."
        }
      ],
      suggestedImprovements: [
        "Mention the exact billing screen path before asking for account details.",
        "Add a short reassurance that no credits are removed during sync review."
      ],
      replaySteps: [
        { title: "Intent", detail: "Billing + Credits", sortOrder: 1 },
        { title: "Retrieval", detail: "Credits FAQ and Billing Policy retrieved with high similarity.", sortOrder: 2 },
        { title: "Validation", detail: "Answer is grounded and safe to send.", sortOrder: 3 }
      ],
      feedbackCount: 0
    },
    {
      messageId: `demo_review_${organizationId}_render`,
      conversationId: `demo_conversation_${organizationId}_render`,
      conversationTitle: "Render failed at 67%",
      customerName: "Jordan Ellis",
      createdAt: now,
      response:
        "A render stopping at 67% usually means the generation worker hit a processing or asset issue. Please send the generation ID, selected model, and whether credits were deducted. I can create a support engineering ticket if it continues.",
      overallQualityScore: 84,
      retrievalQuality: 82,
      confidenceScore: 86,
      hallucinationRisk: "medium",
      validationStatus: "warn",
      knowledgeSourcesUsed: [
        {
          title: "Rendering Troubleshooting",
          sourceUrl: "https://picxstudio.com/help/rendering",
          score: 0.89,
          snippet: "Failed generations should include the generation ID when contacting support."
        }
      ],
      suggestedImprovements: [
        "Avoid saying 'usually' unless the source explicitly supports it.",
        "Add the exact refund or credit review policy before mentioning deducted credits."
      ],
      replaySteps: [
        { title: "Intent", detail: "Render Troubleshooting", sortOrder: 1 },
        { title: "Retrieval", detail: "Rendering Troubleshooting retrieved.", sortOrder: 2 },
        { title: "Validator", detail: "Warned because the likely cause needs stronger citation.", sortOrder: 3 }
      ],
      feedbackCount: 0
    }
  ];
}

function normalizeSources(sources: unknown) {
  if (!Array.isArray(sources)) return [];

  return sources.slice(0, 8).map((source: Record<string, any>) => ({
    title: source.title || "Untitled source",
    sourceUrl: source.sourceUrl || source.source_url || "",
    score: Number(source.score || source.similarityScore || 0),
    snippet: source.snippet || source.chunkText || ""
  }));
}

function suggestImprovements(input: {
  validation: Record<string, any>;
  validationStatus: string;
  hallucinationRisk: string;
  retrievalQuality: number;
  confidenceScore: number;
  sourceCount: number;
  response: string;
}) {
  const suggestions = new Set<string>();

  if (!input.sourceCount) suggestions.add("Add grounded knowledge sources before answering.");
  if (input.retrievalQuality < 60) suggestions.add("Retrieve stronger Company Brain chunks or ask a clarifying question.");
  if (input.confidenceScore < 70) suggestions.add("Make the answer more explicit about uncertainty and next steps.");
  if (input.hallucinationRisk !== "low") suggestions.add("Remove unsupported claims and cite the exact policy or document.");
  if (input.validationStatus === "warn") suggestions.add("Review validator notes before reusing this answer pattern.");
  if (input.validationStatus === "fail") suggestions.add("Replace the answer with a safer fallback or human escalation.");
  if (input.validation?.missingCitations) suggestions.add("Mention the source title in the answer so the customer can trust it.");
  if (input.response.length < 180) suggestions.add("Add enough detail to resolve the customer issue without extra back-and-forth.");
  if (!/[.!?]$/.test(input.response.trim())) suggestions.add("Finish the response cleanly before sending.");

  return Array.from(suggestions).slice(0, 6);
}

function inferHallucinationRisk(validation: Record<string, any>, retrievalQuality: number): "low" | "medium" | "high" {
  if (validation.unsafeOutput || validation.status === "fail" || retrievalQuality < 35) return "high";
  if (validation.status === "warn" || validation.missingCitations || retrievalQuality < 60) return "medium";
  return "low";
}

function scoreToPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return clampPercent(Math.round(value <= 1 ? value * 100 : value));
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function groupBy(rows: Record<string, any>[], key: string) {
  const grouped = new Map<string, Record<string, any>[]>();
  rows.forEach((row) => {
    const value = row[key];
    grouped.set(value, [...(grouped.get(value) || []), row]);
  });
  return grouped;
}

function runtimeError(error: { code: string; message: string } | null) {
  return {
    ok: false as const,
    status: 503,
    error: error || {
      code: "ai_improvement_not_configured",
      message: "AI Improvement Center is not configured."
    }
  };
}

function improvementError(code: string, message: string, status = 500) {
  return {
    ok: false as const,
    status,
    error: {
      code,
      message
    }
  };
}
