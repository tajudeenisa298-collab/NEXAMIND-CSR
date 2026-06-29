import fs from "node:fs";

const envPath = ".env.local";
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "PRODUCTION_HEALTH_CHECK_TOKEN"
];

if (!fs.existsSync(envPath)) {
  console.log("Missing .env.local. Create it from .env.example first.");
  process.exit(1);
}

const content = fs.readFileSync(envPath, "utf8");
const values = new Map(
  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const [key, ...rest] = line.split("=");
      return [key, rest.join("=").replace(/^"|"$/g, "")];
    })
);

let failed = false;

for (const key of required) {
  const value = values.get(key) || "";
  const missing = !value || value.includes("PASTE_") || value.includes("_HERE");
  console.log(`${missing ? "MISSING" : "OK"} ${key}`);
  if (missing) failed = true;
}

if (failed) {
  console.log("\nReplace the placeholder values in .env.local, then run this check again.");
  process.exit(1);
}

console.log("\nLocal environment values are filled in. Restart the dev server before testing.");
