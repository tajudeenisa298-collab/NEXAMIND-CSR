import { NextResponse } from "next/server";
import { saveAiImprovement } from "@/lib/ai-improvement-center";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    organizationId?: string;
    conversationId?: string;
    messageId?: string;
    reviewerName?: string;
    originalResponse?: string;
    improvedResponse?: string;
    improvementNotes?: string;
    promptGuidance?: string;
    qualityScore?: number;
  };

  if (!body.conversationId || !body.messageId) {
    return NextResponse.json(
      {
        error: {
          code: "missing_response",
          message: "Choose an AI response before saving an improvement."
        }
      },
      { status: 400 }
    );
  }

  const result = await saveAiImprovement({
    organizationId: body.organizationId || "org_demo",
    conversationId: body.conversationId,
    messageId: body.messageId,
    reviewerName: body.reviewerName,
    originalResponse: body.originalResponse || "",
    improvedResponse: body.improvedResponse || "",
    improvementNotes: body.improvementNotes || "",
    promptGuidance: body.promptGuidance || "",
    qualityScore: body.qualityScore
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
