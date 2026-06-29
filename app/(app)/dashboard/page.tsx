"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowUpRight,
  Clock3,
  MessageSquareText,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import {
  demoConversations,
  demoKnowledgeSources,
  demoWorkflows,
} from "@/lib/demo-data";
import { useOrganization } from "@/lib/org";

type ExecutiveMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "default" | "success" | "warning";
};

type ExecutiveDashboard = {
  metrics: ExecutiveMetric[];
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

export default function DashboardPage() {
  const { activeOrganization } = useOrganization();
  const [executiveDashboard, setExecutiveDashboard] = useState<ExecutiveDashboard | null>(null);
  const [dashboardStatus, setDashboardStatus] = useState<"loading" | "live" | "fallback">("loading");
  const [conversationSearch, setConversationSearch] = useState("");
  const conversations = demoConversations.filter(
    (conversation) => conversation.organizationId === activeOrganization.id
  );
  const docs = demoKnowledgeSources.filter((doc) => doc.organizationId === activeOrganization.id);
  const workflows = demoWorkflows.filter((workflow) => workflow.organizationId === activeOrganization.id);
  const escalated = conversations.filter((conversation) => conversation.status === "Escalated").length;
  const resolved = conversations.filter((conversation) => conversation.status === "Resolved").length;
  const enabledWorkflows = workflows.filter((workflow) => workflow.enabled).length;
  const fallbackAiResolution = Math.round((resolved / Math.max(conversations.length, 1)) * 100);
  const fallbackEscalation = Math.round((escalated / Math.max(conversations.length, 1)) * 100);
  const fallbackAutomation = Math.round((enabledWorkflows / Math.max(workflows.length, 1)) * 100);
  const fallbackKnowledge = Math.min(100, Math.round((docs.reduce((sum, doc) => sum + doc.chunks, 0) / 60) * 100));

  useEffect(() => {
    let cancelled = false;

    async function loadExecutiveDashboard() {
      setDashboardStatus("loading");
      try {
        const response = await fetch(`/api/executive-intelligence?organizationId=${activeOrganization.id}`);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error?.message || "Executive Intelligence failed to load.");
        if (!cancelled) {
          setExecutiveDashboard(json);
          setDashboardStatus("live");
        }
      } catch {
        if (!cancelled) {
          setExecutiveDashboard(null);
          setDashboardStatus("fallback");
        }
      }
    }

    loadExecutiveDashboard();

    return () => {
      cancelled = true;
    };
  }, [activeOrganization.id]);

  const metricMap = useMemo(() => {
    return new Map((executiveDashboard?.metrics || []).map((metric) => [metric.label, metric]));
  }, [executiveDashboard]);

  const chartBars = useMemo(() => {
    const base = Math.max(conversations.length, 1);
    return Array.from({ length: 12 }, (_, index) => {
      const wave = [0.52, 0.64, 0.58, 0.76, 0.88, 0.7, 0.94, 1, 0.82, 0.92, 0.72, 0.8][index];
      return Math.max(18, Math.round((base * 18 + docs.length * 8 + enabledWorkflows * 10) * wave));
    });
  }, [conversations.length, docs.length, enabledWorkflows]);

  const supportRows = conversations.map((conversation) => ({
    conversationId: conversation.id,
    id: conversation.id.replace("conv_", "#"),
    customer: conversation.customer,
    issue: conversation.subject,
    intent: conversation.intent,
    sentiment: conversation.sentiment,
    priority: conversation.priority,
    status: conversation.status
  }));
  const filteredSupportRows = supportRows.filter((row) =>
    [row.customer, row.issue, row.intent, row.sentiment, row.status, row.id]
      .join(" ")
      .toLowerCase()
      .includes(conversationSearch.toLowerCase())
  );

  const supportVolume = metricMap.get("Support Volume")?.value || String(conversations.length);
  const aiResolution = metricMap.get("AI Resolution")?.value || `${fallbackAiResolution}%`;
  const escalationRate = metricMap.get("Escalation")?.value || `${fallbackEscalation}%`;
  const automationSuccess = metricMap.get("Automation Success")?.value || `${fallbackAutomation}%`;
  const knowledgeCoverage = metricMap.get("Knowledge Coverage")?.value || `${fallbackKnowledge}%`;
  const estimatedSavings = metricMap.get("Estimated Savings")?.value || "$0";
  const ticketsCreated = metricMap.get("Tickets Created")?.value || String(escalated);
  const confidenceSignal = dashboardStatus === "live" ? "Measured" : "Demo";

  return (
    <>
      <div className="dashboard-hero-title">
        <div>
          <span className="eyebrow">Command Center</span>
          <h1>Welcome back, {activeOrganization.name}</h1>
          <p>
            Your live operating view for AI support: volume, resolution, escalation,
            knowledge coverage, automation performance, and savings.
          </p>
        </div>
        <div className="topbar-actions">
          <Link className="button" href="/company-brain">
            Build Company Brain
          </Link>
          <span className={dashboardStatus === "live" ? "badge success" : "badge warning"}>
            {dashboardStatus === "loading" ? "Loading analytics" : dashboardStatus === "live" ? "Live analytics" : "Demo fallback"}
          </span>
        </div>
      </div>

      <section className="dashboard-showcase">
        <div className="card revenue-card">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">Support Volume</span>
              <h2>Conversation trend</h2>
            </div>
            <Link className="badge success" href="/analytics">View analytics</Link>
          </div>
          <div className="chart-tabs">
            <Link href="/support-chat">Conversations</Link>
            <Link href="/analytics">Resolution</Link>
          </div>
          <div className="animated-chart" aria-label="Support volume by month">
            {chartBars.map((height, index) => (
              <span
                className={index === 9 ? "is-active" : ""}
                key={index}
                style={{ "--bar-height": `${height}px`, animationDelay: `${index * 70}ms` } as CSSProperties}
              />
            ))}
            <div className="chart-tooltip">
              <span>30-day volume</span>
              <strong>{supportVolume} conversations</strong>
            </div>
          </div>
          <div className="chart-months">
            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month) => (
              <span key={month}>{month}</span>
            ))}
          </div>
        </div>

        <div className="dashboard-metric-grid">
          <MetricTile href="/support-chat" icon={<MessageSquareText size={16} />} label="Support Volume" value={supportVolume} delta={metricMap.get("Support Volume")?.detail || "Conversations in scope"} />
          <MetricTile href="/analytics" icon={<ShieldCheck size={16} />} label="AI Resolution" value={aiResolution} delta={metricMap.get("AI Resolution")?.detail || "Resolved by AI"} />
          <MetricTile href="/inbox" icon={<Clock3 size={16} />} label="Escalation Rate" value={escalationRate} delta={metricMap.get("Escalation")?.detail || `${escalated} active escalation${escalated === 1 ? "" : "s"}`} tone={escalated ? "warning" : "success"} />
          <MetricTile href="/automation" icon={<Workflow size={16} />} label="Automation Success" value={automationSuccess} delta={metricMap.get("Automation Success")?.detail || `${enabledWorkflows} enabled workflow${enabledWorkflows === 1 ? "" : "s"}`} />
        </div>
      </section>

      <div className="grid cols-4 dashboard-kpi-strip">
        <StatCard detail={metricMap.get("Knowledge Coverage")?.detail || `${docs.length} sources, ${docs.reduce((sum, doc) => sum + doc.chunks, 0)} chunks`} label="Knowledge Coverage" value={knowledgeCoverage} />
        <StatCard detail="AI confidence and validation status" label="Quality Signal" tone={dashboardStatus === "live" ? "success" : "default"} value={confidenceSignal} />
        <StatCard detail={metricMap.get("Estimated Savings")?.detail || "Estimated support cost avoided"} label="Estimated Savings" tone="success" value={estimatedSavings} />
        <StatCard detail={metricMap.get("Tickets Created")?.detail || "Human work items from escalations"} label="Tickets Created" tone={escalated ? "warning" : "success"} value={ticketsCreated} />
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <section className="card">
          <h2>Knowledge readiness</h2>
          <p className="muted">
            Indexed sources that the AI can cite, retrieve, and inspect during support turns.
          </p>
          <div className="list">
            {docs.map((doc) => (
              <Link className="list-row clickable-row" href={`/knowledge?source=${encodeURIComponent(doc.id)}`} key={doc.id}>
                <div>
                  <strong>{doc.title}</strong>
                  <span className="muted">{doc.category} / {doc.chunks} chunks</span>
                </div>
                <span className={doc.status === "Ready" ? "badge success" : "badge warning"}>{doc.status}</span>
              </Link>
            ))}
            {!docs.length ? (
              <div className="empty-state">
                <strong>No indexed knowledge yet</strong>
                <p className="muted">Build the Company Brain to populate searchable sources and chunks.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="card">
          <h2>Automation readiness</h2>
          <p className="muted">
            Workflows that let the AI create tickets, notify teams, and route customer issues.
          </p>
          <div className="list">
            {workflows.map((workflow) => (
              <Link className="list-row clickable-row" href="/automation" key={workflow.id}>
                <div>
                  <strong>{workflow.name}</strong>
                  <span className="muted">{workflow.trigger} to {workflow.destination}</span>
                </div>
                <span className={workflow.enabled ? "badge success" : "badge"}>{workflow.enabled ? "Enabled" : "Paused"}</span>
              </Link>
            ))}
            <div className="list-row">
              <div>
                <strong>Workflow coverage</strong>
                <span className="muted">
                  {workflows.filter((workflow) => workflow.enabled).length} of {workflows.length}
                </span>
              </div>
              <div className="meter" style={{ width: 110 }}>
                <span
                  style={{
                    width: `${Math.round(
                      (workflows.filter((workflow) => workflow.enabled).length /
                        Math.max(workflows.length, 1)) *
                        100
                    )}%`
                  }}
                />
              </div>
            </div>
            {!workflows.length ? (
              <div className="empty-state">
                <strong>No workflows configured</strong>
                <p className="muted">Add automation paths before letting the AI complete customer tasks.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="card dashboard-table-card" style={{ marginTop: 16 }}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Customer Work</span>
            <h2>Recent support conversations</h2>
          </div>
          <div className="dashboard-table-actions">
            <input
              aria-label="Search recent support conversations"
              className="table-search"
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder="Search conversations..."
              value={conversationSearch}
            />
            <Link className="button secondary" href="/support-chat">
              <MessageSquareText size={16} />
              Open AI Chat
            </Link>
          </div>
        </div>
        <div className="premium-table">
          <div className="premium-table-head">
            <span>ID</span>
            <span>Customer</span>
            <span>Issue</span>
            <span>Intent</span>
            <span>Sentiment</span>
            <span>Status</span>
          </div>
          {filteredSupportRows.map((row, index) => (
            <Link
              className="premium-table-row clickable-table-row"
              href={`/support-chat?conversationId=${encodeURIComponent(row.conversationId)}`}
              key={row.id}
              style={{ animationDelay: `${index * 55}ms` }}
            >
              <span className="pill-id">{row.id}</span>
              <strong>{row.customer}</strong>
              <span>{row.issue}</span>
              <span>{row.intent}</span>
              <span>{row.sentiment}</span>
              <span className={row.status === "Escalated" ? "badge warning" : row.status === "Waiting" ? "badge" : "badge success"}>
                {row.status}
              </span>
            </Link>
          ))}
          {!filteredSupportRows.length ? (
            <div className="empty-state table-empty">
              <strong>{supportRows.length ? "No matching conversations" : "No support conversations yet"}</strong>
              <p className="muted">{supportRows.length ? "Try a customer, intent, status, or issue keyword." : "Ask the Company Brain a question to create the first measurable support turn."}</p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

function MetricTile({
  href,
  icon,
  label,
  value,
  delta,
  tone = "success"
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: string;
  delta: string;
  tone?: "success" | "warning";
}) {
  return (
    <Link className="metric-tile" href={href}>
      <span className="metric-icon">{icon}</span>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      <span className={tone === "success" ? "metric-delta success" : "metric-delta warning"}>
        {delta}
        <ArrowUpRight size={13} />
      </span>
    </Link>
  );
}
