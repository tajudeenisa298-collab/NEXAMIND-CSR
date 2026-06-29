import { serverEnv } from "@/lib/server-env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { humanizeErrorMessage } from "@/lib/humanize-error";
import { ensureOrganizationRecord } from "@/lib/ensure-organization";
import type { EscalationDecision, MessageIntelligence } from "@/lib/ai-intelligence";

export type AutomationActionType =
  | "make_workflow"
  | "webhook"
  | "ticket_create"
  | "refund_workflow"
  | "slack_notify"
  | "discord_notify"
  | "email_notify";

export type AutomationWorkflow = {
  id: string;
  organizationId: string;
  name: string;
  triggerType: string;
  actionType: AutomationActionType;
  destination: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AutomationRun = {
  id: string;
  organizationId: string;
  workflowId: string | null;
  conversationId: string | null;
  messageId: string | null;
  actionType: AutomationActionType;
  status: "queued" | "running" | "succeeded" | "failed" | "skipped";
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type WorkflowLog = {
  id: string;
  organizationId: string;
  runId: string | null;
  level: "info" | "warn" | "error";
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  organizationId: string;
  conversationId: string | null;
  messageId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  subject: string;
  description: string;
  status: "open" | "waiting" | "resolved" | "escalated";
  priority: "low" | "normal" | "high" | "urgent";
  intent: string | null;
  assignedQueue: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type RefundRequest = {
  id: string;
  organizationId: string;
  ticketId: string | null;
  conversationId: string | null;
  amount: number | null;
  currency: string;
  reason: string;
  status: "draft" | "pending_review" | "approved" | "rejected" | "processed";
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type AutomationRequest = {
  organizationId: string;
  workflowId?: string;
  conversationId?: string;
  messageId?: string;
  actionType: AutomationActionType;
  reason?: string;
  customerName?: string | null;
  customerEmail?: string | null;
  subject?: string;
  description?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  intent?: string | null;
  assignedQueue?: string;
  payload?: Record<string, unknown>;
};

type EscalationAutomationInput = {
  organizationId: string;
  organizationName: string;
  conversationId: string;
  messageId: string;
  customerName?: string | null;
  customerEmail?: string | null;
  question: string;
  answer: string;
  escalation: EscalationDecision;
  intelligence: MessageIntelligence;
};

const defaultWorkflows: Array<Omit<AutomationWorkflow, "id" | "organizationId" | "createdAt" | "updatedAt">> = [
  {
    name: "AI Escalation Ticket",
    triggerType: "Escalation decision",
    actionType: "ticket_create",
    destination: "Support queue",
    enabled: true,
    config: {}
  },
  {
    name: "Refund Review",
    triggerType: "Refund or cancellation intent",
    actionType: "refund_workflow",
    destination: "Finance review",
    enabled: true,
    config: {}
  },
  {
    name: "Make.com Handoff",
    triggerType: "Automation-ready support task",
    actionType: "make_workflow",
    destination: "Make.com scenario",
    enabled: false,
    config: {}
  },
  {
    name: "Slack Support Alert",
    triggerType: "Urgent escalation",
    actionType: "slack_notify",
    destination: "#support-alerts",
    enabled: true,
    config: {}
  },
  {
    name: "Discord Incident Alert",
    triggerType: "API or incident escalation",
    actionType: "discord_notify",
    destination: "Support Discord",
    enabled: false,
    config: {}
  },
  {
    name: "Email Follow-up",
    triggerType: "Customer follow-up needed",
    actionType: "email_notify",
    destination: "Customer email",
    enabled: true,
    config: {}
  },
  {
    name: "Generic Webhook",
    triggerType: "Custom workflow",
    actionType: "webhook",
    destination: "External endpoint",
    enabled: false,
    config: {}
  }
];

export function getAutomationRuntimeStatus() {
  const supabaseConfigured = Boolean(serverEnv.supabaseUrl && serverEnv.supabaseServiceRoleKey);
  const destinations = getAutomationDestinations();

  return {
    configured: supabaseConfigured,
    demoMode: serverEnv.demoMode,
    destinationMode: serverEnv.demoMode ? "demo" : "client",
    dryRun: serverEnv.automationDryRun,
    integrations: {
      make: Boolean(destinations.make),
      webhook: Boolean(destinations.webhook),
      refund: Boolean(destinations.refund),
      slack: Boolean(destinations.slack),
      discord: Boolean(destinations.discord),
      email: Boolean(destinations.email)
    },
    demoIntegrations: {
      make: Boolean(serverEnv.demoMakeWebhookUrl),
      webhook: Boolean(serverEnv.demoGenericWebhookUrl),
      refund: Boolean(serverEnv.demoRefundWorkflowWebhookUrl),
      slack: Boolean(serverEnv.demoSlackWebhookUrl),
      discord: Boolean(serverEnv.demoDiscordWebhookUrl),
      email: Boolean(serverEnv.demoEmailWebhookUrl)
    },
    clientIntegrations: {
      make: Boolean(serverEnv.makeWebhookUrl),
      webhook: Boolean(serverEnv.genericWebhookUrl),
      refund: Boolean(serverEnv.refundWorkflowWebhookUrl),
      slack: Boolean(serverEnv.slackWebhookUrl),
      discord: Boolean(serverEnv.discordWebhookUrl),
      email: Boolean(serverEnv.emailWebhookUrl)
    },
    error: supabaseConfigured
      ? null
      : {
          code: "automation_not_configured",
          message: "Connect Supabase before using the Automation Engine."
        }
  };
}

export async function listAutomationDashboard(organizationId: string) {
  const runtime = getAutomationRuntimeStatus();
  if (!runtime.configured) return runtimeError(runtime.error);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return automationError("supabase_not_configured", "Supabase is not configured.", 503);

  await ensureOrganizationRecord({ organizationId });
  await ensureDefaultWorkflows(organizationId);

  const [workflows, runs, logs, tickets, refunds] = await Promise.all([
    supabase
      .from("automation_workflows")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("automation_runs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("workflow_logs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("support_tickets")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("refund_requests")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  const firstError = [workflows.error, runs.error, logs.error, tickets.error, refunds.error].find(Boolean);
  if (firstError) return automationError("automation_dashboard_failed", firstError.message);

  return {
    ok: true as const,
    data: {
      runtime,
      workflows: (workflows.data || []).map(mapWorkflow),
      runs: (runs.data || []).map(mapRun),
      logs: (logs.data || []).map(mapLog),
      tickets: (tickets.data || []).map(mapTicket),
      refunds: (refunds.data || []).map(mapRefund)
    }
  };
}

export async function runAutomationAction(input: AutomationRequest) {
  const runtime = getAutomationRuntimeStatus();
  if (!runtime.configured) return runtimeError(runtime.error);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return automationError("supabase_not_configured", "Supabase is not configured.", 503);

  await ensureOrganizationRecord({ organizationId: input.organizationId });
  await ensureDefaultWorkflows(input.organizationId);

  const workflow = input.workflowId
    ? await getWorkflowById(input.organizationId, input.workflowId)
    : await getWorkflowByAction(input.organizationId, input.actionType);

  if (workflow && !workflow.enabled) {
    const run = await createRun(input, workflow.id, "skipped", {
      reason: "Workflow is disabled."
    });
    await logWorkflow(input.organizationId, run.data?.id || null, "warn", `${workflow.name} skipped because it is disabled.`, {
      actionType: input.actionType
    });
    return {
      ok: true as const,
      data: run.data ? mapRun(run.data) : null
    };
  }

  const runResult = await createRun(input, workflow?.id || null, "running");
  if (runResult.error || !runResult.data) {
    return automationError("automation_run_failed", runResult.error?.message || "Unable to create automation run.");
  }

  const runId = runResult.data.id as string;

  try {
    let output: Record<string, unknown>;

    if (input.actionType === "ticket_create") {
      output = await createSupportTicket(input, runId);
    } else if (input.actionType === "refund_workflow") {
      output = await createRefundReview(input, runId);
    } else {
      output = await dispatchNotification(input, runId, workflow?.destination || input.actionType);
    }

    const status = output.skipped ? "skipped" : "succeeded";
    const { data, error } = await supabase
      .from("automation_runs")
      .update({
        status,
        output,
        completed_at: new Date().toISOString()
      })
      .eq("id", runId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message || "Unable to complete automation run.");

    await logWorkflow(
      input.organizationId,
      runId,
      status === "skipped" ? "warn" : "info",
      `${workflow?.name || input.actionType} ${status}.`,
      output
    );

    return {
      ok: true as const,
      data: mapRun(data)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation action failed.";
    await supabase
      .from("automation_runs")
      .update({
        status: "failed",
        error: message,
        completed_at: new Date().toISOString()
      })
      .eq("id", runId);

    await logWorkflow(input.organizationId, runId, "error", message, {
      actionType: input.actionType
    });

    return automationError("automation_action_failed", message);
  }
}

export async function runEscalationAutomations(input: EscalationAutomationInput) {
  if (!input.escalation.shouldEscalate) return;

  const priority = mapEscalationPriority(input.escalation.severity);
  const payload = {
    organizationName: input.organizationName,
    question: input.question,
    answer: input.answer,
    escalation: input.escalation,
    intelligence: input.intelligence
  };

  const ticketResult = await runAutomationAction({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    actionType: "ticket_create",
    reason: input.escalation.reason,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    subject: `AI escalation: ${input.intelligence.intent.intent}`,
    description: `${input.question}\n\nAI response:\n${input.answer}`,
    priority,
    intent: input.intelligence.intent.intent,
    assignedQueue: input.escalation.queue,
    payload
  });

  if (input.intelligence.intent.intent === "Billing + Credits" || /\b(refund|cancel|charge|billing)\b/i.test(input.question)) {
    await runAutomationAction({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      actionType: "refund_workflow",
      reason: input.escalation.reason,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      subject: "Refund review requested",
      description: input.question,
      priority,
      intent: input.intelligence.intent.intent,
      payload: {
        ...payload,
        ticketRunId: ticketResult.ok ? ticketResult.data?.id : null
      }
    });
  }

  if (priority === "urgent" || priority === "high") {
    await runAutomationAction({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      actionType: "slack_notify",
      reason: input.escalation.reason,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      subject: `Support escalation: ${input.intelligence.intent.intent}`,
      description: input.question,
      priority,
      intent: input.intelligence.intent.intent,
      payload
    });
  }
}

async function ensureDefaultWorkflows(organizationId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  const now = new Date().toISOString();
  const rows = defaultWorkflows.map((workflow) => ({
    organization_id: organizationId,
    name: workflow.name,
    trigger_type: workflow.triggerType,
    action_type: workflow.actionType,
    destination: workflow.destination,
    enabled: workflow.enabled,
    config: workflow.config,
    updated_at: now
  }));

  await supabase.from("automation_workflows").upsert(rows, {
    onConflict: "organization_id,action_type,name"
  });
}

async function getWorkflowById(organizationId: string, workflowId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("automation_workflows")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", workflowId)
    .maybeSingle();

  return data ? mapWorkflow(data) : null;
}

async function getWorkflowByAction(organizationId: string, actionType: AutomationActionType) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("automation_workflows")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("action_type", actionType)
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();

  return data ? mapWorkflow(data) : null;
}

async function createRun(input: AutomationRequest, workflowId: string | null, status: AutomationRun["status"], output = {}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      data: null,
      error: new Error("Supabase is not configured.")
    };
  }

  return supabase
    .from("automation_runs")
    .insert({
      organization_id: input.organizationId,
      workflow_id: workflowId,
      conversation_id: input.conversationId || null,
      message_id: input.messageId || null,
      action_type: input.actionType,
      status,
      input: input,
      output,
      completed_at: status === "running" || status === "queued" ? null : new Date().toISOString()
    })
    .select("*")
    .single();
}

async function createSupportTicket(input: AutomationRequest, runId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      organization_id: input.organizationId,
      conversation_id: input.conversationId || null,
      message_id: input.messageId || null,
      customer_name: input.customerName || null,
      customer_email: input.customerEmail || null,
      subject: input.subject || "AI support escalation",
      description: input.description || input.reason || "AI requested human follow-up.",
      status: "open",
      priority: input.priority || "normal",
      intent: input.intent || null,
      assigned_queue: input.assignedQueue || "support",
      metadata: {
        runId,
        reason: input.reason || null,
        payload: input.payload || {}
      }
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "Unable to create support ticket.");

  return {
    ticketId: data.id,
    status: "open",
    assignedQueue: data.assigned_queue
  };
}

async function createRefundReview(input: AutomationRequest, runId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const destinations = getAutomationDestinations();

  const { data, error } = await supabase
    .from("refund_requests")
    .insert({
      organization_id: input.organizationId,
      conversation_id: input.conversationId || null,
      reason: input.reason || input.description || "Refund review requested by AI.",
      status: "pending_review",
      metadata: {
        runId,
        customerName: input.customerName || null,
        customerEmail: input.customerEmail || null,
        payload: input.payload || {}
      }
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "Unable to create refund review.");

  const webhookOutput = await dispatchToUrl({
    organizationId: input.organizationId,
    runId,
    channel: "webhook",
    destination: "Refund workflow",
    url: destinations.refund,
    payload: {
      refundRequestId: data.id,
      reason: data.reason,
      customerName: input.customerName || null,
      customerEmail: input.customerEmail || null,
      payload: input.payload || {}
    }
  });

  return {
    refundRequestId: data.id,
    status: "pending_review",
    workflow: webhookOutput
  };
}

async function dispatchNotification(input: AutomationRequest, runId: string, destination: string) {
  const destinations = getAutomationDestinations();
  const urls: Record<AutomationActionType, { url: string; channel: "make" | "webhook" | "slack" | "discord" | "email" }> = {
    make_workflow: { url: destinations.make, channel: "make" },
    webhook: { url: destinations.webhook, channel: "webhook" },
    ticket_create: { url: "", channel: "webhook" },
    refund_workflow: { url: destinations.refund, channel: "webhook" },
    slack_notify: { url: destinations.slack, channel: "slack" },
    discord_notify: { url: destinations.discord, channel: "discord" },
    email_notify: { url: destinations.email, channel: "email" }
  };

  const target = urls[input.actionType];
  const payload = formatNotificationPayload(input, destination);

  return dispatchToUrl({
    organizationId: input.organizationId,
    runId,
    channel: target.channel,
    destination,
    url: target.url,
    payload
  });
}

async function dispatchToUrl(input: {
  organizationId: string;
  runId: string;
  channel: "make" | "webhook" | "slack" | "discord" | "email";
  destination: string;
  url: string;
  payload: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  if (serverEnv.automationDryRun || !input.url) {
    await supabase.from("notification_deliveries").insert({
      organization_id: input.organizationId,
      run_id: input.runId,
      channel: input.channel,
      status: "skipped",
      destination: input.destination,
      payload: input.payload,
      error: serverEnv.automationDryRun ? "Dry-run mode is enabled." : "No destination URL configured."
    });

    return {
      skipped: true,
      dryRun: serverEnv.automationDryRun,
      reason: serverEnv.automationDryRun ? "Dry-run mode is enabled." : "No destination URL configured.",
      channel: input.channel,
      destinationMode: serverEnv.demoMode ? "demo" : "client"
    };
  }

  const response = await fetchWithRetry(input.url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input.payload)
  });
  const responseBody = await response.text();
  const ok = response.ok;

  await supabase.from("notification_deliveries").insert({
    organization_id: input.organizationId,
    run_id: input.runId,
    channel: input.channel,
    status: ok ? "succeeded" : "failed",
    destination: input.destination,
    payload: input.payload,
    response_status: response.status,
    response_body: responseBody.slice(0, 2000),
    error: ok ? null : humanizeErrorMessage(responseBody.slice(0, 500))
  });

  if (!ok) throw new Error(humanizeErrorMessage(`${input.channel} delivery failed with status ${response.status}.`));

  return {
    skipped: false,
    channel: input.channel,
    destinationMode: serverEnv.demoMode ? "demo" : "client",
    responseStatus: response.status
  };
}

function getAutomationDestinations() {
  if (serverEnv.demoMode) {
    return {
      make: serverEnv.demoMakeWebhookUrl || serverEnv.makeWebhookUrl,
      webhook: serverEnv.demoGenericWebhookUrl || serverEnv.genericWebhookUrl,
      refund: serverEnv.demoRefundWorkflowWebhookUrl || serverEnv.refundWorkflowWebhookUrl,
      slack: serverEnv.demoSlackWebhookUrl || serverEnv.slackWebhookUrl,
      discord: serverEnv.demoDiscordWebhookUrl || serverEnv.discordWebhookUrl,
      email: serverEnv.demoEmailWebhookUrl || serverEnv.emailWebhookUrl
    };
  }

  return {
    make: serverEnv.makeWebhookUrl,
    webhook: serverEnv.genericWebhookUrl,
    refund: serverEnv.refundWorkflowWebhookUrl,
    slack: serverEnv.slackWebhookUrl,
    discord: serverEnv.discordWebhookUrl,
    email: serverEnv.emailWebhookUrl
  };
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal
      });

      if (response.ok || response.status < 500 || attempt === attempts) return response;
      lastError = new Error(`Webhook returned ${response.status}.`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 450));
  }

  throw new Error(humanizeErrorMessage(lastError instanceof Error ? lastError.message : "Webhook request failed."));
}

async function logWorkflow(
  organizationId: string,
  runId: string | null,
  level: WorkflowLog["level"],
  message: string,
  metadata: Record<string, unknown>
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  await supabase.from("workflow_logs").insert({
    organization_id: organizationId,
    run_id: runId,
    level,
    message,
    metadata
  });
}

function formatNotificationPayload(input: AutomationRequest, destination: string) {
  const base = {
    subject: input.subject || "SupportFlow AI automation",
    description: input.description || input.reason || "Automation requested.",
    priority: input.priority || "normal",
    intent: input.intent || null,
    customerName: input.customerName || null,
    customerEmail: input.customerEmail || null,
    conversationId: input.conversationId || null,
    messageId: input.messageId || null,
    destination,
    payload: input.payload || {}
  };

  if (input.actionType === "slack_notify") {
    return {
      text: `${base.subject}\nPriority: ${base.priority}\n${base.description}`,
      ...base
    };
  }

  if (input.actionType === "discord_notify") {
    return {
      content: `${base.subject}\nPriority: ${base.priority}\n${base.description}`,
      ...base
    };
  }

  return base;
}

function mapEscalationPriority(severity: EscalationDecision["severity"]): AutomationRequest["priority"] {
  if (severity === "Urgent") return "urgent";
  if (severity === "High") return "high";
  if (severity === "Medium") return "normal";
  return "low";
}

function mapWorkflow(row: Record<string, any>): AutomationWorkflow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    triggerType: row.trigger_type,
    actionType: row.action_type,
    destination: row.destination,
    enabled: row.enabled,
    config: row.config || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRun(row: Record<string, any>): AutomationRun {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workflowId: row.workflow_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    actionType: row.action_type,
    status: row.status,
    input: row.input || {},
    output: row.output || {},
    error: row.error,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

function mapLog(row: Record<string, any>): WorkflowLog {
  return {
    id: row.id,
    organizationId: row.organization_id,
    runId: row.run_id,
    level: row.level,
    message: row.message,
    metadata: row.metadata || {},
    createdAt: row.created_at
  };
}

function mapTicket(row: Record<string, any>): SupportTicket {
  return {
    id: row.id,
    organizationId: row.organization_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    subject: row.subject,
    description: row.description,
    status: row.status,
    priority: row.priority,
    intent: row.intent,
    assignedQueue: row.assigned_queue,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRefund(row: Record<string, any>): RefundRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    ticketId: row.ticket_id,
    conversationId: row.conversation_id,
    amount: row.amount,
    currency: row.currency,
    reason: row.reason,
    status: row.status,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function runtimeError(error: { code: string; message: string } | null) {
  return {
    ok: false as const,
    status: 503,
    error: error || {
      code: "automation_not_configured",
      message: "Automation Engine is not configured."
    }
  };
}

function automationError(code: string, message: string, status = 500) {
  return {
    ok: false as const,
    status,
    error: {
      code,
      message
    }
  };
}
