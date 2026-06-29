"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Building2, Loader2, LockKeyhole, Mail, Sparkles } from "lucide-react";
import type { Organization } from "@/lib/demo-data";
import { useOrganization } from "@/lib/org";

const USER_STORAGE_KEY = "nexamind.demo.user";

export default function CustomerLoginPage() {
  return (
    <Suspense fallback={<CustomerLoginFallback />}>
      <CustomerLoginContent />
    </Suspense>
  );
}

function CustomerLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setCustomerWorkspace } = useOrganization();
  const workspaceId = searchParams.get("workspace") || "";
  const invitedEmail = searchParams.get("email") || "";
  const [workspace, setWorkspace] = useState<Organization | null>(null);
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const workspaceUrl = useMemo(() => {
    if (!workspaceId) return "";
    const params = new URLSearchParams({ workspace: workspaceId });
    if (email) params.set("email", email);
    return `/customer-login?${params.toString()}`;
  }, [email, workspaceId]);

  useEffect(() => {
    async function loadWorkspace() {
      setLoading(true);
      setError("");
      try {
        if (!workspaceId) throw new Error("This login link is missing a workspace ID.");
        const response = await fetch(`/api/workspaces/public?workspace=${encodeURIComponent(workspaceId)}`);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error?.message || "Unable to load workspace.");
        setWorkspace(json);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load workspace.");
      } finally {
        setLoading(false);
      }
    }

    void loadWorkspace();
  }, [workspaceId]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace) return;
    setSubmitting(true);

    const userEmail = email.trim() || `admin@${new URL(workspace.website || "https://example.com").hostname}`;
    const userName = userEmail.split("@")[0] || "Customer Admin";

    window.localStorage.setItem(
      USER_STORAGE_KEY,
      JSON.stringify({
        id: `customer_${workspace.id}`,
        email: userEmail,
        name: userName,
        role: "Owner"
      })
    );
    setCustomerWorkspace(workspace);
    router.replace("/dashboard");
  }

  return (
    <main className="auth-page customer-login-page">
      <section className="auth-card customer-login-card">
        <div className="demo-preview-brand">
          <span className="demo-logo" style={{ background: workspace?.brandColor || "#1f8a5b" }}>
            {workspace?.logoUrl ? <img alt="" src={workspace.logoUrl} /> : <Building2 size={20} />}
          </span>
          <div>
            <span className="eyebrow">Customer Workspace</span>
            <strong>{workspace?.name || "Loading workspace"}</strong>
          </div>
        </div>

        <h1>{workspace ? `Welcome to ${workspace.name}` : "Preparing your workspace"}</h1>
        <p>
          Sign in to open your company-only Nexamind workspace with Company Brain,
          dashboard, knowledge, AI chat, automations, and sample support conversations.
        </p>

        {loading ? (
          <div className="premium-loader compact-loader">
            <div className="loader-orbit" aria-hidden="true">
              <span />
              <span />
            </div>
            <strong>Loading customer workspace</strong>
          </div>
        ) : null}

        {error ? <div className="error-banner">{error}</div> : null}

        {!loading && workspace ? (
          <form className="form-stack" onSubmit={handleLogin}>
            <label className="field">
              <span>Email</span>
              <div className="input-icon-row">
                <Mail size={16} />
                <input
                  className="input"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="caitlin@picxstudio.com"
                  type="email"
                  value={email}
                />
              </div>
            </label>

            <label className="field">
              <span>Password</span>
              <div className="input-icon-row">
                <LockKeyhole size={16} />
                <input
                  className="input"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Use the temporary password you sent"
                  type="password"
                  value={password}
                />
              </div>
            </label>

            <button className="button" disabled={submitting} type="submit">
              {submitting ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
              Open {workspace.name}
              <ArrowRight size={16} />
            </button>

            <div className="customer-link-box">
              <span className="eyebrow">Share link</span>
              <code>{workspaceUrl}</code>
            </div>
          </form>
        ) : null}
      </section>
    </main>
  );
}

function CustomerLoginFallback() {
  return (
    <main className="auth-page customer-login-page">
      <section className="auth-card customer-login-card">
        <div className="loader-orbit" aria-hidden="true">
          <span />
          <span />
        </div>
        <span className="eyebrow">Customer Workspace</span>
        <h1>Preparing login</h1>
        <p>Loading the secure workspace link.</p>
      </section>
    </main>
  );
}
