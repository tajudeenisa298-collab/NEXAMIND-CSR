import { NextResponse } from "next/server";
import { runAutomationAction, type AutomationActionType } from "@/lib/automation-engine";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    organizationId?: string;
    workflowId?: string;
    actionType?: AutomationActionType;
    reason?: string;
    customerName?: string;
    customerEmail?: string;
    subject?: string;
    description?: string;
    priority?: "low" | "normal" | "high" | "urgent";
    intent?: string;
    assignedQueue?: string;
    payload?: Record<string, unknown>;
  };

  if (!body.actionType) {
    return NextResponse.json(
      {
        error: {
          code: "missing_action_type",
          message: "Choose an automation action to run."
        }
      },
      { status: 400 }
    );
  }

  const result = await runAutomationAction({
    organizationId: body.organizationId || "org_demo",
    workflowId: body.workflowId,
    actionType: body.actionType,
    reason: body.reason,
    customerName: body.customerName,
    customerEmail: body.customerEmail,
    subject: body.subject,
    description: body.description,
    priority: body.priority,
    intent: body.intent,
    assignedQueue: body.assignedQueue,
    payload: body.payload
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
