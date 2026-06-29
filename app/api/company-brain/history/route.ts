import { NextRequest, NextResponse } from "next/server";
import { getCrawlHistory } from "@/lib/company-brain-pipeline";

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organizationId") || "org_demo";
  const result = await getCrawlHistory(organizationId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}

