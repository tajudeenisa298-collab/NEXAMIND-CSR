import { NextResponse } from "next/server";
import { getSupportConversation } from "@/lib/support-chat";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") || "org_demo";
  const result = await getSupportConversation(organizationId, conversationId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
