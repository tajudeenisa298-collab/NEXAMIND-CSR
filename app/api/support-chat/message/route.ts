import { NextResponse } from "next/server";
import { getSupportChatRuntimeStatus, runSupportChatTurn, type ChatAttachment } from "@/lib/support-chat";

export async function POST(request: Request) {
  const runtime = getSupportChatRuntimeStatus(true);
  if (!runtime.configured) {
    return NextResponse.json({ error: runtime.error }, { status: 503 });
  }

  const body = (await request.json()) as {
    organizationId?: string;
    organizationName?: string;
    organizationWebsite?: string;
    supportEmail?: string;
    aiTone?: string;
    customerName?: string;
    customerEmail?: string;
    conversationId?: string;
    question?: string;
    attachments?: ChatAttachment[];
    regenerate?: boolean;
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        await runSupportChatTurn(
          {
            organizationId: body.organizationId || "org_demo",
            organizationName: body.organizationName || "Workspace",
            organizationWebsite: body.organizationWebsite || "https://example.com",
            supportEmail: body.supportEmail || "",
            aiTone: body.aiTone || "friendly, professional, helpful",
            customerName: body.customerName,
            customerEmail: body.customerEmail,
            conversationId: body.conversationId,
            question: body.question,
            attachments: body.attachments || [],
            regenerate: body.regenerate
          },
          emit
        );
      } catch (error) {
        emit({
          type: "error",
          message: error instanceof Error ? error.message : "AI Support Chat failed."
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform"
    }
  });
}
