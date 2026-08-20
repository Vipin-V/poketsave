import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { BookmarkCard } from "@/components/BookmarkCard";
import { AddBookmarkSheet } from "@/components/AddBookmarkSheet";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { REMINDER_CATEGORIES, daysLeft, urgencyOf, type Bookmark } from "@/lib/bookmarks";
import { dedupeByUrl, loadAlbumVisibility } from "@/lib/album-visibility";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Deadline calendar — PoketSave" },
      {
        name: "description",
        content:
          "A month-by-month calendar of your saved job, internship and event dates, so you can see at a glance which ones are coming up.",
      },
      { property: "og:title", content: "Deadline calendar — Pocket" },
      {
        property: "og:description",
        content: "See every saved job, internship and event date laid out on a calendar.",
      },
    ],
  }),
  component: CalendarView,
});

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dotColor: Record<string, string> = {
  ok: "bg-primary",
  soon: "bg-warn",
  critical: "bg-danger",
  expired: "bg-muted-foreground",
};

function CalendarView() {
  const { bookmarks: allBookmarks, ready, add } = useBookmarks();
  const [open, setOpen] = useState(false);
  const [calendarAlbumIds, setCalendarAlbumIds] = useState<Set<string>>(new Set());

  // Client-only: matches the read-after-hydration pattern used for the
  // localStorage-backed guest bookmark list, avoiding an SSR/client mismatch.
  useEffect(() => {
    setCalendarAlbumIds(loadAlbumVisibility("calendar"));
  }, []);

  // Album bookmarks live under Albums by default — unless the album has been
  // opted into the personal calendar from its own page. De-duped by url: an
  // album bookmark "added to album" from a personal one is a separate copy,
  // so an opted-in album can otherwise list the same link twice.
  const bookmarks = useMemo(
    () =>
      dedupeByUrl(allBookmarks.filter((b) => !b.albumId || calendarAlbumIds.has(b.albumId))),
    [allBookmarks, calendarAlbumIds],
  );
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(iso(today));

  const byDate = useMemo(() => {
    const map = new Map<string, Bookmark[]>();
    for (const b of bookmarks) {
      if (!REMINDER_CATEGORIES.includes(b.category) || !b.deadline) continue;
      map.set(b.deadline, [...(map.get(b.deadline) ?? []), b]);
    }
    return map;
  }, [bookmarks]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Monday-first
    const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= total; d++) out.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    return out;
  }, [cursor]);

  const selectedJobs = selected ? (byDate.get(selected) ?? []) : [];

  const upcoming = useMemo(
    () =>
      bookmarks
        .filter(
          (b) =>
            REMINDER_CATEGORIES.includes(b.category) &&
            b.deadline &&
            !b.applied &&
            daysLeft(b.deadline) >= 0,
        )
        .sort((a, b) => daysLeft(a.deadline!) - daysLeft(b.deadline!))
        .slice(0, 3),
    [bookmarks],
  );

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <PhoneShell onAdd={() => setOpen(true)}>
      <header className="mb-5">
        <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">Calendar</p>
        <h1 className="mt-1 text-3xl font-bold text-balance-tight">Deadlines by date</h1>
      </header>

      <div className="glass rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="text-sm font-semibold">{monthLabel}</p>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="py-1 text-[10px] font-medium text-muted-foreground">
              {d}
            </span>
          ))}
          {cells.map((date, i) => {
            if (!date) return <span key={`e${i}`} />;
            const key = iso(date);
            const jobs = byDate.get(key) ?? [];
            const isToday = key === iso(today);
            const isSelected = key === selected;
            const urgency = jobs.length
              ? urgencyOf(Math.min(...jobs.map((j) => daysLeft(j.deadline!))))
              : null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-xl text-[13px] transition-colors ${
                  isSelected
                    ? "bg-primary/20 font-semibold text-primary"
                    : isToday
                      ? "border border-primary/40 text-foreground"
                      : "text-foreground/80"
                }`}
              >
                {date.getDate()}
                {urgency && (
                  <span className={`mt-0.5 size-1.5 rounded-full ${dotColor[urgency]}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
          {selectedJobs.length > 0
            ? new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "short",
              })
            : "Next up"}
        </h2>
        {selectedJobs.length > 0 ? (
          selectedJobs.map((b) => <BookmarkCard key={b.id} bookmark={b} />)
        ) : upcoming.length > 0 ? (
          upcoming.map((b) => <BookmarkCard key={b.id} bookmark={b} />)
        ) : ready ? (
          <div className="glass rounded-3xl px-6 py-10 text-center">
            <CalendarDays className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No dates saved yet. Add a job, internship or event link with a date and it appears
              here.
            </p>
          </div>
        ) : null}
      </section>

      <AddBookmarkSheet open={open} onOpenChange={setOpen} onSave={add} />
    </PhoneShell>
  );
}
