export type Category = "job" | "reading" | "social" | "website";

export type Bookmark = {
  id: string;
  url: string;
  title: string;
  description?: string | undefined;
  image?: string | undefined;
  favicon?: string | undefined;
  domain: string;
  category: Category;
  tags: string[];
  notes?: string | undefined;
  createdAt: string;
  /* job fields */
  company?: string | undefined;
  role?: string | undefined;
  deadline?: string | undefined; // yyyy-mm-dd
  applied?: boolean | undefined;
  favorite?: boolean | undefined;
  /* set when this bookmark lives in a shared album instead of a personal list */
  albumId?: string | undefined;
  /* false only for album bookmarks the current user didn't add and doesn't own the album for */
  canDelete?: boolean | undefined;
};

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "job", label: "Jobs" },
  { value: "reading", label: "Reading" },
  { value: "social", label: "Social" },
  { value: "website", label: "Websites" },
];

export const categoryLabel = (c: Category) =>
  CATEGORIES.find((x) => x.value === c)?.label ?? "Websites";

const KEY = "pocket.bookmarks.v1";

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] ?? "";
  }
}

export function guessCategory(url: string): Category {
  const d = getDomain(url).toLowerCase();
  const path = url.toLowerCase();
  if (/(jobs|careers|greenhouse|lever\.co|workday|ashbyhq|wellfound|naukri|indeed)/.test(d + path))
    return "job";
  if (/(x\.com|twitter\.com|reddit\.com|instagram\.com|threads|linkedin\.com|mastodon)/.test(d))
    return "social";
  if (/(medium\.com|substack|dev\.to|blog|news|arxiv|hashnode|nytimes|theverge)/.test(d))
    return "reading";
  return "website";
}

export function normalizeUrl(input: string): string {
  const v = input.trim();
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function loadBookmarks(): Bookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Bookmark[]) : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(list: Bookmark[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("pocket:bookmarks"));
}

export function daysLeft(deadline: string): number {
  const end = new Date(`${deadline}T23:59:59`);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
}

export type Urgency = "expired" | "critical" | "soon" | "ok";

export function urgencyOf(days: number): Urgency {
  if (days < 0) return "expired";
  if (days <= 2) return "critical";
  if (days <= 7) return "soon";
  return "ok";
}

export function deadlineLabel(days: number): string {
  if (days < 0) return "Closed";
  if (days === 0) return "Last day";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

export function faviconFor(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}
