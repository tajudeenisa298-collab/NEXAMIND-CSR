"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { appEnv, hasSupabaseConfig } from "@/lib/env";
import { isPlatformAdmin, type AppUser, useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { authMode, signInDemo, signInWithPassword, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace(getPostLoginRoute(user));
    }
  }, [router, user]);

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const nextUser = await signInWithPassword(email, password);
      setMessage("Signed in successfully.");
      router.replace(getPostLoginRoute(nextUser));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDemoSignIn() {
    signInDemo();
    router.replace("/admin");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">Secure Access</span>
        <h1>Sign in to {appEnv.appName}</h1>
        <p>
          Owners see the Nexamind operator dashboard. Tenant users see only their
          company workspace and business stats.
        </p>

        <form className="form-stack" onSubmit={handleEmailSignIn}>
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@nexamind.ai or user@company.com"
              required
              type="email"
              value={email}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              className="input"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your Supabase password"
              required
              type="password"
              value={password}
            />
          </label>

          <button className="button" disabled={submitting} type="submit">
            <LockKeyhole size={16} />
            {submitting ? "Signing in..." : "Sign in"}
          </button>

          {authMode === "demo" ? (
            <button className="button secondary" onClick={handleDemoSignIn} type="button">
              <Sparkles size={16} />
              Open owner demo
            </button>
          ) : null}
        </form>

        {message ? <p className="muted">{message}</p> : null}

        <p className="muted" style={{ fontSize: 13 }}>
          Supabase status: {hasSupabaseConfig() ? "configured" : "not configured yet"}
          <ArrowRight size={13} style={{ margin: "0 4px -2px" }} />
          {authMode === "supabase" ? "password login active." : "demo mode active."}
        </p>
      </section>
    </main>
  );
}

function getPostLoginRoute(user: AppUser) {
  if (isPlatformAdmin(user)) return "/admin";
  return window.localStorage.getItem("nexamind.workspace.created") ? "/dashboard" : "/workspace/new";
}
