import { NextResponse } from "next/server";
import { getAdminDashboard } from "@/lib/admin-panel";

export async function GET() {
  const result = await getAdminDashboard();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
