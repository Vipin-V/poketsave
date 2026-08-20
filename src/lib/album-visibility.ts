// Per-device preference: which shared albums a user has opted into seeing
// on their personal Library and/or Calendar. Deliberately local rather than
// synced — it's a display choice, not data, and every album already
// requires sign-in to exist at all.
export type AlbumVisibilityScope = "library" | "calendar";

const KEY_PREFIX = "pocket.albumVisibility.";

export function loadAlbumVisibility(scope: AlbumVisibilityScope): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + scope);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function setAlbumVisibility(
  scope: AlbumVisibilityScope,
  albumId: string,
  enabled: boolean,
) {
  if (typeof window === "undefined") return;
  const ids = loadAlbumVisibility(scope);
  if (enabled) ids.add(albumId);
  else ids.delete(albumId);
  window.localStorage.setItem(KEY_PREFIX + scope, JSON.stringify([...ids]));
}

// Called when an album is deleted or left, so a stale preference for an
// album that's no longer reachable doesn't linger forever.
export function clearAlbumVisibility(albumId: string) {
  setAlbumVisibility("library", albumId, false);
  setAlbumVisibility("calendar", albumId, false);
}

// A bookmark added to an album via "Add to album" is a separate document
// (its own id) from wherever it was copied from, so once an opted-in album
// bookmark and its personal-library origin can both be visible on the same
// page, they need de-duplicating — same url means the same underlying link.
export function dedupeByUrl<T extends { url: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}
