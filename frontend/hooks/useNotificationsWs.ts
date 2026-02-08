"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getWsOrigin } from "@/lib/api";

type NotificationMessage = {
  message: {
    action: string;
    details?: string;
    data?: { container_id?: string; cmd?: string };
  };
};

type OnRefetch = () => void;
type OnWaiting = (containerId: string) => void;
type OnDone = () => void;

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useNotificationsWs(
  onRefetch: OnRefetch,
  onWaiting?: OnWaiting,
  onDone?: OnDone
): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const onRefetchRef = useRef(onRefetch);
  const onWaitingRef = useRef(onWaiting);
  const onDoneRef = useRef(onDone);
  const reconnectAttemptRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);

  onRefetchRef.current = onRefetch;
  onWaitingRef.current = onWaiting;
  onDoneRef.current = onDone;

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      const base = getWsOrigin();
      const url = `${base}/ws/notifications/`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mountedRef.current) {
          setConnected(true);
          reconnectAttemptRef.current = 0;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as NotificationMessage;
          const { action, details, data: payload } = data.message;
          if (action === "WAITING") {
            if (details) toast.info(details);
            if (payload?.container_id && onWaitingRef.current) {
              onWaitingRef.current(payload.container_id);
            }
          }
          if (
            action === "CREATED" ||
            action === "STARTED" ||
            action === "STOPPED" ||
            action === "REMOVED" ||
            action === "RESTARTED"
          ) {
            if (details) toast.success(details);
            onDoneRef.current?.();
            onRefetchRef.current();
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (mountedRef.current) {
          setConnected(false);
          wsRef.current = null;
          if (reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptRef.current += 1;
            timeoutRef.current = setTimeout(() => {
              timeoutRef.current = null;
              connect();
            }, RECONNECT_DELAY_MS);
          }
        }
      };

      ws.onerror = () => {
        // close will follow and trigger reconnect
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { connected };
}
