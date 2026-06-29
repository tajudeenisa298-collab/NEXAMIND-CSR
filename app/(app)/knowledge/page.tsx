"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, Layers3, MessageSquareText, Search, Sparkles, Upload } from "lucide-react";
import { demoKnowledgeSources } from "@/lib/demo-data";
import { useOrganization } from "@/lib/org";

export default function KnowledgePage() {
  const { activeOrganization } = useOrganization();
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [manualUpdate, setManualUpdate] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const docs = demoKnowledgeSources.filter((doc) => doc.organizationId === activeOrganization.id);
  const selectedSource = useMemo(
    () => docs.find((doc) => doc.id === selectedSourceId) || docs[0] || null,
    [docs, selectedSourceId]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    if (source) setSelectedSourceId(source);
  }, []);

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
        <span className="badge success">{docs.reduce((sum, doc) => sum + doc.chunks, 0)} chunks</span>
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
                {doc.chunks} chunks
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
              {Array.from({ length: Math.min(4, Math.max(1, Math.ceil(selectedSource.chunks / 6))) }, (_, index) => (
                <article className="chunk-preview" key={`${selectedSource.id}-${index}`}>
                  <div>
                    <strong>Chunk {index + 1}</strong>
                    <span className="muted">{selectedSource.category} / retrieval-ready / estimated relevance {92 - index * 7}%</span>
                  </div>
                  <p>
                    {selectedSource.title} contains support guidance for {activeOrganization.name}. Use this chunk
                    when answering customer questions about {selectedSource.category.toLowerCase()}.
                  </p>
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
              onChange={(event) => setUploadedFiles(Array.from(event.target.files || []).map((file) => file.name))}
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
            <span>Manual instruction or policy change</span>
            <textarea
              className="textarea"
              onChange={(event) => setManualUpdate(event.target.value)}
              placeholder="Example: If a customer asks about refunds after a failed render, explain the review process and do not promise approval."
              value={manualUpdate}
            />
          </label>
          <button className="button" disabled={!manualUpdate.trim() && !uploadedFiles.length} type="button">
            <MessageSquareText size={16} />
            Save training update
          </button>
          <p className="muted" style={{ fontSize: 13 }}>
            Next production step: persist these uploads into Supabase Storage, parse them, chunk them,
            embed them, and add them to the evaluation queue.
          </p>
        </div>
      </section>
    </>
  );
}
