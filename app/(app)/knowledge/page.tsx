"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, Layers3, MessageSquareText, Search, Sparkles, Upload } from "lucide-react";
import { demoKnowledgeSources } from "@/lib/demo-data";
import { useOrganization } from "@/lib/org";

type KnowledgeSource = {
  id: string;
  title: string;
  category: string;
  status: string;
  url: string;
  chunks: number;
  documents: number;
  chunkPreviews: Array<{
    id: string;
    chunkNumber: number;
    content: string;
    tokenCount: number;
    documentTitle: string;
    sourceUrl: string;
  }>;
};

export default function KnowledgePage() {
  const { activeOrganization } = useOrganization();
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [manualUpdate, setManualUpdate] = useState("");
  const [manualTitle, setManualTitle] = useState("Manual knowledge update");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const fallbackDocs: KnowledgeSource[] = demoKnowledgeSources
    .filter((doc) => doc.organizationId === activeOrganization.id)
    .map((doc) => ({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      status: doc.status,
      url: "",
      chunks: doc.chunks,
      documents: 1,
      chunkPreviews: []
    }));
  const docs = sources.length ? sources : fallbackDocs;
  const selectedSource = useMemo(
    () => docs.find((doc) => doc.id === selectedSourceId) || docs[0] || null,
    [docs, selectedSourceId]
  );

  async function loadSources() {
    setLoading(true);
    try {
      const response = await fetch(`/api/knowledge/sources?organizationId=${encodeURIComponent(activeOrganization.id)}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Unable to load knowledge sources.");
      setSources(json.data || []);
    } catch {
      setSources([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    if (source) setSelectedSourceId(source);
  }, []);

  useEffect(() => {
    void loadSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganization.id]);

  async function saveManualKnowledge() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/knowledge/updates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: activeOrganization.id,
          title: manualTitle,
          body: manualUpdate,
          updateType: "instruction"
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Unable to save knowledge update.");
      setManualUpdate("");
      setMessage("Knowledge update indexed and added to retrieval.");
      await loadSources();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save knowledge update.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadKnowledge() {
    setSaving(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.set("organizationId", activeOrganization.id);
      formData.set("note", manualUpdate);
      selectedFiles.forEach((file) => formData.append("files", file));
      const response = await fetch("/api/knowledge/uploads", {
        method: "POST",
        body: formData
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Unable to upload knowledge.");
      setSelectedFiles([]);
      setUploadedFiles([]);
      setManualUpdate("");
      setMessage("Knowledge upload saved. Text files are indexed; binary files are queued for parser review.");
      await loadSources();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload knowledge.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">Knowledge</span>
          <h1>RAG-ready sources</h1>
          <p>
            Knowledge cards show retrieval readiness, chunk depth, and review state
            so demos feel grounded instead of abstract.
          </p>
        </div>
        <span className="badge success">{loading ? "Loading" : `${docs.reduce((sum, doc) => sum + doc.chunks, 0)} chunks`}</span>
      </div>

      <section className="knowledge-grid">
        {docs.map((doc, index) => (
          <button
            className="card knowledge-card knowledge-card-button"
            key={doc.id}
            onClick={() => setSelectedSourceId(doc.id)}
            style={{ animationDelay: `${index * 55}ms` }}
            type="button"
          >
            <div className="knowledge-card-top">
              <span className="panel-icon">
                <FileText size={18} />
              </span>
              <span className={doc.status === "Ready" ? "badge success" : "badge warning"}>{doc.status}</span>
            </div>
            <h2>{doc.title}</h2>
            <p className="muted">{doc.category} source prepared for retrieval and answer grounding.</p>
            <div className="knowledge-card-metrics">
              <span>
                <Layers3 size={15} />
                    {doc.chunks || doc.documents} chunks
              </span>
              <span>
                <Search size={15} />
                RAG-ready
              </span>
              <span>
                {doc.status === "Ready" ? <CheckCircle2 size={15} /> : <Sparkles size={15} />}
                {doc.status === "Ready" ? "Indexed" : "Review"}
              </span>
            </div>
            <div className="meter">
              <span style={{ width: `${doc.status === "Ready" ? 100 : 62}%` }} />
            </div>
          </button>
        ))}
      </section>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card source-inspector-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Source Inspector</span>
              <h2>{selectedSource?.title || "Select a source"}</h2>
              <p className="muted">Review chunks, retrieval status, and why this source matters.</p>
            </div>
            <span className={selectedSource?.status === "Ready" ? "badge success" : "badge warning"}>
              {selectedSource?.status || "No source"}
            </span>
          </div>
          {selectedSource ? (
            <div className="chunk-preview-list">
              {(selectedSource.chunkPreviews.length ? selectedSource.chunkPreviews : Array.from({ length: Math.min(4, Math.max(1, Math.ceil(selectedSource.chunks / 6))) }, (_, index) => ({
                id: `${selectedSource.id}-${index}`,
                chunkNumber: index + 1,
                content: `${selectedSource.title} contains support guidance for ${activeOrganization.name}. Use this chunk when answering customer questions about ${selectedSource.category.toLowerCase()}.`,
                tokenCount: 0,
                documentTitle: selectedSource.title,
                sourceUrl: selectedSource.url
              }))).map((chunk) => (
                <article className="chunk-preview" key={chunk.id}>
                  <div>
                    <strong>Chunk {chunk.chunkNumber}</strong>
                    <span className="muted">{chunk.documentTitle} / {chunk.tokenCount || "estimated"} tokens</span>
                  </div>
                  <p>{chunk.content}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">No knowledge source selected.</div>
          )}
        </div>

        <div className="card knowledge-update-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Train The AI</span>
              <h2>Add knowledge update</h2>
              <p className="muted">Upload docs or type policy changes the AI should learn from.</p>
            </div>
            <Upload color="var(--accent)" size={20} />
          </div>
          <label className="field upload-dropzone">
            <Upload size={18} />
            <span>Upload PDFs, docs, screenshots, images, or policy files</span>
            <input
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                setSelectedFiles(files);
                setUploadedFiles(files.map((file) => file.name));
              }}
              type="file"
            />
          </label>
          {uploadedFiles.length ? (
            <div className="compact-list">
              {uploadedFiles.map((file) => (
                <div className="list-row" key={file}>
                  <strong>{file}</strong>
                  <span className="badge">Queued</span>
                </div>
              ))}
            </div>
          ) : null}
          <label className="field">
            <span>Update title</span>
            <input
              className="input"
              onChange={(event) => setManualTitle(event.target.value)}
              value={manualTitle}
            />
          </label>
          <label className="field">
            <span>Manual instruction or policy change</span>
            <textarea
              className="textarea"
              onChange={(event) => setManualUpdate(event.target.value)}
              placeholder="Example: If a customer asks about refunds after a failed render, explain the review process and do not promise approval."
              value={manualUpdate}
            />
          </label>
          <div className="button-row">
            <button className="button" disabled={saving || !manualUpdate.trim()} onClick={saveManualKnowledge} type="button">
              <MessageSquareText size={16} />
              Save text update
            </button>
            <button className="button secondary" disabled={saving || (!manualUpdate.trim() && !selectedFiles.length)} onClick={uploadKnowledge} type="button">
              <Upload size={16} />
              Upload knowledge
            </button>
          </div>
          {message ? <p className="muted">{message}</p> : null}
          <p className="muted" style={{ fontSize: 13 }}>
            Text, Markdown, CSV, and JSON files are indexed immediately. PDFs, docs, and images are stored
            for parser review so they can be approved before retrieval uses them.
          </p>
        </div>
      </section>
    </>
  );
}
