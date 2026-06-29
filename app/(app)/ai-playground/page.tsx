"use client";

import { FormEvent, useEffect, useState } from "react";
import { BrainCircuit, Clock, FileSearch, Loader2, Play, Save, Search, Sparkles } from "lucide-react";
import { useOrganization } from "@/lib/org";

type Trace = {
  id: string;
  question: string;
  embedding: { model: string; dimensions: number; preview: string; latencyMs: number };
  retrievedDocuments: Array<{ title: string; sourceUrl: string; score: number; snippet: string }>;
  prompt: string;
  reasoning: string;
  finalAnswer: string;
  latencyBreakdown: Record<string, number>;
  promptVersion: string;
  createdAt: string;
};

export default function AiPlaygroundPage() {
  const { activeOrganization } = useOrganization();
  const [question, setQuestion] = useState("My credits disappeared.");
  const [promptOverride, setPromptOverride] = useState("");
  const [trace, setTrace] = useState<Trace | null>(null);
  const [history, setHistory] = useState<Trace[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function loadHistory() {
    const response = await fetch(`/api/ai-playground/history?organizationId=${activeOrganization.id}`);
    const json = await response.json();
    if (response.ok) setHistory(json);
  }

  async function runTrace(event?: FormEvent) {
    event?.preventDefault();
    setRunning(true);
    setError("");
    try {
      const response = await fetch("/api/ai-playground/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: activeOrganization.id,
          organizationName: activeOrganization.name,
          question,
          promptOverride: promptOverride || undefined
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Playground run failed.");
      setTrace(json);
      setPromptOverride(json.prompt);
      await loadHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Playground run failed.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganization.id]);

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">AI Playground</span>
          <h1>Debug the Company Brain visually</h1>
          <p>Ask a question and inspect embedding, retrieved documents, similarity, prompt, reasoning, answer, and latency.</p>
        </div>
        <span className="badge">{trace?.promptVersion || "default"}</span>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="playground-layout">
        <form className="card playground-control" onSubmit={runTrace}>
          <label className="field">
            <span>Ask a question</span>
            <textarea className="textarea" value={question} onChange={(event) => setQuestion(event.target.value)} />
          </label>
          <label className="field">
            <span>Edit prompt</span>
            <textarea className="textarea tall-textarea" value={promptOverride} onChange={(event) => setPromptOverride(event.target.value)} placeholder="Run once to see the generated prompt, then edit and run again." />
          </label>
          <button className="button" disabled={running || !question.trim()} type="submit">
            {running ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Send
          </button>
          <button className="button secondary" disabled={!trace} type="button">
            <Save size={16} />
            Save Version
          </button>
        </form>

        <main className="playground-trace">
          {trace ? (
            <>
              <section className="latency-ribbon">
                {Object.entries(trace.latencyBreakdown).map(([key, value]) => (
                  <span key={key}>{humanize(key)}: {value}ms</span>
                ))}
              </section>
              <TracePanel icon={<Search size={18} />} title="Question">{trace.question}</TracePanel>
              <TracePanel icon={<BrainCircuit size={18} />} title="Embedding">
                {trace.embedding.model} · {trace.embedding.dimensions} dimensions · {trace.embedding.latencyMs}ms · {trace.embedding.preview}
              </TracePanel>
              <section className="card">
                <div className="section-heading compact">
                  <div><span className="eyebrow">Retrieved</span><h2>Documents</h2></div>
                  <FileSearch color="var(--accent)" size={18} />
                </div>
                <div className="source-stack">
                  {trace.retrievedDocuments.map((doc) => (
                    <div className="mini-source" key={doc.title}>
                      <strong>{doc.title}</strong>
                      <span className="muted">{Math.round(doc.score * 100)} similarity</span>
                      <p>{doc.snippet}</p>
                    </div>
                  ))}
                </div>
              </section>
              <TracePanel icon={<Sparkles size={18} />} title="Prompt"><pre>{trace.prompt}</pre></TracePanel>
              <TracePanel icon={<BrainCircuit size={18} />} title="Reasoning">{trace.reasoning}</TracePanel>
              <TracePanel icon={<Sparkles size={18} />} title="Final Answer">{trace.finalAnswer}</TracePanel>
              <section className="card">
                <div className="section-heading compact">
                  <div><span className="eyebrow">Latency</span><h2>Stage timing</h2></div>
                  <Clock color="var(--accent)" size={18} />
                </div>
                <div className="latency-stack">
                  {Object.entries(trace.latencyBreakdown).map(([key, value]) => (
                    <div key={key}>
                      <div className="chat-metric"><span>{humanize(key)}</span><strong>{value}ms</strong></div>
                      <div className="meter"><span style={{ width: `${Math.min(100, Math.round(Number(value) / 25))}%` }} /></div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="empty-state">Ask a question to generate a full AI trace.</div>
          )}
        </main>

        <aside className="card">
          <div className="section-heading compact">
            <div><span className="eyebrow">History</span><h2>Recent runs</h2></div>
          </div>
          <div className="conversation-list">
            {history.map((item) => (
              <button className="conversation-item" key={item.id} onClick={() => { setTrace(item); setQuestion(item.question); setPromptOverride(item.prompt); }} type="button">
                <strong>{item.question}</strong>
                <span>{item.promptVersion} · {new Date(item.createdAt).toLocaleString()}</span>
              </button>
            ))}
            {!history.length ? <div className="empty-state">No playground runs yet.</div> : null}
          </div>
        </aside>
      </section>
    </>
  );
}

function TracePanel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="card trace-panel">
      <div className="section-heading compact">
        <div><span className="eyebrow">Trace</span><h2>{title}</h2></div>
        <span className="panel-icon">{icon}</span>
      </div>
      <div className="trace-body">{children}</div>
    </section>
  );
}

function humanize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
