import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Users, XCircle } from "lucide-react";
import { OAuthProvider } from "appwrite";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  account,
  databases,
  isAppwriteConfigured,
  DATABASE_ID,
  ALBUMS_COLLECTION_ID,
} from "@/integrations/appwrite/client";
import { useAuth } from "@/hooks/use-auth";
import { useAlbums } from "@/hooks/use-albums";

export const Route = createFileRoute("/albums/join/$id")({
  head: () => ({
    meta: [{ title: "Join album — Pocket" }],
  }),
  component: JoinAlbum,
});

type AlbumPreview = { name: string; emoji: string; teamId: string };

function JoinAlbum() {
  const { id } = Route.useParams();
  const { user, ready: authReady } = useAuth();
  const { join } = useAlbums();
  const [album, setAlbum] = useState<AlbumPreview | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "joining" | "done" | "error">(
    "loading",
  );

  useEffect(() => {
    if (!authReady || !user) return;
    databases
      .getDocument(DATABASE_ID, ALBUMS_COLLECTION_ID, id)
      .then((doc) => {
        setAlbum(doc as unknown as AlbumPreview);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [authReady, user, id]);

  async function joinNow() {
    if (!album) return;
    setStatus("joining");
    try {
      await join(album.teamId);
      setStatus("done");
      setTimeout(() => {
        window.location.href = `/albums/${id}`;
      }, 800);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col items-center justify-center px-4 text-center">
      <div className="glass-strong w-full rounded-3xl px-6 py-10">
        {!authReady || status === "loading" ? (
          <Loader2 className="mx-auto size-6 animate-spin text-primary" />
        ) : !user ? (
          <SignInToJoin />
        ) : status === "error" ? (
          <>
            <XCircle className="mx-auto size-8 text-destructive" />
            <h1 className="mt-3 text-lg font-semibold">Invite link didn't work</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              It may have been deleted, or you don't have access.
            </p>
          </>
        ) : status === "done" ? (
          <>
            <CheckCircle2 className="mx-auto size-8 text-primary" />
            <h1 className="mt-3 text-lg font-semibold">You're in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Taking you to the album…</p>
          </>
        ) : album ? (
          <>
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-3xl">
              {album.emoji}
            </div>
            <h1 className="mt-3 text-lg font-semibold">Join "{album.name}"?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You'll see every bookmark already saved here, and everyone in the album will see what
              you add.
            </p>
            <Button
              className="neon-glow mt-5 h-12 w-full rounded-2xl text-sm font-semibold"
              onClick={() => void joinNow()}
              disabled={status === "joining"}
            >
              {status === "joining" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Join album
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function SignInToJoin() {
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
        success: window.location.href,
        failure: window.location.href,
      });
    } catch {
      toast("Couldn't sign in with Google — try again.");
      setSigningIn(false);
    }
  }

  return (
    <>
      <Users className="mx-auto size-6 text-muted-foreground" />
      <h1 className="mt-3 text-lg font-semibold">Sign in to join</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You need an account to see and add to this shared album.
      </p>
      <Button
        className="neon-glow mt-5 h-12 w-full rounded-2xl text-sm font-semibold"
        onClick={signIn}
        disabled={signingIn}
      >
        {signingIn ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Continue with Google
      </Button>
    </>
  );
}
