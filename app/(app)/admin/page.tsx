"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Building2, Coins, DatabaseZap, Gauge, RefreshCw, ServerCrash, Sparkles } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { isPlatformAdmin, useAuth } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AdminDashboard = {
  totals: {
    companies: number;
    crawlJobs: number;
    failedBuilds: number;
    conversations: number;
    messages: number;
    totalTokens: number;
    estimatedOpenAiCost: number;
  };
  companies: Array<{
    id: string;
    name: string;
    website: string;
    createdAt: string;
    crawlJobs: number;
    conversations: number;
    messages: number;
    estimatedOpenAiCost: number;
    status: "healthy" | "building" | "attention";
  }>;
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

export default function AdminPanelPage() {
  const { user } = useAuth();
  const allowed = isPlatformAdmin(user);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const sortedCompanies = useMemo(
    () => [...(dashboard?.companies || [])].sort((a, b) => b.messages - a.messages),
    [dashboard]
  );

  async function loadAdmin() {
    setLoading(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const response = await fetch("/api/admin/dashboard", {
        headers: session?.access_token
          ? {
              authorization: `Bearer ${session.access_token}`
            }
          : {}
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Admin Panel failed to load.");
      setDashboard(json);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Admin Panel failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (allowed) void loadAdmin();
  }, [allowed]);

  if (!allowed) {
    return (
      <div className="access-denied-card">
        <span className="eyebrow">Owner Dashboard</span>
        <h1>This area is for Nexamind admins</h1>
        <p className="muted">
          Tenant users only see their company dashboard, support stats, Company Brain,
          conversations, automations, and settings.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">Admin Panel</span>
          <h1>Operator view for Nexamind</h1>
          <p>
            See every company, workspace build, crawl job, failed build, API usage, and
            estimated OpenAI spend from one internal control room.
          </p>
        </div>
        <button className="button secondary" onClick={loadAdmin} disabled={loading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="grid cols-4">
        <StatCard label="Companies" value={loading ? "..." : String(dashboard?.totals.companies || 0)} detail="customer workspaces" tone="success" />
        <StatCard label="Crawl Jobs" value={loading ? "..." : String(dashboard?.totals.crawlJobs || 0)} detail="website builds started" />
        <StatCard label="Failed Builds" value={loading ? "..." : String(dashboard?.totals.failedBuilds || 0)} detail="need attention" tone={dashboard?.totals.failedBuilds ? "warning" : "success"} />
        <StatCard label="OpenAI Cost" value={loading ? "..." : `$${(dashboard?.totals.estimatedOpenAiCost || 0).toFixed(2)}`} detail={`${(dashboard?.totals.totalTokens || 0).toLocaleString()} tracked tokens`} />
      </section>

      <section className="admin-command-grid" style={{ marginTop: 16 }}>
        <div className="card admin-hero-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">All Companies</span>
              <h2>Customer workspaces</h2>
            </div>
            <Building2 color="var(--accent)" size={20} />
          </div>
          <div className="admin-company-list">
            {sortedCompanies.map((company) => (
              <article className="admin-company-row" key={company.id}>
                <div>
                  <strong>{company.name}</strong>
                  <span className="muted">{company.website || company.id}</span>
                </div>
                <div className="admin-company-metrics">
                  <span>{company.crawlJobs} builds</span>
                  <span>{company.conversations} chats</span>
                  <span>{company.messages} messages</span>
                  <span>${company.estimatedOpenAiCost.toFixed(2)}</span>
                </div>
                <span className={company.status === "healthy" ? "badge success" : company.status === "building" ? "badge" : "badge warning"}>
                  {company.status}
                </span>
              </article>
            ))}
            {!loading && !sortedCompanies.length ? (
              <div className="empty-state">
                <strong>No companies yet.</strong>
                <span>Build a workspace from AI Workspace Builder to populate this panel.</span>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="card admin-usage-card">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">API Usage</span>
              <h2>Cost signals</h2>
            </div>
            <Coins color="var(--accent)" size={20} />
          </div>
          <div className="metric-stack">
            <AdminMetric icon={<Sparkles size={17} />} label="Assistant messages" value={String(dashboard?.apiUsage.assistantMessages || 0)} />
            <AdminMetric icon={<DatabaseZap size={17} />} label="Tracked tokens" value={(dashboard?.apiUsage.totalTokens || 0).toLocaleString()} />
            <AdminMetric icon={<Gauge size={17} />} label="Average latency" value={`${dashboard?.apiUsage.averageLatencyMs || 0}ms`} />
            <AdminMetric icon={<Coins size={17} />} label="Estimated OpenAI" value={`$${(dashboard?.apiUsage.estimatedOpenAiCost || 0).toFixed(2)}`} />
          </div>
        </aside>
      </section>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Builds</span>
              <h2>Recent crawl jobs</h2>
            </div>
            <DatabaseZap color="var(--accent)" size={20} />
          </div>
          <div className="admin-build-list">
            {(dashboard?.recentBuilds || []).map((build) => (
              <div className="admin-build-row" key={build.id}>
                <div>
                  <strong>{build.companyName}</strong>
                  <span className="muted">{build.website}</span>
                </div>
                <span>{build.pagesIndexed} pages</span>
                <span className={build.status === "failed" ? "badge warning" : build.status === "succeeded" ? "badge success" : "badge"}>{build.status}</span>
              </div>
            ))}
            {!loading && !dashboard?.recentBuilds.length ? <div className="empty-state">No crawl jobs yet.</div> : null}
          </div>
        </div>

        <div className="card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Failures</span>
              <h2>Failed builds</h2>
            </div>
            {dashboard?.failedBuilds.length ? <AlertTriangle color="var(--warning)" size={20} /> : <ServerCrash color="var(--accent)" size={20} />}
          </div>
          <div className="admin-build-list">
            {(dashboard?.failedBuilds || []).map((build) => (
              <div className="admin-failure-row" key={build.id}>
                <strong>{build.companyName}</strong>
                <span className="muted">{build.website}</span>
                <p>{build.error}</p>
              </div>
            ))}
            {!loading && !dashboard?.failedBuilds.length ? (
              <div className="empty-state">
                <strong>No failed builds.</strong>
                <span>Everything looks healthy right now.</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}

function AdminMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
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
