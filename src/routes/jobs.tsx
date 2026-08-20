import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PhoneShell } from "@/components/PhoneShell";
import { BookmarkCard } from "@/components/BookmarkCard";
import { AddBookmarkSheet } from "@/components/AddBookmarkSheet";
import { ShareButton } from "@/components/ShareButton";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { daysLeft } from "@/lib/bookmarks";
import { dedupeByUrl } from "@/lib/album-visibility";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Job deadlines — PoketSave" },
      {
        name: "description",
        content:
          "Every job and internship link you saved, sorted by how soon the application window closes, with countdowns and applied tracking.",
      },
      { property: "og:title", content: "Job deadlines — Pocket" },
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

  // Job/internship deadlines are per-bookmark, so album bookmarks count too —
  // just dedupe by url in case the same link exists both personally and
  // inside an album.
  const bookmarks = useMemo(() => dedupeByUrl(allBookmarks), [allBookmarks]);

  const { active, rest } = useMemo(() => {
    const jobs = bookmarks.filter((b) => b.category === "job" || b.category === "internship");
    const withDate = jobs
      .filter((b) => b.deadline && !b.applied && daysLeft(b.deadline!) >= 0)
      .sort((a, b) => daysLeft(a.deadline!) - daysLeft(b.deadline!));
    const others = jobs.filter((b) => !withDate.includes(b));
    return { active: withDate, rest: others };
  }, [bookmarks]);

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
          bookmarks={active}
          label="Share"
          heading="Jobs & internships closing soon (shared from Pocket):"
        />
      </header>

      {ready && active.length === 0 && rest.length === 0 ? (
        <div className="glass mt-8 rounded-3xl px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">No jobs or internships saved</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Save a job or internship link, set the last date to apply, and it will count down here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section className="space-y-3">
              {active.map((b) => (
                <BookmarkCard key={b.id} bookmark={b} />
              ))}
            </section>
          )}
          {rest.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                Applied &amp; closed
              </h2>
              {rest.map((b) => (
                <BookmarkCard key={b.id} bookmark={b} />
              ))}
            </section>
          )}
        </div>
      )}

      <AddBookmarkSheet open={open} onOpenChange={setOpen} onSave={add} />
    </PhoneShell>
  );
}
