"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card auth-loading-card">
          <div className="loader-orbit" aria-hidden="true">
            <span />
            <span />
          </div>
          <span className="eyebrow">Loading</span>
          <h1>Preparing your workspace</h1>
          <p>Checking the current session and organization scope.</p>
          <div className="skeleton-stack" aria-hidden="true">
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <span className="eyebrow">Authentication required</span>
          <h1>Sign in to continue</h1>
          <p>
            This SaaS shell protects dashboard routes behind the authentication boundary.
          </p>
          <Link className="button" href="/login">
            <Lock size={16} />
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
