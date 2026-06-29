"use client";

import { CheckCircle2, FileText, Layers3, Search, Sparkles } from "lucide-react";
import { demoKnowledgeSources } from "@/lib/demo-data";
import { useOrganization } from "@/lib/org";

export default function KnowledgePage() {
  const { activeOrganization } = useOrganization();
  const docs = demoKnowledgeSources.filter((doc) => doc.organizationId === activeOrganization.id);

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
          <article className="card knowledge-card" key={doc.id} style={{ animationDelay: `${index * 55}ms` }}>
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
          </article>
        ))}
      </section>
    </>
  );
}
