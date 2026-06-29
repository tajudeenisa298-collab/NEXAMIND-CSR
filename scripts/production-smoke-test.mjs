const baseUrl = (process.env.STAGING_URL || process.argv[2] || "http://127.0.0.1:3000").replace(/\/$/, "");
const organizationId = process.env.SMOKE_TEST_ORGANIZATION_ID || process.argv[3] || "org_picx";
const token = process.env.PRODUCTION_HEALTH_CHECK_TOKEN || "";

const headers = token ? { authorization: `Bearer ${token}` } : {};
const url = `${baseUrl}/api/health/production-readiness?organizationId=${encodeURIComponent(organizationId)}`;

const response = await fetch(url, { headers });
const payload = await response.json();

console.log(`SupportFlow AI production readiness: ${payload.status || "unavailable"}`);
console.log(`Target: ${baseUrl}`);
console.log(`Organization: ${organizationId}`);

if (Array.isArray(payload.checks)) {
  for (const check of payload.checks) {
    const marker = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : check.status === "skip" ? "SKIP" : "FAIL";
    console.log(`[${marker}] ${check.name}: ${check.message}`);
  }
} else if (payload.error) {
  console.log(`[FAIL] ${payload.error.code}: ${payload.error.message}`);
}

if (!response.ok || payload.ok === false) {
  process.exitCode = 1;
}
