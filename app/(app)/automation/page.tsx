"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Bell, Bot, CheckCircle2, ExternalLink, FileCheck2, Mail, Play, RefreshCw, Ticket, Workflow } from "lucide-react";
import { useOrganization } from "@/lib/org";
import type { AutomationActionType } from "@/lib/automation-engine";

type WorkflowRow = {
  id: string;
  name: string;
  triggerType: string;
  actionType: AutomationActionType;
  destination: string;
  enabled: boolean;
};

type RunRow = {
  id: string;
  actionType: AutomationActionType;
  status: "queued" | "running" | "succeeded" | "failed" | "skipped";
  error: string | null;
  createdAt: string;
};

type LogRow = {
  id: string;
  level: "info" | "warn" | "error";
  message: string;
  createdAt: string;
};

type TicketRow = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  assignedQueue: string;
  createdAt: string;
};

type RefundRow = {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
};

type DashboardData = {
  runtime: {
    demoMode: boolean;
    destinationMode: "demo" | "client";
    dryRun: boolean;
    integrations: Record<string, boolean>;
    demoIntegrations: Record<string, boolean>;
    clientIntegrations: Record<string, boolean>;
  };
  workflows: WorkflowRow[];
  runs: RunRow[];
  logs: LogRow[];
  tickets: TicketRow[];
  refunds: RefundRow[];
};

export default function AutomationPage() {
  const { activeOrganization } = useOrganization();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabledCount = useMemo(() => data?.workflows.filter((workflow) => workflow.enabled).length || 0, [data]);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/automation/dashboard?organizationId=${activeOrganization.id}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Automation dashboard failed to load.");
      setData(json);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Automation dashboard failed to load.");
    } finally {
      setLoading(false);
    }
  }

  async function runWorkflow(workflow: WorkflowRow) {
    setRunningId(workflow.id);
    setError(null);
    try {
      const response = await fetch("/api/automation/run", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          organizationId: activeOrganization.id,
          workflowId: workflow.id,
          actionType: workflow.actionType,
          reason: "Manual automation test from the dashboard.",
          customerName: "Demo Customer",
          customerEmail: "customer@example.com",
          subject: `Test: ${workflow.name}`,
          description: "Nexamind automation test run.",
          priority: "normal",
          intent: "Automation Test",
          assignedQueue: "support",
          payload: {
            source: "automation_dashboard",
            organizationName: activeOrganization.name
          }
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Automation test failed.");
      await loadDashboard();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Automation test failed.");
    } finally {
      setRunningId(null);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganization.id]);

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">Automation Engine</span>
          <h1>Work the AI can complete</h1>
          <p>
            Connect AI decisions to tickets, refund reviews, Make.com scenarios,
            webhooks, Slack, Discord, and email notifications.
          </p>
        </div>
        <button className="button secondary" onClick={loadDashboard} disabled={loading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="grid cols-2">
        <div className="card metric-card">
          <span className="eyebrow">Workflows</span>
          <strong>{loading ? "..." : enabledCount}</strong>
          <span className="muted">enabled automation paths</span>
        </div>
        <div className="card metric-card">
          <span className="eyebrow">Delivery</span>
          <strong>{data?.runtime.dryRun ? "Dry-run" : "Live"}</strong>
          <span className="muted">
            {data?.runtime.dryRun ? "External sends are logged, not delivered" : "Configured integrations can send"}
          </span>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Demo Infrastructure</span>
            <h2>{data?.runtime.demoMode ? "Using your demo accounts" : "Using client-owned accounts"}</h2>
          </div>
          <span className={data?.runtime.demoMode ? "badge success" : "badge"}>
            {data?.runtime.destinationMode || "demo"} mode
          </span>
        </div>
        <p className="muted">
          Demo Mode routes Make.com, Slack, Discord, email, refund, and webhook actions to your owned demo
          infrastructure. Turn it off when a customer should use their own credentials.
        </p>
        <div className="integration-grid">
          <IntegrationStatus label="Demo Make.com" ready={Boolean(data?.runtime.demoIntegrations.make)} icon={<Bot size={18} />} />
          <IntegrationStatus label="Demo Slack" ready={Boolean(data?.runtime.demoIntegrations.slack)} icon={<Bell size={18} />} />
          <IntegrationStatus label="Demo Discord" ready={Boolean(data?.runtime.demoIntegrations.discord)} icon={<Bell size={18} />} />
          <IntegrationStatus label="Demo Email" ready={Boolean(data?.runtime.demoIntegrations.email)} icon={<Mail size={18} />} />
          <IntegrationStatus label="Client Make.com" ready={Boolean(data?.runtime.clientIntegrations.make)} icon={<Bot size={18} />} />
          <IntegrationStatus label="Client Webhook" ready={Boolean(data?.runtime.clientIntegrations.webhook)} icon={<Workflow size={18} />} />
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Workflow Registry</span>
            <h2>Actions the AI can take</h2>
          </div>
          <span className="badge">{data?.workflows.length || 0} total</span>
        </div>

        <div className="list">
          {(data?.workflows || []).map((workflow) => (
            <div className="list-row" key={workflow.id}>
              <div style={{ display: "flex", gap: 12 }}>
                <Workflow color="var(--accent)" size={20} />
                <div>
                  <strong>{workflow.name}</strong>
                  <span className="muted">
                    {workflow.triggerType} · {workflow.destination}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={workflow.enabled ? "badge success" : "badge"}>
                  {workflow.enabled ? "Enabled" : "Disabled"}
                </span>
                <button
                  className="icon-button"
                  onClick={() => runWorkflow(workflow)}
                  disabled={runningId === workflow.id}
                  title="Run test"
                >
                  <Play size={16} />
                </button>
              </div>
            </div>
          ))}
          {!loading && !data?.workflows.length ? <EmptyState label="No workflows yet" /> : null}
        </div>
      </section>

      <section className="grid cols-2">
        <div className="card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Tickets</span>
              <h2>Human work created</h2>
            </div>
            <Ticket size={18} color="var(--accent)" />
          </div>
          <CompactList
            rows={(data?.tickets || []).map((ticket) => ({
              id: ticket.id,
              title: ticket.subject,
              detail: `${ticket.priority} · ${ticket.assignedQueue}`,
              badge: ticket.status
            }))}
            emptyLabel="No tickets yet"
          />
        </div>

        <div className="card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Refund Workflow</span>
              <h2>Finance reviews</h2>
            </div>
            <FileCheck2 size={18} color="var(--accent)" />
          </div>
          <CompactList
            rows={(data?.refunds || []).map((refund) => ({
              id: refund.id,
              title: refund.reason,
              detail: formatTime(refund.createdAt),
              badge: refund.status
            }))}
            emptyLabel="No refund reviews yet"
          />
        </div>
      </section>

      <section className="grid cols-2">
        <div className="card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Recent Runs</span>
              <h2>Execution history</h2>
            </div>
            <CheckCircle2 size={18} color="var(--accent)" />
          </div>
          <CompactList
            rows={(data?.runs || []).map((run) => ({
              id: run.id,
              title: labelAction(run.actionType),
              detail: run.error || formatTime(run.createdAt),
              badge: run.status
            }))}
            emptyLabel="No runs yet"
          />
        </div>

        <div className="card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Integrations</span>
              <h2>Delivery channels</h2>
            </div>
            <ExternalLink size={18} color="var(--accent)" />
          </div>
          <div className="integration-grid">
            <IntegrationStatus label="Make.com" ready={Boolean(data?.runtime.integrations.make)} icon={<Bot size={18} />} />
            <IntegrationStatus label="Webhook" ready={Boolean(data?.runtime.integrations.webhook)} icon={<Workflow size={18} />} />
            <IntegrationStatus label="Slack" ready={Boolean(data?.runtime.integrations.slack)} icon={<Bell size={18} />} />
            <IntegrationStatus label="Discord" ready={Boolean(data?.runtime.integrations.discord)} icon={<Bell size={18} />} />
            <IntegrationStatus label="Email" ready={Boolean(data?.runtime.integrations.email)} icon={<Mail size={18} />} />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Workflow Logs</span>
            <h2>Audit trail</h2>
          </div>
          <span className="badge">{data?.logs.length || 0} entries</span>
        </div>
        <div className="timeline">
          {(data?.logs || []).map((log) => (
            <div className="timeline-item" key={log.id}>
              <span className={`status-dot ${log.level}`} />
              <div>
                <strong>{log.message}</strong>
                <span className="muted">{formatTime(log.createdAt)}</span>
              </div>
            </div>
          ))}
          {!loading && !data?.logs.length ? <EmptyState label="No logs yet" /> : null}
        </div>
      </section>
    </>
  );
}

function CompactList({
  rows,
  emptyLabel
}: {
  rows: Array<{ id: string; title: string; detail: string; badge: string }>;
  emptyLabel: string;
}) {
  if (!rows.length) return <EmptyState label={emptyLabel} />;

  return (
    <div className="list compact-list">
      {rows.slice(0, 6).map((row) => (
        <div className="list-row" key={row.id}>
          <div>
            <strong>{row.title}</strong>
            <span className="muted">{row.detail}</span>
          </div>
          <span className="badge">{row.badge}</span>
        </div>
      ))}
    </div>
  );
}

function IntegrationStatus({ label, ready, icon }: { label: string; ready: boolean; icon: ReactNode }) {
  return (
    <div className="integration-pill">
      {icon}
      <div>
        <strong>{label}</strong>
        <span className={ready ? "badge success" : "badge"}>{ready ? "Configured" : "Waiting"}</span>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="empty-state">{label}</div>;
}

function labelAction(action: AutomationActionType) {
  return action
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
