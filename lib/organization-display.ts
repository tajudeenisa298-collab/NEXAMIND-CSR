export function normalizeOrganizationDisplayName(input: {
  id?: string | null;
  name?: string | null;
  profileCompany?: string | null;
  slug?: string | null;
}) {
  const raw =
    input.name ||
    input.profileCompany ||
    input.slug ||
    input.id?.replace(/^org_/, "") ||
    "Customer Workspace";

  const cleaned = raw
    .replace(/^org[_-\s]+/i, "")
    .replace(/[_-]\d{8,}$/g, "")
    .replace(/\s+\d{8,}$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "Customer Workspace";
  if (/[A-Z]/.test(cleaned.slice(1))) return cleaned;

  return cleaned
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
