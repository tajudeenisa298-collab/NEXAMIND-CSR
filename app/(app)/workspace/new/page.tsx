"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";
import { normalizeWebsiteInput } from "@/lib/company-brain";
import { useOrganization } from "@/lib/org";

export default function NewWorkspacePage() {
  const router = useRouter();
  const { createOrganization } = useOrganization();
  const [name, setName] = useState("PicX Studio");
  const [website, setWebsite] = useState("picxstudio.com");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      const normalizedWebsite = normalizeWebsiteInput(website);
      createOrganization({ name, website: normalizedWebsite });
      router.push(`/company-brain?website=${encodeURIComponent(normalizedWebsite)}&autostart=1`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create workspace.");
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">Create Workspace</span>
          <h1>Start with the company website</h1>
          <p>
            The MVP flow begins by creating a tenant, then building the Company Brain from
            public resources.
          </p>
        </div>
      </div>

      <form className="card settings-section" onSubmit={handleSubmit}>
        <h2>Workspace details</h2>
        <label className="field">
          <span>Company name</span>
          <input
            className="input"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <label className="field">
          <span>Company website</span>
          <input
            className="input"
            onChange={(event) => setWebsite(event.target.value)}
            placeholder="picxstudio.com"
            required
            value={website}
          />
        </label>
        {error ? <p className="muted">{error}</p> : null}
        <button className="button" type="submit">
          <Building2 size={16} />
          Create workspace and build brain
          <ArrowRight size={16} />
        </button>
      </form>
    </>
  );
}

