import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Clock } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { BookmarkCard } from "@/components/BookmarkCard";
import { AddBookmarkSheet } from "@/components/AddBookmarkSheet";
import { Input } from "@/components/ui/input";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { CATEGORIES, daysLeft, type Category } from "@/lib/bookmarks";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PoketSave" },
      {
        name: "description",
        content:
          "A mobile bookmark vault for X posts, Reddit threads, articles and job listings — with countdown alerts before applications close.",
      },
      { property: "og:title", content: "Pocket — Save links, never lose a job deadline" },
      {
        property: "og:description",
        content: "Save any link on your phone and find it again in seconds. Job deadlines included.",
      },
    ],
  }),
  component: Library,
});

function Library() {
  const { bookmarks, ready, add } = useBookmarks();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Category | "all">("all");

  const expiring = useMemo(
    () =>
      bookmarks.filter(
        (b) =>
          b.category === "job" &&
          b.deadline &&
          !b.applied &&
          daysLeft(b.deadline) >= 0 &&
          daysLeft(b.deadline) <= 7,
      ),
    [bookmarks],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookmarks.filter((b) => {
      if (filter !== "all" && b.category !== filter) return false;
      if (!q) return true;
      return [b.title, b.notes, b.domain, b.company, b.role, ...b.tags]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [bookmarks, query, filter]);

  return (
    <PhoneShell onAdd={() => setOpen(true)}>
      <header className="mb-5">
        <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">Pocket</p>
        <h1 className="mt-1 text-3xl font-bold text-balance-tight">Your saved corner of the internet</h1>
      </header>

      <div className="relative mb-4">
        <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search links, tags, notes"
          className="glass h-12 rounded-2xl pl-10"
        />
      </div>

      {expiring.length > 0 && (
        <Link
          to="/jobs"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-warn/40 bg-warn/10 px-3.5 py-3"
        >
          <Clock className="size-4 shrink-0 text-warn" />
          <p className="text-sm text-foreground">
            <span className="font-semibold text-warn">{expiring.length}</span> job
            {expiring.length > 1 ? "s" : ""} closing within a week
          </p>
        </Link>
      )}

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {(["all", ...CATEGORIES.map((c) => c.value)] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setFilter(v)}
            className={`min-h-9 shrink-0 rounded-full border px-3.5 text-xs font-medium transition-colors ${
              filter === v
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {v === "all" ? "All" : CATEGORIES.find((c) => c.value === v)!.label}
          </button>
        ))}
      </div>

      {ready && visible.length === 0 ? (
        <div className="glass mt-8 rounded-3xl px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">
            {bookmarks.length === 0 ? "Nothing saved yet" : "No matches"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {bookmarks.length === 0
              ? "Tap the + button and paste any link — a post, an article, or a job you want to apply to."
              : "Try a different search or filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((b) => (
            <BookmarkCard key={b.id} bookmark={b} />
          ))}
        </div>
      )}

      <AddBookmarkSheet open={open} onOpenChange={setOpen} onSave={add} />
    </PhoneShell>
  );
}
