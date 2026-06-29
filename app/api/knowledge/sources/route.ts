import { NextResponse } from "next/server";
import { listKnowledgeLibrary } from "@/lib/knowledge-training";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId") || "org_picx";

  const result = await listKnowledgeLibrary(organizationId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
