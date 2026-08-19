import { useCallback, useEffect, useState } from "react";
import { loadBookmarks, saveBookmarks, type Bookmark } from "@/lib/bookmarks";

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setBookmarks(loadBookmarks());
    sync();
    setReady(true);
    window.addEventListener("pocket:bookmarks", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("pocket:bookmarks", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const add = useCallback((b: Bookmark) => {
    saveBookmarks([b, ...loadBookmarks()]);
  }, []);

  const update = useCallback((id: string, patch: Partial<Bookmark>) => {
    saveBookmarks(loadBookmarks().map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const remove = useCallback((id: string) => {
    saveBookmarks(loadBookmarks().filter((b) => b.id !== id));
  }, []);

  return { bookmarks, ready, add, update, remove };
}
