import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type OrganizationRow = {
  id: string;
  name: string | null;
  slug: string | null;
  website: string | null;
  profile: Record<string, any> | null;
};

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return NextResponse.json({ organizations: [] });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ organizations: [] });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const user = authData.user;

  if (authError || !user?.email) {
    return NextResponse.json({ organizations: [] });
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id,role,status")
    .eq("status", "active")
    .or(`user_id.eq.${user.id},email.eq.${user.email.toLowerCase()}`);

  if (membershipError || !memberships?.length) {
    return NextResponse.json({ organizations: [] });
  }

  const organizationIds = Array.from(new Set(memberships.map((membership) => membership.organization_id)));
  const { data: organizations, error: organizationError } = await supabase
    .from("organizations")
    .select("id,name,slug,website,profile")
    .in("id", organizationIds);

  if (organizationError) {
    return NextResponse.json(
      {
        error: {
          code: "membership_lookup_failed",
          message: organizationError.message
        }
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    organizations: (organizations || []).map(mapOrganization)
  });
}

function mapOrganization(organization: OrganizationRow) {
  const profile = organization.profile || {};
  const website = organization.website || "https://example.com";
  const hostname = safeHostname(website);

  return {
    id: organization.id,
    name: organization.name || profile.company || "Customer Workspace",
    slug: organization.slug || organization.id.replace(/^org_/, ""),
    plan: profile.plan || "Pro",
    website,
    supportEmail: profile.supportEmail || `support@${hostname}`,
    timezone: profile.timezone || "America/Los_Angeles",
    brandColor: profile.primaryColor || "#1f8a5b",
    logoUrl: profile.logoUrl || undefined,
    aiTone: Array.isArray(profile.tone) ? profile.tone.join(", ") : "Friendly, professional, helpful",
    escalationThreshold: Number(profile.escalationThreshold || 0.72)
  };
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "example.com";
  }
}
