"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Bot, DollarSign, Gauge, Layers3, MessageCircle, RefreshCw, Sparkles, TrendingUp, Workflow } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { useOrganization } from "@/lib/org";

type Metric = {
  label: string;
  value: string;
  detail: string;
  tone: "default" | "success" | "warning";
};

type Insight = {
  label: string;
  value: number;
  detail: string;
};

type ExecutiveDashboard = {
  metrics: Metric[];
  sentiment: Insight[];
  commonIssues: Insight[];
  knowledgeGaps: Insight[];
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

export default function AnalyticsPage() {
  const { activeOrganization } = useOrganization();
  const [dashboard, setDashboard] = useState<ExecutiveDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/executive-intelligence?organizationId=${activeOrganization.id}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Executive Intelligence failed to load.");
      setDashboard(json);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Executive Intelligence failed to load.");
    } finally {
      setLoading(false);
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
          <span className="eyebrow">Executive Intelligence</span>
          <h1>Founder dashboard</h1>
          <p>
            The operating view for support leverage: AI resolution, escalations,
            volume, sentiment, knowledge health, automation success, savings, and gaps.
          </p>
        </div>
        <button className="button secondary" onClick={loadDashboard} disabled={loading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid executive-grid">
        {(dashboard?.metrics || fallbackMetrics()).map((metric) => (
          <StatCard
            detail={loading ? "Loading live data..." : metric.detail}
            key={metric.label}
            label={metric.label}
            tone={metric.tone}
            value={loading ? "..." : metric.value}
          />
        ))}
      </div>

      <section className="executive-layout">
        <div className="card executive-hero-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Founder Signal</span>
              <h2>Is support getting cheaper and smarter?</h2>
            </div>
            <Sparkles color="var(--accent)" size={20} />
          </div>
          <div className="founder-signal">
            <div>
              <span>Estimated monthly savings</span>
              <strong>${(dashboard?.savings.estimatedMonthlySavings || 0).toLocaleString()}</strong>
              <p className="muted">Based on AI resolutions, successful automations, and AI-assisted support turns.</p>
            </div>
            <div className="signal-bars">
              <SignalBar label="Knowledge" value={dashboard?.knowledgeCoverage.score || 0} />
              <SignalBar label="Automation" value={dashboard?.automation.successRate || 0} />
              <SignalBar label="Coverage" value={dashboard?.knowledgeCoverage.categories ? Math.min(100, dashboard.knowledgeCoverage.categories * 14) : 0} />
            </div>
          </div>
          <ul className="compact-bullets">
            {(dashboard?.savings.assumptions || []).map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>

        <Panel icon={<MessageCircle size={18} />} title="Common Issues" eyebrow="Demand">
          <InsightList emptyLabel="No issue data yet" insights={dashboard?.commonIssues || []} />
        </Panel>
      </section>

      <section className="grid cols-3">
        <Panel icon={<Gauge size={18} />} title="Customer Sentiment" eyebrow="Experience">
          <InsightList emptyLabel="No sentiment data yet" insights={dashboard?.sentiment || []} />
        </Panel>

        <Panel icon={<AlertTriangle size={18} />} title="Knowledge Gaps" eyebrow="Risk">
          <InsightList emptyLabel="No low-confidence gaps found" insights={dashboard?.knowledgeGaps || []} />
        </Panel>

        <Panel icon={<Workflow size={18} />} title="Automation Health" eyebrow="Work Done">
          <div className="executive-mini-stats">
            <MiniStat icon={<Bot size={16} />} label="Successful" value={dashboard?.automation.successfulRuns || 0} />
            <MiniStat icon={<AlertTriangle size={16} />} label="Failed" value={dashboard?.automation.failedRuns || 0} />
            <MiniStat icon={<TrendingUp size={16} />} label="Success Rate" value={`${dashboard?.automation.successRate || 0}%`} />
          </div>
        </Panel>
      </section>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <Panel icon={<Layers3 size={18} />} title="Knowledge Coverage" eyebrow="Company Brain">
          <div className="coverage-card">
            <div className="meter">
              <span style={{ width: `${dashboard?.knowledgeCoverage.score || 0}%` }} />
            </div>
            <div className="executive-mini-stats">
              <MiniStat icon={<FileIcon />} label="Documents" value={dashboard?.knowledgeCoverage.documents || 0} />
              <MiniStat icon={<Layers3 size={16} />} label="Chunks" value={dashboard?.knowledgeCoverage.chunks || 0} />
              <MiniStat icon={<Gauge size={16} />} label="Categories" value={dashboard?.knowledgeCoverage.categories || 0} />
            </div>
            <p className="muted">{dashboard?.knowledgeCoverage.detail || "No indexed knowledge yet."}</p>
          </div>
        </Panel>

        <Panel icon={<DollarSign size={18} />} title="Savings Model" eyebrow="ROI">
          <div className="roi-card">
            <strong>${(dashboard?.savings.estimatedMonthlySavings || 0).toLocaleString()}</strong>
            <span className="muted">estimated monthly support cost avoided</span>
          </div>
          <ul className="compact-bullets">
            {(dashboard?.savings.assumptions || []).map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </Panel>
      </section>
    </>
  );
}

function Panel({ eyebrow, title, icon, children }: { eyebrow: string; title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <span className="panel-icon">{icon}</span>
      </div>
      {children}
    </div>
  );
}

function InsightList({ insights, emptyLabel }: { insights: Insight[]; emptyLabel: string }) {
  if (!insights.length) return <div className="empty-state">{emptyLabel}</div>;

  const max = Math.max(...insights.map((insight) => insight.value), 1);

  return (
    <div className="insight-list">
      {insights.map((insight) => (
        <div className="insight-row" key={insight.label}>
          <div>
            <strong>{insight.label}</strong>
            <span className="muted">{insight.detail}</span>
          </div>
          <div className="insight-value">
            <span>{insight.value}</span>
            <div className="meter">
              <span style={{ width: `${Math.round((insight.value / max) * 100)}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="mini-stat">
      {icon}
      <div>
        <span className="muted">{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function SignalBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="signal-bar">
      <div>
        <strong>{label}</strong>
        <span>{value}%</span>
      </div>
      <div className="meter">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function FileIcon() {
  return <Layers3 size={16} />;
}

function fallbackMetrics(): Metric[] {
  return [
    { label: "AI Resolution", value: "0%", detail: "No live data yet", tone: "default" },
    { label: "Escalation", value: "0%", detail: "No live data yet", tone: "default" },
    { label: "Support Volume", value: "0", detail: "No live data yet", tone: "default" },
    { label: "Knowledge Coverage", value: "0%", detail: "No live data yet", tone: "default" },
    { label: "Automation Success", value: "0%", detail: "No live data yet", tone: "default" },
    { label: "Estimated Savings", value: "$0", detail: "No live data yet", tone: "default" },
    { label: "Tickets Created", value: "0", detail: "No live data yet", tone: "default" }
  ];
}
