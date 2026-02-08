"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useConsoleApi } from "@/hooks/useConsoleApi";
import { Terminal } from "@/components/console/Terminal";

export default function ConsolePage() {
  const params = useParams();
  const router = useRouter();
  const action = params.action as string;
  const id = params.id as string;
  const { info, loading, error } = useConsoleApi(id, action);

  const handleError = (msg: string) => {
    if (msg.includes("Unauthorized") || msg.includes("authenticated")) {
      router.replace("/login");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-xl border border-border bg-background shadow-sm">
        <p className="text-text-muted">Loading console...</p>
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-xl border border-border bg-background p-8 shadow-sm">
        <p className="text-center text-text-muted">{error ?? "Container not found"}</p>
        <Link
          href="/dashboard/containers"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Back to Containers
        </Link>
      </div>
    );
  }

  const act = action === "attach" ? "attach" : "shell";

  return (
    <div className="flex h-screen flex-col bg-background p-4">
      <nav className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
        <Link
          href="/dashboard/containers"
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-border"
        >
          ← Back
        </Link>
        <span className="text-sm text-text-muted" aria-label="Container info">
          <span className="font-medium text-text">{info.container_name}</span>
          <span className="mx-1.5">·</span>
          {info.image}
          <span className="mx-1.5">·</span>
          <code className="rounded bg-border px-1.5 py-0.5 font-mono text-xs">{info.short_id}</code>
          {info.command != null && (
            <>
              <span className="mx-1.5">·</span>
              <span className="text-text-muted">{info.command}</span>
            </>
          )}
        </span>
      </nav>
      <div className="flex min-h-[200px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <Terminal containerId={info.id} action={act} onError={handleError} />
      </div>
    </div>
  );
}
