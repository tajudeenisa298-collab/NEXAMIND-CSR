import { NextResponse } from "next/server";
import { getExecutiveDashboard } from "@/lib/executive-intelligence";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId") || "org_demo";

  const result = await getExecutiveDashboard(organizationId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
