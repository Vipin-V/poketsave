// Client-side cache of bookmark embeddings, keyed by bookmark id. Keeping
// this in the browser (rather than the bookmark record itself) means AI
// search works the same for local and cloud-synced bookmarks with no
// database schema change — the cost is that a new device has to rebuild the
// cache once before its first AI search is fully warmed up.
export type EmbeddingCache = Record<string, { hash: string; vector: number[] }>;

const KEY = "poketsave.embeddings.v1";

export function loadEmbeddingCache(): EmbeddingCache {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveEmbeddingCache(cache: EmbeddingCache) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // ponytail: quota exceeded on very large libraries silently drops the
    // write — search still works, it just re-embeds next time. Move to
    // IndexedDB if that becomes common.
  }
}

// Cheap non-cryptographic hash used only to detect "did this bookmark's
// searchable text change since it was last embedded" — collisions are
// harmless here (worst case is a stale-but-still-similar cache hit).
export function textHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
