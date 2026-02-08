"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import type { Container } from "@/types/api";

export function useContainers() {
  const { token } = useAuth();
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContainers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/dashboard/api/containers", { token });
      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error("Failed to fetch containers");
      }
      const data = (await res.json()) as { containers: Container[] };
      setContainers(data.containers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchContainers();
  }, [fetchContainers]);

  const control = useCallback(
    async (id: string, cmd: "start" | "stop" | "restart" | "remove") => {
      if (!token) return;
      const res = await apiFetch("/dashboard/api/containers/control", {
        method: "POST",
        token,
        body: JSON.stringify({ id, cmd }),
      });
      if (!res.ok) throw new Error("Control request failed");
      return (await res.json()) as { task_id: string | null };
    },
    [token]
  );

  return { containers, loading, error, refetch: fetchContainers, control };
}
