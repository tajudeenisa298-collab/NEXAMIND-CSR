import { NextResponse } from "next/server";
import { addInternalNote } from "@/lib/human-copilot";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    organizationId?: string;
    conversationId?: string;
    body?: string;
    authorName?: string;
    visibility?: "internal" | "handoff";
  };

  if (!body.conversationId) {
    return NextResponse.json(
      {
        error: {
          code: "missing_conversation",
          message: "Choose a conversation before saving a note."
        }
      },
      { status: 400 }
    );
  }

  const result = await addInternalNote({
    organizationId: body.organizationId || "org_demo",
    conversationId: body.conversationId,
    body: body.body || "",
    authorName: body.authorName,
    visibility: body.visibility
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
