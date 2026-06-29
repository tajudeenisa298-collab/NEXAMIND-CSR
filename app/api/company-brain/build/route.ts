import { NextRequest, NextResponse } from "next/server";
import { buildCompanyBrainPersisted } from "@/lib/company-brain-pipeline";

type BuildRequest = {
  website?: string;
  organizationId?: string;
  rebuild?: boolean;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as BuildRequest;
  const result = await buildCompanyBrainPersisted({
    website: body.website || "",
    organizationId: body.organizationId || "org_demo",
    rebuild: body.rebuild
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}

