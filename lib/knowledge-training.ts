import crypto from "node:crypto";
import { ensureOrganizationRecord } from "@/lib/ensure-organization";
import { getBackendConfigStatus, serverEnv } from "@/lib/server-env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const KNOWLEDGE_BUCKET = "knowledge-uploads";

export type KnowledgeLibrarySource = {
  id: string;
  title: string;
  category: string;
  status: string;
  url: string;
  chunks: number;
  documents: number;
  chunkPreviews: Array<{
    id: string;
    chunkNumber: number;
    content: string;
    tokenCount: number;
    documentTitle: string;
    sourceUrl: string;
  }>;
};

export async function listKnowledgeLibrary(organizationId: string) {
  const runtime = getKnowledgeRuntimeStatus(false);
  if (!runtime.configured) return runtimeError(runtime.error);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return knowledgeError("supabase_not_configured", "Supabase is not configured.", 503);

  const { data: sources, error: sourceError } = await supabase
    .from("knowledge_sources")
    .select("id,title,type,url,status,created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (sourceError) return knowledgeError("knowledge_sources_failed", sourceError.message);

  const sourceIds = (sources || []).map((source) => source.id);
  if (!sourceIds.length) {
    return { ok: true as const, data: [] as KnowledgeLibrarySource[] };
  }

  const { data: documents, error: documentError } = await supabase
    .from("knowledge_documents")
    .select("id,source_id,title,source_url,category,status")
    .eq("organization_id", organizationId)
    .in("source_id", sourceIds);

  if (documentError) return knowledgeError("knowledge_documents_failed", documentError.message);

  const documentIds = (documents || []).map((document) => document.id);
  const { data: chunks, error: chunkError } = documentIds.length
    ? await supabase
        .from("knowledge_chunks")
        .select("id,document_id,chunk_number,content,token_count")
        .eq("organization_id", organizationId)
        .in("document_id", documentIds)
        .order("chunk_number", { ascending: true })
    : { data: [], error: null };

  if (chunkError) return knowledgeError("knowledge_chunks_failed", chunkError.message);

  const documentsBySource = new Map<string, typeof documents>();
  for (const document of documents || []) {
    const list = documentsBySource.get(document.source_id) || [];
    list.push(document);
    documentsBySource.set(document.source_id, list);
  }

  const documentById = new Map((documents || []).map((document) => [document.id, document]));
  const chunksByDocument = new Map<string, typeof chunks>();
  for (const chunk of chunks || []) {
    const list = chunksByDocument.get(chunk.document_id) || [];
    list.push(chunk);
    chunksByDocument.set(chunk.document_id, list);
  }

  return {
    ok: true as const,
    data: (sources || []).map((source): KnowledgeLibrarySource => {
      const sourceDocuments = documentsBySource.get(source.id) || [];
      const sourceChunks = sourceDocuments.flatMap((document) => chunksByDocument.get(document.id) || []);

      return {
        id: source.id,
        title: source.title,
        category: source.type || sourceDocuments[0]?.category || "Knowledge",
        status: normalizeStatus(source.status),
        url: source.url,
        chunks: sourceChunks.length,
        documents: sourceDocuments.length,
        chunkPreviews: sourceChunks.slice(0, 8).map((chunk) => {
          const document = documentById.get(chunk.document_id);
          return {
            id: chunk.id,
            chunkNumber: chunk.chunk_number,
            content: chunk.content,
            tokenCount: chunk.token_count,
            documentTitle: document?.title || source.title,
            sourceUrl: document?.source_url || source.url
          };
        })
      };
    })
  };
}

export async function saveManualKnowledgeUpdate(input: {
  organizationId: string;
  title: string;
  body: string;
  updateType?: "instruction" | "policy" | "release_note" | "faq" | "correction";
  createdBy?: string | null;
}) {
  const runtime = getKnowledgeRuntimeStatus(true);
  if (!runtime.configured) return runtimeError(runtime.error);
  if (!input.body.trim()) return knowledgeError("empty_update", "Write an update before saving.", 400);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return knowledgeError("supabase_not_configured", "Supabase is not configured.", 503);

  await ensureOrganizationRecord({ organizationId: input.organizationId });

  const title = input.title.trim() || "Manual knowledge update";
  const body = input.body.trim();
  const indexed = await indexKnowledgeText({
    organizationId: input.organizationId,
    title,
    body,
    category: "Manual Update",
    sourceType: "Manual Update",
    sourceUrl: `manual://${checksum(`${title}:${Date.now()}`).slice(0, 12)}`,
    documentType: "manual_update",
    metadata: {
      updateType: input.updateType || "instruction"
    }
  });

  if (!indexed.ok) return indexed;

  const { data, error } = await supabase
    .from("knowledge_updates")
    .insert({
      organization_id: input.organizationId,
      created_by: input.createdBy || null,
      title,
      body,
      update_type: input.updateType || "instruction",
      status: "indexed",
      source_id: indexed.data.sourceId,
      document_id: indexed.data.documentId,
      metadata: indexed.data.metadata
    })
    .select("*")
    .single();

  if (error || !data) return knowledgeError("knowledge_update_failed", error?.message || "Unable to save update.");

  return { ok: true as const, data };
}

export async function uploadKnowledgeFiles(input: {
  organizationId: string;
  files: File[];
  note?: string;
  uploadedBy?: string | null;
}) {
  const runtime = getKnowledgeRuntimeStatus(true);
  if (!runtime.configured) return runtimeError(runtime.error);
  if (!input.files.length && !input.note?.trim()) return knowledgeError("empty_upload", "Add a file or note before uploading.", 400);

  const supabase = getSupabaseAdminClient();
  if (!supabase) return knowledgeError("supabase_not_configured", "Supabase is not configured.", 503);

  await ensureOrganizationRecord({ organizationId: input.organizationId });
  await ensureKnowledgeBucket();

  const uploaded = [];
  for (const file of input.files) {
    const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const path = `${input.organizationId}/${Date.now()}-${checksum(file.name).slice(0, 8)}.${extension}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(KNOWLEDGE_BUCKET)
      .upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });

    if (uploadError) return knowledgeError("storage_upload_failed", uploadError.message);

    const text = await extractText(file);
    const parserStatus = text ? "parsed" : "queued_for_parser";
    const status = text ? "indexed" : "needs_review";

    let indexed: { sourceId: string | null; documentId: string | null; metadata: Record<string, unknown> } = {
      sourceId: null,
      documentId: null,
      metadata: {}
    };

    if (text) {
      const indexedResult = await indexKnowledgeText({
        organizationId: input.organizationId,
        title: file.name,
        body: text,
        category: "Uploaded File",
        sourceType: "Upload",
        sourceUrl: `storage://${KNOWLEDGE_BUCKET}/${path}`,
        documentType: file.type || "upload",
        metadata: {
          fileName: file.name,
          fileType: file.type,
          storagePath: path
        }
      });
      if (!indexedResult.ok) return indexedResult;
      indexed = indexedResult.data;
    }

    const { data, error } = await supabase
      .from("knowledge_uploads")
      .insert({
        organization_id: input.organizationId,
        uploaded_by: input.uploadedBy || null,
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        file_size: file.size,
        storage_bucket: KNOWLEDGE_BUCKET,
        storage_path: path,
        status,
        parser_status: parserStatus,
        metadata: {
          note: input.note || null,
          sourceId: indexed.sourceId,
          documentId: indexed.documentId
        }
      })
      .select("*")
      .single();

    if (error || !data) return knowledgeError("knowledge_upload_failed", error?.message || "Unable to save upload.");
    uploaded.push(data);
  }

  if (input.note?.trim()) {
    const noteResult = await saveManualKnowledgeUpdate({
      organizationId: input.organizationId,
      title: "Upload note",
      body: input.note,
      updateType: "instruction",
      createdBy: input.uploadedBy
    });
    if (!noteResult.ok) return noteResult;
  }

  return { ok: true as const, data: uploaded };
}

async function indexKnowledgeText(input: {
  organizationId: string;
  title: string;
  body: string;
  category: string;
  sourceType: string;
  sourceUrl: string;
  documentType: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return knowledgeError("supabase_not_configured", "Supabase is not configured.", 503);

  const cleanText = input.body.replace(/\s+/g, " ").trim();
  const chunks = chunkText(cleanText);
  if (!chunks.length) return knowledgeError("content_too_short", "Knowledge text is too short to index.", 400);

  const { data: source, error: sourceError } = await supabase
    .from("knowledge_sources")
    .insert({
      organization_id: input.organizationId,
      type: input.sourceType,
      title: input.title,
      url: input.sourceUrl,
      status: "indexed",
      discovered_by: "training",
      article_estimate: 1,
      chunk_estimate: chunks.length,
      metadata: input.metadata || {}
    })
    .select("id")
    .single();

  if (sourceError || !source) return knowledgeError("source_insert_failed", sourceError?.message || "Unable to create source.");

  const { data: document, error: documentError } = await supabase
    .from("knowledge_documents")
    .insert({
      organization_id: input.organizationId,
      source_id: source.id,
      title: input.title,
      source_url: input.sourceUrl,
      category: input.category,
      document_type: input.documentType,
      status: "ready",
      checksum: checksum(cleanText),
      clean_text: cleanText,
      metadata: input.metadata || {}
    })
    .select("id")
    .single();

  if (documentError || !document) return knowledgeError("document_insert_failed", documentError?.message || "Unable to create document.");

  const vectors = await generateEmbeddings(chunks);
  const chunkRows = chunks.map((content, index) => ({
    organization_id: input.organizationId,
    document_id: document.id,
    chunk_number: index + 1,
    content,
    token_count: estimateTokens(content),
    embedding: formatVector(vectors[index]),
    metadata: {
      title: input.title,
      source_url: input.sourceUrl,
      category: input.category
    }
  }));

  const { data: persistedChunks, error: chunkError } = await supabase
    .from("knowledge_chunks")
    .insert(chunkRows)
    .select("id,document_id,metadata");

  if (chunkError || !persistedChunks) return knowledgeError("chunk_insert_failed", chunkError?.message || "Unable to create chunks.");

  const embeddingRows = persistedChunks.map((chunk, index) => ({
    organization_id: input.organizationId,
    document_id: chunk.document_id,
    chunk_id: chunk.id,
    embedding_model: serverEnv.embeddingModel,
    embedding: formatVector(vectors[index]),
    metadata: chunk.metadata || {}
  }));

  const { error: embeddingError } = await supabase.from("embeddings").insert(embeddingRows);
  if (embeddingError) return knowledgeError("embedding_insert_failed", embeddingError.message);

  return {
    ok: true as const,
    data: {
      sourceId: source.id,
      documentId: document.id,
      metadata: {
        chunks: chunks.length,
        category: input.category,
        sourceUrl: input.sourceUrl
      }
    }
  };
}

async function ensureKnowledgeBucket() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data } = await supabase.storage.getBucket(KNOWLEDGE_BUCKET);
  if (data) return;

  await supabase.storage.createBucket(KNOWLEDGE_BUCKET, {
    public: false
  });
}

async function extractText(file: File) {
  const type = file.type || "";
  const name = file.name.toLowerCase();
  if (
    type.startsWith("text/") ||
    type.includes("json") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    name.endsWith(".txt")
  ) {
    return await file.text();
  }

  return "";
}

async function generateEmbeddings(inputs: string[]) {
  const vectors: number[][] = [];
  for (let start = 0; start < inputs.length; start += 32) {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        authorization: `Bearer ${serverEnv.openaiApiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: serverEnv.embeddingModel,
        input: inputs.slice(start, start + 32),
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

function chunkText(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let start = 0; start < words.length; start += 440) {
    const chunk = words.slice(start, start + 520).join(" ");
    if (estimateTokens(chunk) >= 20) chunks.push(chunk);
    if (chunks.length >= 8) break;
  }
  return chunks;
}

function estimateTokens(text: string) {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.35);
}

function formatVector(vector: number[]) {
  return `[${vector.join(",")}]`;
}

function checksum(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeStatus(status: string) {
  if (status === "indexed" || status === "ready") return "Ready";
  if (status === "needs_review") return "Needs review";
  return status || "Ready";
}

function getKnowledgeRuntimeStatus(needsOpenAI: boolean) {
  const backend = getBackendConfigStatus();
  const configured = backend.supabaseConfigured && (!needsOpenAI || backend.openaiConfigured);
  return {
    configured,
    error: configured
      ? null
      : {
          code: "knowledge_training_not_configured",
          message: `Connect ${needsOpenAI ? "Supabase and OpenAI" : "Supabase"} before using knowledge training.`,
          missing: backend.missing
        }
  };
}

function runtimeError(error: { code: string; message: string; missing?: string[] } | null) {
  return {
    ok: false as const,
    status: 503,
    error: error || {
      code: "knowledge_training_not_configured",
      message: "Knowledge training is not configured."
    }
  };
}

function knowledgeError(code: string, message: string, status = 500) {
  return {
    ok: false as const,
    status,
    error: {
      code,
      message
    }
  };
}
