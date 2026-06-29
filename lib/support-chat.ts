import { getBackendConfigStatus, serverEnv } from "@/lib/server-env";
import { runEscalationAutomations } from "@/lib/automation-engine";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { humanizeErrorMessage } from "@/lib/humanize-error";
import {
  analyzeCustomerMessage,
  buildSafeFallback,
  buildContextPackage,
  buildReasoningPipelineState,
  computeConfidence,
  decideEscalation,
  validateSupportResponse,
  type ConfidenceResult,
  type ContextPackage,
  type EscalationDecision,
  type ExtractedEntities,
  type IntentResult,
  type MessageIntelligence,
  type ReasoningPipelineState,
  type RollingMemory,
  type SentimentResult,
  type ValidationResult
} from "@/lib/ai-intelligence";

export type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  isImage: boolean;
};

export type ChatSource = {
  chunkId: string;
  documentId: string;
  title: string;
  sourceUrl: string;
  category: string;
  score: number;
  similarityScore: number;
  snippet: string;
  chunkText: string;
};

export type AiThinking = {
  intent: string;
  priority: string;
  sentiment: string;
  confidence: number;
  retrieved: string[];
  reasoning: string;
  action: "Respond" | "Ask for details" | "Escalate";
};

export type ConversationReplayStep = {
  stepKey:
    | "customer"
    | "embedding"
    | "vector_search"
    | "retrieved_documents"
    | "reasoning"
    | "final_response";
  title: string;
  detail: string;
  metadata: Record<string, unknown>;
  sortOrder: number;
};

export type ChatMetrics = {
  confidence: number;
  retrievalConfidence: number;
  reasoningConfidence: number;
  finalConfidence: number;
  retrievalScore: number;
  documentsUsed: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
};

export type SupportChatMessage = {
  id: string;
  role: "customer" | "assistant" | "system" | "tool";
  content: string;
  attachments: ChatAttachment[];
  sources: ChatSource[];
  metrics: ChatMetrics | null;
  thinking: AiThinking | null;
  replaySteps: ConversationReplayStep[];
  intelligence: MessageIntelligence | null;
  contextPackage: ContextPackage | null;
  escalation: EscalationDecision | null;
  pipeline: ReasoningPipelineState | null;
  createdAt: string;
};

export type SupportConversationListItem = {
  id: string;
  title: string;
  status: "open" | "waiting" | "resolved" | "escalated";
  customerName: string | null;
  currentIssue: string | null;
  updatedAt: string;
  lastMessage: string;
};

type SupportChatTurnInput = {
  organizationId: string;
  organizationName: string;
  organizationWebsite: string;
  supportEmail: string;
  aiTone: string;
  customerName?: string;
  customerEmail?: string;
  conversationId?: string;
  question?: string;
  attachments?: ChatAttachment[];
  regenerate?: boolean;
};

type StreamEvent =
  | { type: "conversation"; conversationId: string }
  | { type: "delta"; content: string }
  | { type: "done"; conversationId: string; message: SupportChatMessage; sources: ChatSource[]; metrics: ChatMetrics }
  | { type: "error"; message: string };

type RetrievedChunk = ChatSource & {
  content: string;
  similarity: number;
};

type ConversationMemory = {
  summary: string;
  customerName: string | null;
  currentIssue: string | null;
  previousTroubleshooting: string[];
  rollingMemory: RollingMemory | null;
  extractedEntities: ExtractedEntities;
  sentiment: string | null;
  priority: string | null;
};

const defaultSuggestedQuestions = [
  "My credits disappeared",
  "My render failed",
  "How do I upgrade?",
  "Can I use images commercially?",
  "My API isn't working"
];

export function getSupportChatRuntimeStatus(needsOpenAI = true) {
  const status = getBackendConfigStatus();
  const configured = status.supabaseConfigured && (!needsOpenAI || status.openaiConfigured);

  return {
    configured,
    missing: status.missing,
    error: configured
      ? null
      : {
          code: "support_chat_not_configured",
          message: needsOpenAI
            ? "Connect Supabase and OpenAI before using the AI Support Chat."
            : "Connect Supabase before loading AI Support Chat history.",
          missing: status.missing
        }
  };
}

export async function getSuggestedQuestions(organizationId: string) {
  const runtime = getSupportChatRuntimeStatus(false);
  if (!runtime.configured) {
    return {
      ok: true as const,
      data: defaultSuggestedQuestions
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      ok: true as const,
      data: defaultSuggestedQuestions
    };
  }

  const { data, error } = await supabase
    .from("organization_suggested_questions")
    .select("question")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error || !data?.length) {
    return {
      ok: true as const,
      data: defaultSuggestedQuestions
    };
  }

  return {
    ok: true as const,
    data: data.map((item) => item.question as string)
  };
}

export async function listSupportConversations(organizationId: string) {
  const runtime = getSupportChatRuntimeStatus(false);
  if (!runtime.configured) return runtimeError(runtime.error);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return pipelineError("supabase_not_configured", "Supabase is not configured.", 503);

  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error) return pipelineError("conversation_list_failed", error.message);

  const items = await Promise.all(
    (data || []).map(async (conversation): Promise<SupportConversationListItem> => {
      const { data: lastMessages } = await supabase
        .from("messages")
        .select("content")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(1);

      return {
        id: conversation.id,
        title: conversation.title,
        status: conversation.status,
        customerName: conversation.customer_name,
        currentIssue: conversation.current_issue,
        updatedAt: conversation.updated_at,
        lastMessage: lastMessages?.[0]?.content || ""
      };
    })
  );

  return {
    ok: true as const,
    data: items
  };
}

export async function getSupportConversation(organizationId: string, conversationId: string) {
  const runtime = getSupportChatRuntimeStatus(false);
  if (!runtime.configured) return runtimeError(runtime.error);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return pipelineError("supabase_not_configured", "Supabase is not configured.", 503);

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) return pipelineError("conversation_load_failed", conversationError.message);
  if (!conversation) {
    return {
      ok: true as const,
      data: null
    };
  }

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (messagesError) return pipelineError("messages_load_failed", messagesError.message);

  return {
    ok: true as const,
    data: {
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      customerName: conversation.customer_name,
      currentIssue: conversation.current_issue,
      updatedAt: conversation.updated_at,
      messages: (messages || []).map(mapMessage)
    }
  };
}

export async function runSupportChatTurn(input: SupportChatTurnInput, emit: (event: StreamEvent) => void) {
  const runtime = getSupportChatRuntimeStatus(true);
  if (!runtime.configured) {
    throw new Error(runtime.error?.message || "AI Support Chat is not configured.");
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const startedAt = Date.now();
  await upsertOrganization(supabase, input);

  const question = input.regenerate
    ? await getLastCustomerQuestion(supabase, input.organizationId, input.conversationId)
    : (input.question || "").trim();

  if (!question) {
    throw new Error("Enter a support question.");
  }

  const conversation = await ensureConversation(supabase, input, question);
  emit({ type: "conversation", conversationId: conversation.id });

  const attachments = input.attachments || [];
  const memory = await loadConversationMemory(supabase, input.organizationId, conversation.id);
  const analysis = analyzeCustomerMessage({
    question,
    previousMemory: memory.rollingMemory || undefined,
    previousSummary: memory.summary
  });

  if (!input.regenerate) {
    const { data: customerMessage, error: customerMessageError } = await supabase
      .from("messages")
      .insert({
      organization_id: input.organizationId,
      conversation_id: conversation.id,
      role: "customer",
      content: question,
      attachments,
      intent: analysis.intent.intent,
      intent_confidence: analysis.intent.confidence,
      priority: analysis.intent.priority,
      sentiment: analysis.sentiment.sentiment,
      extracted_entities: analysis.entities,
      metadata: {
        customer_name: input.customerName || null,
        intelligence: {
          intent: analysis.intent,
          sentiment: analysis.sentiment,
          entities: analysis.entities,
          memory: analysis.memory
        }
      }
    })
      .select("id")
      .single();

    if (customerMessageError || !customerMessage) {
      throw new Error(customerMessageError?.message || "Unable to store customer message.");
    }

    await persistMessageIntelligence(supabase, {
      organizationId: input.organizationId,
      conversationId: conversation.id,
      messageId: customerMessage.id,
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      entities: analysis.entities,
      memory: analysis.memory
    });
  }

  const recentMessages = await loadRecentMessages(supabase, input.organizationId, conversation.id);

  const queryEmbedding = await createEmbedding(question);
  const retrieved = await retrieveChunks(supabase, input.organizationId, queryEmbedding);
  const reranked = rerankChunks(question, retrieved).slice(0, 8);

  if (!reranked.length) {
    const fallback =
      "I do not have enough indexed Company Brain knowledge to answer that safely yet. Rebuild the Company Brain or add the relevant support documentation, then ask again.";
    const validation = validateSupportResponse({
      answer: fallback,
      sources: [],
      intent: analysis.intent.intent
    });
    const confidence = computeConfidence({ sources: [], answer: fallback, validation });
    const metrics = buildMetrics([], startedAt, fallback, question, undefined, confidence);
    const contextPackage = buildContextPackage({
      question,
      memory: analysis.memory,
      entities: analysis.entities,
      sources: [],
      demoMode: true
    });
    const escalation = decideEscalation({
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      confidence,
      validation,
      entities: analysis.entities
    });
    const pipeline = buildReasoningPipelineState({
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      context: contextPackage,
      confidence,
      validation,
      escalation
    });
    const thinking = buildThinkingSummary(question, [], metrics, analysis.intent, analysis.sentiment, validation, escalation);
    const replaySteps = buildReplaySteps({
      question,
      sources: [],
      metrics,
      thinking,
      answer: fallback,
      intelligence: analysis,
      validation,
      contextPackage,
      escalation,
      pipeline
    });
    emitBufferedResponse(fallback, emit);
    const message = await persistAssistantMessage(supabase, {
      organizationId: input.organizationId,
      conversationId: conversation.id,
      content: fallback,
      sources: [],
      metrics,
      thinking,
      replaySteps,
      intelligence: buildMessageIntelligence(analysis, metrics, validation, contextPackage, escalation, pipeline)
    });
    await persistReplaySteps(supabase, input.organizationId, conversation.id, message.id, replaySteps);
    await persistMessageIntelligence(supabase, {
      organizationId: input.organizationId,
      conversationId: conversation.id,
      messageId: message.id,
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      entities: analysis.entities,
      memory: analysis.memory,
      metrics,
      validation,
      contextPackage,
      escalation,
      pipeline
    });

    await finalizeConversation(supabase, {
      organizationId: input.organizationId,
      conversationId: conversation.id,
      question,
      answer: fallback,
      customerName: input.customerName || memory.customerName,
      currentIssue: question,
      previousMemory: memory,
      intelligence: analysis,
      contextPackage,
      escalation
    });

    await runEscalationAutomations({
      organizationId: input.organizationId,
      organizationName: input.organizationName,
      conversationId: conversation.id,
      messageId: message.id,
      customerName: input.customerName || memory.customerName,
      customerEmail: input.customerEmail,
      question,
      answer: fallback,
      escalation,
      intelligence: buildMessageIntelligence(analysis, metrics, validation, contextPackage, escalation, pipeline)
    });

    emit({ type: "done", conversationId: conversation.id, message, sources: [], metrics });
    return;
  }

  const prompt = buildPrompt({
    organizationName: input.organizationName,
    organizationWebsite: input.organizationWebsite,
    supportEmail: input.supportEmail,
    aiTone: input.aiTone,
    question,
    attachments,
    memory,
    intelligence: analysis,
    recentMessages,
    sources: reranked
  });

  const response = await generateOpenAIResponse(prompt);
  const sources = reranked.map(({ content: _content, similarity: _similarity, ...source }) => source);
  const initialContent = response.content.trim();
  const initialValidation = validateSupportResponse({
    answer: initialContent,
    sources,
    intent: analysis.intent.intent
  });
  const content = initialValidation.status === "fail" ? buildSafeFallback(initialValidation) : initialContent;
  const validation = initialValidation.status === "fail"
    ? validateSupportResponse({ answer: content, sources, intent: analysis.intent.intent })
    : initialValidation;
  const confidence = computeConfidence({ sources, answer: content, validation });
  const metrics = buildMetrics(reranked, startedAt, content, question, response.usage, confidence);
  const contextPackage = buildContextPackage({
    question,
    memory: analysis.memory,
    entities: analysis.entities,
    sources,
    demoMode: true
  });
  const escalation = decideEscalation({
    intent: analysis.intent,
    sentiment: analysis.sentiment,
    confidence,
    validation,
    entities: analysis.entities
  });
  const pipeline = buildReasoningPipelineState({
    intent: analysis.intent,
    sentiment: analysis.sentiment,
    context: contextPackage,
    confidence,
    validation,
    escalation
  });
  const thinking = buildThinkingSummary(question, sources, metrics, analysis.intent, analysis.sentiment, validation, escalation);
  const replaySteps = buildReplaySteps({
    question,
    sources,
    metrics,
    thinking,
    answer: content,
    intelligence: analysis,
    validation,
    contextPackage,
    escalation,
    pipeline
  });
  emitBufferedResponse(content, emit);
  const message = await persistAssistantMessage(supabase, {
    organizationId: input.organizationId,
    conversationId: conversation.id,
    content,
    sources,
    metrics,
    thinking,
    replaySteps,
    intelligence: buildMessageIntelligence(analysis, metrics, validation, contextPackage, escalation, pipeline)
  });
  await persistReplaySteps(supabase, input.organizationId, conversation.id, message.id, replaySteps);
  await persistMessageIntelligence(supabase, {
    organizationId: input.organizationId,
    conversationId: conversation.id,
    messageId: message.id,
    intent: analysis.intent,
    sentiment: analysis.sentiment,
    entities: analysis.entities,
    memory: analysis.memory,
    metrics,
    validation,
    contextPackage,
    escalation,
    pipeline
  });

  await finalizeConversation(supabase, {
    organizationId: input.organizationId,
    conversationId: conversation.id,
    question,
    answer: content,
    customerName: input.customerName || memory.customerName,
    currentIssue: question,
    previousMemory: memory,
    intelligence: analysis,
    contextPackage,
    escalation
  });

  await runEscalationAutomations({
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    conversationId: conversation.id,
    messageId: message.id,
    customerName: input.customerName || memory.customerName,
    customerEmail: input.customerEmail,
    question,
    answer: content,
    escalation,
    intelligence: buildMessageIntelligence(analysis, metrics, validation, contextPackage, escalation, pipeline)
  });

  emit({ type: "done", conversationId: conversation.id, message, sources, metrics });
}

async function upsertOrganization(supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>, input: SupportChatTurnInput) {
  const website = input.organizationWebsite || "https://example.com";
  const { error } = await supabase.from("organizations").upsert({
    id: input.organizationId,
    name: input.organizationName || "Workspace",
    slug: input.organizationId.replace(/^org_/, ""),
    website,
    updated_at: new Date().toISOString()
  });

  if (error) throw new Error(error.message);
}

async function ensureConversation(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  input: SupportChatTurnInput,
  question: string
) {
  if (input.conversationId) {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("id", input.conversationId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return data;
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      organization_id: input.organizationId,
      title: createTitle(question),
      customer_name: input.customerName || null,
      customer_email: input.customerEmail || null,
      current_issue: question
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "Unable to create conversation.");

  const participants = [
    {
      organization_id: input.organizationId,
      conversation_id: data.id,
      participant_type: "customer",
      display_name: input.customerName || "Customer",
      email: input.customerEmail || null
    },
    {
      organization_id: input.organizationId,
      conversation_id: data.id,
      participant_type: "ai",
      display_name: "Nexamind AI"
    }
  ];

  const { error: participantError } = await supabase.from("conversation_participants").insert(participants);
  if (participantError) throw new Error(participantError.message);

  return data;
}

async function getLastCustomerQuestion(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  organizationId: string,
  conversationId?: string
) {
  if (!conversationId) return "";

  const { data, error } = await supabase
    .from("messages")
    .select("content")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .eq("role", "customer")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.content || "";
}

async function loadConversationMemory(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  organizationId: string,
  conversationId: string
): Promise<ConversationMemory> {
  const { data } = await supabase
    .from("conversation_summaries")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .maybeSingle();

  return {
    summary: data?.summary || "",
    customerName: data?.customer_name || null,
    currentIssue: data?.current_issue || null,
    previousTroubleshooting: data?.previous_troubleshooting || [],
    rollingMemory: data?.rolling_memory || null,
    extractedEntities: data?.extracted_entities || emptyEntities(),
    sentiment: data?.sentiment || null,
    priority: data?.priority || null
  };
}

async function loadRecentMessages(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  organizationId: string,
  conversationId: string
) {
  const { data } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (data || []).reverse() as Array<{ role: string; content: string; created_at: string }>;
}

async function createEmbedding(input: string) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      authorization: `Bearer ${serverEnv.openaiApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: serverEnv.embeddingModel,
      input,
      dimensions: serverEnv.embeddingDimensions
    })
  });

  const payload = (await response.json()) as {
    data?: Array<{ embedding: number[] }>;
    error?: { message?: string };
  };

  if (!response.ok || !payload.data?.[0]?.embedding) {
    throw new Error(humanizeErrorMessage(payload.error?.message || "Unable to create question embedding."));
  }

  return payload.data[0].embedding;
}

async function retrieveChunks(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  organizationId: string,
  queryEmbedding: number[]
) {
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    match_organization_id: organizationId,
    query_embedding: formatVector(queryEmbedding),
    match_count: 8
  });

  if (error) throw new Error(error.message);

  return ((data || []) as Array<{
    chunk_id: string;
    document_id: string;
    content: string;
    title: string;
    source_url: string;
    category: string;
    similarity: number;
  }>).map((item) => ({
    chunkId: item.chunk_id,
    documentId: item.document_id,
    title: item.title || "Company Brain source",
    sourceUrl: item.source_url || "",
    category: item.category || "Knowledge",
    score: roundScore(item.similarity || 0),
    similarityScore: roundScore(item.similarity || 0),
    similarity: item.similarity || 0,
    snippet: item.content.slice(0, 280),
    chunkText: item.content,
    content: item.content
  }));
}

function rerankChunks(question: string, chunks: RetrievedChunk[]) {
  const questionTerms = tokenize(question);

  return chunks
    .map((chunk) => {
      const chunkTerms = new Set(tokenize(`${chunk.title} ${chunk.category} ${chunk.content}`));
      const overlap = questionTerms.filter((term) => chunkTerms.has(term)).length;
      const lexicalScore = questionTerms.length ? overlap / questionTerms.length : 0;
      const score = chunk.similarity * 0.82 + lexicalScore * 0.18;

      return {
        ...chunk,
        score: roundScore(score)
      };
    })
    .sort((a, b) => b.score - a.score);
}

function buildPrompt({
  organizationName,
  organizationWebsite,
  supportEmail,
  aiTone,
  question,
  attachments,
  memory,
  intelligence,
  recentMessages,
  sources
}: {
  organizationName: string;
  organizationWebsite: string;
  supportEmail: string;
  aiTone: string;
  question: string;
  attachments: ChatAttachment[];
  memory: ConversationMemory;
  intelligence: ReturnType<typeof analyzeCustomerMessage>;
  recentMessages: Array<{ role: string; content: string; created_at: string }>;
  sources: RetrievedChunk[];
}) {
  const sourceText = sources
    .map(
      (source, index) => `[${index + 1}] ${source.title}
Category: ${source.category}
URL: ${source.sourceUrl}
Retrieval score: ${source.score}
Excerpt: ${source.content.slice(0, 1400)}`
    )
    .join("\n\n");

  const recentText = recentMessages
    .map((message) => `${message.role}: ${message.content.slice(0, 800)}`)
    .join("\n");

  const attachmentText = attachments.length
    ? attachments.map((item) => `- ${item.name} (${item.type || "file"}, ${item.size} bytes)`).join("\n")
    : "No attachments.";

  return [
    {
      role: "system" as const,
      content: `You are Nexamind AI, a senior support engineer for ${organizationName}.
Use the retrieved Company Brain context as the source of truth.
If the answer is not supported by the retrieved context, say what is missing and ask for the smallest useful next detail.
Do not invent policies, prices, refunds, account data, legal terms, API behavior, or troubleshooting results.
Write in clear Markdown. Use short sections, lists, and code blocks when useful.
Tone: ${aiTone || "friendly, professional, helpful"}.
Company website: ${organizationWebsite}.
Support email: ${supportEmail}.`
    },
    {
      role: "user" as const,
      content: `Customer question:
${question}

Conversation memory:
Customer name: ${memory.customerName || "Unknown"}
Current issue: ${memory.currentIssue || "Unknown"}
Summary: ${memory.summary || "No prior summary yet."}
Previous troubleshooting: ${memory.previousTroubleshooting.length ? memory.previousTroubleshooting.join("; ") : "None recorded."}
Rolling memory: ${formatRollingMemory(intelligence.memory)}

AI intelligence:
Intent: ${intelligence.intent.intent} (${Math.round(intelligence.intent.confidence * 100)}% confidence)
Priority: ${intelligence.intent.priority}
Sentiment: ${intelligence.sentiment.sentiment}
Extracted entities: ${formatEntities(intelligence.entities)}

Recent conversation:
${recentText || "No previous messages."}

Attachments:
${attachmentText}

Retrieved Company Brain context:
${sourceText}

Answer the customer. Be specific about the likely next step and only reference source titles that appear above.`
    }
  ];
}

async function generateOpenAIResponse(messages: Array<{ role: "system" | "user"; content: string }>) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${serverEnv.openaiApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: serverEnv.chatModel,
      messages,
      temperature: 0.2,
      stream: true,
      stream_options: { include_usage: true }
    })
  });

  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(humanizeErrorMessage(payload?.error?.message || "OpenAI response generation failed."));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;

      const data = line.replace(/^data:\s*/, "");
      if (data === "[DONE]") continue;

      const payload = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      if (payload.usage) usage = payload.usage;

      const delta = payload.choices?.[0]?.delta?.content || "";
      if (delta) content += delta;
    }
  }

  return { content, usage };
}

function emitBufferedResponse(content: string, emit: (event: StreamEvent) => void) {
  const words = content.split(/(\s+)/);
  let chunk = "";

  for (const word of words) {
    chunk += word;
    if (chunk.length >= 48 || /\n/.test(word)) {
      emit({ type: "delta", content: chunk });
      chunk = "";
    }
  }

  if (chunk) emit({ type: "delta", content: chunk });
}

async function persistAssistantMessage(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  input: {
    organizationId: string;
    conversationId: string;
    content: string;
    sources: ChatSource[];
    metrics: ChatMetrics;
    thinking: AiThinking;
    replaySteps: ConversationReplayStep[];
    intelligence: MessageIntelligence;
  }
) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      organization_id: input.organizationId,
      conversation_id: input.conversationId,
      role: "assistant",
      content: input.content,
      sources: input.sources,
      confidence: input.metrics.confidence,
      retrieval_confidence: input.metrics.retrievalConfidence,
      reasoning_confidence: input.metrics.reasoningConfidence,
      final_confidence: input.metrics.finalConfidence,
      retrieval_score: input.metrics.retrievalScore,
      documents_used: input.metrics.documentsUsed,
      latency_ms: input.metrics.latencyMs,
      prompt_tokens: input.metrics.promptTokens,
      completion_tokens: input.metrics.completionTokens,
      total_tokens: input.metrics.totalTokens,
      model: input.metrics.model,
      intent: input.intelligence.intent.intent,
      intent_confidence: input.intelligence.intent.confidence,
      priority: input.intelligence.intent.priority,
      sentiment: input.intelligence.sentiment.sentiment,
      validation_status: input.intelligence.validation.status,
      validation_results: input.intelligence.validation,
      extracted_entities: input.intelligence.entities,
      context_package: input.intelligence.context,
      escalation_decision: input.intelligence.escalation,
      reasoning_pipeline: input.intelligence.pipeline,
      metadata: {
        thinking: input.thinking,
        replay_steps: input.replaySteps,
        intelligence: input.intelligence
      }
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "Unable to store assistant response.");
  return mapMessage(data);
}

async function persistReplaySteps(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  organizationId: string,
  conversationId: string,
  messageId: string,
  steps: ConversationReplayStep[]
) {
  if (!steps.length) return;

  const inserts = steps.map((step) => ({
    organization_id: organizationId,
    conversation_id: conversationId,
    message_id: messageId,
    step_key: step.stepKey,
    title: step.title,
    detail: step.detail,
    metadata: step.metadata,
    sort_order: step.sortOrder
  }));

  const { error } = await supabase.from("conversation_replay_steps").insert(inserts);
  if (error) throw new Error(error.message);
}

async function persistMessageIntelligence(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  input: {
    organizationId: string;
    conversationId: string;
    messageId: string;
    intent: IntentResult;
    sentiment: SentimentResult;
    entities: ExtractedEntities;
    memory: RollingMemory;
    metrics?: ChatMetrics;
    validation?: ValidationResult;
    contextPackage?: ContextPackage;
    escalation?: EscalationDecision;
    pipeline?: ReasoningPipelineState;
  }
) {
  const { error } = await supabase.from("message_intelligence").insert({
    organization_id: input.organizationId,
    conversation_id: input.conversationId,
    message_id: input.messageId,
    intent: input.intent.intent,
    intent_confidence: input.intent.confidence,
    priority: input.intent.priority,
    sentiment: input.sentiment.sentiment,
    entities: input.entities,
    retrieval_confidence: input.metrics?.retrievalConfidence ?? null,
    reasoning_confidence: input.metrics?.reasoningConfidence ?? null,
    final_confidence: input.metrics?.finalConfidence ?? null,
    validation_status: input.validation?.status ?? null,
    validation_results: input.validation || {},
    rolling_memory: input.memory,
    context_package: input.contextPackage || {},
    escalation_decision: input.escalation || {},
    reasoning_pipeline: input.pipeline || {}
  });

  if (error) throw new Error(error.message);
}

async function finalizeConversation(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  input: {
    organizationId: string;
    conversationId: string;
    question: string;
    answer: string;
    customerName: string | null;
    currentIssue: string;
    previousMemory: ConversationMemory;
    intelligence: ReturnType<typeof analyzeCustomerMessage>;
    contextPackage: ContextPackage;
    escalation: EscalationDecision;
  }
) {
  const now = new Date().toISOString();
  const nextSummary = summarizeTurn(input.previousMemory.summary, input.question, input.answer);
  const previousTroubleshooting = collectTroubleshooting(input.previousMemory.previousTroubleshooting, input.question);

  const [{ error: conversationError }, { error: summaryError }] = await Promise.all([
    supabase
      .from("conversations")
      .update({
        customer_name: input.customerName,
        current_issue: input.currentIssue,
        updated_at: now
      })
      .eq("id", input.conversationId)
      .eq("organization_id", input.organizationId),
    supabase.from("conversation_summaries").upsert({
      organization_id: input.organizationId,
      conversation_id: input.conversationId,
      summary: nextSummary,
      customer_name: input.customerName,
      current_issue: input.currentIssue,
      previous_troubleshooting: previousTroubleshooting,
      rolling_memory: input.intelligence.memory,
      extracted_entities: input.intelligence.entities,
      sentiment: input.intelligence.sentiment.sentiment,
      priority: input.intelligence.intent.priority,
      last_context_package: input.contextPackage,
      last_escalation_decision: input.escalation,
      last_message_at: now,
      updated_at: now
    })
  ]);

  if (conversationError) throw new Error(conversationError.message);
  if (summaryError) throw new Error(summaryError.message);
}

function mapMessage(message: Record<string, any>): SupportChatMessage {
  const metadata = message.metadata || {};
  const metrics =
    message.role === "assistant"
      ? {
          confidence: Number(message.confidence || 0),
          retrievalConfidence: Number(message.retrieval_confidence || message.retrieval_score || 0),
          reasoningConfidence: Number(message.reasoning_confidence || message.confidence || 0),
          finalConfidence: Number(message.final_confidence || message.confidence || 0),
          retrievalScore: Number(message.retrieval_score || 0),
          documentsUsed: Number(message.documents_used || 0),
          latencyMs: Number(message.latency_ms || 0),
          promptTokens: Number(message.prompt_tokens || 0),
          completionTokens: Number(message.completion_tokens || 0),
          totalTokens: Number(message.total_tokens || 0),
          model: message.model || serverEnv.chatModel
        }
      : null;

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    attachments: message.attachments || [],
    sources: message.sources || [],
    metrics,
    thinking: metadata.thinking || null,
    replaySteps: metadata.replay_steps || [],
    intelligence: metadata.intelligence || null,
    contextPackage: metadata.intelligence?.context || message.context_package || null,
    escalation: metadata.intelligence?.escalation || message.escalation_decision || null,
    pipeline: metadata.intelligence?.pipeline || message.reasoning_pipeline || null,
    createdAt: message.created_at
  };
}

function buildThinkingSummary(
  question: string,
  sources: ChatSource[],
  metrics: ChatMetrics,
  intent: IntentResult,
  sentiment: SentimentResult,
  validation: ValidationResult,
  escalation: EscalationDecision
): AiThinking {
  const action =
    validation.status === "fail" || metrics.finalConfidence < 0.45
      ? "Ask for details"
      : escalation.shouldEscalate
        ? "Escalate"
        : "Respond";

  return {
    intent: intent.intent,
    priority: intent.priority,
    sentiment: sentiment.sentiment,
    confidence: metrics.finalConfidence,
    retrieved: sources.map((source) => source.title).slice(0, 4),
    reasoning: inferReasoningSummary(intent.intent, question, sources, validation),
    action
  };
}

function buildMessageIntelligence(
  analysis: ReturnType<typeof analyzeCustomerMessage>,
  metrics: ChatMetrics,
  validation: ValidationResult,
  context: ContextPackage,
  escalation: EscalationDecision,
  pipeline: ReasoningPipelineState
): MessageIntelligence {
  return {
    intent: analysis.intent,
    sentiment: analysis.sentiment,
    entities: analysis.entities,
    memory: analysis.memory,
    confidence: {
      retrievalConfidence: metrics.retrievalConfidence,
      reasoningConfidence: metrics.reasoningConfidence,
      finalConfidence: metrics.finalConfidence
    },
    context,
    validation,
    escalation,
    pipeline
  };
}

function buildReplaySteps({
  question,
  sources,
  metrics,
  thinking,
  answer,
  intelligence,
  validation,
  contextPackage,
  escalation,
  pipeline
}: {
  question: string;
  sources: ChatSource[];
  metrics: ChatMetrics;
  thinking: AiThinking;
  answer: string;
  intelligence: ReturnType<typeof analyzeCustomerMessage>;
  validation: ValidationResult;
  contextPackage: ContextPackage;
  escalation: EscalationDecision;
  pipeline: ReasoningPipelineState;
}): ConversationReplayStep[] {
  return [
    {
      stepKey: "customer",
      title: "Customer",
      detail: question,
      metadata: {
        characters: question.length,
        sentiment: intelligence.sentiment,
        entities: intelligence.entities
      },
      sortOrder: 1
    },
    {
      stepKey: "embedding",
      title: "Embedding",
      detail: `Created a ${serverEnv.embeddingDimensions}-dimension embedding for semantic search.`,
      metadata: { model: serverEnv.embeddingModel },
      sortOrder: 2
    },
    {
      stepKey: "vector_search",
      title: "Vector Search",
      detail: `Searched pgvector and selected ${sources.length} top chunks for reranking.`,
      metadata: {
        retrievalScore: metrics.retrievalScore,
        documentsUsed: metrics.documentsUsed
      },
      sortOrder: 3
    },
    {
      stepKey: "retrieved_documents",
      title: "Retrieved Documents",
      detail: sources.length ? sources.map((source) => source.title).join(", ") : "No matching chunks were available.",
      metadata: { sources },
      sortOrder: 4
    },
    {
      stepKey: "reasoning",
      title: "Reasoning",
      detail: `${thinking.reasoning} ${escalation.shouldEscalate ? `Escalation: ${escalation.reason}` : "No escalation required."}`,
      metadata: {
        intent: thinking.intent,
        priority: thinking.priority,
        sentiment: thinking.sentiment,
        action: thinking.action,
        confidence: thinking.confidence,
        validation,
        contextPackage,
        pipeline
      },
      sortOrder: 5
    },
    {
      stepKey: "final_response",
      title: "Final Response",
      detail: `Streamed and stored the response with ${metrics.totalTokens} total tokens in ${metrics.latencyMs}ms.`,
      metadata: {
        preview: answer.replace(/\s+/g, " ").slice(0, 320),
        model: metrics.model,
        retrievalConfidence: metrics.retrievalConfidence,
        reasoningConfidence: metrics.reasoningConfidence,
        finalConfidence: metrics.finalConfidence
      },
      sortOrder: 6
    }
  ];
}

function formatRollingMemory(memory: RollingMemory) {
  return [
    `Customer type: ${memory.customerType}`,
    `Plan: ${memory.plan}`,
    `Current issue: ${memory.currentIssue || "Unknown"}`,
    `Known facts: ${memory.knownFacts.length ? memory.knownFacts.join("; ") : "None"}`,
    `Verified steps: ${memory.verifiedSteps.length ? memory.verifiedSteps.join("; ") : "None"}`,
    `Waiting on: ${memory.waitingOn}`
  ].join("\n");
}

function formatEntities(entities: ExtractedEntities) {
  const entries = Object.entries(entities)
    .filter(([, values]) => Array.isArray(values) && values.length)
    .map(([key, values]) => `${key}: ${(values as string[]).join(", ")}`);

  return entries.length ? entries.join("; ") : "None detected";
}

function emptyEntities(): ExtractedEntities {
  return {
    invoices: [],
    emails: [],
    generationIds: [],
    subscriptions: [],
    models: [],
    apiKeys: [],
    browsers: [],
    operatingSystems: []
  };
}

function inferIntent(question: string, sources: ChatSource[]) {
  const value = `${question} ${sources.map((source) => `${source.title} ${source.category}`).join(" ")}`.toLowerCase();

  if (/\b(credit|billing|invoice|charge|payment|refund|plan)\b/.test(value)) return "Billing + Credits";
  if (/\b(render|generation|failed|upscale|image|video)\b/.test(value)) return "Render Troubleshooting";
  if (/\b(upgrade|subscription|pricing|seat|workspace)\b/.test(value)) return "Plan Upgrade";
  if (/\b(commercial|license|usage rights|copyright)\b/.test(value)) return "Commercial License";
  if (/\b(api|token|key|rate limit|429|endpoint)\b/.test(value)) return "API Support";
  if (/\b(account|login|password|email)\b/.test(value)) return "Account Access";
  return "General Support";
}

function inferReasoningSummary(intent: string, question: string, sources: ChatSource[], validation: ValidationResult) {
  if (validation.status === "fail") return "Response validation found insufficient grounding or unsafe output, so the answer was replaced with a safe fallback.";
  if (validation.status === "warn") return `Response validation passed with caution: ${validation.notes[0] || "review grounding and citations."}`;
  if (!sources.length) return "No grounded Company Brain source was available, so the safest action is to ask for more context or rebuild the knowledge base.";

  if (intent === "Billing + Credits") return "Possible credit synchronization delay, plan-credit mismatch, or billing policy question grounded in retrieved billing sources.";
  if (intent === "Render Troubleshooting") return "Likely render failure path; use troubleshooting context before suggesting account-specific escalation.";
  if (intent === "Plan Upgrade") return "Upgrade question should be answered from pricing and plan documentation before recommending account changes.";
  if (intent === "Commercial License") return "License answer must stay grounded in policy language and avoid inventing usage rights.";
  if (intent === "API Support") return "API issue should use documentation context and ask for request details when the retrieved source is incomplete.";
  if (/\b(urgent|angry|broken|refund|cancel)\b/i.test(question)) return "Customer wording suggests higher support sensitivity; answer directly and keep escalation available.";
  return "Retrieved Company Brain chunks are relevant enough to provide a grounded support response.";
}

function buildMetrics(
  sources: Array<{ score: number; documentId: string }>,
  startedAt: number,
  content: string,
  question: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
  confidence?: ConfidenceResult
): ChatMetrics {
  const retrievalScore = sources.length ? Math.max(...sources.map((source) => source.score)) : 0;
  const uniqueDocuments = new Set(sources.map((source) => source.documentId)).size;
  const legacyConfidence = sources.length
    ? clamp(0.28 + retrievalScore * 0.55 + Math.min(uniqueDocuments / 4, 1) * 0.17, 0.1, 0.98)
    : 0.18;

  const promptTokens = usage?.prompt_tokens || estimateTokens(`${question} ${sources.map((source) => source.documentId).join(" ")}`);
  const completionTokens = usage?.completion_tokens || estimateTokens(content);

  return {
    confidence: confidence?.finalConfidence ?? roundScore(legacyConfidence),
    retrievalConfidence: confidence?.retrievalConfidence ?? roundScore(retrievalScore),
    reasoningConfidence: confidence?.reasoningConfidence ?? roundScore(legacyConfidence),
    finalConfidence: confidence?.finalConfidence ?? roundScore(legacyConfidence),
    retrievalScore: roundScore(retrievalScore),
    documentsUsed: uniqueDocuments,
    latencyMs: Date.now() - startedAt,
    promptTokens,
    completionTokens,
    totalTokens: usage?.total_tokens || promptTokens + completionTokens,
    model: serverEnv.chatModel
  };
}

function summarizeTurn(previousSummary: string, question: string, answer: string) {
  const next = [
    previousSummary,
    `Customer asked: ${question}`,
    `Nexamind AI answered: ${answer.replace(/\s+/g, " ").slice(0, 500)}`
  ]
    .filter(Boolean)
    .join("\n");

  return next.slice(-2400);
}

function collectTroubleshooting(previous: string[], question: string) {
  const shouldRemember = /\b(tried|failed|error|bug|issue|not working|broken|cannot|can't|stuck)\b/i.test(question);
  const next = shouldRemember ? [...previous, question] : previous;
  return Array.from(new Set(next)).slice(-8);
}

function createTitle(question: string) {
  const cleaned = question.replace(/\s+/g, " ").trim();
  return cleaned.length > 72 ? `${cleaned.slice(0, 69)}...` : cleaned || "New support conversation";
}

function tokenize(value: string) {
  const stopWords = new Set(["the", "and", "for", "that", "this", "with", "from", "have", "does", "what", "when", "where", "how", "why", "can", "you", "my", "our", "your"]);
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s']/g, " ")
        .split(/\s+/)
        .filter((term) => term.length > 2 && !stopWords.has(term))
    )
  );
}

function estimateTokens(text: string) {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.35);
}

function formatVector(vector: number[]) {
  return `[${vector.join(",")}]`;
}

function roundScore(value: number) {
  return Math.round(value * 10000) / 10000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function runtimeError(error: ReturnType<typeof getSupportChatRuntimeStatus>["error"]) {
  return {
    ok: false as const,
    status: 503,
    error: error || {
      code: "support_chat_not_configured",
      message: "AI Support Chat is not configured.",
      missing: []
    }
  };
}

function pipelineError(code: string, message: string, status = 400) {
  return {
    ok: false as const,
    status,
    error: {
      code,
      message
    }
  };
}
