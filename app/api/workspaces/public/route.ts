import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("workspace") || "";

  if (!organizationId) {
    return NextResponse.json(
      {
        error: {
          code: "missing_workspace",
          message: "Workspace link is missing a company ID."
        }
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error: {
          code: "workspace_lookup_unavailable",
          message: "Workspace lookup needs Supabase to be connected."
        }
      },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("id,name,slug,website,profile,created_at")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error: {
          code: "workspace_lookup_failed",
          message: error.message
        }
      },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        error: {
          code: "workspace_not_found",
          message: "This company workspace was not found."
        }
      },
      { status: 404 }
    );
  }

  const profile = (data.profile || {}) as Record<string, any>;

  return NextResponse.json({
    id: data.id,
    name: data.name || profile.company || "Customer Workspace",
    slug: data.slug || data.id.replace(/^org_/, ""),
    plan: "Demo",
    website: data.website || "",
    supportEmail: profile.supportEmail || `support@${new URL(data.website || "https://example.com").hostname}`,
    timezone: "America/Los_Angeles",
    brandColor: profile.primaryColor || "#1f8a5b",
    logoUrl: profile.logoUrl || undefined,
    aiTone: Array.isArray(profile.tone) ? profile.tone.join(", ") : "Friendly, professional, helpful",
    escalationThreshold: 0.72
  });
}
