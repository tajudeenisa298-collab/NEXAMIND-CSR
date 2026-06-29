import { NextResponse } from "next/server";
import { listSupportConversations } from "@/lib/support-chat";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") || "org_demo";
  const result = await listSupportConversations(organizationId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
