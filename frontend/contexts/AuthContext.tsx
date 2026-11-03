"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  clearTokens,
  getAccessToken,
  setTokens,
  verifyToken,
} from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { Account } from "@/types/api";

type AuthContextValue = {
  token: string | null;
  /** The logged-in account (role decides which pages and options show up). */
  me: Account | null;
  isReady: boolean;
  login: (access: string, refresh: string) => void;
  logout: () => void;
  ensureAuth: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(token: string): Promise<Account | null> {
  const res = await apiFetch("/dashboard/api/me", { token });
  return res.ok ? ((await res.json()) as Account) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Account | null>(null);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  const login = useCallback((access: string, refresh: string) => {
    setTokens(access, refresh);
    setToken(access);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setToken(null);
    setMe(null);
    router.push("/login");
  }, [router]);

  const ensureAuth = useCallback(async (): Promise<boolean> => {
    const t = getAccessToken();
    if (!t) return false;
    const account = (await verifyToken(t)) ? await fetchMe(t) : null;
    if (!account) {
      clearTokens();
      setToken(null);
      setMe(null);
      return false;
    }
    setToken(t);
    setMe(account);
    return true;
  }, []);

  useEffect(() => {
    const t = getAccessToken();
    setToken(t);
    setIsReady(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, me, isReady, login, logout, ensureAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
