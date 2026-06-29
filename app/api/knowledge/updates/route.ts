import { NextResponse } from "next/server";
import { saveManualKnowledgeUpdate } from "@/lib/knowledge-training";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await saveManualKnowledgeUpdate({
      organizationId: body.organizationId,
      title: body.title || "Manual knowledge update",
      body: body.body || "",
      updateType: body.updateType || "instruction",
      createdBy: body.createdBy || null
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ data: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "knowledge_update_failed",
          message: error instanceof Error ? error.message : "Unable to save knowledge update."
        }
      },
      { status: 500 }
    );
  }
}
