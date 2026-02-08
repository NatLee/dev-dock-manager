"use client";

import type { Container } from "@/types/api";

type Props = {
  container: Container | null;
  onClose: () => void;
};

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb.toFixed(2) + " GB";
}

export function ContainerDetailsModal({ container, onClose }: Props) {
  if (!container) return null;

  const sizeRawGb = formatBytes(container.size_raw);
  const sizeFsGb = formatBytes(container.size_fs);
  const commandStr =
    container.command && container.command.length > 0
      ? container.command.join(" ")
      : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="container-details-title"
        className="relative w-full max-w-lg rounded-2xl border border-border bg-background shadow-xl"
      >
        <div className="flex items-center justify-between gap-4 rounded-t-2xl border-b border-border bg-surface px-4 py-3">
          <h2
            id="container-details-title"
            className="text-base font-semibold text-text"
          >
            {container.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-border hover:text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">ID</dt>
              <dd className="mt-0.5 font-mono text-text">{container.short_id}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Full ID</dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-text">{container.id}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Status</dt>
              <dd className="mt-0.5">
                <span
                  className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                    container.status === "running"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200"
                  }`}
                >
                  {container.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Image</dt>
              <dd className="mt-0.5 font-mono text-text">{container.image_tag || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Command</dt>
              <dd className="mt-0.5 break-words font-mono text-text">{commandStr}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">SSH port</dt>
              <dd className="mt-0.5 font-mono text-text">{container.ports?.ssh ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Size (raw | fs)</dt>
              <dd className="mt-0.5 font-mono text-text">{sizeRawGb} | {sizeFsGb}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Options</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1">
                {container.privileged && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    Privileged
                  </span>
                )}
                {container.nvdocker && (
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                    NV-Docker
                  </span>
                )}
                {!container.privileged && !container.nvdocker && (
                  <span className="text-text-muted">—</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
