"use client";

import Link from "next/link";
import type { Container } from "@/types/api";

const getOrigin = () =>
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_ORIGIN || window.location.origin)
    : process.env.NEXT_PUBLIC_API_ORIGIN || "http://localhost:8000";

type Props = {
  container: Container;
  onControl: (id: string, cmd: "start" | "stop" | "restart" | "remove") => void;
  waiting?: boolean;
};

export function ContainerActions({
  container,
  onControl,
  waiting,
}: Props) {
  const running = container.status === "running";
  const origin = getOrigin();
  const isSameOrigin = typeof window !== "undefined" && origin === window.location.origin;
  const novncPath = `/novnc/${container.name}/?path=novnc/${container.name}/websockify`;

  if (waiting) {
    return (
      <span className="inline-flex items-center rounded-xl bg-amber-100 px-2 py-1 text-sm font-medium text-amber-800">
        Waiting
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {running ? (
        <>
          <a
            href={isSameOrigin ? novncPath : `${origin}${novncPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-primary px-2 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            NoVNC
          </a>
          <Link
            href={`/dashboard/console/shell/${container.id}`}
            target="_blank"
            className="rounded-xl bg-primary px-2 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Console
          </Link>
          <Link
            href={`/dashboard/console/attach/${container.id}`}
            target="_blank"
            className="rounded-xl bg-primary px-2 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Attach
          </Link>
          <button
            type="button"
            onClick={() => onControl(container.id, "restart")}
            className="rounded-xl bg-amber-500 px-2 py-1 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            Restart
          </button>
          <button
            type="button"
            onClick={() => onControl(container.id, "stop")}
            className="rounded-xl bg-amber-500 px-2 py-1 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            Stop
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onControl(container.id, "start")}
            className="rounded-xl bg-green-600 px-2 py-1 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            Start
          </button>
          <button
            type="button"
            onClick={() => onControl(container.id, "remove")}
            className="rounded-xl bg-red-600 px-2 py-1 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Remove
          </button>
        </>
      )}
    </div>
  );
}
