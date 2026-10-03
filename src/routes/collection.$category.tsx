import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PhoneShell } from "@/components/PhoneShell";
import { LinkTile } from "@/components/LinkTile";
import { AddBookmarkSheet } from "@/components/AddBookmarkSheet";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { dedupeByUrl, loadAlbumVisibility } from "@/lib/album-visibility";
import { inFolder } from "@/lib/collections";
import { useFolders } from "@/hooks/use-folders";
import { iconFor } from "@/lib/folders";
import { DeleteFolderDialog } from "@/components/DeleteFolderDialog";
import { daysLeft, type Category } from "@/lib/bookmarks";

export const Route = createFileRoute("/collection/$category")({
  head: () => ({
    meta: [
      { title: "Collection — PoketSave" },
      {
        name: "description",
        content: "Every link you saved in this collection, in one scrollable grid.",
      },
      { property: "og:title", content: "Your collection on PoketSave" },
      { property: "og:description", content: "Saved links, grouped into collections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CollectionPage,
});

function CollectionPage() {
  const { category } = Route.useParams();
  const { bookmarks: all, ready, add } = useBookmarks();
  const [open, setOpen] = useState(false);
  const [albumIds] = useState<Set<string>>(() => loadAlbumVisibility("library"));

  const { folders, findFolder, deleteFolder } = useFolders();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const known = folders.some((f) => f.id === category);
  const folder = findFolder(category as Category);
  const FolderIcon = iconFor(folder);
  // Websites is where links from deleted folders go, so it stays.
  const deletable = known && category !== "website";
  const inside = all.filter((b) => inFolder(b.category, category)).length;

  // Jobs and internships whose last date has passed leave the collection —
  // they live on in Jobs → Closed instead.
  const items = useMemo(
    () =>
      dedupeByUrl(
        all.filter(
          (b) =>
            inFolder(b.category, category) &&
            (!b.albumId || albumIds.has(b.albumId)) &&
            !(
              (b.category === "job" || b.category === "internship") &&
              b.deadline &&
              daysLeft(b.deadline) < 0
            ),
        ),
      ),
    [all, category, albumIds],
  );

  return (
    <PhoneShell onAdd={() => setOpen(true)}>
      <div className="mb-5 flex items-center gap-3">
        <Link
          to="/"
          aria-label="Back to library"
          className="glass brutal-press grid size-11 shrink-0 place-items-center rounded-2xl"
        >
          <ChevronLeft className="size-5" strokeWidth={2.6} />
        </Link>
        <div
          className={`grid size-11 shrink-0 place-items-center rounded-xl border-2 border-border ${folder.color}`}
        >
          <FolderIcon className="size-5 text-primary-foreground" strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold">{known ? folder.label : "Collection"}</h1>
          <p className="text-xs font-bold text-muted-foreground">
            {items.length} link{items.length === 1 ? "" : "s"}
          </p>
        </div>
        {deletable && (
          <button
            type="button"
            aria-label="Delete folder"
            onClick={() => setConfirmOpen(true)}
            className="glass brutal-press grid size-11 shrink-0 place-items-center rounded-2xl text-destructive"
          >
            <Trash2 className="size-4.5" strokeWidth={2.4} />
          </button>
        )}
      </div>

      <DeleteFolderDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        label={folder.label}
        count={inside}
        onConfirm={() => {
          deleteFolder(category as Category);
          toast(`“${folder.label}” deleted`);
          void navigate({ to: "/", replace: true });
        }}
      />

      {ready && items.length === 0 ? (
        <div className="glass rounded-2xl px-6 py-12 text-center">
          <h2 className="text-base font-extrabold">This collection is empty</h2>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Tap + and save a link — anything in this category lands here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((b) => (
            <LinkTile key={b.id} bookmark={b} />
          ))}
        </div>
      )}

      <AddBookmarkSheet
        open={open}
        onOpenChange={setOpen}
        onSave={add}
        defaultCategory={known ? (category as Category) : undefined}
      />
    </PhoneShell>
  );
}
