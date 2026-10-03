import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { account } from "@/integrations/appwrite/client";
import type { Category } from "@/lib/bookmarks";
import {
  BUILTIN_FOLDERS,
  NEW_USER_FOLDER_IDS,
  customLabels,
  folderKey,
  newFolderId,
  type Folder,
} from "@/lib/folders";
import { useAuth } from "./use-auth";
import { useBookmarks } from "./use-bookmarks";

const LOCAL_KEY = "poketsave.folders.v1";

type FoldersApi = {
  folders: Folder[];
  ready: boolean;
  addFolder: (f: Omit<Folder, "id" | "builtin">) => Folder;
  deleteFolder: (id: Category) => void;
  findFolder: (id: Category) => Folder;
};

const Ctx = createContext<FoldersApi | null>(null);

function parse(v: unknown): Folder[] | null {
  try {
    const arr = typeof v === "string" ? JSON.parse(v) : v;
    if (!Array.isArray(arr)) return null;
    return arr.filter((f) => f && typeof f.id === "string" && typeof f.label === "string");
  } catch {
    return null;
  }
}

function readLocal() {
  return parse(localStorage.getItem(LOCAL_KEY));
}

function mergeLists(a: Folder[], b: Folder[]) {
  const ids = new Set(a.map((f) => f.id));
  return [...a, ...b.filter((f) => !ids.has(f.id))];
}

export function FoldersProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const { bookmarks, ready: bmReady, update } = useBookmarks();
  // null = not loaded yet; [] never happens after seeding
  const [saved, setSaved] = useState<Folder[] | null>(null);
  const loaded = useRef<string | null>(null);

  // Load the saved list (account prefs when signed in, phone otherwise),
  // seeding a first-time list once bookmarks are known.
  useEffect(() => {
    if (!authReady || !bmReady) return;
    const who = user?.$id ?? "guest";
    if (loaded.current === who) return;
    loaded.current = who;
    (async () => {
      const local = readLocal();
      let list: Folder[] | null = null;
      if (user) {
        try {
          const prefs = (await account.getPrefs()) as Record<string, unknown>;
          list = parse(prefs["folders"]);
        } catch {
          list = null;
        }
        if (list && local) list = mergeLists(list, local);
        else if (!list) list = local;
      } else {
        list = local;
      }
      if (!list || list.length === 0) {
        // Existing users keep every folder they had; new users get the basics.
        list =
          bookmarks.length > 0
            ? BUILTIN_FOLDERS
            : BUILTIN_FOLDERS.filter((f) => NEW_USER_FOLDER_IDS.includes(f.id));
      }
      setSaved(list);
    })();
  }, [authReady, bmReady, user, bookmarks.length]);

  // Persist on every change.
  const persist = useCallback(
    (list: Folder[]) => {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
      if (user) {
        account
          .getPrefs()
          .then((prefs) => account.updatePrefs({ ...prefs, folders: JSON.stringify(list) }))
          .catch(() => {});
      }
    },
    [user],
  );

  // Safety net: any folder a bookmark points at always shows up.
  const folders = useMemo(() => {
    const base = saved ?? [];
    const ids = new Set(base.map((f) => f.id));
    const extra: Folder[] = [];
    for (const b of bookmarks) {
      const key = folderKey(b.category);
      if (ids.has(key)) continue;
      ids.add(key);
      extra.push(
        BUILTIN_FOLDERS.find((f) => f.id === key) ?? {
          id: key,
          label: "Folder",
          icon: "folder",
          color: "bg-folder-slate",
        },
      );
    }
    return [...base, ...extra];
  }, [saved, bookmarks]);

  useEffect(() => {
    customLabels.clear();
    for (const f of folders) if (!f.builtin) customLabels.set(f.id, f.label);
  }, [folders]);

  const addFolder = useCallback<FoldersApi["addFolder"]>(
    (f) => {
      const folder: Folder = { ...f, id: newFolderId() };
      setSaved((prev) => {
        const next = [...(prev ?? folders), folder];
        persist(next);
        return next;
      });
      return folder;
    },
    [folders, persist],
  );

  const deleteFolder = useCallback(
    (id: Category) => {
      // Never lose links: move them into Websites first.
      for (const b of bookmarks) {
        if (folderKey(b.category) === id) update(b.id, { category: "website" });
      }
      setSaved((prev) => {
        let next = (prev ?? folders).filter((f) => f.id !== id);
        if (id !== "website" && !next.some((f) => f.id === "website"))
          next = [BUILTIN_FOLDERS[0]!, ...next];
        persist(next);
        return next;
      });
    },
    [bookmarks, folders, persist, update],
  );

  const findFolder = useCallback(
    (id: Category) =>
      folders.find((f) => f.id === folderKey(id)) ??
      BUILTIN_FOLDERS.find((f) => f.id === folderKey(id)) ?? {
        id,
        label: "Folder",
        icon: "folder",
        color: "bg-folder-slate",
      },
    [folders],
  );

  return (
    <Ctx.Provider value={{ folders, ready: saved !== null, addFolder, deleteFolder, findFolder }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFolders() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFolders must be used inside FoldersProvider");
  return v;
}
