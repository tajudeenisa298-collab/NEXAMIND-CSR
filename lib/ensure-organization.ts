import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function ensureOrganizationRecord(input: {
  organizationId: string;
  name?: string;
  website?: string;
}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  const fallbackName = input.name || input.organizationId.replace(/^org_/, "").replace(/[-_]/g, " ") || "Workspace";
  const fallbackWebsite = input.website || "https://example.com";

  await supabase.from("organizations").upsert({
    id: input.organizationId,
    name: fallbackName,
    slug: input.organizationId.replace(/^org_/, ""),
    website: fallbackWebsite,
    updated_at: new Date().toISOString()
  });
}
