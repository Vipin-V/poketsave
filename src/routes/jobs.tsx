import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PhoneShell } from "@/components/PhoneShell";
import { BookmarkCard } from "@/components/BookmarkCard";
import { AddBookmarkSheet } from "@/components/AddBookmarkSheet";
import { ShareButton } from "@/components/ShareButton";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { daysLeft } from "@/lib/bookmarks";
import { dedupeByUrl } from "@/lib/album-visibility";

type View = "closing" | "applied" | "closed";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Job deadlines — PoketSave" },
      {
        name: "description",
        content:
          "Every job and internship link you saved, sorted by how soon the application window closes, with countdowns and applied tracking.",
      },
      { property: "og:title", content: "Job deadlines — PoketSave" },
      {
        property: "og:description",
        content: "Track saved job and internship applications and never miss a closing date.",
      },
    ],
  }),
  component: Jobs,
});

function Jobs() {
  const { bookmarks: allBookmarks, ready, add } = useBookmarks();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("closing");

  // Job/internship deadlines are per-bookmark, so album bookmarks count too —
  // just dedupe by url in case the same link exists both personally and
  // inside an album.
  const bookmarks = useMemo(() => dedupeByUrl(allBookmarks), [allBookmarks]);

  const { closing, applied, closed } = useMemo(() => {
    const jobs = bookmarks.filter((b) => b.category === "job" || b.category === "internship");
    const applied = jobs.filter((b) => b.applied);
    const closing = jobs
      .filter((b) => !b.applied && b.deadline && daysLeft(b.deadline) >= 0)
      .sort((a, b) => daysLeft(a.deadline!) - daysLeft(b.deadline!));
    // Not applied and no longer open — either the deadline passed, or it was
    // never given one, so it can't be "closing soon" either.
    const closed = jobs.filter((b) => !b.applied && (!b.deadline || daysLeft(b.deadline) < 0));
    return { closing, applied, closed };
  }, [bookmarks]);

  const shown = view === "applied" ? applied : view === "closed" ? closed : closing;

  return (
    <PhoneShell onAdd={() => setOpen(true)}>
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">Deadlines</p>
          <h1 className="mt-1 text-3xl font-bold text-balance-tight">
            Jobs &amp; internships closing soon
          </h1>
        </div>
        <ShareButton
          bookmarks={closing}
          label="Share"
          heading="Jobs & internships closing soon (shared from PoketSave):"
        />
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setView((v) => (v === "applied" ? "closing" : "applied"))}
          className={`glass rounded-2xl p-3.5 text-left transition-colors ${
            view === "applied" ? "bg-primary/10 ring-2 ring-primary/60" : ""
          }`}
        >
          <p className="text-2xl font-bold">{applied.length}</p>
          <p className="text-xs text-muted-foreground">Applied</p>
        </button>
        <button
          type="button"
          onClick={() => setView((v) => (v === "closed" ? "closing" : "closed"))}
          className={`glass rounded-2xl p-3.5 text-left transition-colors ${
            view === "closed" ? "bg-primary/10 ring-2 ring-primary/60" : ""
          }`}
        >
          <p className="text-2xl font-bold">{closed.length}</p>
          <p className="text-xs text-muted-foreground">Closed</p>
        </button>
      </div>

      {ready && shown.length === 0 ? (
        <div className="glass mt-8 rounded-3xl px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">
            {view === "applied"
              ? "No applied jobs yet"
              : view === "closed"
                ? "Nothing closed"
                : "No jobs or internships saved"}
          </h2>
          {view === "closing" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Save a job or internship link, set the last date to apply, and it will count down
              here.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((b) => (
            <BookmarkCard key={b.id} bookmark={b} />
          ))}
        </div>
      )}

      <AddBookmarkSheet open={open} onOpenChange={setOpen} onSave={add} />
    </PhoneShell>
  );
}
