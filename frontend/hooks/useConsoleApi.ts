"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import type { ConsoleInfo } from "@/types/api";

export function useConsoleApi(containerId: string | null, action: string | null) {
  const { token } = useAuth();
  const [info, setInfo] = useState<ConsoleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInfo = useCallback(async () => {
    if (!token || !containerId || !action) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/dashboard/api/console/${action}/${containerId}`,
        { token }
      );
      if (!res.ok) {
        if (res.status === 401) setError("Unauthorized");
        else setError("Failed to load console info");
        return;
      }
      const data = (await res.json()) as ConsoleInfo;
      setInfo(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [token, containerId, action]);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  return { info, loading, error };
}
