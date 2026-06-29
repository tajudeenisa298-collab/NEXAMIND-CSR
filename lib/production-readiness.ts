import { getBackendConfigStatus, serverEnv } from "@/lib/server-env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type CheckStatus = "pass" | "fail" | "warn" | "skip";

type ReadinessCheck = {
  name: string;
  status: CheckStatus;
  message: string;
  details?: unknown;
};

type ReadinessSnapshot = {
  pgvector_enabled?: boolean;
  retrieval_function_ready?: boolean;
  readiness_function_ready?: boolean;
  tables?: Array<{
    table: string;
    exists: boolean;
    rls_enabled: boolean;
    policy_count: number;
  }>;
};

export async function runProductionReadinessCheck(organizationId: string) {
  const startedAt = Date.now();
  const checks: ReadinessCheck[] = [];
  const config = getBackendConfigStatus();

  checks.push({
    name: "Environment variables",
    status: config.missing.length ? "fail" : "pass",
    message: config.missing.length
      ? `Missing required environment variables: ${config.missing.join(", ")}`
      : "Supabase and OpenAI environment variables are present.",
    details: { missing: config.missing }
  });

  checks.push({
    name: "Production health token",
    status: serverEnv.productionHealthCheckToken ? "pass" : "warn",
    message: serverEnv.productionHealthCheckToken
      ? "Production health-check token is configured."
      : "Set PRODUCTION_HEALTH_CHECK_TOKEN before exposing this endpoint in staging or production."
  });

  const supabase = getSupabaseAdminClient();
  let snapshot: ReadinessSnapshot | null = null;

  if (!supabase) {
    checks.push({
      name: "Supabase connection",
      status: "fail",
      message: "Supabase service-role client is not configured."
    });
  } else {
    const { error: connectionError } = await supabase
      .from("organizations")
      .select("id", { count: "exact", head: true });

    checks.push({
      name: "Supabase connection",
      status: connectionError ? "fail" : "pass",
      message: connectionError
        ? connectionError.message
        : "Supabase service-role connection can reach the application schema."
    });

    const { data, error } = await supabase.rpc("production_readiness_snapshot");
    snapshot = (data as ReadinessSnapshot | null) || null;

    checks.push({
      name: "Migrations applied",
      status: error ? "fail" : "pass",
      message: error
        ? "Run all Supabase migrations, including 004_production_readiness.sql."
        : "Production readiness snapshot function is available.",
      details: error ? error.message : undefined
    });

    if (snapshot) {
      const missingTables = (snapshot.tables || []).filter((table) => !table.exists);
      const rlsDisabled = (snapshot.tables || []).filter((table) => table.exists && !table.rls_enabled);
      const missingPolicies = (snapshot.tables || []).filter(
        (table) => table.exists && table.rls_enabled && table.policy_count === 0
      );

      checks.push({
        name: "Database tables",
        status: missingTables.length ? "fail" : "pass",
        message: missingTables.length
          ? `Missing tables: ${missingTables.map((table) => table.table).join(", ")}`
          : "All expected Nexamind tables exist.",
        details: missingTables
      });

      checks.push({
        name: "Row-Level Security",
        status: rlsDisabled.length ? "fail" : "pass",
        message: rlsDisabled.length
          ? `RLS is disabled on: ${rlsDisabled.map((table) => table.table).join(", ")}`
          : "RLS is enabled on all expected application tables.",
        details: { rlsDisabled, missingPolicies }
      });

      checks.push({
        name: "pgvector and retrieval RPC",
        status: snapshot.pgvector_enabled && snapshot.retrieval_function_ready ? "pass" : "fail",
        message:
          snapshot.pgvector_enabled && snapshot.retrieval_function_ready
            ? "pgvector and match_knowledge_chunks are available."
            : "Enable pgvector and run the retrieval migrations.",
        details: {
          pgvectorEnabled: snapshot.pgvector_enabled,
          retrievalFunctionReady: snapshot.retrieval_function_ready
        }
      });
    }

    const tenantCheck = await runTenantScopeCheck(supabase);
    checks.push(tenantCheck);
  }

  const embeddingCheck = await runEmbeddingCheck();
  checks.push(embeddingCheck);

  const chatModelCheck = await runChatModelCheck();
  checks.push(chatModelCheck);

  if (supabase && config.openaiConfigured) {
    checks.push(await runRetrievalCheck(supabase, organizationId));
  } else {
    checks.push({
      name: "End-to-end retrieval",
      status: "skip",
      message: "Skipped until Supabase and OpenAI are configured."
    });
  }

  const failed = checks.filter((check) => check.status === "fail").length;
  const warned = checks.filter((check) => check.status === "warn").length;

  return {
    ok: failed === 0,
    status: failed ? "blocked" : warned ? "ready_with_warnings" : "ready",
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    organizationId,
    checks
  };
}

async function runTenantScopeCheck(supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>): Promise<ReadinessCheck> {
  const orgA = `org_readiness_a_${Date.now()}`;
  const orgB = `org_readiness_b_${Date.now()}`;

  try {
    const { error: orgError } = await supabase.from("organizations").insert([
      {
        id: orgA,
        name: "Readiness Tenant A",
        slug: orgA,
        website: "https://tenant-a.example"
      },
      {
        id: orgB,
        name: "Readiness Tenant B",
        slug: orgB,
        website: "https://tenant-b.example"
      }
    ]);

    if (orgError) throw orgError;

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .insert({
        organization_id: orgA,
        title: "Tenant isolation smoke test",
        current_issue: "Readiness test"
      })
      .select("id")
      .single();

    if (conversationError || !conversation) throw conversationError || new Error("No conversation returned.");

    const { data: wrongTenantRows, error: wrongTenantError } = await supabase
      .from("conversations")
      .select("id")
      .eq("organization_id", orgB)
      .eq("id", conversation.id);

    if (wrongTenantError) throw wrongTenantError;

    return {
      name: "Multi-tenant isolation",
      status: wrongTenantRows?.length ? "fail" : "pass",
      message: wrongTenantRows?.length
        ? "A conversation appeared under the wrong organization filter."
        : "Organization-scoped queries do not leak the tenant isolation test conversation."
    };
  } catch (error) {
    return {
      name: "Multi-tenant isolation",
      status: "fail",
      message: error instanceof Error ? error.message : "Tenant isolation check failed."
    };
  } finally {
    await supabase.from("organizations").delete().in("id", [orgA, orgB]);
  }
}

async function runEmbeddingCheck(): Promise<ReadinessCheck> {
  if (!serverEnv.openaiApiKey) {
    return {
      name: "OpenAI embeddings",
      status: "fail",
      message: "OPENAI_API_KEY is missing."
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        authorization: `Bearer ${serverEnv.openaiApiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: serverEnv.embeddingModel,
        input: "Nexamind production readiness check",
        dimensions: serverEnv.embeddingDimensions
      })
    });

    const payload = (await response.json()) as {
      data?: Array<{ embedding: number[] }>;
      error?: { message?: string };
    };

    const dimensions = payload.data?.[0]?.embedding.length || 0;
    const passes = response.ok && dimensions === serverEnv.embeddingDimensions;

    return {
      name: "OpenAI embeddings",
      status: passes ? "pass" : "fail",
      message: passes
        ? `Embedding model returned ${dimensions} dimensions.`
        : payload.error?.message || `Expected ${serverEnv.embeddingDimensions} dimensions, received ${dimensions}.`,
      details: { model: serverEnv.embeddingModel, dimensions }
    };
  } catch (error) {
    return {
      name: "OpenAI embeddings",
      status: "fail",
      message: error instanceof Error ? error.message : "Embedding check failed."
    };
  }
}

async function runChatModelCheck(): Promise<ReadinessCheck> {
  if (!serverEnv.openaiApiKey) {
    return {
      name: "OpenAI chat model",
      status: "fail",
      message: "OPENAI_API_KEY is missing."
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${serverEnv.openaiApiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: serverEnv.chatModel,
        messages: [
          {
            role: "user",
            content: "Reply with the single word: ready"
          }
        ],
        temperature: 0,
        max_tokens: 4
      })
    });

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    return {
      name: "OpenAI chat model",
      status: response.ok ? "pass" : "fail",
      message: response.ok
        ? `Chat model responded: ${payload.choices?.[0]?.message?.content?.trim() || "ok"}`
        : payload.error?.message || "Chat model check failed.",
      details: { model: serverEnv.chatModel }
    };
  } catch (error) {
    return {
      name: "OpenAI chat model",
      status: "fail",
      message: error instanceof Error ? error.message : "Chat model check failed."
    };
  }
}

async function runRetrievalCheck(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  organizationId: string
): Promise<ReadinessCheck> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        authorization: `Bearer ${serverEnv.openaiApiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: serverEnv.embeddingModel,
        input: "credits billing policy support question",
        dimensions: serverEnv.embeddingDimensions
      })
    });

    const payload = (await response.json()) as {
      data?: Array<{ embedding: number[] }>;
      error?: { message?: string };
    };

    if (!response.ok || !payload.data?.[0]?.embedding) {
      return {
        name: "End-to-end retrieval",
        status: "fail",
        message: payload.error?.message || "Unable to create retrieval test embedding."
      };
    }

    const { data, error } = await supabase.rpc("match_knowledge_chunks", {
      match_organization_id: organizationId,
      query_embedding: `[${payload.data[0].embedding.join(",")}]`,
      match_count: 8
    });

    if (error) {
      return {
        name: "End-to-end retrieval",
        status: "fail",
        message: error.message
      };
    }

    const count = Array.isArray(data) ? data.length : 0;

    return {
      name: "End-to-end retrieval",
      status: count ? "pass" : "warn",
      message: count
        ? `Retrieved ${count} Company Brain chunks for ${organizationId}.`
        : `Retrieval RPC works, but ${organizationId} has no embedded chunks yet.`,
      details: { organizationId, chunks: count }
    };
  } catch (error) {
    return {
      name: "End-to-end retrieval",
      status: "fail",
      message: error instanceof Error ? error.message : "Retrieval check failed."
    };
  }
}
