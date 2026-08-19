import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, ExternalLink, Pencil, Share2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PhoneShell } from "@/components/PhoneShell";
import { AddBookmarkSheet } from "@/components/AddBookmarkSheet";
import { DeadlinePill } from "@/components/DeadlinePill";
import { shareBookmarks } from "@/lib/share";
import { Button } from "@/components/ui/button";
import { useBookmarks } from "@/hooks/use-bookmarks";
import {
  categoryLabel,
  daysLeft,
  deadlineLabel,
  faviconFor,
  urgencyOf,
} from "@/lib/bookmarks";

export const Route = createFileRoute("/bookmark/$id")({
  head: () => ({
    meta: [
      { title: "Saved link — Pocket" },
      { name: "description", content: "Preview, notes and deadline details for a saved bookmark." },
      { property: "og:title", content: "Saved link — Pocket" },
      { property: "og:description", content: "Your saved link with notes, tags and deadline." },
    ],
  }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { bookmarks, ready, update, remove } = useBookmarks();
  const [editing, setEditing] = useState(false);
  const bookmark = bookmarks.find((b) => b.id === id);

  if (!bookmark) {
    return (
      <PhoneShell onAdd={() => navigate({ to: "/" })}>
        <div className="glass mt-16 rounded-3xl px-6 py-12 text-center">
          <h1 className="text-lg font-semibold">{ready ? "Bookmark not found" : "Loading…"}</h1>
          {ready && (
            <Button variant="secondary" className="mt-4" onClick={() => navigate({ to: "/" })}>
              Back to library
            </Button>
          )}
        </div>
      </PhoneShell>
    );
  }

  const days = bookmark.deadline ? daysLeft(bookmark.deadline) : null;

  return (
    <PhoneShell onAdd={() => setEditing(true)}>
      <button
        type="button"
        onClick={() => navigate({ to: "/" })}
        className="mb-4 flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Library
      </button>

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

      {bookmark.category === "job" && (
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
                urgency={bookmark.applied ? "ok" : urgencyOf(days)}
                label={bookmark.applied ? "Applied" : deadlineLabel(days)}
              />
              <span className="text-xs text-muted-foreground">
                Apply before {bookmark.deadline}
              </span>
            </div>
          )}
          <Button
            variant={bookmark.applied ? "secondary" : "default"}
            className="mt-1 h-11 w-full rounded-xl"
            onClick={() => update(bookmark.id, { applied: !bookmark.applied })}
          >
            <CheckCircle2 className="mr-1 size-4" />
            {bookmark.applied ? "Marked as applied" : "Mark as applied"}
          </Button>
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

      <div className="mt-6 space-y-2">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noreferrer"
          className="neon-glow flex h-13 min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground"
        >
          <ExternalLink className="size-4" /> Open link
        </a>
        <div className="flex gap-2">
          <Button variant="secondary" className="h-12 flex-1 rounded-2xl" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 size-4" /> Edit
          </Button>
          <Button
            variant="ghost"
            className="h-12 flex-1 rounded-2xl text-destructive"
            onClick={() => {
              remove(bookmark.id);
              navigate({ to: "/" });
            }}
          >
            <Trash2 className="mr-1 size-4" /> Delete
          </Button>
        </div>
      </div>

      {editing && (
        <AddBookmarkSheet
          open={editing}
          onOpenChange={setEditing}
          initial={bookmark}
          onSave={(b) => update(b.id, b)}
        />
      )}
    </PhoneShell>
  );
}
