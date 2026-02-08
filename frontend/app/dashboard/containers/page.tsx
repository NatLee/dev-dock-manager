"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { Container } from "@/types/api";
import { useContainers } from "@/hooks/useContainers";
import { useNotificationsWs } from "@/hooks/useNotificationsWs";
import { ContainerTable } from "@/components/containers/ContainerTable";
import { ContainerDetailsModal } from "@/components/containers/ContainerDetailsModal";
import { ImagesSection } from "@/components/containers/ImagesSection";
import { NewContainerModal } from "@/components/containers/NewContainerModal";

export default function ContainersPage() {
  const { containers, loading, error, refetch, control } = useContainers();
  const [waitingIds, setWaitingIds] = useState<Set<string>>(new Set());
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [detailsContainer, setDetailsContainer] = useState<Container | null>(null);

  const onWaiting = useCallback((containerId: string) => {
    setWaitingIds((prev) => new Set(prev).add(containerId));
  }, []);

  const onDone = useCallback(() => {
    setWaitingIds(new Set());
  }, []);

  const { connected: wsConnected } = useNotificationsWs(refetch, onWaiting, onDone);

  const handleControl = useCallback(
    async (id: string, cmd: "start" | "stop" | "restart" | "remove") => {
      setWaitingIds((prev) => new Set(prev).add(id));
      try {
        await control(id, cmd);
      } catch {
        toast.error("Action failed");
        setWaitingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [control]
  );

  return (
    <div className="mx-5">
      <ImagesSection />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-text">
          Containers
        </h2>
        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/50 px-2.5 py-1.5 text-sm text-text-muted"
            title={wsConnected ? "WebSocket connected" : "Disconnected, reconnecting…"}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${wsConnected ? "bg-success" : "bg-warning"}`}
              aria-hidden
            />
            {wsConnected ? "Connected" : "Disconnected"}
          </span>
          <button
            type="button"
            onClick={() => setNewModalOpen(true)}
            className="rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            ↻
          </button>
        </div>
      </div>
      {error && (
        <p className="mb-2 text-sm text-error">{error}</p>
      )}
      {loading ? (
        <div className="rounded-xl border border-border bg-surface/30 px-4 py-8 text-center text-sm text-text-muted">
          Loading containers…
        </div>
      ) : (
        containers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface/50 py-16 px-6 text-center">
            <p className="mb-1 text-lg font-medium text-text">No containers yet</p>
            <p className="mb-4 text-sm text-text-muted">
              Click the button below to create your first dev environment container.
            </p>
            <button
              type="button"
              onClick={() => setNewModalOpen(true)}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Create container
            </button>
          </div>
        ) : (
          <ContainerTable
            containers={containers}
            onControl={handleControl}
            waitingIds={waitingIds}
            onContainerClick={setDetailsContainer}
          />
        )
      )}
      <ContainerDetailsModal
        container={detailsContainer}
        onClose={() => setDetailsContainer(null)}
      />
      <NewContainerModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onSuccess={refetch}
      />
    </div>
  );
}
