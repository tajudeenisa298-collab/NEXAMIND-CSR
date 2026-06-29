import { NextResponse } from "next/server";
import { runCopilotAction } from "@/lib/human-copilot";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    organizationId?: string;
    conversationId?: string;
    actionType?: "create_ticket" | "refund_review" | "slack_notify" | "email_followup" | "human_takeover" | "resolve_conversation" | "send_reply";
    reply?: string;
    note?: string;
  };

  if (!body.conversationId || !body.actionType) {
    return NextResponse.json(
      {
        error: {
          code: "missing_action",
          message: "Choose a conversation and action first."
        }
      },
      { status: 400 }
    );
  }

  const result = await runCopilotAction({
    organizationId: body.organizationId || "org_demo",
    conversationId: body.conversationId,
    actionType: body.actionType,
    reply: body.reply,
    note: body.note
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
