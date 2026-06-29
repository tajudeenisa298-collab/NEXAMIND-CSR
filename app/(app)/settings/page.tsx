"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { appEnv, getEnvironmentStatus } from "@/lib/env";
import { useOrganization } from "@/lib/org";

export default function SettingsPage() {
  const { activeOrganization, organizations, removeOrganization, updateActiveOrganization } = useOrganization();
  const [form, setForm] = useState(activeOrganization);
  const [saved, setSaved] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [removing, setRemoving] = useState(false);
  const [removeMessage, setRemoveMessage] = useState("");

  useEffect(() => {
    setForm(activeOrganization);
  }, [activeOrganization]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateActiveOrganization({
      name: form.name,
      website: form.website,
      supportEmail: form.supportEmail,
      timezone: form.timezone,
      aiTone: form.aiTone,
      escalationThreshold: Number(form.escalationThreshold)
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  async function handleRemoveOrganization() {
    if (confirmName !== activeOrganization.name) return;
    setRemoving(true);
    setRemoveMessage("");
    try {
      const response = await fetch("/api/organizations/offboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: activeOrganization.id })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Unable to remove company.");
      removeOrganization(activeOrganization.id);
      setConfirmName("");
      setRemoveMessage(json.message || "Company removed from the workspace.");
    } catch (error) {
      setRemoveMessage(error instanceof Error ? error.message : "Unable to remove company.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>Workspace configuration</h1>
          <p>
            Organization settings are tenant-scoped and persisted locally until Supabase
            tables are connected.
          </p>
        </div>
        {saved ? <span className="badge success">Saved</span> : null}
      </div>

      <div className="grid cols-2">
        <form className="card settings-section" onSubmit={handleSubmit}>
          <h2>Organization</h2>
          <label className="field">
            <span>Company name</span>
            <input
              className="input"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              value={form.name}
            />
          </label>
          <label className="field">
            <span>Company website</span>
            <input
              className="input"
              onChange={(event) => setForm({ ...form, website: event.target.value })}
              value={form.website}
            />
          </label>
          <label className="field">
            <span>Support email</span>
            <input
              className="input"
              onChange={(event) => setForm({ ...form, supportEmail: event.target.value })}
              type="email"
              value={form.supportEmail}
            />
          </label>
          <label className="field">
            <span>Timezone</span>
            <input
              className="input"
              onChange={(event) => setForm({ ...form, timezone: event.target.value })}
              value={form.timezone}
            />
          </label>
          <label className="field">
            <span>AI tone</span>
            <textarea
              className="textarea"
              onChange={(event) => setForm({ ...form, aiTone: event.target.value })}
              value={form.aiTone}
            />
          </label>
          <label className="field">
            <span>Escalation threshold</span>
            <input
              className="input"
              max="1"
              min="0"
              onChange={(event) =>
                setForm({ ...form, escalationThreshold: Number(event.target.value) })
              }
              step="0.01"
              type="number"
              value={form.escalationThreshold}
            />
          </label>
          <button className="button" type="submit">
            <Save size={16} />
            Save settings
          </button>
        </form>

        <section className="card settings-section">
          <h2>Demo Mode</h2>
          <div className="env-row">
            <div>
              <strong>{appEnv.demoMode ? "Demo infrastructure is active" : "Client infrastructure is active"}</strong>
              <div className="muted">
                {appEnv.demoMode
                  ? "Automations can route to your Make.com, Slack, Discord, and email demo accounts."
                  : "Automations should use the customer-owned integration credentials."}
              </div>
            </div>
            <span className={appEnv.demoMode ? "badge success" : "badge"}>{appEnv.demoMode ? "Demo" : "Client"}</span>
          </div>
          <p className="muted">
            Change `NEXT_PUBLIC_DEMO_MODE` and `DEMO_MODE` in `.env.local`, then restart the app.
          </p>
        </section>

        <section className="card settings-section">
          <h2>Environment variables</h2>
          <p className="muted">
            Add these values in `.env.local` when connecting Supabase, OpenAI, and demo infrastructure.
          </p>
          <div className="list">
            {getEnvironmentStatus().map((item) => (
              <div className="env-row" key={item.key}>
                <div>
                  <strong>{item.key}</strong>
                  <div className="muted">{item.label}</div>
                </div>
                <span className={item.configured ? "badge success" : "badge warning"}>
                  {item.configured ? "Configured" : "Missing"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card settings-section">
          <h2>Offboard company</h2>
          <p className="muted">
            Remove the active company from this demo workspace. In production this maps to
            tenant offboarding: revoke access, archive data, and remove the organization from the switcher.
          </p>
          <div className="env-row">
            <div>
              <strong>{activeOrganization.name}</strong>
              <div className="muted">{activeOrganization.website}</div>
            </div>
            <span className="badge warning">{organizations.length} companies</span>
          </div>
          <label className="field">
            <span>Type company name to confirm</span>
            <input
              className="input"
              onChange={(event) => setConfirmName(event.target.value)}
              placeholder={activeOrganization.name}
              value={confirmName}
            />
          </label>
          <button
            className="button secondary"
            disabled={confirmName !== activeOrganization.name || removing}
            onClick={handleRemoveOrganization}
            type="button"
          >
            <Trash2 size={16} />
            {removing ? "Removing company" : "Remove company"}
          </button>
          {removeMessage ? <p className="muted">{removeMessage}</p> : null}
        </section>
      </div>
    </>
  );
}
