import { NextResponse } from "next/server";
import { runPlaygroundTrace } from "@/lib/ai-playground";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    organizationId?: string;
    organizationName?: string;
    question?: string;
    promptOverride?: string;
  };

  if (!body.question?.trim()) {
    return NextResponse.json({ error: { code: "missing_question", message: "Ask a question first." } }, { status: 400 });
  }

  const result = await runPlaygroundTrace({
    organizationId: body.organizationId || "org_demo",
    organizationName: body.organizationName || "Workspace",
    question: body.question,
    promptOverride: body.promptOverride
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
