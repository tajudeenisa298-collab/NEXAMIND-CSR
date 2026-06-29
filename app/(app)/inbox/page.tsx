"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Bot, CheckCircle2, ClipboardList, FileText, Hand, History, MessageSquare, NotebookPen, Send, Sparkles, UserRound, Zap } from "lucide-react";
import { useOrganization } from "@/lib/org";

type Conversation = {
  id: string;
  title: string;
  status: string;
  takeoverStatus: string;
  customerName: string | null;
  customerEmail: string | null;
  currentIssue: string | null;
  assignedAgent: string | null;
  updatedAt: string;
  lastMessage: string;
  priority: string;
  intent: string;
  sentiment: string;
};

type Message = {
  id: string;
  role: "customer" | "assistant" | "system" | "tool";
  content: string;
  createdAt: string;
};

type Note = {
  id: string;
  authorName: string;
  body: string;
  visibility: "internal" | "handoff";
  createdAt: string;
};

type Action = {
  id: string;
  actionType: string;
  status: "completed" | "failed" | "skipped";
  label: string;
  createdAt: string;
};

type Source = {
  title: string;
  sourceUrl: string;
  score: number;
  snippet: string;
};

type OneClickAction = {
  actionType: "create_ticket" | "refund_review" | "slack_notify" | "email_followup" | "human_takeover" | "resolve_conversation";
  label: string;
  description: string;
};

type Workspace = {
  conversations: Conversation[];
  selected: Conversation | null;
  messages: Message[];
  notes: Note[];
  actions: Action[];
  aiSummary: string;
  suggestedReply: string;
  customerHistory: string[];
  knowledgeSources: Source[];
  oneClickActions: OneClickAction[];
};

export default function InboxPage() {
  const { activeOrganization } = useOrganization();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = workspace?.selected || null;
  const queueCount = workspace?.conversations.length || 0;
  const takeoverCount = useMemo(
    () => workspace?.conversations.filter((conversation) => conversation.takeoverStatus !== "ai_active").length || 0,
    [workspace]
  );

  async function loadWorkspace(conversationId = selectedId) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ organizationId: activeOrganization.id });
      if (conversationId) params.set("conversationId", conversationId);
      const response = await fetch(`/api/copilot/workspace?${params.toString()}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Agent Workspace failed to load.");
      setWorkspace(json);
      setSelectedId(json.selected?.id || null);
      setReply(json.suggestedReply || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Agent Workspace failed to load.");
    } finally {
      setLoading(false);
    }
  }

  async function saveNote() {
    if (!selected || !note.trim()) return;
    setWorking("note");
    setError(null);
    try {
      const response = await fetch("/api/copilot/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: activeOrganization.id,
          conversationId: selected.id,
          body: note,
          authorName: "Support Agent",
          visibility: "internal"
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Could not save note.");
      setNote("");
      await loadWorkspace(selected.id);
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Could not save note.");
    } finally {
      setWorking(null);
    }
  }

  async function runAction(actionType: OneClickAction["actionType"] | "send_reply") {
    if (!selected) return;
    setWorking(actionType);
    setError(null);
    try {
      const response = await fetch("/api/copilot/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: activeOrganization.id,
          conversationId: selected.id,
          actionType,
          reply,
          note: note || undefined
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || "Action failed.");
      await loadWorkspace(selected.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    } finally {
      setWorking(null);
    }
  }

  useEffect(() => {
    loadWorkspace(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganization.id]);

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">Human Copilot</span>
          <h1>Agent Workspace</h1>
          <p>
            AI summary, suggested reply, customer history, grounded sources,
            internal notes, one-click actions, and human takeover in one place.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="badge">{queueCount} conversations</span>
          <span className="badge warning">{takeoverCount} takeover</span>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="agent-workspace">
        <aside className="card agent-queue">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">Queue</span>
              <h2>Conversations</h2>
            </div>
            <MessageSquare size={18} color="var(--accent)" />
          </div>
          <div className="conversation-list">
            {(workspace?.conversations || []).map((conversation) => (
              <button
                className={`conversation-item ${conversation.id === selectedId ? "active" : ""}`}
                key={conversation.id}
                onClick={() => {
                  setSelectedId(conversation.id);
                  loadWorkspace(conversation.id);
                }}
              >
                <strong>{conversation.title}</strong>
                <span>{conversation.customerName || "Customer"} · {conversation.intent}</span>
                <small>{conversation.lastMessage || conversation.currentIssue || "No messages yet"}</small>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className={conversation.priority === "High" || conversation.priority === "Urgent" ? "badge warning" : "badge"}>
                    {conversation.priority}
                  </span>
                  <span className="badge">{conversation.sentiment}</span>
                </div>
              </button>
            ))}
            {!loading && !workspace?.conversations.length ? <div className="empty-state">No conversations yet.</div> : null}
          </div>
        </aside>

        <main className="card agent-thread">
          {selected ? (
            <>
              <div className="agent-thread-header">
                <div>
                  <span className="eyebrow">{selected.status}</span>
                  <h2>{selected.title}</h2>
                  <p className="muted">
                    {selected.customerName || "Customer"} · {selected.customerEmail || "No email"} · {selected.takeoverStatus.replace("_", " ")}
                  </p>
                </div>
                <span className="badge">{selected.assignedAgent || "AI active"}</span>
              </div>

              <div className="agent-messages">
                {(workspace?.messages || []).map((message) => (
                  <div className={`agent-message ${message.role}`} key={message.id}>
                    <div className="agent-message-avatar">
                      {message.role === "customer" ? <UserRound size={16} /> : <Bot size={16} />}
                    </div>
                    <div>
                      <strong>{message.role === "customer" ? selected.customerName || "Customer" : message.role === "assistant" ? "Assistant" : message.role}</strong>
                      <p>{message.content}</p>
                      <span className="muted">{formatTime(message.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="agent-reply-box">
                <label className="field">
                  <span>Suggested reply</span>
                  <textarea className="textarea" value={reply} onChange={(event) => setReply(event.target.value)} />
                </label>
                <button className="button" onClick={() => runAction("send_reply")} disabled={working === "send_reply" || !reply.trim()}>
                  <Send size={16} />
                  Send reply
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">Select a conversation to open the Agent Workspace.</div>
          )}
        </main>

        <aside className="copilot-panel">
          <Panel title="AI Summary" eyebrow="Copilot" icon={<Sparkles size={18} />}>
            <p>{workspace?.aiSummary || "No summary yet."}</p>
          </Panel>

          <Panel title="Customer History" eyebrow="Memory" icon={<History size={18} />}>
            <ul className="compact-bullets">
              {(workspace?.customerHistory || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
              {!workspace?.customerHistory.length ? <li>No customer history yet.</li> : null}
            </ul>
          </Panel>

          <Panel title="Knowledge Sources" eyebrow="Grounding" icon={<FileText size={18} />}>
            <div className="source-stack">
              {(workspace?.knowledgeSources || []).map((source, index) => (
                <div className="mini-source" key={`${source.title}-${source.sourceUrl}-${index}`}>
                  <strong>{source.title}</strong>
                  <span className="muted">{Math.round((source.score || 0) * 100)}% match</span>
                  <p>{source.snippet}</p>
                </div>
              ))}
              {!workspace?.knowledgeSources.length ? <div className="empty-state">No cited sources yet.</div> : null}
            </div>
          </Panel>

          <Panel title="One-Click Actions" eyebrow="Work" icon={<Zap size={18} />}>
            <div className="action-grid">
              {(workspace?.oneClickActions || []).map((action) => (
                <button
                  className="button secondary"
                  key={action.actionType}
                  onClick={() => runAction(action.actionType)}
                  disabled={working === action.actionType}
                  title={action.description}
                >
                  {action.actionType === "human_takeover" ? <Hand size={15} /> : <ClipboardList size={15} />}
                  {action.label}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Internal Notes" eyebrow="Agent" icon={<NotebookPen size={18} />}>
            <label className="field">
              <span>Private note</span>
              <textarea className="textarea" value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            <button className="button secondary" onClick={saveNote} disabled={working === "note" || !note.trim()}>
              Save note
            </button>
            <div className="note-list">
              {(workspace?.notes || []).map((item) => (
                <div className="note-item" key={item.id}>
                  <strong>{item.authorName}</strong>
                  <p>{item.body}</p>
                  <span className="muted">{formatTime(item.createdAt)}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Action History" eyebrow="Audit" icon={<CheckCircle2 size={18} />}>
            <div className="note-list">
              {(workspace?.actions || []).map((action) => (
                <div className="note-item" key={action.id}>
                  <strong>{action.label}</strong>
                  <span className="muted">{action.status} · {formatTime(action.createdAt)}</span>
                </div>
              ))}
              {!workspace?.actions.length ? <div className="empty-state">No actions yet.</div> : null}
            </div>
          </Panel>
        </aside>
      </section>
    </>
  );
}

function Panel({ eyebrow, title, icon, children }: { eyebrow: string; title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="card copilot-card">
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <span className="panel-icon">{icon}</span>
      </div>
      {children}
    </section>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
