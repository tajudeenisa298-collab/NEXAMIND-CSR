"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  Clock,
  Database,
  FileSearch,
  Globe2,
  Loader2,
  Network,
  RefreshCw,
  Sparkles,
  Upload
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { companyBrainPipeline, normalizeWebsiteInput, type CompanyBrain } from "@/lib/company-brain";
import { useOrganization } from "@/lib/org";
import { formatNumber } from "@/lib/utils";

type CrawlHistoryItem = {
  id: string;
  website: string;
  status: "running" | "succeeded" | "failed";
  pagesDiscovered: number;
  pagesIndexed: number;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
};

type ApiError = {
  code: string;
  message: string;
  missing?: string[];
};

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export default function CompanyBrainPage() {
  const { activeOrganization, updateActiveOrganization } = useOrganization();
  const [website, setWebsite] = useState(activeOrganization.website || "https://picxstudio.com");
  const [brain, setBrain] = useState<CompanyBrain | null>(null);
  const [history, setHistory] = useState<CrawlHistoryItem[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [building, setBuilding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [missingConfig, setMissingConfig] = useState<string[]>([]);
  const [hasAutostarted, setHasAutostarted] = useState(false);
  const [trainingNote, setTrainingNote] = useState("");
  const [trainingFiles, setTrainingFiles] = useState<string[]>([]);

  const loadPersistedState = useCallback(async () => {
    setLoading(true);
    setError("");
    setMissingConfig([]);

    try {
      const [brainResponse, historyResponse] = await Promise.all([
        fetch(`/api/company-brain/current?organizationId=${encodeURIComponent(activeOrganization.id)}`),
        fetch(`/api/company-brain/history?organizationId=${encodeURIComponent(activeOrganization.id)}`)
      ]);

      const brainPayload = (await brainResponse.json()) as {
        data?: CompanyBrain | null;
        error?: ApiError;
      };
      const historyPayload = (await historyResponse.json()) as {
        data?: CrawlHistoryItem[];
        error?: ApiError;
      };

      if (!brainResponse.ok) {
        setError(brainPayload.error?.message || "Unable to load persisted Company Brain.");
        setMissingConfig(brainPayload.error?.missing || []);
      } else {
        setBrain(brainPayload.data || null);
      }

      if (historyResponse.ok) {
        setHistory(historyPayload.data || []);
      }
    } catch {
      setError("Unable to reach the Company Brain backend.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganization.id]);

  useEffect(() => {
    setWebsite(activeOrganization.website || "https://picxstudio.com");
    setBrain(null);
    setHistory([]);
    setActiveStep(0);
    void loadPersistedState();
  }, [activeOrganization.id, activeOrganization.website, loadPersistedState]);

  const buildBrain = useCallback(
    async (requestedWebsite: string, rebuild = false) => {
      setError("");
      setMissingConfig([]);
      setBuilding(true);
      setActiveStep(0);

      try {
        const normalizedWebsite = normalizeWebsiteInput(requestedWebsite);
        setWebsite(normalizedWebsite);

        const buildRequest = fetch("/api/company-brain/build", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            website: normalizedWebsite,
            organizationId: activeOrganization.id,
            rebuild
          })
        }).then(async (response) => {
          const payload = (await response.json()) as {
            data?: CompanyBrain;
            error?: ApiError;
          };
          if (!response.ok || !payload.data) {
            const message = payload.error?.message || "Unable to build Company Brain.";
            const apiError = new Error(message) as Error & { missing?: string[] };
            apiError.missing = payload.error?.missing;
            throw apiError;
          }
          return payload.data;
        });

        for (let index = 0; index < companyBrainPipeline.length - 1; index += 1) {
          setActiveStep(index);
          await delay(index === 7 ? 520 : 260);
        }

        const result = await buildRequest;
        setActiveStep(companyBrainPipeline.length - 1);
        setBrain(result);
        updateActiveOrganization({ website: normalizedWebsite });
        await loadPersistedState();
      } catch (caught) {
        const apiError = caught as Error & { missing?: string[] };
        setError(apiError.message || "Unable to build Company Brain.");
        setMissingConfig(apiError.missing || []);
      } finally {
        setBuilding(false);
      }
    },
    [activeOrganization.id, loadPersistedState, updateActiveOrganization]
  );

  useEffect(() => {
    if (hasAutostarted) return;
    const params = new URLSearchParams(window.location.search);
    const autostart = params.get("autostart") === "1";
    const requestedWebsite = params.get("website");
    if (autostart && requestedWebsite) {
      setHasAutostarted(true);
      void buildBrain(requestedWebsite);
    }
  }, [buildBrain, hasAutostarted]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await buildBrain(website, false);
  }

  const sources = brain?.crawledSources || [];
  const graph = brain?.graph || [];
  const profile = brain?.profile;
  const metrics = brain?.metrics;
  const sourceCount = sources.length;

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">Sprint 2.5</span>
          <h1>Real Company Brain</h1>
          <p>
            Crawl public resources, store raw HTML and clean text in Supabase, chunk documents,
            generate real OpenAI embeddings, and save vectors in pgvector.
          </p>
        </div>
        <span className={brain ? "badge success" : "badge"}>
          {loading ? "Loading" : brain ? "Ready" : building ? "Building" : "Not indexed"}
        </span>
      </div>

      <section className="brain-hero">
        <div>
          <span className="eyebrow">Backend pipeline</span>
          <h2>Build a real support brain from a company website</h2>
          <p>
            This now uses persisted backend storage for crawl jobs, crawl pages,
            documents, chunks, and embeddings in Supabase.
          </p>
          <div className="brain-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <strong>Company Brain</strong>
          </div>
        </div>
        <form className="brain-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Company website</span>
            <input
              className="input"
              disabled={building}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="picxstudio.com"
              value={website}
            />
          </label>
          <button className="button" disabled={building} type="submit">
            {building ? <Loader2 className="spin" size={16} /> : <BrainCircuit size={16} />}
            {building ? "Building brain" : "Build Company Brain"}
          </button>
          {brain ? (
            <button
              className="button secondary"
              disabled={building}
              onClick={() => void buildBrain(website, true)}
              type="button"
            >
              <RefreshCw size={16} />
              Rebuild Company Brain
            </button>
          ) : null}
        </form>
      </section>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Company Brain Training</span>
              <h2>Add private knowledge</h2>
              <p className="muted">Use docs, files, images, screenshots, or notes to teach the AI beyond the public website.</p>
            </div>
            <Upload color="var(--accent)" size={20} />
          </div>
          <label className="field upload-dropzone">
            <Upload size={18} />
            <span>Upload PDFs, docs, images, screenshots, CSVs, or support exports</span>
            <input
              multiple
              onChange={(event) => setTrainingFiles(Array.from(event.target.files || []).map((file) => file.name))}
              type="file"
            />
          </label>
          {trainingFiles.length ? (
            <div className="compact-list">
              {trainingFiles.map((file) => (
                <div className="list-row" key={file}>
                  <strong>{file}</strong>
                  <span className="badge">Ready to ingest</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Behavior Rules</span>
              <h2>Tell the AI what changed</h2>
              <p className="muted">Add policy updates, launch notes, edge cases, or instructions for specific situations.</p>
            </div>
            <Sparkles color="var(--accent)" size={20} />
          </div>
          <label className="field">
            <span>Instruction or update</span>
            <textarea
              className="textarea"
              onChange={(event) => setTrainingNote(event.target.value)}
              placeholder="Example: Starting July 1, annual Pro customers get priority support and refunds require manager approval."
              value={trainingNote}
            />
          </label>
          <button className="button" disabled={!trainingNote.trim() && !trainingFiles.length} type="button">
            <BrainCircuit size={16} />
            Add to training queue
          </button>
          <p className="muted" style={{ fontSize: 13 }}>
            Next production step: save this to Supabase, parse attachments, create chunks, embed them, and mark it as supplemental knowledge.
          </p>
        </div>
      </section>

      {error ? (
        <div className="card" style={{ marginTop: 16 }}>
          <strong>{missingConfig.length ? "Backend setup required" : "Build issue"}</strong>
          <p className="muted">{error}</p>
          {missingConfig.length ? (
            <div className="list">
              {missingConfig.map((item) => (
                <div className="list-row" key={item}>
                  <strong>{item}</strong>
                  <span className="badge warning">Missing</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-heading">
          <div>
            <h2>Build pipeline</h2>
            <p className="muted">
              Rebuild deletes old embeddings, re-crawls, re-chunks, re-embeds, and completes.
            </p>
          </div>
          <span className="badge">{companyBrainPipeline.length} stages</span>
        </div>
        <div className="pipeline">
          {companyBrainPipeline.map((step, index) => {
            const complete = Boolean(brain) || (building && index < activeStep);
            const running = building && index === activeStep;
            const pending = !complete && !running;

            return (
              <div
                className="pipeline-step"
                data-state={complete ? "complete" : running ? "running" : "pending"}
                key={step.id}
                style={{ animationDelay: `${index * 42}ms` }}
              >
                <span className="pipeline-icon">
                  {complete ? (
                    <CheckCircle2 size={16} />
                  ) : running ? (
                    <Loader2 className="spin" size={16} />
                  ) : (
                    <Clock size={16} />
                  )}
                </span>
                <span>{step.label}</span>
                {pending ? null : <small>{complete ? "Done" : "Running"}</small>}
              </div>
            );
          })}
        </div>
        <div className="pipeline-progress" aria-hidden="true">
          <span style={{ width: `${brain ? 100 : building ? Math.round(((activeStep + 1) / companyBrainPipeline.length) * 100) : 0}%` }} />
        </div>
      </section>

      {brain ? (
        <>
          <div className="grid cols-3" style={{ marginTop: 16 }}>
            <StatCard detail="Company Brain status" label="Status" tone="success" value={metrics?.status || "Ready"} />
            <StatCard
              detail={`${sourceCount} discovered source groups`}
              label="Pages indexed"
              value={formatNumber(metrics?.pagesIndexed || 0)}
            />
            <StatCard
              detail="Stored in pgvector"
              label="Embeddings"
              value={formatNumber(metrics?.embeddings || 0)}
            />
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <section className="card">
              <div className="section-heading">
                <div>
                  <h2>Company DNA</h2>
                  <p className="muted">Generated from persisted source records.</p>
                </div>
                <Sparkles color="var(--accent)" size={20} />
              </div>
              <div className="dna-grid">
                <ProfileRow label="Company" value={profile?.company || activeOrganization.name} />
                <ProfileRow label="Industry" value={profile?.industry || "Software Company"} />
                <ProfileRow label="Products" value={formatList(profile?.products, "Core Product")} />
                <ProfileRow label="Audience" value={formatList(profile?.audience, "Customers")} />
                <ProfileRow label="Tone" value={formatList(profile?.tone, activeOrganization.aiTone)} />
                <ProfileRow label="Brand Vocabulary" value={formatList(profile?.brandVocabulary, "Account, Plan, Workspace, Support")} />
                <ProfileRow label="Support Channels" value={formatList(profile?.supportChannels, activeOrganization.supportEmail)} />
                <ProfileRow label="Last Synced" value={profile?.lastSynced || "Today"} />
              </div>
            </section>

            <section className="card">
              <div className="section-heading">
                <div>
                  <h2>Knowledge graph</h2>
                  <p className="muted">A first-pass map from organization profile and source types.</p>
                </div>
                <Network color="var(--accent)" size={20} />
              </div>
              <div className="knowledge-graph-map">
                <div className="graph-center-node">
                  <strong>{profile?.company || activeOrganization.name}</strong>
                  <span>Company Brain</span>
                </div>
                {(graph.length ? graph : [{ id: "fallback", label: "Knowledge", group: "Company" }]).slice(0, 10).map((node, index) => (
                  <span
                    className="graph-node graph-map-node"
                    data-group={node.group}
                    key={node.id}
                    style={{ "--node-angle": `${index * (360 / Math.min(10, Math.max(graph.length, 1)))}deg` } as CSSProperties}
                  >
                    {node.label}
                  </span>
                ))}
              </div>
            </section>
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <section className="card">
              <div className="section-heading">
                <div>
                  <h2>Company Brain dashboard</h2>
                  <p className="muted">Counts now come from Supabase tables.</p>
                </div>
                <Database color="var(--accent)" size={20} />
              </div>
              <div className="list">
                <MetricRow label="Knowledge articles" value={formatNumber(metrics?.knowledgeArticles || 0)} />
                <MetricRow label="Chunks" value={formatNumber(metrics?.chunks || 0)} />
                <MetricRow label="Languages" value={formatList(metrics?.languages, "English")} />
                <MetricRow label="Last crawl" value={metrics?.lastCrawl || "Today"} />
                <MetricRow label="Sync health" value={metrics?.syncHealth || "Partial"} />
              </div>
            </section>

            <section className="card">
              <div className="section-heading">
                <div>
                  <h2>Crawled sources</h2>
                  <p className="muted">Persisted source records from the latest build.</p>
                </div>
                <Globe2 color="var(--accent)" size={20} />
              </div>
              <div className="source-list">
                {sources.map((source, index) => (
                  <a className="source-row source-card" href={source.url} key={`${source.id}-${index}`} rel="noreferrer" style={{ animationDelay: `${index * 34}ms` }} target="_blank">
                    <FileSearch color="var(--accent)" size={18} />
                    <div>
                      <strong>{source.type}</strong>
                      <span className="muted">{source.url}</span>
                    </div>
                    <span className="badge success">{source.status}</span>
                  </a>
                ))}
                {!sources.length ? (
                  <div className="empty-state">
                    <strong>No source rows stored yet.</strong>
                    <p className="muted">Rebuild the Company Brain to populate crawled sources.</p>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </>
      ) : (
        <section className="empty-state" style={{ marginTop: 16 }}>
          <strong>Enter `picxstudio.com` after Supabase and OpenAI are configured.</strong>
          <p className="muted">
            Once complete, this page will show crawled sources, Company DNA, indexed pages,
            chunks, embeddings, sync health, and crawl history from the database.
          </p>
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-heading">
          <div>
            <h2>Previous crawls</h2>
            <p className="muted">Real crawl history from the backend.</p>
          </div>
          <span className="badge">{history.length} runs</span>
        </div>
        {history.length ? (
          <div className="list">
            {history.map((item) => (
              <div className="list-row" key={item.id}>
                <div>
                  <strong>{relativeTime(item.startedAt)}</strong>
                  <span className="muted">
                    {item.website} · {item.pagesIndexed} indexed of {item.pagesDiscovered} discovered
                  </span>
                  {item.error ? <span className="muted">Error: {item.error}</span> : null}
                </div>
                <span
                  className={
                    item.status === "succeeded"
                      ? "badge success"
                      : item.status === "failed"
                        ? "badge warning"
                        : "badge"
                  }
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No crawls stored yet.</strong>
            <p className="muted">Build the Company Brain to create the first crawl job.</p>
          </div>
        )}
      </section>
    </>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="list-row">
      <strong>{label}</strong>
      <span className="muted">{value}</span>
    </div>
  );
}

function formatList(value: unknown, fallback: string) {
  if (Array.isArray(value) && value.length) {
    return value.filter(Boolean).join(", ");
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return fallback;
}

function relativeTime(input: string) {
  const then = new Date(input).getTime();
  const now = Date.now();
  const diffDays = Math.floor((now - then) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}
