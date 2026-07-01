"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { isPlatformAdmin, useAuth } from "@/lib/auth";
import { normalizeWebsiteInput } from "@/lib/company-brain";
import { demoOrganizations, type Organization } from "@/lib/demo-data";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type OrganizationContextValue = {
  organizations: Organization[];
  activeOrganization: Organization;
  organizationLoading: boolean;
  setActiveOrganizationId: (id: string) => void;
  createOrganization: (input: {
    name: string;
    website: string;
    supportEmail?: string;
    brandColor?: string;
    logoUrl?: string;
    isolateWorkspace?: boolean;
  }) => Organization;
  setCustomerWorkspace: (organization: Organization) => void;
  updateActiveOrganization: (patch: Partial<Organization>) => void;
  removeOrganization: (id: string) => void;
};

const OrganizationContext = createContext<OrganizationContextValue | null>(null);
const STORAGE_KEY = "nexamind.active.organization";
const ORGS_STORAGE_KEY = "nexamind.organizations";

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user, authMode } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>(demoOrganizations);
  const [activeOrganizationId, setActiveOrganizationIdState] = useState(demoOrganizations[0].id);
  const [organizationLoading, setOrganizationLoading] = useState(false);

  useEffect(() => {
    const storedOrganizations = window.localStorage.getItem(ORGS_STORAGE_KEY);
    const storedActiveId = window.localStorage.getItem(STORAGE_KEY);

    if (storedOrganizations) {
      setOrganizations(
        (JSON.parse(storedOrganizations) as Organization[]).map((organization) => ({
          ...organization,
          website: organization.website || `https://${organization.slug}.example`
        }))
      );
    }

    if (storedActiveId) {
      setActiveOrganizationIdState(storedActiveId);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadMemberships() {
      if (!user || authMode !== "supabase" || isPlatformAdmin(user)) return;

      setOrganizationLoading(true);
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const token = data.session?.access_token;
      if (!token) {
        if (mounted) setOrganizationLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/organizations/memberships", {
          headers: {
            authorization: `Bearer ${token}`
          }
        });
        const json = await response.json();
        const memberOrganizations = (json.organizations || []) as Organization[];

        if (mounted) {
          if (memberOrganizations.length) {
            const currentActive = memberOrganizations.find((organization) => organization.id === activeOrganizationId);
            const nextActive = currentActive || memberOrganizations[0];
            setOrganizations(memberOrganizations);
            setActiveOrganizationIdState(nextActive.id);
            window.localStorage.setItem(ORGS_STORAGE_KEY, JSON.stringify(memberOrganizations));
            window.localStorage.setItem(STORAGE_KEY, nextActive.id);
          } else {
            setOrganizations([]);
            setActiveOrganizationIdState("");
            window.localStorage.removeItem(ORGS_STORAGE_KEY);
            window.localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {
        if (mounted) {
          setOrganizations([]);
          setActiveOrganizationIdState("");
        }
      } finally {
        if (mounted) setOrganizationLoading(false);
      }
    }

    void loadMemberships();

    return () => {
      mounted = false;
    };
  }, [activeOrganizationId, authMode, user]);

  const setActiveOrganizationId = useCallback((id: string) => {
    setActiveOrganizationIdState(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const createOrganization = useCallback(
    (input: {
      name: string;
      website: string;
      supportEmail?: string;
      brandColor?: string;
      logoUrl?: string;
      isolateWorkspace?: boolean;
    }) => {
      const website = normalizeWebsiteInput(input.website);
      const slug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const organization: Organization = {
        id: `org_${slug || "workspace"}_${Date.now()}`,
        name: input.name,
        slug: slug || "workspace",
        plan: "Demo",
        website,
        supportEmail: input.supportEmail || `support@${new URL(website).hostname}`,
        timezone: "America/Los_Angeles",
        brandColor: input.brandColor || "#1f8a5b",
        logoUrl: input.logoUrl,
        aiTone: "Friendly, professional, helpful",
        escalationThreshold: 0.72
      };

      setOrganizations((current) => {
        const next = input.isolateWorkspace ? [organization] : [...current, organization];
        window.localStorage.setItem(ORGS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setActiveOrganizationId(organization.id);
      window.localStorage.setItem("nexamind.workspace.created", "true");
      return organization;
    },
    [setActiveOrganizationId]
  );

  const updateActiveOrganization = useCallback(
    (patch: Partial<Organization>) => {
      setOrganizations((current) => {
        const next = current.map((organization) =>
          organization.id === activeOrganizationId
            ? { ...organization, ...patch }
            : organization
        );
        window.localStorage.setItem(ORGS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [activeOrganizationId]
  );

  const setCustomerWorkspace = useCallback((organization: Organization) => {
    const next = [organization];
    window.localStorage.setItem(ORGS_STORAGE_KEY, JSON.stringify(next));
    window.localStorage.setItem(STORAGE_KEY, organization.id);
    window.localStorage.setItem("nexamind.workspace.created", "true");
    setOrganizations(next);
    setActiveOrganizationIdState(organization.id);
  }, []);

  const removeOrganization = useCallback(
    (id: string) => {
      setOrganizations((current) => {
        const next = current.filter((organization) => organization.id !== id);
        const safeNext = next.length ? next : [demoOrganizations[0]];
        const nextActiveId =
          activeOrganizationId === id
            ? safeNext[0].id
            : activeOrganizationId;

        window.localStorage.setItem(ORGS_STORAGE_KEY, JSON.stringify(safeNext));
        window.localStorage.setItem(STORAGE_KEY, nextActiveId);
        window.localStorage.removeItem(`nexamind.companyBrain.${id}`);
        window.localStorage.removeItem(`nexamind.chat.${id}`);
        window.localStorage.removeItem(`nexamind.demo.${id}`);
        setActiveOrganizationIdState(nextActiveId);
        return safeNext;
      });
    },
    [activeOrganizationId]
  );

  const activeOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ||
    organizations[0] ||
    createUnassignedOrganization(user?.email);

  const value = useMemo(
    () => ({
      organizations,
      activeOrganization,
      organizationLoading,
      createOrganization,
      removeOrganization,
      setCustomerWorkspace,
      setActiveOrganizationId,
      updateActiveOrganization
    }),
    [
      activeOrganization,
      createOrganization,
      organizationLoading,
      removeOrganization,
      setCustomerWorkspace,
      organizations,
      setActiveOrganizationId,
      updateActiveOrganization
    ]
  );

  return (
    <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);

  if (!context) {
    throw new Error("useOrganization must be used inside OrganizationProvider");
  }

  return context;
}

function createUnassignedOrganization(email?: string): Organization {
  return {
    id: "org_unassigned",
    name: "Workspace not assigned",
    slug: "unassigned",
    plan: "Pro",
    website: "https://example.com",
    supportEmail: email || "support@example.com",
    timezone: "America/Los_Angeles",
    brandColor: "#1f8a5b",
    aiTone: "Friendly, professional, helpful",
    escalationThreshold: 0.72
  };
}
