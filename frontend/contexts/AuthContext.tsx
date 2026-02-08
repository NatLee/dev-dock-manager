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

type AuthContextValue = {
  token: string | null;
  isReady: boolean;
  login: (access: string, refresh: string) => void;
  logout: () => void;
  ensureAuth: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  const login = useCallback((access: string, refresh: string) => {
    setTokens(access, refresh);
    setToken(access);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setToken(null);
    router.push("/login");
  }, [router]);

  const ensureAuth = useCallback(async (): Promise<boolean> => {
    const t = getAccessToken();
    if (!t) return false;
    const ok = await verifyToken(t);
    if (!ok) {
      clearTokens();
      setToken(null);
      return false;
    }
    setToken(t);
    return true;
  }, []);

  useEffect(() => {
    const t = getAccessToken();
    setToken(t);
    setIsReady(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, isReady, login, logout, ensureAuth }}
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
