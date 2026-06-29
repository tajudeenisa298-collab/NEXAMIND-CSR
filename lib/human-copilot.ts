import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAutomationRuntimeStatus, runAutomationAction } from "@/lib/automation-engine";
import { getBackendConfigStatus } from "@/lib/server-env";

export type CopilotConversation = {
  id: string;
  title: string;
  status: "open" | "waiting" | "resolved" | "escalated";
  takeoverStatus: "ai_active" | "human_requested" | "human_active" | "resolved";
  customerName: string | null;
  customerEmail: string | null;
  currentIssue: string | null;
  assignedAgent: string | null;
  updatedAt: string;
  lastMessage: string;
  priority: string;
  intent: string;
  sentiment: string;
};

export type CopilotMessage = {
  id: string;
  role: "customer" | "assistant" | "system" | "tool";
  content: string;
  sources: Array<{
    title: string;
    sourceUrl: string;
    score: number;
    snippet: string;
  }>;
  createdAt: string;
};

export type CopilotNote = {
  id: string;
  authorName: string;
  body: string;
  visibility: "internal" | "handoff";
  createdAt: string;
};

export type CopilotAction = {
  id: string;
  actionType: string;
  status: "completed" | "failed" | "skipped";
  label: string;
  createdAt: string;
};

export type CopilotWorkspace = {
  conversations: CopilotConversation[];
  selected: CopilotConversation | null;
  messages: CopilotMessage[];
  notes: CopilotNote[];
  actions: CopilotAction[];
  aiSummary: string;
  suggestedReply: string;
  customerHistory: string[];
  knowledgeSources: Array<{
    title: string;
    sourceUrl: string;
    score: number;
    snippet: string;
  }>;
  oneClickActions: Array<{
    actionType: "create_ticket" | "refund_review" | "slack_notify" | "email_followup" | "human_takeover" | "resolve_conversation";
    label: string;
    description: string;
  }>;
};

type CopilotActionInput = {
  organizationId: string;
  conversationId: string;
  actionType: "create_ticket" | "refund_review" | "slack_notify" | "email_followup" | "human_takeover" | "resolve_conversation" | "send_reply";
  reply?: string;
  note?: string;
};

export function getHumanCopilotRuntimeStatus() {
  const backend = getBackendConfigStatus();
  const automation = getAutomationRuntimeStatus();
  const configured = backend.supabaseConfigured;

  return {
    configured,
    automation,
    error: configured
      ? null
      : {
          code: "human_copilot_not_configured",
          message: "Connect Supabase before using the Human Copilot workspace."
        }
  };
}

export async function getHumanCopilotWorkspace(organizationId: string, conversationId?: string) {
  const runtime = getHumanCopilotRuntimeStatus();
  if (!runtime.configured) return copilotRuntimeError(runtime.error);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return copilotError("supabase_not_configured", "Supabase is not configured.", 503);

  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(40);

  if (conversationsError) return copilotError("conversations_failed", conversationsError.message);

  const conversationRows = conversations || [];
  const selectedRow = conversationRows.find((conversation) => conversation.id === conversationId) || conversationRows[0] || null;
  const selectedId = selectedRow?.id || null;

  const conversationsWithLastMessage = await Promise.all(
    conversationRows.map(async (conversation) => {
      const [lastMessageResult, intelligenceResult] = await Promise.all([
        supabase
          .from("messages")
          .select("content")
          .eq("organization_id", organizationId)
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("message_intelligence")
          .select("intent, sentiment")
          .eq("organization_id", organizationId)
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(1)
      ]);

      const intent = intelligenceResult.data?.[0]?.intent;
      const sentiment = intelligenceResult.data?.[0]?.sentiment;

      return mapConversation(conversation, lastMessageResult.data?.[0]?.content || "", {
        intent: intent?.intent || "General Support",
        priority: intent?.priority || "Medium",
        sentiment: sentiment?.sentiment || "Neutral"
      });
    })
  );

  if (!selectedId || !selectedRow) {
    return {
      ok: true as const,
      data: emptyWorkspace()
    };
  }

  const [messagesResult, summaryResult, notesResult, actionsResult] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("conversation_id", selectedId)
      .order("created_at", { ascending: true }),
    supabase
      .from("conversation_summaries")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("conversation_id", selectedId)
      .maybeSingle(),
    supabase
      .from("internal_notes")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("conversation_id", selectedId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("copilot_actions")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("conversation_id", selectedId)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  const firstError = [messagesResult.error, summaryResult.error, notesResult.error, actionsResult.error].find(Boolean);
  if (firstError) return copilotError("workspace_failed", firstError.message);

  const messages = (messagesResult.data || []).map(mapMessage);
  const selected = conversationsWithLastMessage.find((conversation) => conversation.id === selectedId) || null;
  const knowledgeSources = collectSources(messages);
  const aiSummary = buildAiSummary(summaryResult.data, selected, messages);
  const suggestedReply = buildSuggestedReply(selected, aiSummary, knowledgeSources);
  const customerHistory = buildCustomerHistory(summaryResult.data, messages);

  return {
    ok: true as const,
    data: {
      conversations: conversationsWithLastMessage,
      selected,
      messages,
      notes: (notesResult.data || []).map(mapNote),
      actions: (actionsResult.data || []).map(mapAction),
      aiSummary,
      suggestedReply,
      customerHistory,
      knowledgeSources,
      oneClickActions: buildOneClickActions(selected)
    }
  };
}

export async function addInternalNote(input: {
  organizationId: string;
  conversationId: string;
  body: string;
  authorName?: string;
  visibility?: "internal" | "handoff";
}) {
  const runtime = getHumanCopilotRuntimeStatus();
  if (!runtime.configured) return copilotRuntimeError(runtime.error);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return copilotError("supabase_not_configured", "Supabase is not configured.", 503);

  const body = input.body.trim();
  if (!body) return copilotError("empty_note", "Write a note before saving it.", 400);

  const { data, error } = await supabase
    .from("internal_notes")
    .insert({
      organization_id: input.organizationId,
      conversation_id: input.conversationId,
      author_name: input.authorName || "Support Agent",
      body,
      visibility: input.visibility || "internal"
    })
    .select("*")
    .single();

  if (error || !data) return copilotError("note_failed", error?.message || "Unable to save note.");

  return {
    ok: true as const,
    data: mapNote(data)
  };
}

export async function runCopilotAction(input: CopilotActionInput) {
  const runtime = getHumanCopilotRuntimeStatus();
  if (!runtime.configured) return copilotRuntimeError(runtime.error);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return copilotError("supabase_not_configured", "Supabase is not configured.", 503);

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.conversationId)
    .maybeSingle();

  if (conversationError) return copilotError("conversation_failed", conversationError.message);
  if (!conversation) return copilotError("conversation_missing", "Conversation not found.", 404);

  try {
    if (input.actionType === "send_reply") {
      await sendHumanReply(input);
    } else if (input.actionType === "human_takeover") {
      await markHumanTakeover(input, "human_active");
    } else if (input.actionType === "resolve_conversation") {
      await markHumanTakeover(input, "resolved");
    } else {
      await runActionAutomation(input, conversation);
    }

    const { data, error } = await supabase
      .from("copilot_actions")
      .insert({
        organization_id: input.organizationId,
        conversation_id: input.conversationId,
        action_type: input.actionType,
        status: "completed",
        label: labelCopilotAction(input.actionType),
        payload: {
          reply: input.reply || null,
          note: input.note || null
        }
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message || "Unable to record copilot action.");

    return {
      ok: true as const,
      data: mapAction(data)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Copilot action failed.";
    await supabase.from("copilot_actions").insert({
      organization_id: input.organizationId,
      conversation_id: input.conversationId,
      action_type: input.actionType,
      status: "failed",
      label: labelCopilotAction(input.actionType),
      payload: {
        error: message
      }
    });

    return copilotError("copilot_action_failed", message);
  }
}

async function sendHumanReply(input: CopilotActionInput) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const reply = (input.reply || "").trim();
  if (!reply) throw new Error("Write a reply before sending.");

  const { error: messageError } = await supabase.from("messages").insert({
    organization_id: input.organizationId,
    conversation_id: input.conversationId,
    role: "assistant",
    content: reply,
    metadata: {
      sent_by: "human_agent",
      surface: "human_copilot"
    }
  });

  if (messageError) throw new Error(messageError.message);

  await supabase
    .from("conversations")
    .update({
      status: "waiting",
      takeover_status: "human_active",
      assigned_agent: "Support Agent",
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.conversationId);
}

async function markHumanTakeover(input: CopilotActionInput, status: "human_active" | "resolved") {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase
    .from("conversations")
    .update({
      status: status === "resolved" ? "resolved" : "escalated",
      takeover_status: status,
      assigned_agent: "Support Agent",
      takeover_reason: input.note || (status === "resolved" ? "Conversation resolved by agent." : "Agent took over from AI."),
      takeover_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.conversationId);

  if (error) throw new Error(error.message);
}

async function runActionAutomation(input: CopilotActionInput, conversation: Record<string, any>) {
  const actionMap = {
    create_ticket: "ticket_create",
    refund_review: "refund_workflow",
    slack_notify: "slack_notify",
    email_followup: "email_notify"
  } as const;
  const actionType = actionMap[input.actionType as keyof typeof actionMap];
  if (!actionType) return;

  const result = await runAutomationAction({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    actionType,
    reason: input.note || "Agent triggered one-click action.",
    customerName: conversation.customer_name,
    customerEmail: conversation.customer_email,
    subject: conversation.title || labelCopilotAction(input.actionType),
    description: conversation.current_issue || "Agent requested automation from Human Copilot.",
    priority: conversation.status === "escalated" ? "high" : "normal",
    intent: conversation.metadata?.intent || null,
    assignedQueue: "support",
    payload: {
      source: "human_copilot",
      copilotAction: input.actionType
    }
  });

  if (!result.ok) throw new Error(result.error.message);
}

function emptyWorkspace(): CopilotWorkspace {
  return {
    conversations: [],
    selected: null,
    messages: [],
    notes: [],
    actions: [],
    aiSummary: "No conversations yet.",
    suggestedReply: "Start a support conversation to generate a suggested reply.",
    customerHistory: [],
    knowledgeSources: [],
    oneClickActions: []
  };
}

function mapConversation(row: Record<string, any>, lastMessage: string, intelligence: { intent: string; priority: string; sentiment: string }): CopilotConversation {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    takeoverStatus: row.takeover_status || "ai_active",
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    currentIssue: row.current_issue,
    assignedAgent: row.assigned_agent,
    updatedAt: row.updated_at,
    lastMessage,
    priority: intelligence.priority,
    intent: intelligence.intent,
    sentiment: intelligence.sentiment
  };
}

function mapMessage(row: Record<string, any>): CopilotMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    sources: Array.isArray(row.sources) ? row.sources : [],
    createdAt: row.created_at
  };
}

function mapNote(row: Record<string, any>): CopilotNote {
  return {
    id: row.id,
    authorName: row.author_name,
    body: row.body,
    visibility: row.visibility,
    createdAt: row.created_at
  };
}

function mapAction(row: Record<string, any>): CopilotAction {
  return {
    id: row.id,
    actionType: row.action_type,
    status: row.status,
    label: row.label,
    createdAt: row.created_at
  };
}

function collectSources(messages: CopilotMessage[]) {
  const seen = new Set<string>();
  return messages
    .flatMap((message) => message.sources || [])
    .filter((source) => {
      const key = `${source.title}:${source.sourceUrl}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function buildAiSummary(summary: Record<string, any> | null, selected: CopilotConversation | null, messages: CopilotMessage[]) {
  if (summary?.summary) return summary.summary;
  if (!selected) return "No active conversation selected.";

  const latestCustomer = [...messages].reverse().find((message) => message.role === "customer")?.content;
  return `${selected.customerName || "The customer"} needs help with ${selected.currentIssue || selected.title}. Latest customer message: ${latestCustomer || "No customer message yet."}`;
}

function buildSuggestedReply(selected: CopilotConversation | null, aiSummary: string, sources: CopilotWorkspace["knowledgeSources"]) {
  if (!selected) return "Start a support conversation to generate a suggested reply.";

  const citation = sources[0]?.title ? ` I’m checking ${sources[0].title} as the source of truth.` : "";
  return `Hi ${selected.customerName || "there"}, thanks for the details. ${aiSummary}${citation} I’ll help get this resolved and will escalate it if account-specific action is needed.`;
}

function buildCustomerHistory(summary: Record<string, any> | null, messages: CopilotMessage[]) {
  const facts = summary?.key_facts && typeof summary.key_facts === "object" ? Object.values(summary.key_facts).map(String) : [];
  const previousTroubleshooting = Array.isArray(summary?.previous_troubleshooting) ? summary.previous_troubleshooting : [];
  const customerMessages = messages.filter((message) => message.role === "customer").slice(-3).map((message) => message.content);

  return [...facts, ...previousTroubleshooting, ...customerMessages].filter(Boolean).slice(0, 8);
}

function buildOneClickActions(selected: CopilotConversation | null): CopilotWorkspace["oneClickActions"] {
  if (!selected) return [];

  return [
    {
      actionType: "human_takeover",
      label: "Take over",
      description: "Mark this conversation as handled by a human agent."
    },
    {
      actionType: "create_ticket",
      label: "Create ticket",
      description: "Create a support ticket from this conversation."
    },
    {
      actionType: "refund_review",
      label: "Refund review",
      description: "Open a finance review for billing-sensitive cases."
    },
    {
      actionType: "slack_notify",
      label: "Alert Slack",
      description: "Notify the support channel."
    },
    {
      actionType: "email_followup",
      label: "Email follow-up",
      description: "Queue an outbound customer follow-up."
    },
    {
      actionType: "resolve_conversation",
      label: "Resolve",
      description: "Close the conversation after the agent finishes."
    }
  ];
}

function labelCopilotAction(actionType: CopilotActionInput["actionType"]) {
  const labels = {
    send_reply: "Sent human reply",
    human_takeover: "Human takeover",
    create_ticket: "Created ticket",
    refund_review: "Opened refund review",
    slack_notify: "Sent Slack alert",
    email_followup: "Queued email follow-up",
    resolve_conversation: "Resolved conversation"
  };

  return labels[actionType];
}

function copilotRuntimeError(error: { code: string; message: string } | null) {
  return {
    ok: false as const,
    status: 503,
    error: error || {
      code: "human_copilot_not_configured",
      message: "Human Copilot is not configured."
    }
  };
}

function copilotError(code: string, message: string, status = 500) {
  return {
    ok: false as const,
    status,
    error: {
      code,
      message
    }
  };
}
