"use client";

import type { Container } from "@/types/api";
import { ContainerActions } from "./ContainerActions";

type Props = {
  containers: Container[];
  onControl: (id: string, cmd: "start" | "stop" | "restart" | "remove") => void;
  waitingIds?: Set<string>;
  onContainerClick?: (container: Container) => void;
};

export function ContainerTable({
  containers,
  onControl,
  waitingIds = new Set(),
  onContainerClick,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
      <table className="min-w-full divide-y divide-border">
        <thead className="border-b border-border bg-surface">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
              ID
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
              Size (GB)
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
              SSH
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
              Option
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {containers.map((item) => {
            const sizeRawGb = (item.size_raw / (1024 * 1024 * 1024)).toFixed(2);
            const sizeFsGb = (item.size_fs / (1024 * 1024 * 1024)).toFixed(2);
            return (
              <tr
                key={item.id}
                role={onContainerClick ? "button" : undefined}
                tabIndex={onContainerClick ? 0 : undefined}
                onClick={onContainerClick ? () => onContainerClick(item) : undefined}
                onKeyDown={
                  onContainerClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onContainerClick(item);
                        }
                      }
                    : undefined
                }
                className={`bg-background even:bg-surface/50 transition-colors hover:bg-surface ${onContainerClick ? "cursor-pointer" : ""}`}
              >
                <td className="px-4 py-3 font-mono text-sm text-text">
                  {item.short_id}
                </td>
                <td className="px-4 py-3 text-sm text-text">{item.name}</td>
                <td className="px-4 py-3 text-sm text-text">
                  {sizeRawGb} | {sizeFsGb}
                </td>
                <td className="px-4 py-3 font-mono text-sm text-text">
                  {item.ports?.ssh ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {item.privileged && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Privileged
                      </span>
                    )}
                    {item.nvdocker && (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                        NV-Docker
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${item.status === "running" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200"}`}
                  >
                    {item.status}
                  </span>
                </td>
                <td
                  className="px-4 py-3"
                  id={`actions-${item.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ContainerActions
                    container={item}
                    onControl={onControl}
                    waiting={waitingIds.has(item.id)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
