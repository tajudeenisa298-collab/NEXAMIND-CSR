import { NextResponse } from "next/server";
import { uploadKnowledgeFiles } from "@/lib/knowledge-training";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const organizationId = String(formData.get("organizationId") || "");
    const note = String(formData.get("note") || "");
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    const result = await uploadKnowledgeFiles({
      organizationId,
      files,
      note
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ data: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "knowledge_upload_failed",
          message: error instanceof Error ? error.message : "Unable to upload knowledge files."
        }
      },
      { status: 500 }
    );
  }
}
