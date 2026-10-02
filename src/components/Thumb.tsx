import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { refreshThumbnail } from "@/lib/link-metadata.functions";
import { useBookmarks } from "@/hooks/use-bookmarks";
import type { Bookmark } from "@/lib/bookmarks";

// Tracks bookmarks already retried this session so a dead image is refreshed once.
const tried = new Set<string>();

/** Bookmark cover image that re-fetches itself if the saved image has expired. */
export function Thumb({
  bookmark,
  className,
  fallback = null,
  lazy = true,
}: {
  bookmark: Bookmark;
  className?: string;
  fallback?: ReactNode;
  lazy?: boolean;
}) {
  const { update } = useBookmarks();
  const refresh = useServerFn(refreshThumbnail);
  const [broken, setBroken] = useState(false);

  if (!bookmark.image || broken) return <>{fallback}</>;

  return (
    <img
      key={bookmark.image}
      src={bookmark.image}
      alt=""
      className={className}
      loading={lazy ? "lazy" : undefined}
      referrerPolicy="no-referrer"
      onError={() => {
        setBroken(true);
        if (tried.has(bookmark.id)) return;
        tried.add(bookmark.id);
        refresh({ data: { url: bookmark.url } })
          .then((r) => {
            if (r.image && r.image !== bookmark.image) {
              update(bookmark.id, { image: r.image });
              setBroken(false);
            }
          })
          .catch(() => {});
      }}
    />
  );
}
