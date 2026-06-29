"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";
import { Bot, Command, LogOut, Search, Sparkles } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { OrgSwitcher } from "@/components/org-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastCenter } from "@/components/toast-center";
import { appEnv } from "@/lib/env";
import { ownerNavItems, tenantNavItems } from "@/lib/demo-data";
import { isPlatformAdmin, useAuth } from "@/lib/auth";
import { useOrganization } from "@/lib/org";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, authMode } = useAuth();
  const { activeOrganization } = useOrganization();
  const [searchQuery, setSearchQuery] = useState("");
  const platformAdmin = isPlatformAdmin(user);
  const navigationItems = platformAdmin ? ownerNavItems : tenantNavItems;
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return navigationItems
      .filter((item) => `${item.label} ${item.href}`.toLowerCase().includes(query))
      .slice(0, 5);
  }, [navigationItems, searchQuery]);
  const brandStyle = {
    "--accent": activeOrganization.brandColor || "#1f8a5b"
  } as CSSProperties;
  const goToSearchResult = () => {
    const target = searchResults[0] || navigationItems.find((item) => item.label.toLowerCase().includes("dashboard"));
    if (target) {
      setSearchQuery("");
      router.push(target.href);
    }
  };

  return (
    <AuthGate>
      <div className="app-frame" style={brandStyle}>
        <aside className="sidebar">
          <Link className="brand" href="/dashboard">
            <span className="brand-mark">
              {activeOrganization.logoUrl ? <img alt="" src={activeOrganization.logoUrl} /> : <Bot size={18} />}
            </span>
            <span>{appEnv.appName}</span>
          </Link>

          <div className="sidebar-search-wrap">
            <form
              className="sidebar-search"
              onSubmit={(event) => {
                event.preventDefault();
                goToSearchResult();
              }}
              role="search"
            >
              <Search size={14} />
              <input
                aria-label="Search workspace pages"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    goToSearchResult();
                  }
                }}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search"
                value={searchQuery}
              />
              <kbd>/</kbd>
            </form>
            {searchResults.length ? (
              <div className="sidebar-search-results">
                {searchResults.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link href={item.href} key={item.href} onClick={() => setSearchQuery("")}>
                      <Icon size={14} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>

          {platformAdmin ? <OrgSwitcher /> : (
            <div className="tenant-scope-card">
              <span className="eyebrow">Tenant Workspace</span>
              <strong>{activeOrganization.name}</strong>
              <span>Company workspace</span>
            </div>
          )}

          <nav className="nav" aria-label="Main navigation">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link className={cn(active && "active")} href={item.href} key={item.href}>
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <Link className="sidebar-help-card" href="/company-brain">
              <span className="help-spark">
                <Sparkles size={14} />
              </span>
              <div>
                <strong>Get Started</strong>
                <p>Build the Company Brain, then ask your AI a real support question.</p>
              </div>
            </Link>
            <div className="sidebar-user-card">
              <span className="user-avatar">{user?.name?.slice(0, 1) || "U"}</span>
              <div>
                <strong>{user?.name || "Support user"}</strong>
                <span>{user?.email || activeOrganization.supportEmail}</span>
              </div>
              <Command size={14} />
            </div>
            <button className="button secondary" onClick={() => void signOut()} type="button">
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div>
              <strong>{activeOrganization.name}</strong>
              <div className="muted" style={{ fontSize: 13 }}>
                {activeOrganization.supportEmail}
              </div>
            </div>
            <div className="topbar-actions">
              <span className="badge">{authMode === "supabase" ? "Password Auth" : "Demo Auth"}</span>
              <ThemeToggle />
              <span className="badge">{user?.role}</span>
            </div>
          </header>

          <section className="content page-transition" key={pathname}>
            {children}
          </section>
          <ToastCenter />
        </main>
      </div>
    </AuthGate>
  );
}
