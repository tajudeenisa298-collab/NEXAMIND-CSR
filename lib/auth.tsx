"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { appEnv } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AppUser = {
  id: string;
  email: string;
  name: string;
  role: "Owner" | "Admin" | "Manager" | "Agent";
};

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  authMode: "demo" | "supabase";
  signInDemo: () => void;
  signInWithEmail: (email: string) => Promise<string>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "supportflow.demo.user";

const demoUser: AppUser = {
  id: "user_demo_owner",
  email: "isa@supportflow.example",
  name: "Isa Demo",
  role: "Owner"
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => (appEnv.demoMode ? demoUser : null));
  const [loading, setLoading] = useState(!appEnv.demoMode);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const authMode: AuthContextValue["authMode"] = supabase && !appEnv.demoMode ? "supabase" : "demo";

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const stored = window.localStorage.getItem(STORAGE_KEY);

      if (stored) {
        setUser(JSON.parse(stored) as AppUser);
      }

      if (appEnv.demoMode) {
        if (mounted && !stored) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser));
          setUser(demoUser);
        }
        if (mounted) setLoading(false);
        return;
      }

      if (supabase) {
        try {
          const { data } = await withTimeout(supabase.auth.getUser(), 4500);
          if (mounted && data.user) {
            setUser({
              id: data.user.id,
              email: data.user.email || "unknown@example.com",
              name:
                data.user.user_metadata?.full_name ||
                data.user.email?.split("@")[0] ||
                "Support user",
              role: "Owner"
            });
          }
        } catch {
          if (mounted && !stored) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser));
            setUser(demoUser);
          }
        }
      }

      if (mounted) {
        setLoading(false);
      }
    }

    loadSession();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const signInDemo = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser));
    setUser(demoUser);
    setLoading(false);
  }, []);

  const signInWithEmail = useCallback(
    async (email: string) => {
      if (!supabase) {
        signInDemo();
        return "Supabase is not configured yet, so demo mode signed you in locally.";
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (error) {
        throw error;
      }

      return "Magic link sent. Check your email to continue.";
    },
    [signInDemo, supabase]
  );

  const signOut = useCallback(async () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);

    if (supabase) {
      await supabase.auth.signOut();
    }
  }, [supabase]);

  const value = useMemo(
    () => ({ user, loading, authMode, signInDemo, signInWithEmail, signOut }),
    [authMode, loading, signInDemo, signInWithEmail, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Session check timed out.")), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout));
  });
}
