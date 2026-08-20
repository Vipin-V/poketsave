import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Sparkles, Users } from "lucide-react";
import { OAuthProvider } from "appwrite";
import { toast } from "sonner";
import { PhoneShell } from "@/components/PhoneShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { account, isAppwriteConfigured } from "@/integrations/appwrite/client";
import { useAuth } from "@/hooks/use-auth";
import { useAlbums } from "@/hooks/use-albums";
import { ALBUM_EMOJIS } from "@/lib/albums";

export const Route = createFileRoute("/albums/")({
  head: () => ({
    meta: [
      { title: "Shared albums — PoketSave" },
      {
        name: "description",
        content: "Create shared albums to save and track links together with other people.",
      },
      { property: "og:title", content: "Shared albums — Pocket" },
      {
        property: "og:description",
        content: "Collaborate on a bookmark album with friends, classmates or teammates.",
      },
    ],
  }),
  component: Albums,
});

function Albums() {
  const { user, ready: authReady } = useAuth();
  const { albums, memberCounts, ready, create } = useAlbums();
  const [open, setOpen] = useState(false);

  return (
    <PhoneShell onAdd={() => setOpen(true)}>
      <header className="mb-5">
        <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">Together</p>
        <h1 className="mt-1 text-3xl font-bold text-balance-tight">Shared albums</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Save jobs, reading or links as a group — everyone sees the same list and the same deadline
          alerts.
        </p>
      </header>

      {authReady && !user ? (
        <SignInPrompt />
      ) : (
        <>
          {ready && albums.length === 0 ? (
            <div className="glass mt-8 rounded-3xl px-6 py-12 text-center">
              <Users className="mx-auto size-6 text-muted-foreground" />
              <h2 className="mt-3 text-lg font-semibold">No albums yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Tap the + button to start one, then share the invite link — anyone who opens it
                can join and add bookmarks right alongside you.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {albums.map((a) => (
                <Link
                  key={a.id}
                  to="/albums/$id"
                  params={{ id: a.id }}
                  className="glass flex items-center gap-3 rounded-2xl p-3.5 transition-transform active:scale-[0.985]"
                >
                  <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-xl">
                    {a.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold">{a.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {memberCounts[a.teamId] ?? 1} member
                      {(memberCounts[a.teamId] ?? 1) === 1 ? "" : "s"} ·{" "}
                      {a.ownerId === user?.$id ? "You" : a.ownerName}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <CreateAlbumSheet open={open} onOpenChange={setOpen} onCreate={create} />
        </>
      )}
    </PhoneShell>
  );
}

function SignInPrompt() {
  const [signingIn, setSigningIn] = useState(false);

  function signIn() {
    if (!isAppwriteConfigured) {
      toast("Sync isn't set up yet — add your Appwrite project details to .env first.");
      return;
    }
    setSigningIn(true);
    try {
      account.createOAuth2Session({
        provider: OAuthProvider.Google,
        success: window.location.origin + "/albums",
        failure: window.location.origin + "/albums",
      });
    } catch {
      toast("Couldn't sign in with Google — try again.");
      setSigningIn(false);
    }
  }

  return (
    <div className="glass mt-8 rounded-3xl px-6 py-10 text-center">
      <Users className="mx-auto size-6 text-muted-foreground" />
      <h2 className="mt-3 text-lg font-semibold">Sign in to collaborate</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Shared albums need an account so they can sync between everyone in the group.
      </p>
      <Button
        className="neon-glow mt-5 h-12 w-full rounded-2xl text-sm font-semibold"
        onClick={signIn}
        disabled={signingIn}
      >
        {signingIn ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Continue with Google
      </Button>
    </div>
  );
}

function CreateAlbumSheet({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (name: string, emoji: string) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(ALBUM_EMOJIS[0]!);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) {
      toast("Give the album a name first");
      return;
    }
    setSaving(true);
    try {
      await onCreate(name.trim(), emoji);
      setName("");
      setEmoji(ALBUM_EMOJIS[0]!);
      onOpenChange(false);
    } catch {
      toast("Couldn't create that album — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-strong mx-auto w-full max-w-[26rem] rounded-t-3xl border-border px-4 pb-8"
      >
        <SheetHeader className="px-0">
          <SheetTitle className="font-display text-xl">New shared album</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="album-name">Name</Label>
            <Input
              id="album-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Summer internships"
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-8 gap-2">
              {ALBUM_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  aria-label={`Use ${e} icon`}
                  aria-pressed={emoji === e}
                  className={`grid size-10 place-items-center rounded-xl border text-lg transition-colors ${
                    emoji === e ? "border-primary/60 bg-primary/15" : "border-border"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => void submit()}
            disabled={saving}
            className="neon-glow h-13 w-full rounded-2xl text-base font-semibold"
          >
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1 size-4" />
            )}
            Create album
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
