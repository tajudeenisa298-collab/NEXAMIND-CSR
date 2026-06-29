import { NextResponse } from "next/server";
import { listPlaygroundRuns } from "@/lib/ai-playground";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId") || "org_demo";
  const result = await listPlaygroundRuns(organizationId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
