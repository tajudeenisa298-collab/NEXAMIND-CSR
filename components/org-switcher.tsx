"use client";

import { Building2 } from "lucide-react";
import { useOrganization } from "@/lib/org";

export function OrgSwitcher() {
  const { organizations, activeOrganization, setActiveOrganizationId } = useOrganization();

  return (
    <label className="field">
      <span>Organization</span>
      <div style={{ position: "relative" }}>
        <Building2
          aria-hidden="true"
          size={16}
          style={{ left: 12, position: "absolute", top: 12, color: "var(--muted)" }}
        />
        <select
          aria-label="Active organization"
          className="select"
          onChange={(event) => setActiveOrganizationId(event.target.value)}
          style={{ paddingLeft: 36 }}
          value={activeOrganization.id}
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

