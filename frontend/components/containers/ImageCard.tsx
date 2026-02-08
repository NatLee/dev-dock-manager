"use client";

import type { Image } from "@/types/api";

function formatSize(mb: number): string {
  if (mb >= 1024) return (mb / 1024).toFixed(2) + " GB";
  return mb.toFixed(2) + " MB";
}

type Props = { image: Image };

export function ImageCard({ image }: Props) {
  const tags = image.tags ?? (image.name ? [image.name] : []);
  const displayName = image.name ?? image.short_id;

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3 last:border-b-0 last:pb-0 first:pt-0"
      role="listitem"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-text" title={displayName}>
          {displayName}
        </p>
        {tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary dark:bg-primary/20 dark:text-primary"
                title={tag}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-sm text-text-muted">
        <span className="font-mono text-xs">{formatSize(image.size)}</span>
        <span className="font-mono text-xs" title={image.id}>
          {image.short_id}
        </span>
      </div>
    </div>
  );
}
