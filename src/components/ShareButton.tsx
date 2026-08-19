import { Share2 } from "lucide-react";
import { toast } from "sonner";
import type { Bookmark } from "@/lib/bookmarks";
import { shareBookmarks } from "@/lib/share";

export function ShareButton({
  bookmarks,
  label = "Share",
  heading,
  className = "",
}: {
  bookmarks: Bookmark[];
  label?: string;
  heading?: string;
  className?: string;
}) {
  async function onClick() {
    const result = await shareBookmarks(bookmarks, heading ? { heading } : {});
    if (result === "copied") toast("Copied to clipboard — paste it in any chat.");
    if (result === "failed") toast("Couldn't share this right now.");
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={bookmarks.length === 0}
      className={`glass flex min-h-11 items-center gap-2 rounded-2xl px-3.5 text-sm font-medium text-foreground transition-transform active:scale-95 disabled:opacity-40 ${className}`}
    >
      <Share2 className="size-4 text-primary" />
      {label}
    </button>
  );
}
