"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FlaskConical, Loader2, Play, XCircle } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { useOrganization } from "@/lib/org";

type EvalTest = {
  id: string;
  question: string;
  expectedIntent: string;
  expectedDocuments: string[];
  expectedAnswer: string;
  expectedWorkflow: string | null;
  expectedConfidence: number;
};

type EvalResult = {
  id: string;
  question: string;
  answer: string;
  expectedIntent: string;
  actualIntent: string;
  expectedDocuments: string[];
  retrievedDocuments: string[];
  correct: boolean;
  hallucinated: boolean;
  wrongDocument: boolean;
  wrongIntent: boolean;
  escalated: boolean;
  actualConfidence: number;
  latencyMs: number;
  tokens: number;
  gradeNotes: string[];
};

type Dashboard = {
  overallScore: number;
  passing: number;
  failed: number;
  total: number;
  averageConfidence: number;
  averageLatencyMs: number;
  latestRunId: string | null;
  tests: EvalTest[];
  results: EvalResult[];
};

export default function AiEvaluationPage() {
  const { activeOrganization } = useOrganization();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/ai-evaluation/dashboard?organizationId=${activeOrganization.id}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "AI Evaluation failed to load.");
      setDashboard(json);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI Evaluation failed to load.");
    } finally {
      setLoading(false);
    }
  }

  async function runAllTests() {
    setRunning(true);
    setError("");
    try {
      const response = await fetch("/api/ai-evaluation/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: activeOrganization.id })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Evaluation run failed.");
      setDashboard(json);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Evaluation run failed.");
    } finally {
      setRunning(false);
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
          <span className="eyebrow">AI Evaluation</span>
          <h1>Regression tests for your support AI</h1>
          <p>Run support questions like software tests so prompt changes improve the AI instead of silently breaking it.</p>
        </div>
        <button className="button" onClick={runAllTests} disabled={running}>
          {running ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
          Run Evaluation
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid cols-3">
        <StatCard detail={dashboard?.latestRunId ? "Latest regression run" : "Run tests to score"} label="Overall Score" tone={scoreTone(dashboard?.overallScore || 0)} value={loading ? "..." : `${dashboard?.overallScore || 0}%`} />
        <StatCard detail={`${dashboard?.passing || 0} / ${dashboard?.total || 0} tests`} label="Passing" tone="success" value={loading ? "..." : String(dashboard?.passing || 0)} />
        <StatCard detail={`${dashboard?.failed || 0} failed regression checks`} label="Failed" tone={dashboard?.failed ? "warning" : "success"} value={loading ? "..." : String(dashboard?.failed || 0)} />
        <StatCard detail="Mean answer confidence" label="Average Confidence" value={loading ? "..." : `${dashboard?.averageConfidence || 0}%`} />
        <StatCard detail="Mean end-to-end response time" label="Average Latency" value={loading ? "..." : `${((dashboard?.averageLatencyMs || 0) / 1000).toFixed(1)} sec`} />
        <StatCard detail="Seeded PicX-style support questions" label="Test Dataset" value={loading ? "..." : String(dashboard?.tests.length || 0)} />
      </div>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">Dataset</span>
              <h2>Support questions</h2>
            </div>
            <FlaskConical color="var(--accent)" size={18} />
          </div>
          <div className="eval-list">
            {(dashboard?.tests || []).map((test) => (
              <div className="eval-row" key={test.id}>
                <strong>{test.question}</strong>
                <span className="muted">Intent: {test.expectedIntent} · Docs: {test.expectedDocuments.join(", ")} · Confidence {test.expectedConfidence}%+</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">Latest Results</span>
              <h2>Pass / Fail</h2>
            </div>
            {dashboard?.failed ? <AlertTriangle color="var(--warning)" size={18} /> : <CheckCircle2 color="var(--accent)" size={18} />}
          </div>
          <div className="eval-list">
            {(dashboard?.results || []).map((result) => (
              <div className="eval-row" key={result.id}>
                <div className="eval-row-title">
                  {result.correct ? <CheckCircle2 color="var(--accent)" size={17} /> : <XCircle color="var(--danger)" size={17} />}
                  <strong>{result.question}</strong>
                  <span className={result.correct ? "badge success" : "badge danger"}>{result.correct ? "Pass" : "Fail"}</span>
                </div>
                <span className="muted">Intent {result.actualIntent} · Confidence {result.actualConfidence}% · {result.latencyMs}ms · {result.tokens} tokens</span>
                <span className="muted">{result.gradeNotes.join(" ")}</span>
              </div>
            ))}
            {!dashboard?.results.length ? <div className="empty-state">No run yet. Click Run Evaluation.</div> : null}
          </div>
        </div>
      </section>
    </>
  );
}

function scoreTone(score: number): "default" | "success" | "warning" {
  if (score >= 85) return "success";
  if (score >= 70) return "default";
  return "warning";
}
