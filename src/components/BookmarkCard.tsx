import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  categoryLabel,
  daysLeft,
  deadlineLabel,
  faviconFor,
  interviewLabel,
  urgencyOf,
  type Bookmark,
} from "@/lib/bookmarks";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { DeadlinePill } from "./DeadlinePill";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DELETE_AT = 120;

export function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  const days = bookmark.deadline ? daysLeft(bookmark.deadline) : null;
  const interviewDays =
    bookmark.applied && bookmark.interviewDate ? daysLeft(bookmark.interviewDate) : null;
  const { update, remove } = useBookmarks();
  const [dx, setDx] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const locked = useRef(false);
  const deleting = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse") return;
    if (bookmark.canDelete === false) return;
    start.current = { x: e.clientX, y: e.clientY };
    locked.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    const dxRaw = e.clientX - start.current.x;
    const dyRaw = e.clientY - start.current.y;
    if (!locked.current) {
      if (Math.abs(dxRaw) < 10 && Math.abs(dyRaw) < 10) return;
      if (Math.abs(dxRaw) < Math.abs(dyRaw)) {
        start.current = null;
        return;
      }
      locked.current = true;
      setSwiping(true);
    }
    setDx(Math.max(0, dxRaw));
  }

  function onPointerUp() {
    start.current = null;
    setSwiping(false);
    if (dx >= DELETE_AT) {
      setDx(DELETE_AT);
      setConfirmOpen(true);
      return;
    }
    setDx(0);
  }

  function confirmDelete() {
    deleting.current = true;
    setConfirmOpen(false);
    setDx(400);
    window.setTimeout(() => {
      remove(bookmark.id);
      toast("Bookmark deleted");
    }, 150);
  }

  function cancelDelete() {
    setConfirmOpen(false);
    setDx(0);
  }

  const armed = dx >= DELETE_AT;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {dx > 0 && (
        <div
          className={`absolute inset-0 flex items-center gap-2 rounded-2xl pl-5 text-sm font-semibold transition-colors ${
            armed ? "bg-destructive text-destructive-foreground" : "bg-destructive/25 text-destructive"
          }`}
        >
          <Trash2 className="size-4" />
          {armed ? "Release to delete" : "Swipe to delete"}
        </div>
      )}

      <div
        className="relative"
        style={{
          transform: `translate3d(${dx}px,0,0)`,
          transition: swiping ? "none" : "transform 200ms cubic-bezier(.2,.8,.2,1)",
          opacity: dx > 300 ? 0 : 1,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
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
            className={`size-4 transition-transform active:scale-90 ${bookmark.favorite ? "fill-warn text-warn" : "text-muted-foreground"}`}
          />
        </button>
        <Link
          to="/bookmark/$id"
          params={{ id: bookmark.id }}
          onClick={(e) => {
            if (dx !== 0) e.preventDefault();
          }}
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
                    urgency={
                      bookmark.applied
                        ? interviewDays !== null
                          ? urgencyOf(interviewDays)
                          : "ok"
                        : urgencyOf(days)
                    }
                    label={
                      bookmark.applied
                        ? interviewDays !== null
                          ? interviewLabel(interviewDays)
                          : "Applied"
                        : deadlineLabel(days)
                    }
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
                referrerPolicy="no-referrer"
              />
            ) : null}
          </div>
        </Link>
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !deleting.current) cancelDelete();
          deleting.current = false;
        }}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-[22rem] rounded-3xl border-border bg-popover p-6 text-popover-foreground">
          <AlertDialogHeader className="items-center text-center">
            <div className="grid size-12 place-items-center rounded-full bg-destructive/15 text-destructive">
              <Trash2 className="size-5" />
            </div>
            <AlertDialogTitle className="mt-1">Delete bookmark?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {bookmark.title || bookmark.domain}
              </span>{" "}
              will be removed permanently. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 flex-row gap-2 sm:justify-stretch">
            <AlertDialogCancel
              onClick={cancelDelete}
              className="mt-0 h-12 flex-1 rounded-2xl border-border"
            >
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="h-12 flex-1 rounded-2xl bg-destructive text-destructive-foreground shadow-none hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
