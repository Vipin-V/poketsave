import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ID, Permission, Query, Role, type Models } from "appwrite";
import type { Album } from "@/lib/albums";
import {
  ALBUMS_COLLECTION_ID,
  BOOKMARKS_COLLECTION_ID,
  DATABASE_ID,
  account,
  client,
  databases,
  teams,
} from "@/integrations/appwrite/client";
import { joinAlbumByLink } from "@/lib/albums.functions";
import { useAuth } from "./use-auth";

type AlbumDoc = Models.Document & {
  name: string;
  emoji: string;
  teamId: string;
  ownerId: string;
  ownerName: string;
};

function docToAlbum(doc: AlbumDoc): Album {
  return {
    id: doc.$id,
    name: doc.name,
    emoji: doc.emoji,
    teamId: doc.teamId,
    ownerId: doc.ownerId,
    ownerName: doc.ownerName,
    createdAt: doc.$createdAt,
  };
}

export function useAlbums() {
  const { user, ready: authReady } = useAuth();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setAlbums([]);
      setReady(true);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const [docs, teamList] = await Promise.all([
          databases.listDocuments<AlbumDoc>(DATABASE_ID, ALBUMS_COLLECTION_ID, [
            Query.orderDesc("$createdAt"),
          ]),
          teams.list(),
        ]);
        if (cancelled) return;
        setAlbums(docs.documents.map(docToAlbum));
        setMemberCounts(Object.fromEntries(teamList.teams.map((t) => [t.$id, t.total])));
      } catch {
        if (!cancelled) toast("Couldn't load your albums.");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authReady]);

  // Live updates so a new album (or a rename) from another device shows up.
  useEffect(() => {
    if (!authReady || !user) return;
    const channel = `databases.${DATABASE_ID}.collections.${ALBUMS_COLLECTION_ID}.documents`;
    const unsubscribe = client.subscribe<AlbumDoc>(channel, (event) => {
      const doc = event.payload;
      if (event.events.some((e) => e.endsWith(".delete"))) {
        setAlbums((prev) => prev.filter((a) => a.id !== doc.$id));
        return;
      }
      const album = docToAlbum(doc);
      setAlbums((prev) =>
        prev.some((a) => a.id === album.id)
          ? prev.map((a) => (a.id === album.id ? album : a))
          : [album, ...prev],
      );
    });
    return () => unsubscribe();
  }, [user, authReady]);

  const create = useCallback(
    async (name: string, emoji: string) => {
      if (!user) throw new Error("Sign in required");
      const team = await teams.create({ teamId: ID.unique(), name });
      const doc = await databases.createDocument<AlbumDoc>(
        DATABASE_ID,
        ALBUMS_COLLECTION_ID,
        team.$id,
        {
          name,
          emoji,
          teamId: team.$id,
          ownerId: user.$id,
          ownerName: user.name || user.email,
        },
        [
          // Readable by any signed-in user so a join link can show a preview
          // before they've joined the team; bookmarks stay team-scoped.
          Permission.read(Role.users()),
          Permission.update(Role.user(user.$id)),
          Permission.delete(Role.user(user.$id)),
        ],
      );
      const album = docToAlbum(doc);
      setAlbums((prev) => [album, ...prev]);
      setMemberCounts((prev) => ({ ...prev, [team.$id]: 1 }));
      return album;
    },
    [user],
  );

  const joinAlbum = useServerFn(joinAlbumByLink);
  const join = useCallback(
    async (teamId: string) => {
      const { jwt } = await account.createJWT();
      const result = await joinAlbum({ data: { teamId, jwt } });
      if (!result.ok) throw new Error(result.error);
    },
    [joinAlbum],
  );

  const remove = useCallback(async (album: Album) => {
    // Appwrite caps a single list call at 100 documents, so an album with
    // more bookmarks than that needs multiple pages or the tail end is left
    // behind as an orphaned trace instead of actually being deleted.
    const PAGE_SIZE = 100;
    const ids: string[] = [];
    let cursor: string | undefined;
    for (;;) {
      const queries = [Query.equal("albumId", album.id), Query.limit(PAGE_SIZE)];
      if (cursor) queries.push(Query.cursorAfter(cursor));
      const page = await databases.listDocuments(DATABASE_ID, BOOKMARKS_COLLECTION_ID, queries);
      ids.push(...page.documents.map((doc) => doc.$id));
      const last = page.documents.at(-1);
      if (page.documents.length < PAGE_SIZE || !last) break;
      cursor = last.$id;
    }
    await Promise.all(
      ids.map((id) => databases.deleteDocument(DATABASE_ID, BOOKMARKS_COLLECTION_ID, id)),
    );
    await databases.deleteDocument(DATABASE_ID, ALBUMS_COLLECTION_ID, album.id);
    await teams.delete({ teamId: album.teamId }).catch(() => {});
    setAlbums((prev) => prev.filter((a) => a.id !== album.id));
  }, []);

  const leave = useCallback(
    async (album: Album) => {
      if (!user) return;
      const memberships = await teams.listMemberships({ teamId: album.teamId });
      const mine = memberships.memberships.find((m) => m.userId === user.$id);
      if (mine) await teams.deleteMembership({ teamId: album.teamId, membershipId: mine.$id });
      setAlbums((prev) => prev.filter((a) => a.id !== album.id));
    },
    [user],
  );

  return { albums, memberCounts, ready, create, join, remove, leave };
}
