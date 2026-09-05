import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Clock, Sparkles, Share, X, Star } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { LinkTile } from "@/components/LinkTile";
import { AddBookmarkSheet } from "@/components/AddBookmarkSheet";
import { Input } from "@/components/ui/input";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { daysLeft, extractSharedUrl, searchableText } from "@/lib/bookmarks";
import { FOLDERS } from "@/lib/collections";
import { dedupeByUrl, loadAlbumVisibility } from "@/lib/album-visibility";
import { embedTexts } from "@/lib/embed.functions";
import {
  cosineSimilarity,
  loadEmbeddingCache,
  saveEmbeddingCache,
  textHash,
} from "@/lib/embeddings";
import { rerankBookmarks } from "@/lib/rerank.functions";

// Embedding cosine scores sit well above 0 even for unrelated bookmarks, so
// embeddings only narrow the library down to a shortlist and an LLM makes the
// final relevance call on just that shortlist — cost stays flat as it grows.
const MATCH_FLOOR = 0.65;
const MAX_CANDIDATES = 20;
const EMBED_BATCH_SIZE = 20;

const AI_HINT_KEY = "poketsave.ai-search-hint-dismissed";
const SHARE_HINT_KEY = "poketsave.ios-share-hint-dismissed";

// Populated by the OS share sheet (see share_target in site.webmanifest)
// when a link is shared into the installed PWA from another app.
type ShareSearch = { url?: string | undefined; text?: string | undefined; title?: string | undefined };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): ShareSearch => ({
    url: typeof search["url"] === "string" ? search["url"] : undefined,
    text: typeof search["text"] === "string" ? search["text"] : undefined,
    title: typeof search["title"] === "string" ? search["title"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "PoketSave — Save now. Find anytime." },
      {
        name: "description",
        content:
          "A mobile bookmark vault for X posts, Reddit threads, articles and job listings — sorted into collections, with countdown alerts before applications close.",
      },
      { property: "og:title", content: "PoketSave — Save links, never lose a job deadline" },
      {
        property: "og:description",
        content:
          "Save any link on your phone, keep it in a collection, and find it again in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Library,
});

function Library() {
  const { bookmarks: allBookmarks, ready, add } = useBookmarks();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [open, setOpen] = useState(false);
  const [sharePrefill, setSharePrefill] = useState<
    { url: string; title?: string | undefined } | undefined
  >();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [libraryAlbumIds, setLibraryAlbumIds] = useState<Set<string>>(new Set());
  const [aiIds, setAiIds] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiHint, setShowAiHint] = useState(false);
  const [showShareHint, setShowShareHint] = useState(false);

  useEffect(() => {
    setLibraryAlbumIds(loadAlbumVisibility("library"));
    setShowAiHint(localStorage.getItem(AI_HINT_KEY) !== "1");

    // iOS Safari has no Web Share Target API, so an installed PWA can never
    // appear in the native Share Sheet directly — a Shortcut is the only way in.
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    setShowShareHint(isIOS && isStandalone && localStorage.getItem(SHARE_HINT_KEY) !== "1");
  }, []);

  const { url: sharedUrlParam, text: sharedTextParam, title: sharedTitleParam } = search;
  useEffect(() => {
    const sharedUrl = extractSharedUrl({
      url: sharedUrlParam,
      text: sharedTextParam,
      title: sharedTitleParam,
    });
    if (!sharedUrl) return;
    setSharePrefill({ url: sharedUrl, title: sharedTitleParam });
    setOpen(true);
    void navigate({ search: {}, replace: true });
  }, [sharedUrlParam, sharedTextParam, sharedTitleParam, navigate]);

  function dismissAiHint() {
    localStorage.setItem(AI_HINT_KEY, "1");
    setShowAiHint(false);
  }

  function dismissShareHint() {
    localStorage.setItem(SHARE_HINT_KEY, "1");
    setShowShareHint(false);
  }

  // Album bookmarks live under Albums by default — unless the album has been
  // opted into the personal library from its own page.
  const bookmarks = useMemo(
    () => dedupeByUrl(allBookmarks.filter((b) => !b.albumId || libraryAlbumIds.has(b.albumId))),
    [allBookmarks, libraryAlbumIds],
  );

  // Closed jobs/internships move out to Jobs → Closed, so they don't count here.
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookmarks) {
      const closedJob =
        (b.category === "job" || b.category === "internship") &&
        !!b.deadline &&
        daysLeft(b.deadline) < 0;
      if (closedJob) continue;
      // Internships count toward the combined "Jobs & Internships" folder.
      const key = b.category === "internship" ? "job" : b.category;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [bookmarks]);

  const favorites = useMemo(() => bookmarks.filter((b) => b.favorite).length, [bookmarks]);

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

  const results = useMemo(() => {
    if (aiIds) {
      const byId = new Map(bookmarks.map((b) => [b.id, b]));
      return aiIds.map((id) => byId.get(id)).filter((b): b is (typeof bookmarks)[number] => !!b);
    }
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return bookmarks.filter((b) => searchableText(b).toLowerCase().includes(q));
  }, [bookmarks, query, aiIds]);

  const searching = searchOpen && (query.trim().length > 0 || !!aiIds);


  // Semantic search in two passes: retrieval by cached embeddings, then an
  // LLM rerank of the shortlist.
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
    <PhoneShell
      onAdd={() => {
        setSharePrefill(undefined);
        setOpen(true);
      }}
    >
      <header className="mb-5">
        <h1 className="text-[2.5rem] leading-[0.95] font-extrabold text-balance-tight">
          Save now.
          <br />
          Find anytime.
        </h1>
      </header>

      <div className="mb-5">
        {searchOpen ? (
          <div className="relative">
            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setAiIds(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && askAi()}
              placeholder="Search, or describe what you want"
              className="glass h-12 rounded-2xl border-2 border-border pr-11 pl-10 text-sm font-medium"
            />
            <button
              type="button"
              onClick={askAi}
              disabled={!query.trim() || aiLoading}
              title="Ask AI to find it"
              className={`absolute top-1/2 right-2.5 grid size-8 -translate-y-1/2 place-items-center rounded-full border-2 border-border disabled:opacity-40 ${
                aiLoading ? "bg-primary" : "bg-card"
              }`}
            >
              <Sparkles className={`size-3.5 ${aiLoading ? "animate-pulse" : ""}`} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="glass brutal-press flex h-12 w-full items-center gap-2 rounded-2xl px-3.5 text-sm font-semibold text-muted-foreground"
          >
            <Search className="size-4" /> Search your saves
          </button>
        )}
      </div>

      {showAiHint && searchOpen && (
        <div className="glass mb-5 flex items-start gap-2 rounded-2xl bg-primary px-3 py-2.5 text-xs font-medium">
          <Sparkles className="mt-0.5 size-3.5 shrink-0" />
          <p className="flex-1">
            Can&apos;t remember the title? Describe it in your own words, then tap the spark.
          </p>
          <button type="button" onClick={dismissAiHint} aria-label="Dismiss" className="shrink-0">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {showShareHint && (
        <div className="glass mb-5 flex items-start gap-2 rounded-2xl px-3 py-2.5 text-xs text-muted-foreground">
          <Share className="mt-0.5 size-3.5 shrink-0" />
          <p className="flex-1">
            iPhone can&apos;t share straight into apps, but a one-time Shortcut fixes that: in
            Shortcuts, new shortcut → turn on &quot;Show in Share Sheet&quot; → add a URL action set
            to <span className="font-semibold text-foreground">{window.location.origin}/?url=</span>{" "}
            with Shortcut Input at the end → add &quot;Open URLs&quot; using that URL.
          </p>
          <button type="button" onClick={dismissShareHint} aria-label="Dismiss" className="shrink-0">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {expiring.length > 0 && !searching && (
        <Link
          to="/jobs"
          className="brutal-press mb-5 flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-3.5 py-3 shadow-[4px_4px_0_0_var(--border)]"
        >
          <Clock className="size-5 shrink-0 text-destructive" strokeWidth={2.6} />
          <p className="text-sm font-bold text-destructive">
            {expiring.length} application{expiring.length > 1 ? "s" : ""} closing within a week
          </p>
        </Link>
      )}

      {searching ? (
        <>
          <h2 className="mb-3 text-sm font-extrabold tracking-[0.14em] uppercase">
            Results ({results.length})
          </h2>
          {results.length === 0 ? (
            <div className="glass rounded-2xl px-6 py-10 text-center">
              <p className="text-sm font-semibold text-muted-foreground">
                Nothing matched that search.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {results.map((b) => (
                <LinkTile key={b.id} bookmark={b} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <h2 className="mb-3 text-lg font-extrabold">My Collections</h2>
          <div className="grid grid-cols-2 gap-3">
            {FOLDERS.map((f) => (
              <FolderCard
                key={f.category}
                to="/collection/$category"
                params={{ category: f.category }}
                label={f.label}
                count={counts.get(f.category) ?? 0}
                color={f.color}
                icon={f.icon}
              />
            ))}
            <FolderCard
              to="/favorites"
              label="Favourites"
              count={favorites}
              color="bg-primary"
              icon={Star}
            />
          </div>

          {ready && bookmarks.length === 0 && (
            <div className="glass mt-5 rounded-2xl px-6 py-10 text-center">
              <h3 className="text-base font-extrabold">Nothing saved yet</h3>
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                Tap the + button below — save a post, an article, or a job you want to apply to.
              </p>
            </div>
          )}
        </>
      )}

      <AddBookmarkSheet
        key={sharePrefill?.url}
        open={open}
        onOpenChange={setOpen}
        prefill={sharePrefill}
        onSave={add}
      />
    </PhoneShell>
  );
}

function FolderCard({
  to,
  params,
  label,
  count,
  color,
  icon: Icon,
}: {
  to: string;
  params?: Record<string, string>;
  label: string;
  count: number;
  color: string;
  icon: typeof Star;
}) {
  return (
    <div className="relative pt-3">
      {/* folder tab */}
      <div
        className={`absolute top-0 left-3 h-4 w-16 rounded-t-lg border-2 border-b-0 border-border ${color}`}
      />
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        to={to as any}
        params={params as never}
        className="glass brutal-press relative block rounded-2xl p-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div
            className={`grid size-11 place-items-center rounded-xl border-2 border-border ${color}`}
          >
            <Icon className="size-5 text-primary-foreground" strokeWidth={2.4} />
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            {count} link{count === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-6 text-[15px] font-extrabold text-balance-tight">{label}</p>
      </Link>
    </div>
  );
}
