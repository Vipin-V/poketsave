import { daysLeft, type Bookmark } from "@/lib/bookmarks";

// Small status chip shown on a tile for anything with a last date:
// jobs, internships and events.
export function DeadlineTag({ bookmark }: { bookmark: Bookmark }) {
  const dated =
    bookmark.category === "job" ||
    bookmark.category === "internship" ||
    bookmark.category === "event";
  if (!dated || !bookmark.deadline) return null;

  const days = daysLeft(bookmark.deadline);
  const closed = days < 0;
  const label = closed
    ? "Closed"
    : days === 0
      ? "Last day"
      : `${days} day${days === 1 ? "" : "s"} left`;

  const tone = closed
    ? "border-border bg-muted text-muted-foreground"
    : days <= 3
      ? "border-danger bg-danger text-primary-foreground"
      : days <= 7
        ? "border-border bg-warn text-primary-foreground"
        : "border-border bg-primary text-primary-foreground";

  return (
    <span
      className={`inline-flex rounded-full border-2 px-2 py-0.5 text-[10px] font-extrabold tracking-wide ${tone}`}
    >
      {label}
    </span>
  );
}
