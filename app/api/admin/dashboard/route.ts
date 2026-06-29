import { NextResponse } from "next/server";
import { getAdminDashboard } from "@/lib/admin-panel";
import { serverEnv } from "@/lib/server-env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const authResult = await requirePlatformAdmin(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const result = await getAdminDashboard();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}

async function requirePlatformAdmin(request: Request) {
  if (process.env.NODE_ENV !== "production" && serverEnv.demoMode) {
    return { ok: true as const };
  }

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return {
      ok: false as const,
      status: 401,
      error: {
        code: "admin_auth_required",
        message: "Admin dashboard requires a signed-in owner or admin account."
      }
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      ok: false as const,
      status: 503,
      error: {
        code: "admin_auth_not_configured",
        message: "Supabase service role is required to verify admin access."
      }
    };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return {
      ok: false as const,
      status: 401,
      error: {
        code: "admin_auth_invalid",
        message: "Admin session is invalid or expired."
      }
    };
  }

  const email = (data.user.email || "").toLowerCase();
  const metadataRole = String(data.user.user_metadata?.role || "").toLowerCase();
  const allowed = serverEnv.ownerEmails.includes(email) || metadataRole === "owner" || metadataRole === "admin";

  if (!allowed) {
    return {
      ok: false as const,
      status: 403,
      error: {
        code: "admin_forbidden",
        message: "This account is a tenant user and cannot access the owner dashboard."
      }
    };
  }

  return { ok: true as const };
}
