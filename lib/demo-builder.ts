import { buildCompanyBrainPersisted } from "@/lib/company-brain-pipeline";
import { createCompanyBrain, createSource, getCompanyNameFromWebsite, normalizeWebsiteInput } from "@/lib/company-brain";
import { getBackendConfigStatus } from "@/lib/server-env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type DemoBuilderInput = {
  organizationId: string;
  companyName: string;
  website: string;
  logoUrl?: string;
  primaryColor: string;
};

export type DemoBuilderResult = {
  organizationId: string;
  companyName: string;
  website: string;
  status: "ready" | "partial";
  steps: Array<{
    label: string;
    status: "complete" | "warning" | "skipped";
    detail: string;
  }>;
  nextUrl: string;
  customerLoginUrl: string;
};

const sampleIssues = [
  {
    title: "Credits missing after plan upgrade",
    customer: "Maya Chen",
    email: "maya@example.com",
    question: "I upgraded to Pro but my credits did not update. Can you check what happened?",
    answer: "Your plan upgrade can take a few minutes to sync credits across billing and generation systems. I would first refresh the workspace, then check the billing event and credit ledger. If credits still do not appear, this should be routed to Billing with the invoice email attached.",
    intent: "Billing + Credits",
    sentiment: "Confused",
    priority: "High",
    status: "open"
  },
  {
    title: "Render failed and used credits",
    customer: "Jordan Ellis",
    email: "jordan@example.com",
    question: "My image render failed but I still lost credits. This is urgent.",
    answer: "A failed generation should be checked against the render job status and credit refund policy. I would collect the generation ID, confirm whether the job reached a billable state, and escalate to Engineering if the render failed after credit capture.",
    intent: "Render Troubleshooting",
    sentiment: "Frustrated",
    priority: "Urgent",
    status: "escalated"
  },
  {
    title: "Commercial usage rights",
    customer: "Ari Morgan",
    email: "ari@example.com",
    question: "Can I use generated images commercially for a client campaign?",
    answer: "Commercial usage depends on the plan and license terms. The safest answer is to cite the commercial license policy, explain what is allowed, and avoid creating rights that are not explicitly stated in the knowledge base.",
    intent: "Commercial License",
    sentiment: "Neutral",
    priority: "Medium",
    status: "waiting"
  }
];

export async function buildPersonalizedDemo(input: DemoBuilderInput) {
  const website = normalizeWebsiteInput(input.website);
  const companyName = input.companyName.trim() || getCompanyNameFromWebsite(website);
  const backend = getBackendConfigStatus();
  const supabase = getSupabaseAdminClient();

  if (!backend.supabaseConfigured || !supabase) {
    return {
      ok: false as const,
      status: 503,
      error: {
        code: "supabase_not_configured",
        message: "Connect Supabase before building a record-ready demo."
      }
    };
  }

  const steps: DemoBuilderResult["steps"] = [];

  await upsertDemoOrganization({
    ...input,
    companyName,
    website
  });
  steps.push({
    label: "Apply branding",
    status: "complete",
    detail: `${companyName} workspace created with primary color ${input.primaryColor}.`
  });

  const brainResult = await buildCompanyBrainPersisted({
    organizationId: input.organizationId,
    website,
    rebuild: true
  });

  if (brainResult.ok) {
    steps.push({
      label: "Crawl website",
      status: "complete",
      detail: `${brainResult.data.metrics.pagesIndexed} pages indexed and ${brainResult.data.metrics.chunks} chunks generated.`
    });
  } else {
    await seedDemoKnowledge(input.organizationId, companyName, website);
    steps.push({
      label: "Crawl website",
      status: "warning",
      detail: `Live crawl could not finish: ${brainResult.error.message}. Demo knowledge was generated instead.`
    });
  }

  await seedDemoConversations(input.organizationId, companyName, website);
  steps.push({
    label: "Generate sample conversations",
    status: "complete",
    detail: "Seeded support conversations, messages, intelligence, sources, and replay steps."
  });

  await seedDemoOperations(input.organizationId);
  steps.push({
    label: "Create executive dashboard",
    status: "complete",
    detail: "Seeded tickets, automation runs, and AI improvement feedback for dashboard signals."
  });

  return {
    ok: true as const,
    data: {
      organizationId: input.organizationId,
      companyName,
      website,
      status: brainResult.ok ? "ready" : "partial",
      steps,
      nextUrl: "/dashboard",
      customerLoginUrl: `/customer-login?workspace=${encodeURIComponent(input.organizationId)}`
    } satisfies DemoBuilderResult
  };
}

async function upsertDemoOrganization(input: DemoBuilderInput & { website: string }) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const brain = createCompanyBrain({
    organizationId: input.organizationId,
    website: input.website
  });

  const { error } = await supabase.from("organizations").upsert({
    id: input.organizationId,
    name: input.companyName,
    slug: input.organizationId.replace(/^org_/, ""),
    website: input.website,
    industry: brain.profile.industry,
    profile: {
      ...brain.profile,
      company: input.companyName,
      logoUrl: input.logoUrl || null,
      primaryColor: input.primaryColor
    },
    updated_at: new Date().toISOString()
  });

  if (error) throw new Error(error.message);
}

async function seedDemoKnowledge(organizationId: string, companyName: string, website: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  await deleteDemoKnowledge(organizationId);

  const brain = createCompanyBrain({ organizationId, website });
  const sources = [
    createSource({ website, type: "Help Center", path: "/help", title: `${companyName} Help Center`, discoveredBy: "homepage", index: 1 }),
    createSource({ website, type: "FAQ", path: "/faq", title: `${companyName} FAQ`, discoveredBy: "sitemap", index: 2 }),
    createSource({ website, type: "Pricing", path: "/pricing", title: `${companyName} Pricing`, discoveredBy: "sitemap", index: 3 }),
    createSource({ website, type: "Documentation", path: "/docs", title: `${companyName} Docs`, discoveredBy: "homepage", index: 4 })
  ];

  const { data: crawlJob } = await supabase
    .from("crawl_jobs")
    .insert({
      organization_id: organizationId,
      website,
      status: "succeeded",
      pages_discovered: sources.length,
      pages_indexed: sources.length,
      completed_at: new Date().toISOString()
    })
    .select("id")
    .single();

  const { data: persistedSources, error: sourceError } = await supabase
    .from("knowledge_sources")
    .insert(
      sources.map((source) => ({
        organization_id: organizationId,
        crawl_job_id: crawlJob?.id || null,
        type: source.type,
        title: source.title,
        url: source.url,
        status: "indexed",
        discovered_by: source.discoveredBy,
        article_estimate: 12,
        chunk_estimate: 36,
        metadata: { demoGenerated: true }
      }))
    )
    .select("*");

  if (sourceError || !persistedSources) throw new Error(sourceError?.message || "Unable to seed knowledge sources.");

  const documents = persistedSources.map((source, index) => ({
    organization_id: organizationId,
    source_id: source.id,
    title: source.title,
    source_url: source.url,
    category: source.type,
    document_type: "html",
    status: "ready",
    clean_text: `${source.title}. ${companyName} supports customers with billing, product usage, account access, licensing, and troubleshooting. This generated demo source gives SupportFlow AI grounded material for a personalized prospect walkthrough.`,
    metadata: { demoGenerated: true, sourceType: source.type, profile: brain.profile },
    checksum: `demo-${index}`
  }));

  const { data: persistedDocuments, error: documentError } = await supabase
    .from("knowledge_documents")
    .insert(documents)
    .select("*");

  if (documentError || !persistedDocuments) throw new Error(documentError?.message || "Unable to seed knowledge documents.");

  const chunks = persistedDocuments.flatMap((document, documentIndex) =>
    [0, 1, 2].map((chunkIndex) => ({
      organization_id: organizationId,
      document_id: document.id,
      chunk_number: chunkIndex + 1,
      content: `${document.title} chunk ${chunkIndex + 1}. ${companyName} customers may ask about credits, pricing, setup, failed jobs, commercial use, account access, API usage, and support escalation. Agents should answer with clear next steps and cite ${document.title}.`,
      token_count: 58,
      metadata: {
        title: document.title,
        source_url: document.source_url,
        category: document.category,
        demoGenerated: true,
        documentIndex
      }
    }))
  );

  const { error: chunkError } = await supabase.from("knowledge_chunks").insert(chunks);
  if (chunkError) throw new Error(chunkError.message);
}

async function seedDemoConversations(organizationId: string, companyName: string, website: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  await supabase.from("conversations").delete().eq("organization_id", organizationId);

  for (const issue of sampleIssues) {
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .insert({
        organization_id: organizationId,
        title: issue.title,
        status: issue.status,
        customer_name: issue.customer,
        customer_email: issue.email,
        current_issue: issue.question,
        metadata: { demoGenerated: true, prospect: companyName },
        takeover_status: issue.status === "escalated" ? "human_requested" : "ai_active"
      })
      .select("*")
      .single();

    if (conversationError || !conversation) throw new Error(conversationError?.message || "Unable to seed conversation.");

    const sources = buildDemoSources(companyName, website, issue.intent);
    const { data: customerMessage } = await supabase
      .from("messages")
      .insert({
        organization_id: organizationId,
        conversation_id: conversation.id,
        role: "customer",
        content: issue.question,
        intent: issue.intent,
        intent_confidence: 0.92,
        priority: issue.priority,
        sentiment: issue.sentiment,
        metadata: { demoGenerated: true }
      })
      .select("id")
      .single();

    const validation = {
      status: "pass",
      hallucinationRisk: "low",
      missingCitations: false,
      policyConflicts: [],
      unsafeOutput: false,
      notes: []
    };
    const metrics = issue.priority === "Urgent"
      ? { confidence: 0.86, retrieval: 0.84, reasoning: 0.88, final: 0.86 }
      : { confidence: 0.92, retrieval: 0.9, reasoning: 0.93, final: 0.92 };

    const { data: assistantMessage, error: assistantError } = await supabase
      .from("messages")
      .insert({
        organization_id: organizationId,
        conversation_id: conversation.id,
        role: "assistant",
        content: issue.answer,
        sources,
        confidence: metrics.confidence,
        retrieval_confidence: metrics.retrieval,
        reasoning_confidence: metrics.reasoning,
        final_confidence: metrics.final,
        retrieval_score: metrics.retrieval,
        documents_used: sources.length,
        latency_ms: 1180,
        prompt_tokens: 690,
        completion_tokens: 165,
        total_tokens: 855,
        model: "demo-seeded",
        intent: issue.intent,
        intent_confidence: 0.92,
        priority: issue.priority,
        sentiment: issue.sentiment,
        validation_status: validation.status,
        validation_results: validation,
        extracted_entities: {},
        metadata: {
          demoGenerated: true,
          thinking: {
            intent: issue.intent,
            priority: issue.priority,
            sentiment: issue.sentiment,
            confidence: metrics.final,
            retrieved: sources.map((source) => source.title),
            reasoning: "Demo response grounded in generated prospect knowledge sources.",
            action: issue.status === "escalated" ? "Escalate" : "Respond"
          },
          replay_steps: buildReplaySteps(issue.question, issue.answer, sources)
        }
      })
      .select("id")
      .single();

    if (assistantError || !assistantMessage) throw new Error(assistantError?.message || "Unable to seed assistant message.");

    await supabase.from("message_intelligence").insert({
      organization_id: organizationId,
      conversation_id: conversation.id,
      message_id: assistantMessage.id,
      intent: issue.intent,
      intent_confidence: 0.92,
      priority: issue.priority,
      sentiment: issue.sentiment,
      retrieval_confidence: metrics.retrieval,
      reasoning_confidence: metrics.reasoning,
      final_confidence: metrics.final,
      validation_status: validation.status,
      validation_results: validation,
      rolling_memory: {
        customerType: "Prospect demo customer",
        plan: "Demo",
        currentIssue: issue.title,
        previousIssues: [],
        verifiedSteps: [],
        waitingOn: issue.status === "waiting" ? "Customer confirmation" : "SupportFlow AI",
        lastSentiment: issue.sentiment,
        lastPriority: issue.priority
      }
    });

    await supabase.from("conversation_replay_steps").insert(
      buildReplaySteps(issue.question, issue.answer, sources).map((step) => ({
        organization_id: organizationId,
        conversation_id: conversation.id,
        message_id: assistantMessage.id,
        step_key: step.stepKey,
        title: step.title,
        detail: step.detail,
        metadata: step.metadata,
        sort_order: step.sortOrder
      }))
    );

    await supabase.from("conversation_summaries").upsert({
      organization_id: organizationId,
      conversation_id: conversation.id,
      summary: `${issue.customer} asked about ${issue.title}. SupportFlow AI answered with grounded next steps for ${companyName}.`,
      customer_name: issue.customer,
      current_issue: issue.question,
      previous_troubleshooting: issue.status === "escalated" ? [issue.question] : [],
      key_facts: { companyName, website, intent: issue.intent },
      sentiment: issue.sentiment,
      priority: issue.priority,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (customerMessage?.id) {
      await supabase.from("conversation_participants").insert([
        {
          organization_id: organizationId,
          conversation_id: conversation.id,
          participant_type: "customer",
          display_name: issue.customer,
          email: issue.email
        },
        {
          organization_id: organizationId,
          conversation_id: conversation.id,
          participant_type: "ai",
          display_name: "SupportFlow AI"
        }
      ]);
    }
  }
}

async function seedDemoOperations(organizationId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id,title,customer_name,customer_email,current_issue")
    .eq("organization_id", organizationId)
    .limit(3);

  const first = conversations?.[0];
  const second = conversations?.[1];

  if (first) {
    await supabase.from("support_tickets").insert({
      organization_id: organizationId,
      conversation_id: first.id,
      customer_name: first.customer_name,
      customer_email: first.customer_email,
      subject: first.title,
      description: first.current_issue,
      status: "open",
      priority: "high",
      intent: "Billing + Credits",
      assigned_queue: "Billing",
      metadata: { demoGenerated: true }
    });
  }

  if (second) {
    await supabase.from("automation_runs").insert([
      {
        organization_id: organizationId,
        conversation_id: second.id,
        action_type: "ticket_create",
        status: "succeeded",
        input: { source: "demo_builder" },
        output: { ticketCreated: true },
        completed_at: new Date().toISOString()
      },
      {
        organization_id: organizationId,
        conversation_id: second.id,
        action_type: "slack_notify",
        status: "skipped",
        input: { source: "demo_builder" },
        output: { dryRun: true },
        completed_at: new Date().toISOString()
      }
    ]);

    await supabase.from("workflow_logs").insert({
      organization_id: organizationId,
      level: "info",
      message: "AI Workspace Builder seeded automation activity.",
      metadata: { demoGenerated: true }
    });
  }
}

async function deleteDemoKnowledge(organizationId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  for (const table of ["embeddings", "knowledge_chunks", "knowledge_documents", "crawl_pages", "knowledge_sources", "crawl_jobs"]) {
    await supabase.from(table).delete().eq("organization_id", organizationId);
  }
}

function buildDemoSources(companyName: string, website: string, intent: string) {
  const category = intent.includes("Billing") ? "Billing" : intent.includes("Render") ? "Troubleshooting" : "Policies";
  return [
    {
      chunkId: `demo_${category.toLowerCase()}_1`,
      documentId: `demo_doc_${category.toLowerCase()}`,
      title: `${companyName} ${category} Guide`,
      sourceUrl: `${website}/${category.toLowerCase()}`,
      category,
      score: 0.91,
      similarityScore: 0.88,
      snippet: `Generated demo source for ${companyName} ${category.toLowerCase()} support behavior.`,
      chunkText: `${companyName} support should answer ${category.toLowerCase()} questions with clear policy-grounded next steps.`
    },
    {
      chunkId: "demo_help_2",
      documentId: "demo_doc_help",
      title: `${companyName} Help Center`,
      sourceUrl: `${website}/help`,
      category: "Help Center",
      score: 0.84,
      similarityScore: 0.82,
      snippet: `Help Center source used to ground support steps for ${companyName}.`,
      chunkText: `SupportFlow AI uses the ${companyName} Help Center to answer common customer questions.`
    }
  ];
}

function buildReplaySteps(question: string, answer: string, sources: ReturnType<typeof buildDemoSources>) {
  return [
    { stepKey: "customer", title: "Customer", detail: question, metadata: {}, sortOrder: 1 },
    { stepKey: "embedding", title: "Embedding", detail: "Created a demo embedding for semantic search.", metadata: {}, sortOrder: 2 },
    { stepKey: "vector_search", title: "Vector Search", detail: `Retrieved ${sources.length} matching demo knowledge chunks.`, metadata: {}, sortOrder: 3 },
    { stepKey: "retrieved_documents", title: "Retrieved Documents", detail: sources.map((source) => source.title).join(", "), metadata: { sources }, sortOrder: 4 },
    { stepKey: "reasoning", title: "Reasoning", detail: "Selected a grounded answer pattern and checked escalation sensitivity.", metadata: {}, sortOrder: 5 },
    { stepKey: "final_response", title: "Final Response", detail: `Stored demo response preview: ${answer.slice(0, 160)}`, metadata: {}, sortOrder: 6 }
  ];
}
