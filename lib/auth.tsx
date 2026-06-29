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

export type AppUser = {
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
  signInWithPassword: (email: string, password: string) => Promise<AppUser>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "nexamind.demo.user";

const demoUser: AppUser = {
  id: "user_demo_owner",
  email: "isa@nexamind.example",
  name: "Isa Demo",
  role: "Owner"
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const authMode: AuthContextValue["authMode"] = supabase && !appEnv.demoMode ? "supabase" : "demo";

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      if (appEnv.demoMode) {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (mounted && !stored) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser));
          setUser(demoUser);
        } else if (mounted && stored) {
          setUser(JSON.parse(stored) as AppUser);
        }
        if (mounted) setLoading(false);
        return;
      }

      if (supabase) {
        try {
          const { data } = await withTimeout(supabase.auth.getUser(), 4500);
          if (mounted && data.user) {
            setUser(mapSupabaseUser(data.user));
          }
        } catch {
          if (mounted) setUser(null);
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

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        signInDemo();
        return demoUser;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("No user returned after sign in.");
      }

      const nextUser = mapSupabaseUser(data.user);
      setUser(nextUser);
      return nextUser;
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
    () => ({ user, loading, authMode, signInDemo, signInWithPassword, signOut }),
    [authMode, loading, signInDemo, signInWithPassword, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function mapSupabaseUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): AppUser {
  const email = user.email || "unknown@example.com";
  const metadataRole = String(user.user_metadata?.role || "").toLowerCase();
  const ownerByEmail = appEnv.ownerEmails.includes(email.toLowerCase());
  const role: AppUser["role"] =
    ownerByEmail || metadataRole === "owner"
      ? "Owner"
      : metadataRole === "admin"
        ? "Admin"
        : metadataRole === "agent"
          ? "Agent"
          : "Manager";

  return {
    id: user.id,
    email,
    name:
      String(user.user_metadata?.full_name || "") ||
      String(user.user_metadata?.name || "") ||
      email.split("@")[0] ||
      "Nexamind user",
    role
  };
}

export function isPlatformAdmin(user: AppUser | null) {
  return user?.role === "Owner" || user?.role === "Admin";
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
