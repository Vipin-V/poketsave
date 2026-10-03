import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { faviconFor, type Bookmark } from "@/lib/bookmarks";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useFolders } from "@/hooks/use-folders";
import { iconFor } from "@/lib/folders";
import { DeadlineTag } from "./DeadlineTag";
import { Thumb } from "./Thumb";

// Grid tile used inside a folder: thumbnail on top, bold title, source below.
export function LinkTile({ bookmark }: { bookmark: Bookmark }) {
  const { update } = useBookmarks();
  const folder = useFolders().findFolder(bookmark.category);
  const FolderIcon = iconFor(folder);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={bookmark.favorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={bookmark.favorite ? true : false}
        onClick={() => {
          update(bookmark.id, { favorite: !bookmark.favorite });
          toast(bookmark.favorite ? "Removed from favorites" : "Added to favorites");
        }}
        className="absolute top-2 left-2 z-10 grid size-7 place-items-center rounded-full border-2 border-border bg-card"
      >
        <Star
          className={`size-3.5 ${bookmark.favorite ? "fill-primary text-foreground" : "text-muted-foreground"}`}
        />
      </button>

      <Link
        to="/bookmark/$id"
        params={{ id: bookmark.id }}
        className="glass brutal-press block overflow-hidden rounded-2xl"
      >
        <div className={`relative aspect-[4/3] w-full border-b-2 border-border ${folder.color}`}>
          <Thumb
            bookmark={bookmark}
            className="size-full object-cover"
            fallback={
              <div className="grid size-full place-items-center">
                <FolderIcon className="size-8 text-primary-foreground" strokeWidth={2.4} />
              </div>
            }
          />
        </div>

        <div className="p-2.5">
          <DeadlineTag bookmark={bookmark} />
          <h3 className="mt-1 line-clamp-2 text-[13px] leading-snug font-bold text-balance-tight">
            {bookmark.title || bookmark.domain}
          </h3>
          <div className="mt-1.5 flex items-center gap-1.5">
            <img
              src={bookmark.favicon || faviconFor(bookmark.domain)}
              alt=""
              className="size-4 shrink-0 rounded-[4px] object-contain"
              loading="lazy"
            />
            <span className="truncate text-[11px] font-medium text-muted-foreground">
              {bookmark.domain}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
