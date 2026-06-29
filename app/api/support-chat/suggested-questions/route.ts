import { NextResponse } from "next/server";
import { getSuggestedQuestions } from "@/lib/support-chat";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") || "org_demo";
  const result = await getSuggestedQuestions(organizationId);

  return NextResponse.json({ data: result.data });
}
