import crypto from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBackendConfigStatus, serverEnv } from "@/lib/server-env";
import {
  crawlSourceCatalog,
  createCompanyBrain,
  createSource,
  getCompanyNameFromWebsite,
  normalizeWebsiteInput,
  type CompanyBrain,
  type CrawlSource,
  type CrawlSourceType
} from "@/lib/company-brain";

type BuildCompanyBrainInput = {
  website: string;
  organizationId: string;
  rebuild?: boolean;
};

type PersistedCrawlPage = {
  source: CrawlSource;
  rawHtml: string;
  cleanText: string;
  title: string;
  httpStatus: number;
  checksum: string;
};

type CrawlHistoryItem = {
  id: string;
  website: string;
  status: "running" | "succeeded" | "failed";
  pagesDiscovered: number;
  pagesIndexed: number;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
};

export async function buildCompanyBrainPersisted(input: BuildCompanyBrainInput) {
  const status = getBackendConfigStatus();
  if (!status.supabaseConfigured || !status.openaiConfigured) {
    return {
      ok: false as const,
      status: 503,
      error: {
        code: "backend_not_configured",
        message:
          "Connect Supabase and OpenAI before building a real Company Brain. Missing: " +
          status.missing.join(", "),
        missing: status.missing
      }
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      ok: false as const,
      status: 503,
      error: {
        code: "supabase_not_configured",
        message: "Supabase service-role client is not configured.",
        missing: status.missing
      }
    };
  }
  const supabaseAdmin = supabase;

  const website = normalizeWebsiteInput(input.website);
  const organizationId = input.organizationId;
  const companyName = getCompanyNameFromWebsite(website);

  const { error: organizationError } = await supabase.from("organizations").upsert({
    id: organizationId,
    name: companyName,
    slug: organizationId.replace(/^org_/, ""),
    website,
    updated_at: new Date().toISOString()
  });

  if (organizationError) {
    return toPipelineError("organization_upsert_failed", organizationError.message);
  }

  if (input.rebuild) {
    const rebuildError = await deleteExistingKnowledge(organizationId);
    if (rebuildError) return rebuildError;
  }

  const { data: crawlJob, error: crawlJobError } = await supabase
    .from("crawl_jobs")
    .insert({
      organization_id: organizationId,
      website,
      status: "running"
    })
    .select("id")
    .single();

  if (crawlJobError || !crawlJob) {
    return toPipelineError("crawl_job_create_failed", crawlJobError?.message || "No crawl job returned.");
  }

  try {
    const pages = await crawlWebsite(website);

    if (!pages.length) {
      throw new Error("No indexable public pages were found for this website.");
    }

    const persistedSources = await persistSources(organizationId, crawlJob.id, pages);
    const persistedPages = await persistPages(organizationId, crawlJob.id, pages, persistedSources);
    const documents = await persistDocuments(organizationId, persistedPages);
    const chunks = await persistChunks(organizationId, documents);
    const vectors = await generateEmbeddings(chunks.map((chunk) => chunk.content));
    if (vectors.length !== chunks.length) {
      throw new Error("OpenAI returned a different number of embeddings than requested.");
    }
    await persistEmbeddings(organizationId, chunks, vectors);

    const brain = createCompanyBrain({
      organizationId,
      website,
      discoveredSources: pages.map((page) => page.source)
    });

    const hydratedBrain: CompanyBrain = {
      ...brain,
      metrics: {
        status: "Ready",
        pagesIndexed: persistedPages.length,
        knowledgeArticles: documents.length,
        chunks: chunks.length,
        embeddings: vectors.length,
        languages: ["English"],
        lastCrawl: "Today",
        syncHealth: "Healthy"
      }
    };

    const { error: profileError } = await supabase
      .from("organizations")
      .update({
        industry: hydratedBrain.profile.industry,
        profile: hydratedBrain.profile,
        updated_at: new Date().toISOString()
      })
      .eq("id", organizationId);

    if (profileError) {
      throw new Error(profileError.message);
    }

    await supabase
      .from("crawl_jobs")
      .update({
        status: "succeeded",
        pages_discovered: pages.length,
        pages_indexed: persistedPages.length,
        completed_at: new Date().toISOString()
      })
      .eq("id", crawlJob.id);

    return {
      ok: true as const,
      data: hydratedBrain
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Company Brain build failed.";
    await supabase
      .from("crawl_jobs")
      .update({
        status: "failed",
        error: message,
        completed_at: new Date().toISOString()
      })
      .eq("id", crawlJob.id);

    return toPipelineError("company_brain_build_failed", message);
  }

  async function deleteExistingKnowledge(organizationIdToDelete: string) {
    const tables = ["embeddings", "knowledge_chunks", "knowledge_documents", "knowledge_sources"];
    for (const table of tables) {
      const { error } = await supabaseAdmin.from(table).delete().eq("organization_id", organizationIdToDelete);
      if (error) {
        return toPipelineError("rebuild_delete_failed", error.message);
      }
    }
    return null;
  }

  async function persistSources(
    organizationIdToPersist: string,
    crawlJobId: string,
    pages: PersistedCrawlPage[]
  ) {
    const inserts = pages.map((page) => ({
      organization_id: organizationIdToPersist,
      crawl_job_id: crawlJobId,
      type: page.source.type,
      title: page.source.title,
      url: page.source.url,
      status: "indexed",
      discovered_by: page.source.discoveredBy,
      article_estimate: page.source.articleEstimate,
      chunk_estimate: page.source.chunkEstimate,
      metadata: {
        checksum: page.checksum
      }
    }));

    const { data, error } = await supabaseAdmin.from("knowledge_sources").insert(inserts).select("*");
    if (error || !data) throw new Error(error?.message || "Unable to store knowledge sources.");
    return data as Array<{ id: string; url: string }>;
  }

  async function persistPages(
    organizationIdToPersist: string,
    crawlJobId: string,
    pages: PersistedCrawlPage[],
    sources: Array<{ id: string; url: string }>
  ) {
    const sourceByUrl = new Map(sources.map((source) => [source.url, source.id]));
    const inserts = pages.map((page) => ({
      organization_id: organizationIdToPersist,
      crawl_job_id: crawlJobId,
      source_id: sourceByUrl.get(page.source.url),
      url: page.source.url,
      title: page.title,
      status: "indexed",
      http_status: page.httpStatus,
      raw_html: page.rawHtml,
      clean_text: page.cleanText,
      checksum: page.checksum,
      metadata: {
        source_type: page.source.type,
        discovered_by: page.source.discoveredBy
      }
    }));

    const { data, error } = await supabaseAdmin.from("crawl_pages").insert(inserts).select("*");
    if (error || !data) throw new Error(error?.message || "Unable to store crawl pages.");
    return data as Array<{
      id: string;
      source_id: string;
      title: string;
      url: string;
      clean_text: string;
      checksum: string;
      metadata: Record<string, string>;
    }>;
  }

  async function persistDocuments(
    organizationIdToPersist: string,
    pages: Array<{
      id: string;
      source_id: string;
      title: string;
      url: string;
      clean_text: string;
      checksum: string;
      metadata: Record<string, string>;
    }>
  ) {
    const inserts = pages.map((page) => ({
      organization_id: organizationIdToPersist,
      source_id: page.source_id,
      crawl_page_id: page.id,
      title: page.title || "Untitled page",
      source_url: page.url,
      category: page.metadata?.source_type || "Documentation",
      document_type: "html",
      status: "ready",
      checksum: page.checksum,
      clean_text: page.clean_text,
      metadata: page.metadata || {}
    }));

    const { data, error } = await supabaseAdmin.from("knowledge_documents").insert(inserts).select("*");
    if (error || !data) throw new Error(error?.message || "Unable to store knowledge documents.");
    return data as Array<{ id: string; title: string; source_url: string; clean_text: string; category: string }>;
  }

  async function persistChunks(
    organizationIdToPersist: string,
    documents: Array<{ id: string; title: string; source_url: string; clean_text: string; category: string }>
  ) {
    const inserts = documents.flatMap((document) =>
      chunkText(document.clean_text).map((chunk, index) => ({
        organization_id: organizationIdToPersist,
        document_id: document.id,
        chunk_number: index,
        content: chunk,
        token_count: estimateTokens(chunk),
        metadata: {
          title: document.title,
          source_url: document.source_url,
          category: document.category
        }
      }))
    );

    if (!inserts.length) {
      throw new Error("No chunks were generated from crawled pages.");
    }

    const { data, error } = await supabaseAdmin.from("knowledge_chunks").insert(inserts).select("*");
    if (error || !data) throw new Error(error?.message || "Unable to store knowledge chunks.");
    return data as Array<{ id: string; document_id: string; content: string; metadata: Record<string, string> }>;
  }

  async function persistEmbeddings(
    organizationIdToPersist: string,
    chunks: Array<{ id: string; document_id: string; content: string; metadata: Record<string, string> }>,
    vectors: number[][]
  ) {
    const chunkUpdates = chunks.map((chunk, index) =>
      supabaseAdmin
        .from("knowledge_chunks")
        .update({ embedding: formatVector(vectors[index]) })
        .eq("id", chunk.id)
    );

    const chunkUpdateResults = await Promise.all(chunkUpdates);
    const chunkUpdateError = chunkUpdateResults.find((result) => result.error)?.error;
    if (chunkUpdateError) {
      throw new Error(chunkUpdateError.message);
    }

    const inserts = chunks.map((chunk, index) => ({
      organization_id: organizationIdToPersist,
      document_id: chunk.document_id,
      chunk_id: chunk.id,
      embedding_model: serverEnv.embeddingModel,
      embedding: formatVector(vectors[index]),
      metadata: chunk.metadata || {}
    }));

    const { error } = await supabaseAdmin.from("embeddings").insert(inserts);
    if (error) throw new Error(error.message);
  }
}

export async function getPersistedCompanyBrain(organizationId: string) {
  const status = getBackendConfigStatus();
  if (!status.supabaseConfigured) {
    return {
      ok: false as const,
      status: 503,
      error: {
        code: "backend_not_configured",
        message: "Connect Supabase before loading persisted Company Brain data.",
        missing: status.missing
      }
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return toPipelineError("supabase_not_configured", "Supabase is not configured.");

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError) return toPipelineError("organization_load_failed", organizationError.message);
  if (!organization) {
    return {
      ok: true as const,
      data: null
    };
  }

  const { data: latestSuccessfulJob } = await supabase
    .from("crawl_jobs")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "succeeded")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestPagesQuery = supabase
    .from("crawl_pages")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  const [{ count: pagesIndexed }, { count: knowledgeArticles }, { count: chunks }, { count: embeddings }, sources] =
    await Promise.all([
      latestSuccessfulJob?.id
        ? latestPagesQuery.eq("crawl_job_id", latestSuccessfulJob.id)
        : latestPagesQuery.eq("crawl_job_id", "00000000-0000-0000-0000-000000000000"),
      supabase
        .from("knowledge_documents")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId),
      supabase.from("knowledge_chunks").select("*", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabase.from("embeddings").select("*", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabase
        .from("knowledge_sources")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(20)
    ]);

  const crawledSources: CrawlSource[] =
    sources.data?.map((source, index) => ({
      id: source.id,
      type: source.type as CrawlSourceType,
      title: source.title,
      url: source.url,
      status: "Indexed",
      discoveredBy: source.discovered_by,
      articleEstimate: source.article_estimate || index + 1,
      chunkEstimate: source.chunk_estimate || 0
    })) || [];

  const brain = createCompanyBrain({
    organizationId,
    website: organization.website,
    discoveredSources: crawledSources
  });

  return {
    ok: true as const,
    data: {
      ...brain,
      profile: organization.profile || brain.profile,
      metrics: {
        status: chunks ? "Ready" : "Needs review",
        pagesIndexed: pagesIndexed || 0,
        knowledgeArticles: knowledgeArticles || 0,
        chunks: chunks || 0,
        embeddings: embeddings || 0,
        languages: ["English"],
        lastCrawl: "Today",
        syncHealth: embeddings && chunks && embeddings === chunks ? "Healthy" : "Partial"
      }
    } satisfies CompanyBrain
  };
}

export async function getCrawlHistory(organizationId: string) {
  const status = getBackendConfigStatus();
  if (!status.supabaseConfigured) {
    return {
      ok: false as const,
      status: 503,
      error: {
        code: "backend_not_configured",
        message: "Connect Supabase before loading crawl history.",
        missing: status.missing
      }
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return toPipelineError("supabase_not_configured", "Supabase is not configured.");

  const { data, error } = await supabase
    .from("crawl_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return toPipelineError("crawl_history_load_failed", error.message);

  return {
    ok: true as const,
    data: (data || []).map((job): CrawlHistoryItem => ({
      id: job.id,
      website: job.website,
      status: job.status,
      pagesDiscovered: job.pages_discovered,
      pagesIndexed: job.pages_indexed,
      error: job.error,
      startedAt: job.started_at,
      completedAt: job.completed_at
    }))
  };
}

async function crawlWebsite(website: string): Promise<PersistedCrawlPage[]> {
  const homepage = await fetchHtml(website);
  const homepageLinks = homepage.html ? extractRelevantLinks(homepage.html, website) : [];
  const commonPathUrls = crawlSourceCatalog.flatMap((item) =>
    item.paths.map((path) => ({ type: item.type, path, discoveredBy: "common-path" as const }))
  );

  const candidates = [
    { type: "Homepage" as CrawlSourceType, path: "/", discoveredBy: "homepage" as const },
    ...homepageLinks,
    ...commonPathUrls
  ];

  const unique = new Map<string, (typeof candidates)[number]>();
  candidates.forEach((candidate) => {
    const url = new URL(candidate.path, website);
    url.hash = "";
    unique.set(url.pathname.replace(/\/$/, "") || "/", candidate);
  });

  const pages = await Promise.all(
    Array.from(unique.values())
      .slice(0, 18)
      .map(async (candidate, index) => {
        const target = new URL(candidate.path, website).toString();
        const fetched = candidate.path === "/" && homepage.ok ? homepage : await fetchHtml(target);
        if (!fetched.ok || !fetched.html) return null;

        const cleanText = cleanHtml(fetched.html);
        if (estimateTokens(cleanText) < 40) return null;

        const source = createSource({
          website,
          type: candidate.type,
          path: candidate.path,
          title: fetched.title || candidate.type,
          discoveredBy: candidate.discoveredBy,
          index
        });

        return {
          source,
          rawHtml: fetched.html,
          cleanText,
          title: fetched.title || source.title,
          httpStatus: fetched.status,
          checksum: checksum(cleanText)
        };
      })
  );

  return pages.filter(Boolean) as PersistedCrawlPage[];
}

async function fetchHtml(url: string) {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "NexamindCompanyBrain/0.2" },
      signal: AbortSignal.timeout(5000)
    });
    const contentType = response.headers.get("content-type") || "";
    const html = contentType.includes("text/html") ? await response.text() : "";
    return {
      ok: response.ok,
      status: response.status,
      html,
      title: extractTitle(html)
    };
  } catch {
    return { ok: false, status: 0, html: "", title: "" };
  }
}

function extractRelevantLinks(html: string, website: string) {
  const origin = new URL(website).origin;
  const links = Array.from(html.matchAll(/href=["']([^"']+)["']/gi))
    .map((match) => match[1])
    .map((href) => {
      try {
        return new URL(href, origin);
      } catch {
        return null;
      }
    })
    .filter((url): url is URL => Boolean(url && url.origin === origin));

  const matched: Array<{ type: CrawlSourceType; path: string; discoveredBy: "homepage" }> = [];
  links.forEach((url) => {
    const normalized = url.pathname.toLowerCase();
    const match = crawlSourceCatalog.find((item) =>
      item.paths.some((path) => normalized.includes(path.replace("/", "")))
    );
    if (match) matched.push({ type: match.type, path: url.pathname, discoveredBy: "homepage" });
  });
  return matched.slice(0, 20);
}

function extractTitle(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return decodeHtml(title.replace(/\s+/g, " ").trim()).slice(0, 90);
}

function cleanHtml(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function chunkText(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunkSize = 520;
  const overlap = 80;
  const chunks: string[] = [];

  for (let start = 0; start < words.length; start += chunkSize - overlap) {
    const chunk = words.slice(start, start + chunkSize).join(" ");
    if (estimateTokens(chunk) >= 35) chunks.push(chunk);
    if (chunks.length >= 5) break;
  }

  return chunks;
}

function estimateTokens(text: string) {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.35);
}

async function generateEmbeddings(inputs: string[]) {
  const vectors: number[][] = [];
  const batchSize = 32;

  for (let start = 0; start < inputs.length; start += batchSize) {
    const input = inputs.slice(start, start + batchSize);
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        authorization: `Bearer ${serverEnv.openaiApiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: serverEnv.embeddingModel,
        input,
        dimensions: serverEnv.embeddingDimensions
      })
    });

    const payload = (await response.json()) as {
      data?: Array<{ embedding: number[] }>;
      error?: { message?: string };
    };

    if (!response.ok || !payload.data) {
      throw new Error(payload.error?.message || "OpenAI embedding generation failed.");
    }

    vectors.push(...payload.data.map((item) => item.embedding));
  }

  return vectors;
}

function formatVector(vector: number[]) {
  return `[${vector.join(",")}]`;
}

function checksum(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function toPipelineError(code: string, message: string) {
  return {
    ok: false as const,
    status: 400,
    error: {
      code,
      message
    }
  };
}
