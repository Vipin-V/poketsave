import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ID, Permission, Query, Role, type Models } from "appwrite";
import { loadBookmarks, saveBookmarks, type Bookmark, type Category } from "@/lib/bookmarks";
import {
  BOOKMARKS_COLLECTION_ID,
  DATABASE_ID,
  client,
  databases,
} from "@/integrations/appwrite/client";
import { useAuth } from "./use-auth";

type BookmarkDoc = Models.Document & {
  url: string;
  title: string;
  description: string | null;
  image: string | null;
  favicon: string | null;
  domain: string;
  category: string;
  tags: string[];
  notes: string | null;
  company: string | null;
  role: string | null;
  deadline: string | null;
  applied: boolean;
  favorite: boolean;
  albumId: string | null;
};

function docToBookmark(doc: BookmarkDoc): Bookmark {
  return {
    id: doc.$id,
    url: doc.url,
    title: doc.title,
    description: doc.description ?? undefined,
    image: doc.image ?? undefined,
    favicon: doc.favicon ?? undefined,
    domain: doc.domain,
    category: doc.category as Category,
    tags: doc.tags ?? [],
    notes: doc.notes ?? undefined,
    createdAt: doc.$createdAt,
    company: doc.company ?? undefined,
    role: doc.role ?? undefined,
    deadline: doc.deadline ?? undefined,
    applied: doc.applied,
    favorite: doc.favorite,
    albumId: doc.albumId ?? undefined,
  };
}

function bookmarkToData(b: Partial<Bookmark>) {
  const data: Record<string, unknown> = {};
  if ("url" in b) data["url"] = b.url;
  if ("title" in b) data["title"] = b.title;
  if ("description" in b) data["description"] = b.description ?? null;
  if ("image" in b) data["image"] = b.image ?? null;
  if ("favicon" in b) data["favicon"] = b.favicon ?? null;
  if ("domain" in b) data["domain"] = b.domain;
  if ("category" in b) data["category"] = b.category;
  if ("tags" in b) data["tags"] = b.tags;
  if ("notes" in b) data["notes"] = b.notes ?? null;
  if ("company" in b) data["company"] = b.company ?? null;
  if ("role" in b) data["role"] = b.role ?? null;
  if ("deadline" in b) data["deadline"] = b.deadline ?? null;
  if ("applied" in b) data["applied"] = b.applied ?? false;
  if ("favorite" in b) data["favorite"] = b.favorite ?? false;
  if ("albumId" in b) data["albumId"] = b.albumId ?? null;
  return data;
}

export function useBookmarks() {
  const { user, ready: authReady } = useAuth();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => loadBookmarks());
  const [ready, setReady] = useState(false);

  // Guest mode: identical to the pre-auth behaviour, pure localStorage.
  useEffect(() => {
    if (user) return;
    const sync = () => setBookmarks(loadBookmarks());
    sync();
    setReady(true);
    window.addEventListener("pocket:bookmarks", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("pocket:bookmarks", sync);
      window.removeEventListener("storage", sync);
    };
  }, [user]);

  // Signed-in mode: cloud is the source of truth. On the transition into a
  // session, upload any local-only bookmarks once, then keep localStorage as
  // a warm offline mirror of whatever the cloud has.
  useEffect(() => {
    if (!authReady || !user) return;
    let cancelled = false;

    (async () => {
      try {
        const local = loadBookmarks();
        const existing = await databases.listDocuments<BookmarkDoc>(
          DATABASE_ID,
          BOOKMARKS_COLLECTION_ID,
          [Query.orderDesc("$createdAt")],
        );
        const cloud = existing.documents.map(docToBookmark);
        const cloudIds = new Set(cloud.map((b) => b.id));
        const cloudUrls = new Set(cloud.map((b) => b.url));
        const toUpload = local.filter((b) => !cloudIds.has(b.id) && !cloudUrls.has(b.url));

        const uploaded = await Promise.all(
          toUpload.map((b) =>
            databases.createDocument<BookmarkDoc>(
              DATABASE_ID,
              BOOKMARKS_COLLECTION_ID,
              ID.custom(b.id),
              bookmarkToData(b) as Omit<BookmarkDoc, keyof Models.Document>,
              [
                Permission.read(Role.user(user.$id)),
                Permission.update(Role.user(user.$id)),
                Permission.delete(Role.user(user.$id)),
              ],
            ),
          ),
        );

        const merged = [...uploaded.map(docToBookmark), ...cloud].sort((a, b) =>
          a.createdAt < b.createdAt ? 1 : -1,
        );
        if (cancelled) return;
        setBookmarks(merged);
        saveBookmarks(merged);
        if (toUpload.length > 0) {
          toast(
            `Synced ${toUpload.length} saved link${toUpload.length > 1 ? "s" : ""} to your account`,
          );
        }
      } catch {
        if (!cancelled)
          toast("Couldn't sync with your account — showing what's saved on this device.");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authReady]);

  // Cross-device sync: push updates from other sessions (e.g. another phone
  // or browser) into this one as they happen, instead of only on page load.
  useEffect(() => {
    if (!authReady || !user) return;

    const channel = `databases.${DATABASE_ID}.collections.${BOOKMARKS_COLLECTION_ID}.documents`;
    const unsubscribe = client.subscribe<BookmarkDoc>(channel, (event) => {
      const doc = event.payload;

      if (event.events.some((e) => e.endsWith(".delete"))) {
        setBookmarks((prev) => {
          const next = prev.filter((b) => b.id !== doc.$id);
          saveBookmarks(next);
          return next;
        });
        return;
      }

      const bookmark = docToBookmark(doc);
      setBookmarks((prev) => {
        const next = prev.some((b) => b.id === bookmark.id)
          ? prev.map((b) => (b.id === bookmark.id ? bookmark : b))
          : [bookmark, ...prev];
        next.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        saveBookmarks(next);
        return next;
      });
    });

    return () => unsubscribe();
  }, [user, authReady]);

  const add = useCallback(
    // Pass teamId when saving into a shared album — grants every current and
    // future member of that album's team access instead of just this user.
    (b: Bookmark, teamId?: string) => {
      if (user) {
        setBookmarks((prev) => {
          const next = [b, ...prev];
          saveBookmarks(next);
          return next;
        });
        const permissions = teamId
          ? [
              Permission.read(Role.team(teamId)),
              Permission.update(Role.team(teamId)),
              Permission.delete(Role.team(teamId)),
            ]
          : [
              Permission.read(Role.user(user.$id)),
              Permission.update(Role.user(user.$id)),
              Permission.delete(Role.user(user.$id)),
            ];
        void databases
          .createDocument<BookmarkDoc>(
            DATABASE_ID,
            BOOKMARKS_COLLECTION_ID,
            ID.custom(b.id),
            bookmarkToData(b) as Omit<BookmarkDoc, keyof Models.Document>,
            permissions,
          )
          .catch(() => toast("Couldn't save that to your account — it's kept on this device."));
      } else {
        saveBookmarks([b, ...loadBookmarks()]);
      }
    },
    [user],
  );

  const update = useCallback(
    (id: string, patch: Partial<Bookmark>) => {
      if (user) {
        setBookmarks((prev) => {
          const next = prev.map((b) => (b.id === id ? { ...b, ...patch } : b));
          saveBookmarks(next);
          return next;
        });
        void databases
          .updateDocument<BookmarkDoc>(
            DATABASE_ID,
            BOOKMARKS_COLLECTION_ID,
            id,
            bookmarkToData(patch),
          )
          .catch(() => toast("Couldn't update that on your account."));
      } else {
        saveBookmarks(loadBookmarks().map((b) => (b.id === id ? { ...b, ...patch } : b)));
      }
    },
    [user],
  );

  const remove = useCallback(
    (id: string) => {
      if (user) {
        setBookmarks((prev) => {
          const next = prev.filter((b) => b.id !== id);
          saveBookmarks(next);
          return next;
        });
        void databases
          .deleteDocument(DATABASE_ID, BOOKMARKS_COLLECTION_ID, id)
          .catch(() => toast("Couldn't delete that from your account."));
      } else {
        saveBookmarks(loadBookmarks().filter((b) => b.id !== id));
      }
    },
    [user],
  );

  return { bookmarks, ready, add, update, remove };
}
