import { NextResponse } from "next/server";
import { runEvaluationSuite } from "@/lib/ai-evaluation";

export async function POST(request: Request) {
  const body = (await request.json()) as { organizationId?: string };
  const result = await runEvaluationSuite(body.organizationId || "org_demo");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
