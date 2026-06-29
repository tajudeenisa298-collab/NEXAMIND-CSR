import type { ChatSource } from "@/lib/support-chat";

export type SupportIntent =
  | "Billing + Credits"
  | "Render Troubleshooting"
  | "Plan Upgrade"
  | "Commercial License"
  | "API Support"
  | "Account Access"
  | "Bug Report"
  | "General Support";

export type SupportPriority = "Low" | "Medium" | "High" | "Urgent";
export type SupportSentiment = "Neutral" | "Happy" | "Confused" | "Frustrated" | "Angry" | "Urgent";

export type ExtractedEntities = {
  invoices: string[];
  emails: string[];
  generationIds: string[];
  subscriptions: string[];
  models: string[];
  apiKeys: string[];
  browsers: string[];
  operatingSystems: string[];
};

export type IntentResult = {
  intent: SupportIntent;
  confidence: number;
  priority: SupportPriority;
};

export type SentimentResult = {
  sentiment: SupportSentiment;
  confidence: number;
};

export type RollingMemory = {
  customerType: string;
  plan: string;
  currentIssue: string;
  knownFacts: string[];
  previousIssues: string[];
  verifiedSteps: string[];
  waitingOn: string;
  lastSentiment: SupportSentiment;
  lastPriority: SupportPriority;
};

export type ConfidenceResult = {
  retrievalConfidence: number;
  reasoningConfidence: number;
  finalConfidence: number;
};

export type ValidationResult = {
  status: "pass" | "warn" | "fail";
  hallucinationRisk: "low" | "medium" | "high";
  missingCitations: boolean;
  policyConflicts: string[];
  unsafeOutput: boolean;
  notes: string[];
};

export type MessageIntelligence = {
  intent: IntentResult;
  sentiment: SentimentResult;
  entities: ExtractedEntities;
  memory: RollingMemory;
  context: ContextPackage;
  confidence: ConfidenceResult;
  validation: ValidationResult;
  escalation: EscalationDecision;
  pipeline: ReasoningPipelineState;
};

export type ContextPackage = {
  customerQuestion: string;
  customerProfile: {
    customerType: string;
    plan: string;
    email: string | null;
  };
  issueContext: {
    currentIssue: string;
    previousIssues: string[];
    verifiedSteps: string[];
    waitingOn: string;
  };
  extractedEntities: ExtractedEntities;
  retrievalContext: {
    sourceCount: number;
    sourceTitles: string[];
    bestScore: number;
  };
  uiContext: {
    surface: "AI Support Chat";
    mode: "demo" | "production";
  };
};

export type EscalationDecision = {
  shouldEscalate: boolean;
  queue: "Billing" | "Engineering" | "Account" | "Policy" | "General Support" | "None";
  reason: string;
  severity: SupportPriority;
};

export type ReasoningPipelineState = {
  stages: Array<{
    name: string;
    status: "complete" | "warning" | "blocked";
    detail: string;
  }>;
};

const blankEntities: ExtractedEntities = {
  invoices: [],
  emails: [],
  generationIds: [],
  subscriptions: [],
  models: [],
  apiKeys: [],
  browsers: [],
  operatingSystems: []
};

export function analyzeCustomerMessage(input: {
  question: string;
  previousMemory?: Partial<RollingMemory>;
  previousSummary?: string;
}) {
  const entities = extractEntities(input.question);
  const intent = detectIntent(input.question, entities);
  const sentiment = detectSentiment(input.question);
  const priority = detectPriority(input.question, intent.intent, sentiment.sentiment, entities);
  const memory = updateRollingMemory({
    question: input.question,
    entities,
    intent: intent.intent,
    sentiment: sentiment.sentiment,
    priority,
    previousMemory: input.previousMemory,
    previousSummary: input.previousSummary
  });

  return {
    intent: { ...intent, priority },
    sentiment,
    entities,
    memory
  };
}

export function computeConfidence(input: {
  sources: ChatSource[];
  answer: string;
  validation?: ValidationResult;
}) {
  const bestRetrieval = input.sources.length ? Math.max(...input.sources.map((source) => source.score || 0)) : 0;
  const uniqueDocuments = new Set(input.sources.map((source) => source.documentId)).size;
  const retrievalConfidence = input.sources.length
    ? clamp(bestRetrieval * 0.72 + Math.min(uniqueDocuments / 4, 1) * 0.28, 0.05, 0.99)
    : 0.08;

  const answerSpecificity = scoreAnswerSpecificity(input.answer);
  const citationSupport = input.sources.length ? 0.18 : -0.22;
  const reasoningConfidence = clamp(retrievalConfidence * 0.58 + answerSpecificity * 0.24 + citationSupport, 0.05, 0.99);

  const validationPenalty =
    input.validation?.status === "fail" ? 0.35 : input.validation?.status === "warn" ? 0.16 : 0;
  const finalConfidence = clamp(retrievalConfidence * 0.45 + reasoningConfidence * 0.55 - validationPenalty, 0.03, 0.99);

  return {
    retrievalConfidence: round(retrievalConfidence),
    reasoningConfidence: round(reasoningConfidence),
    finalConfidence: round(finalConfidence)
  };
}

export function buildContextPackage(input: {
  question: string;
  memory: RollingMemory;
  entities: ExtractedEntities;
  sources: ChatSource[];
  demoMode?: boolean;
}): ContextPackage {
  const bestScore = input.sources.length ? Math.max(...input.sources.map((source) => source.score || 0)) : 0;

  return {
    customerQuestion: input.question,
    customerProfile: {
      customerType: input.memory.customerType,
      plan: input.memory.plan,
      email: input.entities.emails[0] || null
    },
    issueContext: {
      currentIssue: input.memory.currentIssue,
      previousIssues: input.memory.previousIssues,
      verifiedSteps: input.memory.verifiedSteps,
      waitingOn: input.memory.waitingOn
    },
    extractedEntities: input.entities,
    retrievalContext: {
      sourceCount: input.sources.length,
      sourceTitles: input.sources.map((source) => source.title).slice(0, 8),
      bestScore: round(bestScore)
    },
    uiContext: {
      surface: "AI Support Chat",
      mode: input.demoMode ? "demo" : "production"
    }
  };
}

export function decideEscalation(input: {
  intent: IntentResult;
  sentiment: SentimentResult;
  confidence: ConfidenceResult;
  validation: ValidationResult;
  entities: ExtractedEntities;
}): EscalationDecision {
  if (input.validation.unsafeOutput) {
    return {
      shouldEscalate: true,
      queue: "General Support",
      reason: "Validator detected potentially unsafe output.",
      severity: "Urgent"
    };
  }

  if (input.intent.priority === "Urgent" || input.sentiment.sentiment === "Urgent" || input.sentiment.sentiment === "Angry") {
    return {
      shouldEscalate: true,
      queue: queueForIntent(input.intent.intent),
      reason: "High urgency or angry sentiment requires human attention.",
      severity: input.intent.priority === "Low" ? "High" : input.intent.priority
    };
  }

  if (input.confidence.finalConfidence < 0.45 || input.validation.status === "fail") {
    return {
      shouldEscalate: true,
      queue: queueForIntent(input.intent.intent),
      reason: "Final confidence is too low for an autonomous answer.",
      severity: input.intent.priority === "Low" ? "Medium" : input.intent.priority
    };
  }

  if (input.entities.apiKeys.length) {
    return {
      shouldEscalate: true,
      queue: "Engineering",
      reason: "Customer included an API key or API credential-like value.",
      severity: "High"
    };
  }

  return {
    shouldEscalate: false,
    queue: "None",
    reason: "Answer can be handled by the AI support workflow.",
    severity: input.intent.priority
  };
}

export function buildReasoningPipelineState(input: {
  intent: IntentResult;
  sentiment: SentimentResult;
  context: ContextPackage;
  confidence: ConfidenceResult;
  validation: ValidationResult;
  escalation: EscalationDecision;
}): ReasoningPipelineState {
  return {
    stages: [
      {
        name: "Intent Detection",
        status: "complete",
        detail: `${input.intent.intent} at ${Math.round(input.intent.confidence * 100)}% confidence`
      },
      {
        name: "Entity Extraction",
        status: "complete",
        detail: `${countEntities(input.context.extractedEntities)} entities detected`
      },
      {
        name: "Sentiment Analysis",
        status: "complete",
        detail: `${input.sentiment.sentiment} at ${Math.round(input.sentiment.confidence * 100)}% confidence`
      },
      {
        name: "Context Builder",
        status: input.context.retrievalContext.sourceCount ? "complete" : "warning",
        detail: `${input.context.retrievalContext.sourceCount} retrieved sources included`
      },
      {
        name: "Conversation Memory",
        status: "complete",
        detail: `${input.context.issueContext.previousIssues.length} prior issue markers retained`
      },
      {
        name: "Confidence Engine",
        status: input.confidence.finalConfidence >= 0.45 ? "complete" : "warning",
        detail: `Final confidence ${Math.round(input.confidence.finalConfidence * 100)}%`
      },
      {
        name: "Response Validator",
        status: input.validation.status === "pass" ? "complete" : input.validation.status === "warn" ? "warning" : "blocked",
        detail: `Validation ${input.validation.status}`
      },
      {
        name: "Escalation Decision",
        status: input.escalation.shouldEscalate ? "warning" : "complete",
        detail: input.escalation.shouldEscalate ? `Escalate to ${input.escalation.queue}` : "No escalation needed"
      }
    ]
  };
}

export function validateSupportResponse(input: {
  answer: string;
  sources: ChatSource[];
  intent: SupportIntent;
}) {
  const answer = input.answer.toLowerCase();
  const notes: string[] = [];
  const policyConflicts: string[] = [];
  const hasSources = input.sources.length > 0;
  const sourceTerms = new Set(
    input.sources
      .flatMap((source) => tokenize(`${source.title} ${source.category} ${source.snippet} ${source.chunkText || ""}`))
      .slice(0, 800)
  );
  const answerTerms = tokenize(input.answer).filter((term) => term.length > 4);
  const groundedTerms = answerTerms.filter((term) => sourceTerms.has(term));
  const groundingRatio = answerTerms.length ? groundedTerms.length / answerTerms.length : 0;
  const riskyClaims = /\b(refund|guarantee|lawsuit|legal advice|delete your account|payment was processed|invoice was paid|api key is valid|license allows)\b/i.test(
    input.answer
  );

  if (!hasSources) notes.push("No retrieved sources were available.");
  if (hasSources && groundingRatio < 0.08) notes.push("Answer has low lexical overlap with retrieved chunks.");
  if (riskyClaims) policyConflicts.push("Potential account, legal, billing, or license claim requires strong grounding.");

  const unsafeOutput = /\b(password|secret key|sk-[a-z0-9_-]{12,}|bypass|exploit|malware)\b/i.test(input.answer);
  if (unsafeOutput) notes.push("Potentially unsafe or secret-bearing output detected.");

  const missingCitations = hasSources && !input.sources.some((source) => answer.includes(source.title.toLowerCase().split(/\s+/)[0] || ""));
  if (missingCitations) notes.push("Answer may not visibly reference retrieved source titles.");

  const hallucinationRisk =
    !hasSources || (riskyClaims && groundingRatio < 0.12) ? "high" : groundingRatio < 0.1 ? "medium" : "low";

  const status = unsafeOutput || hallucinationRisk === "high" ? "fail" : notes.length || policyConflicts.length ? "warn" : "pass";

  return {
    status,
    hallucinationRisk,
    missingCitations,
    policyConflicts,
    unsafeOutput,
    notes
  } satisfies ValidationResult;
}

export function buildSafeFallback(validation: ValidationResult) {
  return [
    "I need to be careful here because I do not have enough grounded support context to answer safely.",
    "",
    "The safest next step is to check the relevant billing, license, account, or technical record before giving a definitive answer.",
    "",
    validation.notes.length ? `Validation note: ${validation.notes[0]}` : "Validation note: missing grounded evidence."
  ].join("\n");
}

function extractEntities(question: string): ExtractedEntities {
  return {
    ...blankEntities,
    invoices: unique(question.match(/\b(?:inv|invoice)[-_#:\s]*[a-z0-9-]{4,}\b/gi) || []),
    emails: unique(question.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) || []),
    generationIds: unique(question.match(/\b(?:gen|generation|render)[-_#:\s]*[a-z0-9-]{5,}\b/gi) || []),
    subscriptions: unique(
      question.match(/\b(?:free|starter|basic|pro|team|business|enterprise|annual|monthly|trial)\b/gi) || []
    ),
    models: unique(question.match(/\b(?:gpt-[\w.-]+|dall-e[\w.-]*|sdxl|stable diffusion|midjourney|upscale|video model)\b/gi) || []),
    apiKeys: unique(question.match(/\b(?:sk-[a-z0-9_-]{8,}|pk_[a-z0-9_-]{8,}|api[_\s-]?key[:\s]+[a-z0-9_-]{6,})\b/gi) || []),
    browsers: unique(question.match(/\b(?:chrome|safari|firefox|edge|brave|opera)\b/gi) || []),
    operatingSystems: unique(question.match(/\b(?:windows|macos|mac os|ios|android|linux|ubuntu)\b/gi) || [])
  };
}

function detectIntent(question: string, entities: ExtractedEntities): Omit<IntentResult, "priority"> {
  const value = question.toLowerCase();
  const candidates: Array<{ intent: SupportIntent; score: number }> = [
    { intent: "Billing + Credits", score: score(value, ["credit", "billing", "invoice", "refund", "charge", "payment"]) + entities.invoices.length * 2 },
    { intent: "Render Troubleshooting", score: score(value, ["render", "generation", "failed", "upscale", "image", "video"]) + entities.generationIds.length * 2 },
    { intent: "Plan Upgrade", score: score(value, ["upgrade", "plan", "subscription", "seat", "pricing"]) + entities.subscriptions.length },
    { intent: "Commercial License", score: score(value, ["commercial", "license", "copyright", "rights", "usage"]) },
    { intent: "API Support", score: score(value, ["api", "key", "endpoint", "token", "429", "rate limit"]) + entities.apiKeys.length * 2 },
    { intent: "Account Access", score: score(value, ["login", "password", "email", "account", "sign in"]) + entities.emails.length },
    { intent: "Bug Report", score: score(value, ["bug", "broken", "not working", "error", "crash"]) }
  ];
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score <= 0) return { intent: "General Support", confidence: 0.58 };
  return { intent: best.intent, confidence: round(clamp(0.52 + best.score * 0.08, 0.55, 0.97)) };
}

function detectSentiment(question: string): SentimentResult {
  const value = question.toLowerCase();
  if (/\b(urgent|asap|immediately|production down|emergency)\b/.test(value)) return { sentiment: "Urgent", confidence: 0.94 };
  if (/\b(angry|furious|unacceptable|terrible|cancel|lawsuit)\b/.test(value)) return { sentiment: "Angry", confidence: 0.9 };
  if (/\b(frustrated|annoyed|keeps failing|still broken|waste)\b/.test(value)) return { sentiment: "Frustrated", confidence: 0.86 };
  if (/\b(confused|not sure|why|where did|what happened|don't understand)\b/.test(value)) return { sentiment: "Confused", confidence: 0.82 };
  if (/\b(thanks|great|love|awesome|happy|works now)\b/.test(value)) return { sentiment: "Happy", confidence: 0.82 };
  return { sentiment: "Neutral", confidence: 0.68 };
}

function detectPriority(
  question: string,
  intent: SupportIntent,
  sentiment: SupportSentiment,
  entities: ExtractedEntities
): SupportPriority {
  const value = question.toLowerCase();
  if (sentiment === "Urgent" || /\b(production down|cannot access|security|breach|charged twice)\b/.test(value)) return "Urgent";
  if (sentiment === "Angry" || entities.apiKeys.length || entities.invoices.length || intent === "Billing + Credits") return "High";
  if (sentiment === "Frustrated" || intent === "Render Troubleshooting" || intent === "API Support") return "Medium";
  return "Low";
}

function updateRollingMemory(input: {
  question: string;
  entities: ExtractedEntities;
  intent: SupportIntent;
  sentiment: SupportSentiment;
  priority: SupportPriority;
  previousMemory?: Partial<RollingMemory>;
  previousSummary?: string;
}): RollingMemory {
  const previous = input.previousMemory || {};
  const knownFacts = unique([
    ...(previous.knownFacts || []),
    ...input.entities.emails.map((email) => `Customer email: ${email}`),
    ...input.entities.subscriptions.map((plan) => `Subscription mention: ${plan}`),
    input.intent !== "General Support" ? `Latest intent: ${input.intent}` : ""
  ].filter(Boolean));
  const verifiedSteps = unique([
    ...(previous.verifiedSteps || []),
    ...(/verified payment|payment verified|already verified/i.test(input.question) ? ["Already verified payment"] : []),
    ...(/cleared cache|restarted|tried again|reinstalled/i.test(input.question) ? ["Customer has tried basic troubleshooting"] : [])
  ]);
  const previousIssues = unique([
    ...(previous.previousIssues || []),
    input.intent !== "General Support" ? input.intent : ""
  ].filter(Boolean));
  const plan = input.entities.subscriptions.find((item) => /enterprise|pro|business|team/i.test(item)) || previous.plan || "Unknown";

  return {
    customerType: /enterprise/i.test(plan) ? "Enterprise" : previous.customerType || "Customer",
    plan,
    currentIssue: input.question.slice(0, 220),
    knownFacts: knownFacts.slice(-12),
    previousIssues: previousIssues.slice(-8),
    verifiedSteps: verifiedSteps.slice(-8),
    waitingOn: /engineering|developer|dev team/i.test(`${input.question} ${input.previousSummary || ""}`) ? "Engineering" : previous.waitingOn || "Support",
    lastSentiment: input.sentiment,
    lastPriority: input.priority
  };
}

function scoreAnswerSpecificity(answer: string) {
  let scoreValue = 0.35;
  if (answer.length > 240) scoreValue += 0.12;
  if (/\b(step|check|confirm|try|next)\b/i.test(answer)) scoreValue += 0.12;
  if (/\b(can't|cannot|do not have enough|need)\b/i.test(answer)) scoreValue += 0.08;
  if (/\b(refund|legal|guarantee|always|never)\b/i.test(answer)) scoreValue -= 0.08;
  return clamp(scoreValue, 0.05, 0.92);
}

function score(value: string, terms: string[]) {
  return terms.reduce((total, term) => total + (value.includes(term) ? 1 : 0), 0);
}

function queueForIntent(intent: SupportIntent): EscalationDecision["queue"] {
  if (intent === "Billing + Credits" || intent === "Plan Upgrade") return "Billing";
  if (intent === "Render Troubleshooting" || intent === "API Support" || intent === "Bug Report") return "Engineering";
  if (intent === "Account Access") return "Account";
  if (intent === "Commercial License") return "Policy";
  return "General Support";
}

function countEntities(entities: ExtractedEntities) {
  return Object.values(entities).reduce((total, values) => total + values.length, 0);
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2);
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 10000) / 10000;
}
