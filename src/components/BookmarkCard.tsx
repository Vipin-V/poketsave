import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { toast } from "sonner";
import {
  categoryLabel,
  daysLeft,
  deadlineLabel,
  faviconFor,
  urgencyOf,
  type Bookmark,
} from "@/lib/bookmarks";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { DeadlinePill } from "./DeadlinePill";

export function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  const days = bookmark.deadline ? daysLeft(bookmark.deadline) : null;
  const { update } = useBookmarks();

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
        className="absolute right-1.5 bottom-1.5 z-10 grid size-9 place-items-center rounded-full"
      >
        <Star
          className={`size-4 ${bookmark.favorite ? "fill-warn text-warn" : "text-muted-foreground"}`}
        />
      </button>
      <Link
        to="/bookmark/$id"
        params={{ id: bookmark.id }}
        className="glass block rounded-2xl p-3.5 transition-transform active:scale-[0.985]"
      >
        <div className="flex gap-3">
          <img
            src={bookmark.favicon || faviconFor(bookmark.domain)}
            alt=""
            className="mt-0.5 size-8 shrink-0 rounded-lg bg-muted object-contain p-1"
            loading="lazy"
          />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold text-balance-tight">
              {bookmark.title || bookmark.domain}
            </h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">{bookmark.domain}</p>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pr-9">
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium tracking-wide text-secondary-foreground uppercase">
                {categoryLabel(bookmark.category)}
              </span>
              {bookmark.tags.slice(0, 2).map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  #{t}
                </span>
              ))}
              {days !== null && (
                <DeadlinePill
                  urgency={bookmark.applied ? "ok" : urgencyOf(days)}
                  label={bookmark.applied ? "Applied" : deadlineLabel(days)}
                />
              )}
            </div>
          </div>
          {bookmark.image ? (
            <img
              src={bookmark.image}
              alt=""
              className="size-16 shrink-0 rounded-xl object-cover"
              loading="lazy"
            />
          ) : null}
        </div>
      </Link>
    </div>
  );
}
