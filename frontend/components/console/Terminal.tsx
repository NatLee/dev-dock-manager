"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { getWsOrigin } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type TerminalProps = {
  containerId: string;
  action: "shell" | "attach";
  onError?: (message: string) => void;
};

export function Terminal({ containerId, action, onError }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState("connecting");
  const send = useCallback(
    (msg: { action: string; payload: Record<string, unknown> }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));
      }
    },
    []
  );
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "Menlo, Monaco, Courier New, monospace",
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(el);
    const token = getAccessToken();
    if (!token) {
      onError?.("Not authenticated");
      return () => term.dispose();
    }
    const url = getWsOrigin() + "/ws/console/";
    const ws = new WebSocket(url, [
      "token." + btoa(token),
      "container." + containerId,
    ]);
    wsRef.current = ws;
    let initialResizeTimer: ReturnType<typeof setTimeout>;
    ws.onopen = () => {
      setStatus("connected");
      send({ action, payload: { Id: containerId } });
      term.focus();
      // Defer fit until layout is ready to avoid FitAddon parsing/dimension errors
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (el.offsetWidth > 0 && el.offsetHeight > 0) {
            try {
              fitAddon.fit();
            } catch {
              // ignore
            }
          }
        });
      });
      // Delay initial resize so backend has time to create exec (shell) and attach PTY
      initialResizeTimer = setTimeout(doFitAndSendResize, 250);
    };
    ws.onmessage = (e) => term.write(e.data);
    ws.onclose = (event) => {
      setStatus("disconnected");
      term.write("\r\n\n[Connection closed]\r\n");
      term.options.cursorBlink = false;
      term.options.disableStdin = true;
      const msg =
        event.code === 4001
          ? "Unauthorized. Please log in again."
          : event.code === 4000
            ? "Invalid connection (missing or invalid token or container)."
            : "Console connection closed.";
      onError?.(msg);
    };
    ws.onerror = () =>
      onError?.("WebSocket connection failed. Check network or try again.");
    term.onKey(({ key, domEvent }) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const mod = isMac ? domEvent.metaKey : domEvent.ctrlKey;
      if (mod && key === "c" && term.hasSelection()) {
        navigator.clipboard.writeText(term.getSelection());
      }
    });
    term.onData((data) => {
      send({ action: "pty_input", payload: { input: data, id: containerId } });
    });
    const doFitAndSendResize = () => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w <= 0 || h <= 0) return;
      // Double rAF so layout is complete and FitAddon won't hit parsing/dimension errors
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) return;
          const w2 = el.offsetWidth;
          const h2 = el.offsetHeight;
          if (w2 <= 0 || h2 <= 0) return;
          try {
            fitAddon.fit();
            const cols = term.cols;
            const rows = term.rows;
            if (Number.isFinite(cols) && Number.isFinite(rows) && cols > 0 && rows > 0) {
              send({
                action: "pty_resize",
                payload: {
                  size: { rows, cols, height: el.offsetHeight, width: el.offsetWidth },
                },
              });
            }
          } catch {
            // ignore fit/parse errors when dimensions not ready
          }
        });
      });
    };
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const onWindowResize = () => {
      doFitAndSendResize();
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(doFitAndSendResize, 100);
    };
    window.addEventListener("resize", onWindowResize);
    const resizeObserver = new ResizeObserver(() => {
      doFitAndSendResize();
    });
    resizeObserver.observe(el);
    const parent = el.parentElement;
    if (parent) resizeObserver.observe(parent);
    return () => {
      clearTimeout(initialResizeTimer);
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      window.removeEventListener("resize", onWindowResize);
      ws.close();
      term.dispose();
    };
  }, [containerId, action, send, onError]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface/80 px-3 py-1.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            status === "connected"
              ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
              : status === "connecting"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "connected"
                ? "bg-green-500"
                : status === "connecting"
                  ? "animate-pulse bg-amber-500"
                  : "bg-slate-500"
            }`}
          />
          {status}
        </span>
      </div>
      <div
        ref={containerRef}
        className={`min-h-[200px] w-full flex-1 rounded-b-xl bg-zinc-900 p-2 transition-[filter,opacity] duration-300 ${
          status === "disconnected" ? "pointer-events-none opacity-60 grayscale" : ""
        }`}
      />
    </div>
  );
}
