import { NextResponse } from "next/server";
import { buildPersonalizedDemo } from "@/lib/demo-builder";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    organizationId?: string;
    companyName?: string;
    website?: string;
    logoUrl?: string;
    primaryColor?: string;
  };

  if (!body.organizationId || !body.companyName || !body.website) {
    return NextResponse.json(
      {
        error: {
          code: "missing_demo_input",
          message: "Company name, website, and organization ID are required."
        }
      },
      { status: 400 }
    );
  }

  const result = await buildPersonalizedDemo({
    organizationId: body.organizationId,
    companyName: body.companyName,
    website: body.website,
    logoUrl: body.logoUrl,
    primaryColor: body.primaryColor || "#1f8a5b"
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
