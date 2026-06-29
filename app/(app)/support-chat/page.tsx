"use client";

import { FormEvent, type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clipboard,
  ExternalLink,
  FileUp,
  Image as ImageIcon,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Route,
  Search,
  Send,
  Sparkles,
  X
} from "lucide-react";
import { appEnv } from "@/lib/env";
import { useOrganization } from "@/lib/org";
import { cn } from "@/lib/utils";

type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  isImage: boolean;
  previewUrl?: string;
};

type ChatSource = {
  chunkId: string;
  documentId: string;
  title: string;
  sourceUrl: string;
  category: string;
  score: number;
  similarityScore?: number;
  snippet: string;
  chunkText?: string;
};

type AiThinking = {
  intent: string;
  priority: string;
  sentiment: string;
  confidence: number;
  retrieved: string[];
  reasoning: string;
  action: "Respond" | "Ask for details" | "Escalate";
};

type ConversationReplayStep = {
  stepKey:
    | "customer"
    | "embedding"
    | "vector_search"
    | "retrieved_documents"
    | "reasoning"
    | "final_response";
  title: string;
  detail: string;
  metadata: Record<string, unknown>;
  sortOrder: number;
};

type ReasoningPipelineState = {
  stages: Array<{
    name: string;
    status: "complete" | "warning" | "blocked";
    detail: string;
  }>;
};

type EscalationDecision = {
  shouldEscalate: boolean;
  queue: string;
  reason: string;
  severity: string;
};

type ChatMetrics = {
  confidence: number;
  retrievalConfidence: number;
  reasoningConfidence: number;
  finalConfidence: number;
  retrievalScore: number;
  documentsUsed: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
};

type MessageIntelligence = {
  intent: {
    intent: string;
    confidence: number;
    priority: string;
  };
  sentiment: {
    sentiment: string;
    confidence: number;
  };
  entities: Record<string, string[]>;
  confidence: {
    retrievalConfidence: number;
    reasoningConfidence: number;
    finalConfidence: number;
  };
  validation: {
    status: "pass" | "warn" | "fail";
    hallucinationRisk: string;
    missingCitations: boolean;
    policyConflicts: string[];
    unsafeOutput: boolean;
    notes: string[];
  };
  pipeline?: ReasoningPipelineState;
  escalation?: EscalationDecision;
};

type ChatMessage = {
  id: string;
  role: "customer" | "assistant" | "system" | "tool";
  content: string;
  attachments: ChatAttachment[];
  sources: ChatSource[];
  metrics: ChatMetrics | null;
  thinking: AiThinking | null;
  replaySteps: ConversationReplayStep[];
  intelligence: MessageIntelligence | null;
  pipeline: ReasoningPipelineState | null;
  escalation: EscalationDecision | null;
  createdAt: string;
};

type ConversationListItem = {
  id: string;
  title: string;
  status: "open" | "waiting" | "resolved" | "escalated";
  customerName: string | null;
  currentIssue: string | null;
  updatedAt: string;
  lastMessage: string;
};

type ApiError = {
  message: string;
  missing?: string[];
};

const fallbackSuggestedQuestions = [
  "My credits disappeared",
  "My render failed",
  "How do I upgrade?",
  "Can I use images commercially?",
  "My API isn't working"
];

export default function SupportChatPage() {
  const { activeOrganization } = useOrganization();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState(fallbackSuggestedQuestions);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [missingConfig, setMissingConfig] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<ChatSource | null>(null);
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const endRef = useRef<HTMLDivElement | null>(null);

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages]
  );
  const latestSources = latestAssistant?.sources || [];
  const latestMetrics = latestAssistant?.metrics || null;
  const latestThinking = latestAssistant?.thinking || null;
  const latestReplaySteps = latestAssistant?.replaySteps || [];
  const latestIntelligence = latestAssistant?.intelligence || null;
  const latestPipeline = latestAssistant?.pipeline || latestIntelligence?.pipeline || null;
  const latestEscalation = latestAssistant?.escalation || latestIntelligence?.escalation || null;

  useEffect(() => {
    if (!latestSources.length) {
      setSelectedSource(null);
      return;
    }

    if (!selectedSource || !latestSources.some((source) => source.chunkId === selectedSource.chunkId)) {
      setSelectedSource(latestSources[0]);
    }
  }, [latestSources, selectedSource]);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/support-chat/conversations?organizationId=${encodeURIComponent(activeOrganization.id)}`
      );
      const payload = (await response.json()) as {
        data?: ConversationListItem[];
        error?: ApiError;
      };

      if (!response.ok) {
        setError(payload.error?.message || "Unable to load AI Support Chat history.");
        setMissingConfig(payload.error?.missing || []);
        setConversations([]);
        return;
      }

      setConversations(payload.data || []);
      setError("");
      setMissingConfig([]);
    } catch {
      setError("Unable to reach AI Support Chat history.");
    }
  }, [activeOrganization.id]);

  const loadSuggestedQuestions = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/support-chat/suggested-questions?organizationId=${encodeURIComponent(activeOrganization.id)}`
      );
      const payload = (await response.json()) as { data?: string[] };
      setSuggestedQuestions(payload.data?.length ? payload.data : fallbackSuggestedQuestions);
    } catch {
      setSuggestedQuestions(fallbackSuggestedQuestions);
    }
  }, [activeOrganization.id]);

  const loadConversation = useCallback(
    async (conversationId: string) => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/support-chat/conversations/${conversationId}?organizationId=${encodeURIComponent(activeOrganization.id)}`
        );
        const payload = (await response.json()) as {
          data?: { id: string; messages: ChatMessage[] } | null;
          error?: ApiError;
        };

        if (!response.ok) {
          setError(payload.error?.message || "Unable to load conversation.");
          setMissingConfig(payload.error?.missing || []);
          return;
        }

        setActiveConversationId(payload.data?.id || null);
        setMessages(payload.data?.messages || []);
        setError("");
        setMissingConfig([]);
      } catch {
        setError("Unable to reach this conversation.");
      } finally {
        setLoading(false);
      }
    },
    [activeOrganization.id]
  );

  useEffect(() => {
    setLoading(true);
    setActiveConversationId(null);
    setMessages([]);
    setAttachments([]);
    setSelectedSource(null);
    Promise.all([loadConversations(), loadSuggestedQuestions()]).finally(() => setLoading(false));
  }, [activeOrganization.id, loadConversations, loadSuggestedQuestions]);

  useEffect(() => {
    const conversationId = new URLSearchParams(window.location.search).get("conversationId");
    if (conversationId && conversationId !== activeConversationId) {
      void loadConversation(conversationId);
    }
  }, [activeConversationId, loadConversation]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  async function sendMessage(questionOverride?: string, regenerate = false) {
    const question = (questionOverride || input).trim();
    if (streaming) return;
    if (!regenerate && !question) return;

    setStreaming(true);
    setError("");
    setMissingConfig([]);

    const assistantId = `assistant_${Date.now()}`;
    const userMessage: ChatMessage | null = regenerate
      ? null
      : {
          id: `customer_${Date.now()}`,
          role: "customer",
          content: question,
          attachments,
          sources: [],
          metrics: null,
          thinking: null,
          replaySteps: [],
          intelligence: null,
          pipeline: null,
          escalation: null,
          createdAt: new Date().toISOString()
        };

    setMessages((current) => {
      const withoutLastAssistant =
        regenerate && current.at(-1)?.role === "assistant" ? current.slice(0, -1) : current;
      return [
        ...withoutLastAssistant,
        ...(userMessage ? [userMessage] : []),
        {
          id: assistantId,
          role: "assistant",
          content: "",
          attachments: [],
          sources: [],
          metrics: null,
          thinking: null,
          replaySteps: [],
          intelligence: null,
          pipeline: null,
          escalation: null,
          createdAt: new Date().toISOString()
        }
      ];
    });

    setInput("");
    setAttachments([]);

    try {
      const response = await fetch("/api/support-chat/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: activeOrganization.id,
          organizationName: activeOrganization.name,
          organizationWebsite: activeOrganization.website,
          supportEmail: activeOrganization.supportEmail,
          aiTone: activeOrganization.aiTone,
          conversationId: activeConversationId,
          question,
          attachments: attachments.map(({ previewUrl: _previewUrl, ...attachment }) => attachment),
          regenerate
        })
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: ApiError };
        throw Object.assign(new Error(payload.error?.message || "Unable to send message."), {
          missing: payload.error?.missing || []
        });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const rawLine of lines) {
          if (!rawLine.trim()) continue;
          const event = JSON.parse(rawLine) as
            | { type: "conversation"; conversationId: string }
            | { type: "delta"; content: string }
            | { type: "done"; conversationId: string; message: ChatMessage }
            | { type: "error"; message: string };

          if (event.type === "conversation") {
            setActiveConversationId(event.conversationId);
          }

          if (event.type === "delta") {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: `${message.content}${event.content}` }
                  : message
              )
            );
          }

          if (event.type === "done") {
            setActiveConversationId(event.conversationId);
            setSelectedSource(event.message.sources[0] || null);
            setMessages((current) =>
              current.map((message) => (message.id === assistantId ? event.message : message))
            );
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }

      await loadConversations();
    } catch (caught) {
      const apiError = caught as Error & { missing?: string[] };
      setError(apiError.message || "Unable to send message.");
      setMissingConfig(apiError.missing || []);
      setMessages((current) => current.filter((message) => message.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const next = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      isImage: file.type.startsWith("image/"),
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined
    }));
    setAttachments((current) => [...current, ...next].slice(0, 6));
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  async function copyResponse(message: ChatMessage) {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    window.setTimeout(() => setCopiedId(null), 1400);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage();
  }

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">Sprint 3.5</span>
          <h1>AI Support Chat</h1>
          <p>
            Ask the Company Brain real support questions. Answers stream from a grounded retrieval
            pipeline and save confidence, sources, replay steps, latency, and token usage.
          </p>
        </div>
        <span className={latestMetrics ? "badge success" : "badge"}>
          {streaming ? "Answering" : latestMetrics ? "Grounded" : "Ready"}
        </span>
      </div>

      {error ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <strong>{missingConfig.length ? "Backend setup required" : "Chat issue"}</strong>
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

      <div className="chat-workspace">
        <aside className="chat-history card">
          <div className="section-heading compact">
            <div>
              <h2>Conversations</h2>
              <p className="muted">Organization-scoped history.</p>
            </div>
            <button
              aria-label="New chat"
              className="button secondary icon-button"
              onClick={() => {
                setActiveConversationId(null);
                setMessages([]);
                setSelectedSource(null);
                setError("");
                setMissingConfig([]);
              }}
              type="button"
            >
              <MessageSquarePlus size={16} />
            </button>
          </div>

          <div className="conversation-list">
            {conversations.length ? (
              conversations.map((conversation) => (
                <button
                  className={cn("conversation-item", activeConversationId === conversation.id && "active")}
                  key={conversation.id}
                  onClick={() => void loadConversation(conversation.id)}
                  type="button"
                >
                  <strong>{conversation.title}</strong>
                  <span>{conversation.lastMessage || conversation.currentIssue || "No messages yet"}</span>
                  <small>{conversation.status}</small>
                </button>
              ))
            ) : (
              <div className="empty-state">
                <strong>No saved chats yet</strong>
                <p className="muted">Start with a suggested question.</p>
              </div>
            )}
          </div>
        </aside>

        <section className="chat-panel card">
          <div className="chat-panel-header">
            <div>
              <h2>{activeConversationId ? "Support conversation" : "New support conversation"}</h2>
              <p className="muted">
                Retrieval flow: question embedding, pgvector search, top 8 chunks, rerank, prompt,
                streamed GPT answer.
              </p>
            </div>
            {streaming ? (
              <span className="badge">
                <Loader2 className="spin" size={13} />
                Typing
              </span>
            ) : null}
          </div>

          <div className="chat-messages" aria-live="polite">
            {loading && !messages.length ? <PremiumLoader label="Loading chat workspace" /> : null}

            {!loading && !messages.length ? (
              <div className="suggested-panel">
                <Sparkles size={22} />
                <h2>Suggested questions</h2>
                <div className="suggested-grid">
                  {suggestedQuestions.map((question) => (
                    <button
                      className="suggested-question"
                      disabled={streaming}
                      key={question}
                      onClick={() => void sendMessage(question)}
                      type="button"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <article className={cn("chat-message", message.role)} key={message.id}>
                <div className={cn("chat-bubble", message.role === "assistant" && streaming && !message.content && "is-thinking")}>
                  <div className="message-meta">
                    <strong>{message.role === "assistant" ? "Nexamind AI" : "Customer"}</strong>
                    {message.role === "assistant" && message.metrics ? (
                      <ConfidenceBadge value={message.metrics.confidence} />
                    ) : null}
                  </div>
                  {message.content ? <MarkdownContent content={message.content} /> : <TypingDots />}
                  {message.attachments.length ? (
                    <div className="attachment-row">
                      {message.attachments.map((attachment) => (
                        <span className="attachment-chip" key={attachment.id}>
                          {attachment.isImage ? <ImageIcon size={14} /> : <FileUp size={14} />}
                          {attachment.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {message.role === "assistant" && message.content ? (
                    <div className="message-actions">
                      <button className="button ghost compact-button" onClick={() => void copyResponse(message)} type="button">
                        <Clipboard size={14} />
                        {copiedId === message.id ? "Copied" : "Copy"}
                      </button>
                      {message.id === latestAssistant?.id ? (
                        <button
                          className="button ghost compact-button"
                          disabled={streaming}
                          onClick={() => void sendMessage(undefined, true)}
                          type="button"
                        >
                          <RefreshCw size={14} />
                          Regenerate
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
            <div ref={endRef} />
          </div>

          {attachments.length ? (
            <div className="composer-attachments">
              {attachments.map((attachment) => (
                <div className="attachment-preview" key={attachment.id}>
                  {attachment.previewUrl ? (
                    <img alt="" src={attachment.previewUrl} />
                  ) : (
                    <FileUp size={16} />
                  )}
                  <span>{attachment.name}</span>
                  <button aria-label={`Remove ${attachment.name}`} onClick={() => removeAttachment(attachment.id)} type="button">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <form className="chat-composer" onSubmit={handleSubmit}>
            <label className="button secondary icon-button" title="Attach files">
              <FileUp size={16} />
              <input
                accept="image/*,.txt,.md,.pdf,.csv,.json"
                multiple
                onChange={(event) => handleFiles(event.target.files)}
                type="file"
              />
            </label>
            <textarea
              className="textarea"
              disabled={streaming}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Ask about credits, renders, upgrades, licensing, API errors..."
              value={input}
            />
            <button className="button icon-button" disabled={streaming || !input.trim()} type="submit">
              {streaming ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
            </button>
          </form>
        </section>

        <aside className="sources-panel card">
          {appEnv.demoMode ? (
            <AiThinkingPanel
              metrics={latestMetrics}
              onToggle={() => setThinkingOpen((current) => !current)}
              open={thinkingOpen}
              sources={latestSources}
              thinking={latestThinking}
            />
          ) : null}

          <PanelSection
            badge={`${latestSources.length} docs`}
            description="Click a source to inspect grounding."
            title="Sources"
          >
            {latestSources.length ? (
              <div className="source-stack">
                {latestSources.map((source) => (
                  <button
                    className={cn("answer-source", selectedSource?.chunkId === source.chunkId && "active")}
                    key={source.chunkId}
                    onClick={() => setSelectedSource(source)}
                    type="button"
                  >
                    <span className="source-confidence" style={{ "--confidence": `${Math.round(source.score * 100)}%` } as CSSProperties}>
                      {Math.round(source.score * 100)}
                    </span>
                    <span>
                      <strong>{source.title}</strong>
                      <small>
                        {source.category} - score {Math.round(source.score * 100)}%
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>No sources yet</strong>
                <p className="muted">Ask a question after the Company Brain has been indexed.</p>
              </div>
            )}
          </PanelSection>

          <RetrievalInspector source={selectedSource} />

          <PanelSection description="Saved with every assistant response." title="Response Metrics">
            <div className="metric-stack">
              <Metric label="Retrieval confidence" value={latestMetrics ? `${Math.round(latestMetrics.retrievalConfidence * 100)}%` : "-"} />
              <Metric label="Reasoning confidence" value={latestMetrics ? `${Math.round(latestMetrics.reasoningConfidence * 100)}%` : "-"} />
              <Metric label="Final confidence" value={latestMetrics ? `${Math.round(latestMetrics.finalConfidence * 100)}%` : "-"} />
              <Metric label="Retrieval score" value={latestMetrics ? `${Math.round(latestMetrics.retrievalScore * 100)}%` : "-"} />
              <Metric label="Documents used" value={latestMetrics ? String(latestMetrics.documentsUsed) : "-"} />
              <Metric label="Latency" value={latestMetrics ? `${latestMetrics.latencyMs}ms` : "-"} />
              <Metric label="Tokens" value={latestMetrics ? String(latestMetrics.totalTokens) : "-"} />
            </div>
          </PanelSection>

          <EntityPanel intelligence={latestIntelligence} />
          <ValidationPanel intelligence={latestIntelligence} />
          <EscalationPanel escalation={latestEscalation} />
          <ReasoningPipelinePanel pipeline={latestPipeline} />
          <ConversationReplay steps={latestReplaySteps} />
        </aside>
      </div>
    </>
  );
}

function PanelSection({
  badge,
  children,
  description,
  title
}: {
  badge?: string;
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="side-panel-section">
      <div className="section-heading compact">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        {badge ? <span className="badge">{badge}</span> : null}
      </div>
      {children}
    </section>
  );
}

function AiThinkingPanel({
  metrics,
  onToggle,
  open,
  sources,
  thinking
}: {
  metrics: ChatMetrics | null;
  onToggle: () => void;
  open: boolean;
  sources: ChatSource[];
  thinking: AiThinking | null;
}) {
  return (
    <section className="thinking-panel" data-open={open} data-state={thinking ? "ready" : "waiting"}>
      <button className="thinking-toggle" onClick={onToggle} type="button">
        <span>
          <BrainCircuit size={16} />
          AI Thinking
        </span>
        <span className="badge warning">Demo only</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {open ? (
        thinking ? (
          <div className="thinking-body">
            <Metric label="Intent" value={thinking.intent} />
            <Metric label="Priority" value={thinking.priority} />
            <Metric label="Sentiment" value={thinking.sentiment} />
            <Metric label="Confidence" value={`${Math.round(thinking.confidence * 100)}%`} />
            <div className="thinking-block">
              <span>Retrieved</span>
              {thinking.retrieved.length || sources.length ? (
                <ul>
                  {(thinking.retrieved.length ? thinking.retrieved : sources.map((source) => source.title)).map((title, index) => (
                    <li key={`${title}-${index}`}>{title}</li>
                  ))}
                </ul>
              ) : (
                <p>No documents retrieved yet.</p>
              )}
            </div>
            <div className="thinking-block">
              <span>Reasoning</span>
              <p>{thinking.reasoning}</p>
            </div>
            <Metric label="Action" value={thinking.action} />
            {metrics ? <Metric label="Latency" value={`${metrics.latencyMs}ms`} /> : null}
          </div>
        ) : (
          <div className="empty-state">
            <strong>Waiting for an answer</strong>
            <p className="muted">The thinking panel appears after the first grounded response.</p>
          </div>
        )
      ) : null}
    </section>
  );
}

function RetrievalInspector({ source }: { source: ChatSource | null }) {
  return (
    <PanelSection description="Inspect the exact retrieved chunk." title="Retrieval Inspector">
      {source ? (
        <div className="retrieval-inspector">
          <div className="inspector-title">
            <Search size={16} />
            <strong>{source.title}</strong>
          </div>
          <Metric label="Similarity" value={`${Math.round((source.similarityScore ?? source.score) * 100)}%`} />
          <Metric label="Rerank score" value={`${Math.round(source.score * 100)}%`} />
          <div className="thinking-block">
            <span>URL</span>
            {source.sourceUrl ? (
              <a href={source.sourceUrl} rel="noreferrer" target="_blank">
                {source.sourceUrl}
                <ExternalLink size={13} />
              </a>
            ) : (
              <p>No URL stored.</p>
            )}
          </div>
          <div className="thinking-block">
            <span>Chunk text</span>
            <pre>{source.chunkText || source.snippet || "No chunk text stored for this source."}</pre>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <strong>No source selected</strong>
          <p className="muted">Click a source after an answer streams in.</p>
        </div>
      )}
    </PanelSection>
  );
}

function EntityPanel({ intelligence }: { intelligence: MessageIntelligence | null }) {
  const entries = intelligence
    ? Object.entries(intelligence.entities).filter(([, values]) => Array.isArray(values) && values.length)
    : [];

  return (
    <PanelSection description="Automatically extracted from the customer message." title="Entity Extraction">
      {entries.length ? (
        <div className="entity-grid">
          {entries.map(([key, values]) => (
            <div className="entity-row" key={key}>
              <span>{humanizeKey(key)}</span>
              <strong>{values.join(", ")}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>No entities detected</strong>
          <p className="muted">Invoices, emails, generation IDs, subscriptions, models, API keys, browsers, and OS values appear here.</p>
        </div>
      )}
    </PanelSection>
  );
}

function ValidationPanel({ intelligence }: { intelligence: MessageIntelligence | null }) {
  const validation = intelligence?.validation;

  return (
    <PanelSection description="Final answer checks before sending." title="Response Validator">
      {validation ? (
        <div className="validator-panel" data-status={validation.status}>
          <Metric label="Status" value={validation.status} />
          <Metric label="Hallucination risk" value={validation.hallucinationRisk} />
          <Metric label="Missing citations" value={validation.missingCitations ? "Yes" : "No"} />
          <Metric label="Unsafe output" value={validation.unsafeOutput ? "Yes" : "No"} />
          {validation.notes.length || validation.policyConflicts.length ? (
            <div className="thinking-block">
              <span>Notes</span>
              <ul>
                {[...validation.notes, ...validation.policyConflicts].map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="empty-state">
          <strong>No validation yet</strong>
          <p className="muted">The validator runs before each completed assistant response is streamed.</p>
        </div>
      )}
    </PanelSection>
  );
}

function EscalationPanel({ escalation }: { escalation: EscalationDecision | null }) {
  return (
    <PanelSection description="Human handoff decision for this answer." title="Escalation Decision">
      {escalation ? (
        <div className="validator-panel" data-status={escalation.shouldEscalate ? "warn" : "pass"}>
          <Metric label="Decision" value={escalation.shouldEscalate ? "Escalate" : "No escalation"} />
          <Metric label="Queue" value={escalation.queue} />
          <Metric label="Severity" value={escalation.severity} />
          <div className="thinking-block">
            <span>Reason</span>
            <p>{escalation.reason}</p>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <strong>No escalation decision yet</strong>
          <p className="muted">The decision engine runs before the answer is finalized.</p>
        </div>
      )}
    </PanelSection>
  );
}

function ReasoningPipelinePanel({ pipeline }: { pipeline: ReasoningPipelineState | null }) {
  return (
    <PanelSection description="Every message passes through these stages." title="Reasoning Pipeline">
      {pipeline?.stages.length ? (
        <div className="pipeline-mini">
          {pipeline.stages.map((stage) => (
            <div className="pipeline-mini-step" data-status={stage.status} key={stage.name}>
              <strong>{stage.name}</strong>
              <span>{stage.detail}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>No pipeline run yet</strong>
          <p className="muted">Ask a question to create a reasoning trace.</p>
        </div>
      )}
    </PanelSection>
  );
}

function ConversationReplay({ steps }: { steps: ConversationReplayStep[] }) {
  return (
    <PanelSection description="Stored turn-by-turn debug timeline." title="Conversation Replay">
      {steps.length ? (
        <div className="replay-timeline">
          {steps
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((step) => (
              <div className="replay-step" key={`${step.stepKey}-${step.sortOrder}`} style={{ animationDelay: `${step.sortOrder * 80}ms` }}>
                <span className="replay-icon">
                  <Route size={14} />
                </span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>No replay yet</strong>
          <p className="muted">Replay steps are stored with each completed assistant response.</p>
        </div>
      )}
    </PanelSection>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="chat-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const score = Math.round(value * 100);
  const tone = score >= 80 ? "success" : score >= 60 ? "warning" : "danger";

  return (
    <span className={`confidence-badge ${tone}`}>
      <span style={{ "--confidence": `${score}%` } as CSSProperties} />
      {score}% confidence
    </span>
  );
}

function PremiumLoader({ label }: { label: string }) {
  return (
    <div className="premium-loader">
      <span className="loader-orbit">
        <span />
        <span />
      </span>
      <strong>{label}</strong>
      <p className="muted">Preparing memory, retrieval, reasoning, and safety context.</p>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="typing-dots" aria-label="Typing">
      <span />
      <span />
      <span />
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const parts = content.split(/```([\s\S]*?)```/g);

  return (
    <div className="markdown">
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <pre key={`${index}-${part.slice(0, 12)}`}>
            <code>{part.trim()}</code>
          </pre>
        ) : (
          <MarkdownText key={`${index}-${part.slice(0, 12)}`} text={part} />
        )
      )}
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("### ")) {
          return <h4 key={`${index}-${trimmed}`}>{trimmed.replace(/^###\s+/, "")}</h4>;
        }

        if (trimmed.startsWith("## ")) {
          return <h3 key={`${index}-${trimmed}`}>{trimmed.replace(/^##\s+/, "")}</h3>;
        }

        if (/^[-*]\s+/.test(trimmed)) {
          return <p className="markdown-list-line" key={`${index}-${trimmed}`}>{trimmed.replace(/^[-*]\s+/, "")}</p>;
        }

        return <p key={`${index}-${trimmed}`}>{renderInline(trimmed)}</p>;
      })}
    </>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${index}-${part}`}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function humanizeKey(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (match) => match.toUpperCase());
}
