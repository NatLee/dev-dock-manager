"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /novnc and /novnc/ have no container selected; redirect to containers list.
 * Actual /novnc/{containerName}/ is handled by Traefik (GUI container, priority 5).
 */
export default function NoVncIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/containers");
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-text-muted">Redirecting...</p>
    </div>
  );
}
