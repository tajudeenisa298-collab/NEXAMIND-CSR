"use client";

import { FormEvent, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Clapperboard, Globe2, Loader2, Palette, Sparkles, Wand2 } from "lucide-react";
import { normalizeWebsiteInput } from "@/lib/company-brain";
import { useOrganization } from "@/lib/org";

type DemoStep = {
  label: string;
  status: "complete" | "warning" | "skipped";
  detail: string;
};

type DemoResult = {
  organizationId: string;
  companyName: string;
  website: string;
  status: "ready" | "partial";
  steps: DemoStep[];
  nextUrl: string;
  customerLoginUrl: string;
};

const previewSteps = [
  "Crawl website",
  "Build Company Brain",
  "Apply branding",
  "Generate sample conversations",
  "Create executive dashboard",
  "Create isolated workspace"
];

export default function DemoBuilderPage() {
  const router = useRouter();
  const { createOrganization } = useOrganization();
  const [companyName, setCompanyName] = useState("PicX Studio");
  const [website, setWebsite] = useState("picxstudio.com");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1f8a5b");
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DemoResult | null>(null);

  const normalizedPreview = useMemo(() => {
    try {
      return normalizeWebsiteInput(website);
    } catch {
      return website;
    }
  }, [website]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setBuilding(true);

    try {
      const normalizedWebsite = normalizeWebsiteInput(website);
      const organization = createOrganization({
        name: companyName,
        website: normalizedWebsite,
        brandColor: primaryColor,
        logoUrl: logoUrl.trim() || undefined,
        isolateWorkspace: true
      });

      const response = await fetch("/api/demo-builder/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: organization.id,
          companyName,
          website: normalizedWebsite,
          logoUrl: logoUrl.trim() || undefined,
          primaryColor
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Unable to build demo.");
      setResult(json);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to build demo.");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">AI Workspace Builder</span>
          <h1>Build a company workspace from a website</h1>
          <p>
            Enter a company website and create a single-company workspace with Company Brain,
            dashboard, knowledge, AI chat, automations, and sample conversations.
          </p>
        </div>
        <span className={result?.status === "ready" ? "badge success" : result ? "badge warning" : "badge"}>
          {building ? "Building" : result ? result.status : "Ready"}
        </span>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="demo-builder-layout">
        <form className="card demo-builder-form" onSubmit={handleSubmit}>
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">Input</span>
              <h2>Company details</h2>
            </div>
            <Clapperboard color="var(--accent)" size={20} />
          </div>

          <label className="field">
            <span>Company name</span>
            <input className="input" onChange={(event) => setCompanyName(event.target.value)} required value={companyName} />
          </label>

          <label className="field">
            <span>Website</span>
            <input className="input" onChange={(event) => setWebsite(event.target.value)} placeholder="example.com" required value={website} />
          </label>

          <label className="field">
            <span>Logo URL</span>
            <input className="input" onChange={(event) => setLogoUrl(event.target.value)} placeholder="https://example.com/logo.png" value={logoUrl} />
          </label>

          <label className="field">
            <span>Primary color</span>
            <div className="color-input-row">
              <input aria-label="Primary color" onChange={(event) => setPrimaryColor(event.target.value)} type="color" value={primaryColor} />
              <input className="input" onChange={(event) => setPrimaryColor(event.target.value)} value={primaryColor} />
            </div>
          </label>

          <button className="button" disabled={building} type="submit">
            {building ? <Loader2 className="spin" size={16} /> : <Wand2 size={16} />}
            Build Workspace
            <ArrowRight size={16} />
          </button>
        </form>

        <aside className="card demo-preview-card" style={{ "--demo-color": primaryColor } as CSSProperties}>
          <div className="demo-preview-brand">
            <span className="demo-logo">
              {logoUrl ? <img alt="" src={logoUrl} /> : <Sparkles size={20} />}
            </span>
            <div>
              <strong>{companyName || "Company Demo"}</strong>
              <span className="muted">{normalizedPreview}</span>
            </div>
          </div>
          <div className="demo-preview-hero">
            <span className="eyebrow">Customer-ready workspace</span>
            <h2>{companyName || "Prospect"} support intelligence</h2>
            <p>
              The customer sees only their company: Company Brain, AI chat, Human Copilot,
              automations, executive metrics, and improvement feedback.
            </p>
          </div>
          <div className="demo-preview-pills">
            <span><Globe2 size={14} /> Website crawl</span>
            <span><Palette size={14} /> Branding</span>
            <span><CheckCircle2 size={14} /> Demo data</span>
          </div>
        </aside>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Build Plan</span>
            <h2>What happens automatically</h2>
          </div>
          {building ? <Loader2 className="spin" color="var(--accent)" size={20} /> : <CheckCircle2 color="var(--accent)" size={20} />}
        </div>

        <div className="demo-step-grid">
          {(result?.steps || previewSteps.map((label) => ({ label, status: "skipped" as const, detail: "Waiting for Build Workspace." }))).map((step, index) => (
            <div className="demo-step-card" data-status={building ? "running" : step.status} key={step.label} style={{ animationDelay: `${index * 55}ms` }}>
              <span className="pipeline-icon">
                {building ? <Loader2 className="spin" size={16} /> : step.status === "complete" ? <CheckCircle2 size={16} /> : <Sparkles size={16} />}
              </span>
              <strong>{step.label}</strong>
              <p className="muted">{step.detail}</p>
            </div>
          ))}
        </div>

        {result ? (
          <div className="demo-ready-panel">
            <div>
              <span className="eyebrow">Demo Ready</span>
              <h2>{result.companyName} workspace is ready</h2>
              <p className="muted">
                Open the workspace and the switcher will show this company alone. Walk through
                Company Brain, AI Chat, Human Copilot, Automation, Executive Intelligence, and AI Improvement.
              </p>
              <div className="customer-link-box">
                <span className="eyebrow">Customer login link</span>
                <code>{result.customerLoginUrl}</code>
              </div>
            </div>
            <button className="button" onClick={() => router.push(result.nextUrl)} type="button">
              Open workspace
              <ArrowRight size={16} />
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}
