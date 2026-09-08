import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { ID, Permission, Query, Role, type Models } from "appwrite";
import { loadBookmarks, saveBookmarks, type Bookmark, type Category } from "@/lib/bookmarks";
import {
  ALBUMS_COLLECTION_ID,
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
  interviewDate: string | null;
  favorite: boolean;
  albumId: string | null;
};

function docToBookmark(doc: BookmarkDoc, currentUserId: string): Bookmark {
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
    interviewDate: doc.interviewDate ?? undefined,
    favorite: doc.favorite,
    albumId: doc.albumId ?? undefined,
    // Outside an album this is always true (personal bookmarks grant the
    // owner delete on every doc). Inside an album, only the uploader and the
    // album owner get delete permission on a given bookmark document.
    canDelete: doc.$permissions.includes(Permission.delete(Role.user(currentUserId))),
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
  if ("interviewDate" in b) data["interviewDate"] = b.interviewDate ?? null;
  if ("favorite" in b) data["favorite"] = b.favorite ?? false;
  if ("albumId" in b) data["albumId"] = b.albumId ?? null;
  return data;
}

// Shared by both the initial save and the offline-retry reconciliation below,
// so a bookmark re-uploaded after a failed first attempt gets the same team
// read/update access as one that saved on the first try, instead of quietly
// falling back to owner-only permissions.
function permissionsForBookmark(
  userId: string,
  team?: { teamId: string; ownerId?: string | undefined },
) {
  if (!team) {
    return [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ];
  }
  return [
    Permission.read(Role.team(team.teamId)),
    Permission.update(Role.team(team.teamId)),
    Permission.delete(Role.user(userId)),
    ...(team.ownerId && team.ownerId !== userId
      ? [Permission.delete(Role.user(team.ownerId))]
      : []),
  ];
}

// Appwrite caps a single list call at 100 documents, so a library bigger
// than that needs multiple pages to come back in full instead of being
// silently truncated at the (default 25 / max 100) page size.
const PAGE_SIZE = 100;

async function listAllBookmarkDocs(): Promise<BookmarkDoc[]> {
  const all: BookmarkDoc[] = [];
  let cursor: string | undefined;
  for (;;) {
    const queries = [Query.orderDesc("$createdAt"), Query.limit(PAGE_SIZE)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await databases.listDocuments<BookmarkDoc>(
      DATABASE_ID,
      BOOKMARKS_COLLECTION_ID,
      queries,
    );
    all.push(...page.documents);
    const last = page.documents.at(-1);
    if (page.documents.length < PAGE_SIZE || !last) break;
    cursor = last.$id;
  }
  return all;
}

type BookmarksApi = {
  bookmarks: Bookmark[];
  ready: boolean;
  add: (b: Bookmark, teamId?: string, ownerId?: string) => void;
  update: (id: string, patch: Partial<Bookmark>) => void;
  remove: (id: string) => void;
  removeAlbumBookmarks: (albumId: string) => void;
};

const BookmarksContext = createContext<BookmarksApi | null>(null);

// Fetches and subscribes exactly once for the whole app. Everything that
// needs bookmarks (pages, and every individual BookmarkCard) reads from this
// single shared instance instead of each running its own fetch/subscription.
export function BookmarksProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  // Start empty so server and client render the same first paint; localStorage
  // is read in the effect below right after hydration.
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
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
        const documents = await listAllBookmarkDocs();
        const cloud = documents.map((doc) => docToBookmark(doc, user.$id));
        const cloudIds = new Set(cloud.map((b) => b.id));
        const cloudUrls = new Set(cloud.map((b) => b.url));
        // Only bookmarks explicitly flagged as never having synced get
        // re-uploaded here. A local bookmark missing from `cloud` without
        // that flag was synced before and has since been deleted on another
        // device/browser — re-uploading it would silently resurrect it
        // (and push it back out to every other device via realtime).
        const toUpload = local.filter(
          (b) => b.pendingSync && !cloudIds.has(b.id) && !cloudUrls.has(b.url),
        );

        // A bookmark stuck local-only because its first save failed (e.g.
        // Appwrite was unreachable) may belong to a shared album — look up
        // each album's team so it's re-created with team read/update access
        // instead of silently becoming owner-only on retry.
        const albumIds = [...new Set(toUpload.map((b) => b.albumId).filter(Boolean))] as string[];
        const albumTeams = new Map<string, { teamId: string; ownerId: string }>();
        await Promise.all(
          albumIds.map(async (albumId) => {
            try {
              const doc = await databases.getDocument<
                Models.Document & { teamId: string; ownerId: string }
              >(DATABASE_ID, ALBUMS_COLLECTION_ID, albumId);
              albumTeams.set(albumId, { teamId: doc.teamId, ownerId: doc.ownerId });
            } catch {
              // Album was deleted, or is still unreachable — falls back to
              // owner-only permissions for this bookmark below, same as before.
            }
          }),
        );

        const uploaded = await Promise.all(
          toUpload.map((b) =>
            databases.createDocument<BookmarkDoc>(
              DATABASE_ID,
              BOOKMARKS_COLLECTION_ID,
              ID.custom(b.id),
              bookmarkToData(b) as Omit<BookmarkDoc, keyof Models.Document>,
              permissionsForBookmark(user.$id, b.albumId ? albumTeams.get(b.albumId) : undefined),
            ),
          ),
        );

        const merged = [...uploaded.map((doc) => docToBookmark(doc, user.$id)), ...cloud].sort(
          (a, b) => (a.createdAt < b.createdAt ? 1 : -1),
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

      const bookmark = docToBookmark(doc, user.$id);
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
    // future member of that album's team read/update access instead of just
    // this user. Delete stays narrower: only the person who added the
    // bookmark and the album owner can remove it, everyone else can't.
    (b: Bookmark, teamId?: string, ownerId?: string) => {
      if (user) {
        // Flagged pending until the create confirms — see the reconciliation
        // effect above for why this flag matters (it's what tells a later
        // sync this bookmark still needs uploading, rather than having been
        // deleted elsewhere in the meantime).
        const pending = { ...b, pendingSync: true };
        setBookmarks((prev) => {
          const next = [pending, ...prev];
          saveBookmarks(next);
          return next;
        });
        void databases
          .createDocument<BookmarkDoc>(
            DATABASE_ID,
            BOOKMARKS_COLLECTION_ID,
            ID.custom(b.id),
            bookmarkToData(b) as Omit<BookmarkDoc, keyof Models.Document>,
            permissionsForBookmark(user.$id, teamId ? { teamId, ownerId } : undefined),
          )
          .then((doc) => {
            const synced = docToBookmark(doc, user.$id);
            setBookmarks((prev) => {
              const next = prev.map((x) => (x.id === b.id ? synced : x));
              saveBookmarks(next);
              return next;
            });
          })
          .catch(() => toast("Couldn't save that to your account — it's kept on this device."));
      } else {
        // Saved while signed out — flagged so that signing in later uploads
        // it to the account instead of dropping it when cloud data loads.
        saveBookmarks([{ ...b, pendingSync: true }, ...loadBookmarks()]);
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

  // Local-only cleanup — no Appwrite calls here. Called after an album is
  // deleted (its documents are already being removed server-side; this just
  // makes them disappear immediately instead of waiting for each realtime
  // delete event to trickle in) and after leaving an album (nothing gets
  // deleted server-side there — other members still need those documents —
  // but this session lost read access, so its cached copies are now stale
  // and would otherwise keep showing in Library/Calendar until next reload).
  const removeAlbumBookmarks = useCallback((albumId: string) => {
    setBookmarks((prev) => {
      const next = prev.filter((b) => b.albumId !== albumId);
      saveBookmarks(next);
      return next;
    });
  }, []);

  return (
    <BookmarksContext.Provider
      value={{ bookmarks, ready, add, update, remove, removeAlbumBookmarks }}
    >
      {children}
    </BookmarksContext.Provider>
  );
}

export function useBookmarks(): BookmarksApi {
  const ctx = useContext(BookmarksContext);
  if (!ctx) throw new Error("useBookmarks must be used within a BookmarksProvider");
  return ctx;
}
