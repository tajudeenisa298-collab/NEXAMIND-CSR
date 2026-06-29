import { NextResponse } from "next/server";
import { runProductionReadinessCheck } from "@/lib/production-readiness";
import { serverEnv } from "@/lib/server-env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") || "org_picx";
  const isProtectedEnvironment = process.env.NODE_ENV === "production";

  if (isProtectedEnvironment) {
    if (!serverEnv.productionHealthCheckToken) {
      return NextResponse.json(
        {
          error: {
            code: "health_check_token_missing",
            message: "Set PRODUCTION_HEALTH_CHECK_TOKEN before enabling production readiness checks."
          }
        },
        { status: 503 }
      );
    }

    const authorization = request.headers.get("authorization") || "";
    const expected = `Bearer ${serverEnv.productionHealthCheckToken}`;
    if (authorization !== expected) {
      return NextResponse.json(
        {
          error: {
            code: "unauthorized",
            message: "Production readiness check requires a valid bearer token."
          }
        },
        { status: 401 }
      );
    }
  }

  const result = await runProductionReadinessCheck(organizationId);
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
