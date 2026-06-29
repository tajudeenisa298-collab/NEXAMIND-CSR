"use client";

import { useEffect, useState } from "react";
import { CircleDollarSign, Clock, TrendingUp, Users } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { useOrganization } from "@/lib/org";

type Dashboard = {
  estimatedMonthlySavings: number;
  aiResolvedPercent: number;
  humanPercent: number;
  averageAiResponseSeconds: number;
  averageHumanMinutes: number;
  ticketsPrevented: number;
  estimatedHoursSaved: number;
  equivalentEmployees: number;
  supportCostBefore: number;
  supportCostAfter: number;
  roiPercent: number;
  assumptions: {
    monthlyTickets: number;
    averageResolutionMinutes: number;
    averageAgentHourlyCost: number;
    aiResolutionRate: number;
    aiCostPerConversation: number;
  };
  trend: Array<{ label: string; supportVolume: number; aiResolution: number; moneySaved: number; customerSatisfaction: number }>;
};

export default function BusinessImpactPage() {
  const { activeOrganization } = useOrganization();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/business-impact?organizationId=${activeOrganization.id}`);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error?.message || "Business Impact failed to load.");
        setDashboard(json);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Business Impact failed to load.");
      }
    }
    load();
  }, [activeOrganization.id]);

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">Business Impact</span>
          <h1>ROI dashboard founders care about</h1>
          <p>Estimated values based on configurable assumptions: tickets, handling time, labor cost, AI resolution, and AI operating cost.</p>
        </div>
        <span className="badge success">Estimated ROI</span>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="business-hero card">
        <span className="eyebrow">Estimated Monthly Savings</span>
        <strong>${(dashboard?.estimatedMonthlySavings || 0).toLocaleString()}</strong>
        <p className="muted">Labor hours avoided minus estimated AI operating cost.</p>
      </section>

      <div className="grid cols-3" style={{ marginTop: 16 }}>
        <StatCard label="AI Resolved" value={`${dashboard?.aiResolvedPercent || 0}%`} detail={`Human ${dashboard?.humanPercent || 0}%`} tone="success" />
        <StatCard label="Average Response" value={`${dashboard?.averageAiResponseSeconds || 0} sec`} detail={`Human: ${dashboard?.averageHumanMinutes || 0} min`} />
        <StatCard label="Tickets Prevented" value={(dashboard?.ticketsPrevented || 0).toLocaleString()} detail="estimated monthly prevented tickets" tone="success" />
        <StatCard label="Hours Saved" value={(dashboard?.estimatedHoursSaved || 0).toLocaleString()} detail="estimated agent hours saved" />
        <StatCard label="Employees Equivalent" value={String(dashboard?.equivalentEmployees || 0)} detail="full-time support capacity" />
        <StatCard label="ROI" value={`${dashboard?.roiPercent || 0}%`} detail="savings divided by after-AI cost" tone="success" />
      </div>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card cost-card">
          <div><span className="eyebrow">Before</span><strong>${(dashboard?.supportCostBefore || 0).toLocaleString()}</strong><span className="muted">Support cost before AI</span></div>
          <CircleDollarSign color="var(--warning)" size={28} />
        </div>
        <div className="card cost-card">
          <div><span className="eyebrow">After</span><strong>${(dashboard?.supportCostAfter || 0).toLocaleString()}</strong><span className="muted">Support cost after AI</span></div>
          <CircleDollarSign color="var(--accent)" size={28} />
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-heading">
          <div><span className="eyebrow">Trend</span><h2>Support volume, resolution, savings, satisfaction</h2></div>
          <TrendingUp color="var(--accent)" size={20} />
        </div>
        <div className="trend-grid">
          {(dashboard?.trend || []).map((point) => (
            <div className="trend-column" key={point.label}>
              <strong>{point.label}</strong>
              <TrendBar label="Volume" value={Math.min(100, Math.round(point.supportVolume / 30))} />
              <TrendBar label="AI" value={point.aiResolution} />
              <TrendBar label="Saved" value={Math.min(100, Math.round(point.moneySaved / 250))} />
              <TrendBar label="CSAT" value={point.customerSatisfaction} />
            </div>
          ))}
        </div>
      </section>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-heading compact"><div><span className="eyebrow">Assumptions</span><h2>Calculation inputs</h2></div><Clock color="var(--accent)" size={18} /></div>
          <div className="metric-stack">
            <Metric label="Monthly conversations" value={dashboard?.assumptions.monthlyTickets || 0} />
            <Metric label="Average handling time" value={`${dashboard?.assumptions.averageResolutionMinutes || 0} min`} />
            <Metric label="Human labor" value={`$${dashboard?.assumptions.averageAgentHourlyCost || 0}/hour`} />
            <Metric label="AI resolves" value={`${Math.round((dashboard?.assumptions.aiResolutionRate || 0) * 100)}%`} />
            <Metric label="AI cost" value={`$${dashboard?.assumptions.aiCostPerConversation || 0}/conversation`} />
          </div>
        </div>
        <div className="card">
          <div className="section-heading compact"><div><span className="eyebrow">Capacity</span><h2>What AI gives back</h2></div><Users color="var(--accent)" size={18} /></div>
          <p className="muted">This dashboard estimates labor hours avoided and subtracts AI operating costs. It is intentionally labeled as estimated so founders can adjust assumptions later.</p>
        </div>
      </section>
    </>
  );
}

function TrendBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="trend-bar">
      <span>{label}</span>
      <div className="meter"><span style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="chat-metric"><span>{label}</span><strong>{value}</strong></div>;
}
