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
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Library
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
        <IconAction label="Edit" onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
        </IconAction>
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

function IconAction({
  label,
  children,
  onClick,
  destructive,
}: {
  label: string;
  children: React.ReactNode;
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
