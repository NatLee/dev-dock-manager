"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { login, ensureAuth, isReady } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    const check = async () => {
      const ok = await ensureAuth();
      if (ok) router.replace("/dashboard/containers");
    };
    check();
  }, [isReady, ensureAuth, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/token", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("Login failed, please try again.");
        return;
      }
      const data = (await res.json()) as { access_token: string; refresh_token: string };
      login(data.access_token, data.refresh_token);
      router.replace("/dashboard/containers");
    } catch {
      setError("Login failed, please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[400px] rounded-2xl border border-border bg-background p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            GUI Manager
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Sign in to manage your containers
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-text"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="Enter your username"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
            />
          </div>
          {error && (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-200"
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
