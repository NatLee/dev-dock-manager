"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import type { RunContainerBody } from "@/types/api";

export function useFreePorts() {
  const { token } = useAuth();
  const [freePorts, setFreePorts] = useState<number[]>([]);

  const fetchPorts = useCallback(
    async (count = 2) => {
      if (!token) return;
      const res = await apiFetch(
        `/dashboard/api/ports?count=${count}`,
        { token }
      );
      if (!res.ok) return;
      const data = (await res.json()) as { free_ports: number[] };
      setFreePorts(data.free_ports ?? []);
    },
    [token]
  );

  return { freePorts, fetchPorts };
}

export function usePortCheck() {
  const { token } = useAuth();

  const check = useCallback(
    async (port: number): Promise<boolean> => {
      if (!token) return false;
      const res = await apiFetch(
        `/dashboard/api/ports/check?port=${port}`,
        { token }
      );
      if (!res.ok) return true;
      const data = (await res.json()) as { is_used: boolean };
      return data.is_used;
    },
    [token]
  );

  return check;
}

export function useNvdockerCheck() {
  const { token } = useAuth();
  const [available, setAvailable] = useState<boolean | null>(null);

  const check = useCallback(async () => {
    if (!token) return;
    const res = await apiFetch("/dashboard/api/nvdocker/check", { token });
    setAvailable(res.ok);
  }, [token]);

  return { nvdockerAvailable: available, fetchNvdocker: check };
}

export function useRunContainer() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (body: RunContainerBody): Promise<{ container_name: string; task_id: string } | null> => {
      if (!token) return null;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/dashboard/api/container/new", {
          method: "POST",
          token,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setError((data as { error?: string }).error || "Failed to create container");
          return null;
        }
        return data as { container_name: string; task_id: string };
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  return { run, loading, error };
}
