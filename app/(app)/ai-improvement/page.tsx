"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, BookOpenCheck, BrainCircuit, CheckCircle2, ClipboardCheck, Loader2, Play, RefreshCw, Save, Search, ShieldAlert, Sparkles } from "lucide-react";
import { useOrganization } from "@/lib/org";

type Review = {
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

type ImprovementDashboard = {
  reviews: Review[];
  summary: {
    averageQuality: number;
    responsesReviewed: number;
    highRiskResponses: number;
    savedImprovements: number;
  };
};

export default function AiImprovementPage() {
  const { activeOrganization } = useOrganization();
  const [dashboard, setDashboard] = useState<ImprovementDashboard | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [improvedResponse, setImprovedResponse] = useState("");
  const [improvementNotes, setImprovementNotes] = useState("");
  const [promptGuidance, setPromptGuidance] = useState("");
  const [replayOpen, setReplayOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const selected = useMemo(
    () => dashboard?.reviews.find((review) => review.messageId === selectedId) || dashboard?.reviews[0] || null,
    [dashboard, selectedId]
  );

  async function loadReviews() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai-improvement/reviews?organizationId=${activeOrganization.id}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "AI Improvement Center failed to load.");
      setDashboard(json);
      const nextSelected = json.reviews?.[0] || null;
      setSelectedId((current) => current || nextSelected?.messageId || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "AI Improvement Center failed to load.");
    } finally {
      setLoading(false);
    }
  }

  async function saveImprovement() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/ai-improvement/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: activeOrganization.id,
          conversationId: selected.conversationId,
          messageId: selected.messageId,
          reviewerName: "Admin",
          originalResponse: selected.response,
          improvedResponse,
          improvementNotes,
          promptGuidance,
          qualityScore: selected.overallQualityScore
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Unable to save improvement.");
      setSaved(true);
      await loadReviews();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save improvement.");
    } finally {
      setSaving(false);
    }
  }

  function selectReview(review: Review) {
    setSelectedId(review.messageId);
    setImprovedResponse(review.response);
    setImprovementNotes(review.suggestedImprovements.join("\n"));
    setPromptGuidance(buildPromptGuidance(review));
    setReplayOpen(false);
    setSaved(false);
  }

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganization.id]);

  useEffect(() => {
    if (selected && !improvedResponse) {
      setImprovedResponse(selected.response);
      setImprovementNotes(selected.suggestedImprovements.join("\n"));
      setPromptGuidance(buildPromptGuidance(selected));
    }
  }, [selected, improvedResponse]);

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">AI Improvement Center</span>
          <h1>Continuous response review</h1>
          <p>
            Every AI answer is reviewed for quality, retrieval, confidence, sources,
            hallucination risk, and future prompt improvements.
          </p>
        </div>
        <button className="button secondary" onClick={loadReviews} disabled={loading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      {saved ? <div className="success-banner">Improvement saved into the feedback loop.</div> : null}

      <section className="grid cols-4 improvement-summary">
        <SummaryCard icon={<ClipboardCheck size={18} />} label="Responses Reviewed" value={dashboard?.summary.responsesReviewed || 0} />
        <SummaryCard icon={<Sparkles size={18} />} label="Average Quality" value={`${dashboard?.summary.averageQuality || 0}%`} />
        <SummaryCard icon={<ShieldAlert size={18} />} label="High Risk" value={dashboard?.summary.highRiskResponses || 0} />
        <SummaryCard icon={<BookOpenCheck size={18} />} label="Saved Improvements" value={dashboard?.summary.savedImprovements || 0} />
      </section>

      <section className="improvement-workspace">
        <aside className="card improvement-list">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">Review Queue</span>
              <h2>AI responses</h2>
            </div>
            {loading ? <Loader2 className="spin" size={18} /> : <BrainCircuit color="var(--accent)" size={18} />}
          </div>
          <div className="conversation-list">
            {(dashboard?.reviews || []).map((review) => (
              <button
                className={`conversation-item ${selected?.messageId === review.messageId ? "active" : ""}`}
                key={review.messageId}
                onClick={() => selectReview(review)}
                type="button"
              >
                <strong>{review.conversationTitle}</strong>
                <span>{review.customerName || "Customer"} · {formatTime(review.createdAt)}</span>
                <small>{review.response.slice(0, 110)}</small>
                <div className="review-score-strip">
                  <ScorePill label="Quality" value={review.overallQualityScore} />
                  <RiskBadge risk={review.hallucinationRisk} />
                </div>
              </button>
            ))}
            {!loading && !dashboard?.reviews.length ? <div className="empty-state">No AI responses to review yet.</div> : null}
          </div>
        </aside>

        <main className="card improvement-detail">
          {selected ? (
            <>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Response Review</span>
                  <h2>{selected.conversationTitle}</h2>
                  <p className="muted">Saved feedback: {selected.feedbackCount}</p>
                </div>
                <button className="button secondary" onClick={() => setReplayOpen((current) => !current)} type="button">
                  <Play size={16} />
                  Replay
                </button>
              </div>

              <div className="quality-grid">
                <QualityMeter label="Overall quality" value={selected.overallQualityScore} />
                <QualityMeter label="Retrieval quality" value={selected.retrievalQuality} />
                <QualityMeter label="Confidence score" value={selected.confidenceScore} />
                <div className="quality-card">
                  <span className="muted">Hallucination risk</span>
                  <RiskBadge risk={selected.hallucinationRisk} />
                  <span className="muted">Validator: {selected.validationStatus}</span>
                </div>
              </div>

              <section className="review-response">
                <span className="eyebrow">Original Response</span>
                <p>{selected.response}</p>
              </section>

              {replayOpen ? (
                <section className="replay-timeline improvement-replay">
                  {selected.replaySteps.length ? (
                    selected.replaySteps
                      .slice()
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((step) => (
                        <div className="replay-step" key={`${selected.messageId}-${step.sortOrder}`} style={{ animationDelay: `${step.sortOrder * 70}ms` }}>
                          <span className="replay-icon">
                            <Play size={14} />
                          </span>
                          <div>
                            <strong>{step.title}</strong>
                            <p>{step.detail}</p>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="empty-state">No replay steps saved for this response.</div>
                  )}
                </section>
              ) : null}

              <div className="grid cols-2">
                <section className="card subtle-card">
                  <div className="section-heading compact">
                    <div>
                      <span className="eyebrow">Sources Used</span>
                      <h2>Grounding</h2>
                    </div>
                    <Search color="var(--accent)" size={18} />
                  </div>
                  <div className="source-stack">
                    {selected.knowledgeSourcesUsed.map((source, index) => (
                      <div className="mini-source" key={`${source.title}-${source.sourceUrl}-${index}`}>
                        <strong>{source.title}</strong>
                        <span className="muted">{Math.round(source.score * 100)}% match</span>
                        <p>{source.snippet || "No snippet stored."}</p>
                      </div>
                    ))}
                    {!selected.knowledgeSourcesUsed.length ? <div className="empty-state">No sources were used.</div> : null}
                  </div>
                </section>

                <section className="card subtle-card">
                  <div className="section-heading compact">
                    <div>
                      <span className="eyebrow">Suggested Improvements</span>
                      <h2>Review notes</h2>
                    </div>
                    <AlertTriangle color="var(--warning)" size={18} />
                  </div>
                  <ul className="compact-bullets">
                    {selected.suggestedImprovements.map((suggestion) => (
                      <li key={suggestion}>{suggestion}</li>
                    ))}
                    {!selected.suggestedImprovements.length ? <li>This response looks healthy.</li> : null}
                  </ul>
                </section>
              </div>

              <section className="improvement-editor">
                <div className="section-heading compact">
                  <div>
                    <span className="eyebrow">Improve Response</span>
                    <h2>Save feedback for future prompts</h2>
                  </div>
                  <CheckCircle2 color="var(--accent)" size={18} />
                </div>
                <label className="field">
                  <span>Improved response</span>
                  <textarea className="textarea tall-textarea" value={improvedResponse} onChange={(event) => setImprovedResponse(event.target.value)} />
                </label>
                <label className="field">
                  <span>Improvement notes</span>
                  <textarea className="textarea" value={improvementNotes} onChange={(event) => setImprovementNotes(event.target.value)} />
                </label>
                <label className="field">
                  <span>Future prompt guidance</span>
                  <textarea className="textarea" value={promptGuidance} onChange={(event) => setPromptGuidance(event.target.value)} />
                </label>
                <button className="button" onClick={saveImprovement} disabled={saving || !improvedResponse.trim() || !improvementNotes.trim()}>
                  {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                  Save improvement
                </button>
              </section>
            </>
          ) : (
            <div className="empty-state">No AI responses are ready for review yet.</div>
          )}
        </main>
      </section>
    </>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="card mini-stat">
      {icon}
      <div>
        <span className="muted">{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function QualityMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="quality-card">
      <span className="muted">{label}</span>
      <strong>{value}%</strong>
      <div className="meter">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return <span className={value >= 80 ? "badge success" : value >= 60 ? "badge warning" : "badge danger"}>{label}: {value}%</span>;
}

function RiskBadge({ risk }: { risk: Review["hallucinationRisk"] }) {
  return <span className={risk === "low" ? "badge success" : risk === "medium" ? "badge warning" : "badge danger"}>{risk} risk</span>;
}

function buildPromptGuidance(review: Review) {
  const sourceGuidance = review.knowledgeSourcesUsed.length
    ? `Use retrieved sources such as ${review.knowledgeSourcesUsed.slice(0, 2).map((source) => source.title).join(" and ")} when answering this topic.`
    : "Do not answer this topic without retrieved knowledge sources.";

  return [
    sourceGuidance,
    review.hallucinationRisk !== "low" ? "Avoid unsupported claims and state uncertainty clearly." : "Keep answers concise, grounded, and source-aware.",
    review.confidenceScore < 70 ? "If confidence is low, ask a clarifying question or escalate." : "Maintain this confidence pattern for similar questions."
  ].join("\n");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
