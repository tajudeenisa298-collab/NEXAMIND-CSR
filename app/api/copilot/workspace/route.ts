import { NextResponse } from "next/server";
import { getHumanCopilotWorkspace } from "@/lib/human-copilot";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId") || "org_demo";
  const conversationId = searchParams.get("conversationId") || undefined;

  const result = await getHumanCopilotWorkspace(organizationId, conversationId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
