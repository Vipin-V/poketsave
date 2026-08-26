import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Clock, Sparkles, X } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { BookmarkCard } from "@/components/BookmarkCard";
import { AddBookmarkSheet } from "@/components/AddBookmarkSheet";
import { Input } from "@/components/ui/input";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { CATEGORIES, daysLeft, searchableText, type Category } from "@/lib/bookmarks";
import { dedupeByUrl, loadAlbumVisibility } from "@/lib/album-visibility";
import { embedTexts } from "@/lib/embed.functions";
import {
  cosineSimilarity,
  loadEmbeddingCache,
  saveEmbeddingCache,
  textHash,
} from "@/lib/embeddings";
import { rerankBookmarks } from "@/lib/rerank.functions";

// Embedding cosine scores sit well above 0 even for unrelated bookmarks and
// don't separate "real match" from "noise" cleanly enough on their own (e.g.
// a cloud-learning reel can score close to a government-job posting for a
// "government job" query). So embeddings only narrow the whole library down
// to a shortlist — below MATCH_FLOOR there's nothing worth asking about at
// all — and an LLM makes the final relevance call on just that shortlist.
// Bounded shortlist size keeps cost flat no matter how big the library gets.
const MATCH_FLOOR = 0.65;
const MAX_CANDIDATES = 20;
const EMBED_BATCH_SIZE = 20;

const AI_HINT_KEY = "poketsave.ai-search-hint-dismissed";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PoketSave" },
      {
        name: "description",
        content:
          "A mobile bookmark vault for X posts, Reddit threads, articles and job listings — with countdown alerts before applications close.",
      },
      { property: "og:title", content: "PoketSave — Save links, never lose a job deadline" },
      {
        property: "og:description",
        content:
          "Save any link on your phone and find it again in seconds. Job deadlines included.",
      },
    ],
  }),
  component: Library,
});

function Library() {
  const { bookmarks: allBookmarks, ready, add } = useBookmarks();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Category | "all">("all");
  const [libraryAlbumIds, setLibraryAlbumIds] = useState<Set<string>>(new Set());
  const [aiIds, setAiIds] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiHint, setShowAiHint] = useState(false);

  // Client-only: matches the read-after-hydration pattern used for the
  // localStorage-backed guest bookmark list, avoiding an SSR/client mismatch.
  useEffect(() => {
    setLibraryAlbumIds(loadAlbumVisibility("library"));
    setShowAiHint(localStorage.getItem(AI_HINT_KEY) !== "1");
  }, []);

  function dismissAiHint() {
    localStorage.setItem(AI_HINT_KEY, "1");
    setShowAiHint(false);
  }

  // Album bookmarks live under Albums by default — unless the album has been
  // opted into the personal library from its own page. De-duped by url: an
  // album bookmark "added to album" from a personal one is a separate copy,
  // so an opted-in album can otherwise list the same link twice.
  const bookmarks = useMemo(
    () => dedupeByUrl(allBookmarks.filter((b) => !b.albumId || libraryAlbumIds.has(b.albumId))),
    [allBookmarks, libraryAlbumIds],
  );

  const expiring = useMemo(
    () =>
      bookmarks.filter(
        (b) =>
          (b.category === "job" || b.category === "internship") &&
          b.deadline &&
          !b.applied &&
          daysLeft(b.deadline) >= 0 &&
          daysLeft(b.deadline) <= 7,
      ),
    [bookmarks],
  );

  const visible = useMemo(() => {
    const byFilter = bookmarks.filter((b) => filter === "all" || b.category === filter);

    if (aiIds) {
      const byId = new Map(byFilter.map((b) => [b.id, b]));
      return aiIds.map((id) => byId.get(id)).filter((b): b is (typeof byFilter)[number] => !!b);
    }

    const q = query.trim().toLowerCase();
    if (!q) return byFilter;
    return byFilter.filter((b) => searchableText(b).toLowerCase().includes(q));
  }, [bookmarks, query, filter, aiIds]);

  // Semantic search in two passes: (1) retrieval — each bookmark's text is
  // embedded once (cached in localStorage, keyed by a hash of that text so
  // an edit re-embeds it), the query is embedded, and cosine similarity
  // narrows the whole library down to a shortlist; (2) an LLM reranks just
  // that shortlist for the final relevance call. Neither pass ever sends
  // the full bookmark list anywhere, so cost stays flat as the library grows.
  async function askAi() {
    const q = query.trim();
    if (!q) return;
    dismissAiHint();
    setAiLoading(true);
    try {
      const cache = loadEmbeddingCache();
      const withText = bookmarks.map((b) => ({ id: b.id, text: searchableText(b) }));
      const missing = withText.filter(({ id, text }) => cache[id]?.hash !== textHash(text));

      for (let i = 0; i < missing.length; i += EMBED_BATCH_SIZE) {
        const batch = missing.slice(i, i + EMBED_BATCH_SIZE);
        const { vectors } = await embedTexts({
          data: { texts: batch.map((m) => m.text), taskType: "RETRIEVAL_DOCUMENT" },
        });
        batch.forEach((m, j) => {
          const vector = vectors[j];
          if (vector) cache[m.id] = { hash: textHash(m.text), vector };
        });
        saveEmbeddingCache(cache);
      }

      const { vectors: queryVectors } = await embedTexts({
        data: { texts: [q], taskType: "RETRIEVAL_QUERY" },
      });
      const queryVector = queryVectors[0];
      if (!queryVector) {
        setAiIds([]);
        return;
      }

      const scored = bookmarks
        .map((b) => ({ id: b.id, entry: cache[b.id] }))
        .filter((x): x is { id: string; entry: { hash: string; vector: number[] } } => !!x.entry)
        .map((x) => ({ id: x.id, score: cosineSimilarity(queryVector, x.entry.vector) }))
        .sort((a, b) => b.score - a.score);

      const topScore = scored[0]?.score ?? 0;
      if (topScore < MATCH_FLOOR) {
        setAiIds([]);
        return;
      }

      const shortlist = scored.slice(0, MAX_CANDIDATES);
      const byId = new Map(withText.map((w) => [w.id, w.text]));
      const { ids } = await rerankBookmarks({
        data: {
          query: q,
          candidates: shortlist.map((s) => ({
            id: s.id,
            text: (byId.get(s.id) ?? "").slice(0, 500),
          })),
        },
      });
      setAiIds(ids);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <PhoneShell onAdd={() => setOpen(true)}>
      <header className="mb-5">
        <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">PoketSave</p>
        <h1 className="mt-1 text-3xl font-bold text-balance-tight">
          Your saved corner of the internet
        </h1>
      </header>

      <div className="relative mb-4">
        <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setAiIds(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && askAi()}
          placeholder="Search, or describe what you're looking for"
          className="glass h-12 rounded-2xl pl-10 pr-11"
        />
        <button
          type="button"
          onClick={askAi}
          disabled={!query.trim() || aiLoading}
          title="Ask AI to find it"
          className={`absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-200 disabled:opacity-40 disabled:hover:scale-100 ${
            aiLoading
              ? "neon-glow bg-primary text-primary-foreground"
              : "bg-primary/12 text-primary enabled:hover:scale-110 enabled:hover:bg-primary/20 enabled:active:bg-primary enabled:active:text-primary-foreground"
          }`}
        >
          <Sparkles className={`size-3.5 ${aiLoading ? "animate-pulse" : ""}`} />
        </button>
      </div>

      {showAiHint && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <p className="flex-1">
            Can't remember the title? Describe it in your own words, then tap the spark to search
            with AI.
          </p>
          <button
            type="button"
            onClick={dismissAiHint}
            aria-label="Dismiss"
            className="shrink-0 text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {expiring.length > 0 && (
        <Link
          to="/jobs"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-warn/40 bg-warn/10 px-3.5 py-3"
        >
          <Clock className="size-4 shrink-0 text-warn" />
          <p className="text-sm text-foreground">
            <span className="font-semibold text-warn">{expiring.length}</span> application
            {expiring.length > 1 ? "s" : ""} closing within a week
          </p>
        </Link>
      )}

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {(["all", ...CATEGORIES.map((c) => c.value)] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setFilter(v)}
            className={`min-h-9 shrink-0 rounded-full border px-3.5 text-xs font-medium transition-colors ${
              filter === v
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {v === "all" ? "All" : CATEGORIES.find((c) => c.value === v)!.label}
          </button>
        ))}
      </div>

      {ready && visible.length === 0 ? (
        <div className="glass mt-8 rounded-3xl px-6 py-12 text-center">
          <h2 className="text-lg font-semibold">
            {bookmarks.length === 0 ? "Nothing saved yet" : "No matches"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {bookmarks.length === 0
              ? "Tap the + button and paste any link — a post, an article, or a job you want to apply to."
              : "Try a different search or filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((b) => (
            <BookmarkCard key={b.id} bookmark={b} />
          ))}
        </div>
      )}

      <AddBookmarkSheet open={open} onOpenChange={setOpen} onSave={add} />
    </PhoneShell>
  );
}
