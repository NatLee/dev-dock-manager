"use client";

import { useImages } from "@/hooks/useImages";
import { ImageCard } from "./ImageCard";

const DOCKER_HUB_URL = "https://hub.docker.com/r/natlee/gui-vnc";
const REPO_README_URL = "https://github.com/NatLee/dev-dock-manager#quick-start";

export function ImagesSection() {
  const { images, loading, error, refetch } = useImages();

  return (
    <section className="mb-8" id="images">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text">
          Available images (gui-vnc)
        </h3>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium text-text transition-colors hover:bg-surface"
        >
          Refresh
        </button>
      </div>
      {error && (
        <p className="mb-2 text-sm text-error">{error}</p>
      )}
      {loading ? (
        <div className="rounded-xl border border-border bg-surface/30 px-4 py-8 text-center text-sm text-text-muted">
          Loading images…
        </div>
      ) : images.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface/30 p-6">
          <p className="mb-2 font-medium text-text">
            No gui-vnc image found
          </p>
          <p className="mb-4 text-sm text-text-muted">
            Pull from Docker Hub or build from the <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">gui</code> repo. See the{" "}
            <a
              href={REPO_README_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              README
            </a>{" "}
            for details.
          </p>
          <ul className="space-y-2 text-sm text-text">
            <li className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium">Pull:</span>
              <code className="rounded border border-border bg-background px-2 py-1 font-mono text-xs">
                docker pull natlee/gui-vnc:&lt;TAG&gt;
              </code>
              <span className="text-text-muted">(e.g. 20250208-x86 or 20250208-arm64 —</span>
              <a
                href={DOCKER_HUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Docker Hub
              </a>
              <span className="text-text-muted">)</span>
            </li>
            <li className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium">Build:</span>
              <code className="rounded border border-border bg-background px-2 py-1 font-mono text-xs">
                cd gui && docker compose build
              </code>
            </li>
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-background shadow-sm">
          <div className="px-4 py-2">
            {images.map((img) => (
              <ImageCard key={img.id} image={img} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
