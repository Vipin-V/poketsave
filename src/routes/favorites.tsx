import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { BookmarkCard } from "@/components/BookmarkCard";
import { AddBookmarkSheet } from "@/components/AddBookmarkSheet";
import { ShareButton } from "@/components/ShareButton";
import { useBookmarks } from "@/hooks/use-bookmarks";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Favorites — PoketSave" },
      {
        name: "description",
        content:
          "The saved links you starred, kept one tap away so you can revisit them instantly.",
      },
      { property: "og:title", content: "Favorites — Pocket" },
      {
        property: "og:description",
        content: "Your starred bookmarks, always one tap away.",
      },
    ],
  }),
  component: Favorites,
});

function Favorites() {
  const { bookmarks, ready, add } = useBookmarks();
  const [open, setOpen] = useState(false);

  const favorites = useMemo(() => bookmarks.filter((b) => b.favorite), [bookmarks]);

  return (
    <PhoneShell onAdd={() => setOpen(true)}>
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">Starred</p>
          <h1 className="mt-1 text-3xl font-bold text-balance-tight">Favorites</h1>
        </div>
        <ShareButton bookmarks={favorites} heading="My favorite links from Pocket:" />
      </header>

      {ready && favorites.length === 0 ? (
        <div className="glass mt-8 rounded-3xl px-6 py-12 text-center">
          <Star className="mx-auto size-6 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">Nothing starred yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tap the star on any saved link and it will live here for quick access.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((b) => (
            <BookmarkCard key={b.id} bookmark={b} />
          ))}
        </div>
      )}

      <AddBookmarkSheet open={open} onOpenChange={setOpen} onSave={add} />
    </PhoneShell>
  );
}
