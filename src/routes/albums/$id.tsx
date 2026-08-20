import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, LogOut, Menu, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { Models } from "appwrite";
import { PhoneShell } from "@/components/PhoneShell";
import { BookmarkCard } from "@/components/BookmarkCard";
import { AddBookmarkSheet } from "@/components/AddBookmarkSheet";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { teams } from "@/integrations/appwrite/client";
import { shareLink } from "@/lib/share";
import { useAuth } from "@/hooks/use-auth";
import { useAlbums } from "@/hooks/use-albums";
import { useBookmarks } from "@/hooks/use-bookmarks";

export const Route = createFileRoute("/albums/$id")({
  head: () => ({
    meta: [
      { title: "Shared album — PoketSave" },
      { name: "description", content: "Bookmarks saved to this shared album, and who's in it." },
    ],
  }),
  component: AlbumDetail,
});

function AlbumDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { albums, ready: albumsReady, remove, leave } = useAlbums();
  const { bookmarks, add } = useBookmarks();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [members, setMembers] = useState<Models.Membership[]>([]);

  const album = albums.find((a) => a.id === id);
  const isOwner = album?.ownerId === user?.$id;
  const albumBookmarks = useMemo(() => bookmarks.filter((b) => b.albumId === id), [bookmarks, id]);

  async function invite() {
    if (!album) return;
    const url = `${window.location.origin}/albums/join/${album.id}`;
    const result = await shareLink(url, {
      title: album.name,
      text: `Join "${album.name}" on Pocket`,
    });
    if (result === "copied") toast("Invite link copied — send it to anyone you want in.");
    if (result === "failed") toast("Couldn't create an invite link right now.");
  }

  useEffect(() => {
    if (!album) return;
    teams
      .listMemberships({ teamId: album.teamId })
      .then((res) => setMembers(res.memberships))
      .catch(() => undefined);
  }, [album]);

  if (!album) {
    return (
      <PhoneShell onAdd={() => navigate({ to: "/albums" })}>
        <div className="glass mt-16 rounded-3xl px-6 py-12 text-center">
          <h1 className="text-lg font-semibold">{albumsReady ? "Album not found" : "Loading…"}</h1>
          {albumsReady && (
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => navigate({ to: "/albums" })}
            >
              Back to albums
            </Button>
          )}
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell onAdd={() => setAddOpen(true)} hideMenu>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate({ to: "/albums" })}
          className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Albums
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Album menu"
              className="glass grid size-11 place-items-center rounded-full"
            >
              <Menu className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 rounded-2xl border-border bg-popover p-1.5 text-popover-foreground"
          >
            <DropdownMenuItem
              onClick={() => void invite()}
              className="gap-2 rounded-xl py-2.5 focus:bg-accent"
            >
              <UserPlus className="size-4 text-primary" /> Invite people
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {isOwner ? (
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="gap-2 rounded-xl py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 className="size-4" /> Delete album
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  void leave(album).then(() => navigate({ to: "/albums" }));
                }}
                className="gap-2 rounded-xl py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <LogOut className="size-4" /> Leave album
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl">
          {album.emoji}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-balance-tight">{album.name}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {members.length || 1} member{(members.length || 1) === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {members.length > 0 && (
        <div className="mt-3 flex -space-x-2">
          {members.slice(0, 8).map((m) => {
            // Appwrite can hide membership name/email for privacy; fall back
            // to our own profile for ourselves, and a generic label for others.
            const label =
              m.userId === user?.$id
                ? user?.name || user?.email || "You"
                : m.userName || m.userEmail || "Member";
            return (
              <div
                key={m.$id}
                title={label}
                className="glass grid size-8 place-items-center rounded-full text-[11px] font-semibold text-primary"
              >
                {label.slice(0, 1).toUpperCase()}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5">
        {albumBookmarks.length === 0 ? (
          <div className="glass rounded-3xl px-6 py-12 text-center">
            <h2 className="text-lg font-semibold">Nothing saved here yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tap the + button to add the first link. Everyone in this album will see it instantly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {albumBookmarks.map((b) => (
              <BookmarkCard key={b.id} bookmark={b} />
            ))}
          </div>
        )}
      </div>

      <AddBookmarkSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={(b) => add({ ...b, albumId: album.id }, album.teamId, album.ownerId)}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-[22rem] rounded-3xl border-border bg-popover p-6 text-popover-foreground">
          <AlertDialogHeader className="items-center text-center">
            <div className="grid size-12 place-items-center rounded-full bg-destructive/15 text-destructive">
              <Trash2 className="size-5" />
            </div>
            <AlertDialogTitle className="mt-1">Delete this album?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{album.name}</span> and
              {albumBookmarks.length > 0
                ? ` its ${albumBookmarks.length} bookmark${albumBookmarks.length > 1 ? "s" : ""}`
                : " it"}{" "}
              will be removed permanently for every member. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 flex-row gap-2 sm:justify-stretch">
            <AlertDialogCancel className="mt-0 h-12 flex-1 rounded-2xl border-border">
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void remove(album).then(() => navigate({ to: "/albums" }));
              }}
              className="h-12 flex-1 rounded-2xl bg-destructive text-destructive-foreground shadow-none hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PhoneShell>
  );
}
