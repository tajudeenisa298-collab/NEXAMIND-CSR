"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, Sparkles } from "lucide-react";
import { appEnv, hasSupabaseConfig } from "@/lib/env";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { signInDemo, signInWithEmail, user } = useAuth();
  const [email, setEmail] = useState("isa@supportflow.example");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [router, user]);

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const result = await signInWithEmail(email);
      setMessage(result);
      if (!hasSupabaseConfig()) {
        router.replace(getPostLoginRoute());
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDemoSignIn() {
    signInDemo();
    router.replace(getPostLoginRoute());
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">Sprint 1 Foundation</span>
        <h1>Sign in to {appEnv.appName}</h1>
        <p>
          Use local demo mode now, then add Supabase environment variables when you are
          ready to connect real authentication.
        </p>

        <form className="form-stack" onSubmit={handleEmailSignIn}>
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              type="email"
              value={email}
            />
          </label>

          <button className="button" disabled={submitting} type="submit">
            <Mail size={16} />
            {hasSupabaseConfig() ? "Send magic link" : "Continue with demo email"}
          </button>

          <button className="button secondary" onClick={handleDemoSignIn} type="button">
            <Sparkles size={16} />
            Open demo workspace
          </button>
        </form>

        {message ? <p className="muted">{message}</p> : null}

        <p className="muted" style={{ fontSize: 13 }}>
          Supabase status: {hasSupabaseConfig() ? "configured" : "not configured yet"}
          <ArrowRight size={13} style={{ margin: "0 4px -2px" }} />
          local shell remains usable either way.
        </p>
      </section>
    </main>
  );
}

function getPostLoginRoute() {
  return window.localStorage.getItem("supportflow.workspace.created")
    ? "/dashboard"
    : "/workspace/new";
}
