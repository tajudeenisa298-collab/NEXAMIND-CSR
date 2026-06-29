import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";

  if (!organizationId) {
    return NextResponse.json(
      {
        error: {
          code: "missing_organization",
          message: "Choose a company before offboarding."
        }
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      localOnly: true,
      message: "Supabase is not connected, so the company was removed from the local demo switcher only."
    });
  }

  const { error } = await supabase.from("organizations").delete().eq("id", organizationId);
  if (error) {
    return NextResponse.json(
      {
        error: {
          code: "offboard_failed",
          message: error.message
        }
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    localOnly: false,
    message: "Company offboarded. Related tenant data is removed through database cascade rules."
  });
}
