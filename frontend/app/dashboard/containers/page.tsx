"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useContainers } from "@/hooks/useContainers";
import { useNotificationsWs } from "@/hooks/useNotificationsWs";
import { ContainerTable } from "@/components/containers/ContainerTable";
import { NewContainerModal } from "@/components/containers/NewContainerModal";

export default function ContainersPage() {
  const { containers, loading, error, refetch, control } = useContainers();
  const [waitingIds, setWaitingIds] = useState<Set<string>>(new Set());
  const [newModalOpen, setNewModalOpen] = useState(false);

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
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold text-text">
            Development GUI Containers
          </h2>
          <span
            className="flex items-center gap-1.5 text-sm font-medium text-text-muted"
            title={wsConnected ? "Connected" : "Disconnected, reconnecting..."}
          >
            <span
              className={`h-2 w-2 rounded-full ${wsConnected ? "bg-success" : "bg-warning"}`}
              aria-hidden
            />
            {wsConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div className="flex gap-2">
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
        <p className="text-text-muted">Loading containers...</p>
      ) : (
        <ContainerTable
          containers={containers}
          onControl={handleControl}
          waitingIds={waitingIds}
        />
      )}
      <NewContainerModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onSuccess={refetch}
      />
    </div>
  );
}
