import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FolderPlus,
  Pencil,
  Share2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PhoneShell } from "@/components/PhoneShell";
import { AddBookmarkSheet } from "@/components/AddBookmarkSheet";
import { DeadlinePill } from "@/components/DeadlinePill";
import { shareBookmarks } from "@/lib/share";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useAlbums } from "@/hooks/use-albums";
import { useAuth } from "@/hooks/use-auth";
import type { Album } from "@/lib/albums";
import {
  categoryLabel,
  daysLeft,
  deadlineLabel,
  faviconFor,
  interviewLabel,
  urgencyOf,
} from "@/lib/bookmarks";

export const Route = createFileRoute("/bookmark/$id")({
  head: () => ({
    meta: [
      { title: "Saved link — PoketSave" },
      { name: "description", content: "Preview, notes and deadline details for a saved bookmark." },
      { property: "og:title", content: "Saved link — PoketSave" },
      { property: "og:description", content: "Your saved link with notes, tags and deadline." },
    ],
  }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { bookmarks, ready, update, remove, add } = useBookmarks();
  const { user } = useAuth();
  const { albums } = useAlbums();
  const [editing, setEditing] = useState(false);
  const [albumPickerOpen, setAlbumPickerOpen] = useState(false);
  const [interviewInputOpen, setInterviewInputOpen] = useState(false);
  const bookmark = bookmarks.find((b) => b.id === id);

  function addToAlbum(album: Album) {
    if (!bookmark) return;
    add(
      {
        ...bookmark,
        id: crypto.randomUUID(),
        albumId: album.id,
        createdAt: new Date().toISOString(),
        canDelete: undefined,
      },
      album.teamId,
      album.ownerId,
    );
    toast(`Added to "${album.name}"`);
    setAlbumPickerOpen(false);
  }

  if (!bookmark) {
    return (
      <PhoneShell onAdd={() => navigate({ to: "/" })}>
        <div className="glass mt-16 rounded-3xl px-6 py-12 text-center">
          <h1 className="text-lg font-semibold">{ready ? "Bookmark not found" : "Loading…"}</h1>
          {ready && (
            <Button variant="secondary" className="mt-4" onClick={() => navigate({ to: "/" })}>
              Back to self
            </Button>
          )}
        </div>
      </PhoneShell>
    );
  }

  const days = bookmark.deadline ? daysLeft(bookmark.deadline) : null;
  const interviewDays =
    bookmark.applied && bookmark.interviewDate ? daysLeft(bookmark.interviewDate) : null;

  return (
    <PhoneShell onAdd={() => setEditing(true)}>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Self
        </button>
        <button
          type="button"
          aria-label={bookmark.favorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={bookmark.favorite ? true : false}
          onClick={() => update(bookmark.id, { favorite: !bookmark.favorite })}
          className="glass grid size-11 place-items-center rounded-full"
        >
          <Star
            className={`size-4 ${bookmark.favorite ? "fill-warn text-warn" : "text-muted-foreground"}`}
          />
        </button>
      </div>

      {bookmark.image && (
        <img
          src={bookmark.image}
          alt=""
          className="mb-4 aspect-video w-full rounded-2xl object-cover"
        />
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <img
          src={bookmark.favicon || faviconFor(bookmark.domain)}
          alt=""
          className="size-4 rounded"
        />
        {bookmark.domain}
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] tracking-wide uppercase">
          {categoryLabel(bookmark.category)}
        </span>
      </div>

      <h1 className="mt-2 text-2xl font-bold text-balance-tight">{bookmark.title}</h1>
      {bookmark.description && (
        <p className="mt-2 text-sm text-muted-foreground">{bookmark.description}</p>
      )}

      {(bookmark.category === "job" || bookmark.category === "internship") && (
        <div className="glass mt-4 space-y-2 rounded-2xl p-4">
          {(bookmark.company || bookmark.role) && (
            <p className="text-sm">
              <span className="font-semibold">{bookmark.role || "Role"}</span>
              {bookmark.company ? ` · ${bookmark.company}` : ""}
            </p>
          )}
          {days !== null && (
            <div className="flex items-center gap-2">
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
              <span className="text-xs text-muted-foreground">
                {bookmark.applied && bookmark.interviewDate
                  ? `Interview on ${bookmark.interviewDate}`
                  : `Apply before ${bookmark.deadline}`}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => update(bookmark.id, { applied: !bookmark.applied })}
            className={`mt-1 inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors ${
              bookmark.applied
                ? "bg-primary/15 text-primary"
                : "border border-border text-muted-foreground"
            }`}
          >
            <CheckCircle2 className="size-3.5" />
            {bookmark.applied ? "Applied" : "Mark as applied"}
          </button>

          {bookmark.applied && (
            <div className="pt-0.5">
              {interviewInputOpen ? (
                <input
                  type="date"
                  autoFocus
                  defaultValue={bookmark.interviewDate ?? ""}
                  onChange={(e) => {
                    update(bookmark.id, { interviewDate: e.target.value || undefined });
                    setInterviewInputOpen(false);
                  }}
                  onBlur={() => setInterviewInputOpen(false)}
                  className="h-9 rounded-xl border border-border bg-transparent px-2.5 text-xs text-foreground"
                />
              ) : bookmark.interviewDate ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5 shrink-0" />
                  <span className="flex-1">Interview / exam on {bookmark.interviewDate}</span>
                  <button
                    type="button"
                    aria-label="Edit interview date"
                    onClick={() => setInterviewInputOpen(true)}
                    className="grid size-7 place-items-center rounded-full text-muted-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove interview date"
                    onClick={() => update(bookmark.id, { interviewDate: undefined })}
                    className="grid size-7 place-items-center rounded-full text-muted-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setInterviewInputOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-border px-3 text-xs text-muted-foreground"
                >
                  <CalendarClock className="size-3.5" /> Add interview/exam date
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {bookmark.category === "event" && (
        <div className="glass mt-4 space-y-2 rounded-2xl p-4">
          {bookmark.company && (
            <p className="text-sm">
              <span className="font-semibold">{bookmark.company}</span>
            </p>
          )}
          {days !== null && (
            <div className="flex items-center gap-2">
              <DeadlinePill urgency={urgencyOf(days)} label={deadlineLabel(days)} />
              <span className="text-xs text-muted-foreground">On {bookmark.deadline}</span>
            </div>
          )}
        </div>
      )}

      {bookmark.notes && (
        <div className="glass mt-4 rounded-2xl p-4">
          <h2 className="mb-1 text-xs tracking-[0.18em] text-muted-foreground uppercase">Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{bookmark.notes}</p>
        </div>
      )}

      {bookmark.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {bookmark.tags.map((t) => (
            <span key={t} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noreferrer"
          className="neon-glow flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          <ExternalLink className="size-4" /> Open link
        </a>
        <IconAction
          label="Share"
          onClick={async () => {
            const r = await shareBookmarks([bookmark]);
            if (r === "copied") toast("Copied to clipboard — paste it in any chat.");
            if (r === "failed") toast("Couldn't share this right now.");
          }}
        >
          <Share2 className="size-4" />
        </IconAction>
        {user && albums.length > 0 && (
          <IconAction label="Add to shared bookmarks" onClick={() => setAlbumPickerOpen(true)}>
            <FolderPlus className="size-4" />
          </IconAction>
        )}
        <IconAction label="Edit" onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
        </IconAction>
        {bookmark.canDelete !== false && (
          <IconAction
            label="Delete"
            destructive
            onClick={() => {
              remove(bookmark.id);
              navigate({ to: "/" });
            }}
          >
            <Trash2 className="size-4" />
          </IconAction>
        )}
      </div>

      {editing && (
        <AddBookmarkSheet
          open={editing}
          onOpenChange={setEditing}
          initial={bookmark}
          onSave={(b) => update(b.id, b)}
        />
      )}

      <Sheet open={albumPickerOpen} onOpenChange={setAlbumPickerOpen}>
        <SheetContent
          side="bottom"
          className="glass-strong mx-auto max-h-[70dvh] w-full max-w-[26rem] overflow-y-auto rounded-t-3xl border-border px-4 pb-8"
        >
          <SheetHeader className="px-0">
            <SheetTitle className="font-display text-xl">Add to shared bookmarks</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 pt-2">
            {albums.map((album) => (
              <button
                key={album.id}
                type="button"
                onClick={() => addToAlbum(album)}
                className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-transform active:scale-[0.985]"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-lg">
                  {album.emoji}
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {album.name}
                </span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </PhoneShell>
  );
}

function IconAction({
  label,
  children,
  onClick,
  destructive,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`glass grid size-12 shrink-0 place-items-center rounded-2xl transition-transform active:scale-90 ${
        destructive ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
