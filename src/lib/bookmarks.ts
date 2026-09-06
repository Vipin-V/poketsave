export type Category = "job" | "internship" | "reading" | "social" | "event" | "website" | "travel" | "food";

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
  /* job/internship fields, reused for event (company -> location, deadline -> event date, applied -> attending) */
  company?: string | undefined;
  role?: string | undefined;
  deadline?: string | undefined; // yyyy-mm-dd
  applied?: boolean | undefined;
  /* set once applied, if an exam or interview gets scheduled */
  interviewDate?: string | undefined; // yyyy-mm-dd
  favorite?: boolean | undefined;
  /* set when this bookmark lives in a shared album instead of a personal list */
  albumId?: string | undefined;
  /* false only for album bookmarks the current user didn't add and doesn't own the album for */
  canDelete?: boolean | undefined;
  /* true only while this bookmark's cloud write hasn't been confirmed yet (offline create) */
  pendingSync?: boolean | undefined;
};

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "job", label: "Jobs" },
  { value: "internship", label: "Internships" },
  { value: "website", label: "Websites" },
  { value: "social", label: "Social" },
  { value: "event", label: "Events" },
  { value: "reading", label: "Reading" },
  { value: "travel", label: "Travel" },
  { value: "food", label: "Food" },
];

export const categoryLabel = (c: Category) =>
  CATEGORIES.find((x) => x.value === c)?.label ?? "Websites";

// Fields worth searching on, flattened into one string — shared by the
// plain-text filter and by AI search (which embeds this same text).
export function searchableText(
  b: Pick<Bookmark, "title" | "description" | "notes" | "domain" | "company" | "role" | "tags">,
): string {
  return [b.title, b.description, b.notes, b.domain, b.company, b.role, ...b.tags]
    .filter(Boolean)
    .join(" ");
}

// Categories whose deadline/date field should trigger push reminders and
// show up on the Calendar tab.
export const REMINDER_CATEGORIES: Category[] = ["job", "internship", "event"];

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
  if (/(internship|internshala|letsintern)/.test(d + path)) return "internship";
  if (/(jobs|careers|greenhouse|lever\.co|workday|ashbyhq|wellfound|naukri|indeed)/.test(d + path))
    return "job";
  if (/(eventbrite|meetup\.com|lu\.ma|allevents|ticketmaster|facebook\.com\/events)/.test(d + path))
    return "event";
  if (/(x\.com|twitter\.com|reddit\.com|instagram\.com|threads|linkedin\.com|mastodon)/.test(d))
    return "social";
  if (/(medium\.com|substack|dev\.to|blog|news|arxiv|hashnode|nytimes|theverge)/.test(d))
    return "reading";
  if (/(tripadvisor|booking\.com|airbnb|expedia|skyscanner|makemytrip|goibibo|uber|lyft)/.test(d))
    return "travel";
  if (/(zomato|swiggy|yelp|doordash|ubereats|grubhub|foodnetwork|allrecipes|tasty)/.test(d))
    return "food";
  return "website";
}

export function normalizeUrl(input: string): string {
  const v = input.trim();
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

// Android's share sheet fills in `url`, `text` or both depending on the
// sharing app — X/Reddit often only put the link inside `text` alongside a
// caption. Fall back through each field and pull the first http(s) link out.
export function extractSharedUrl(fields: {
  url?: string | undefined;
  text?: string | undefined;
  title?: string | undefined;
}): string | undefined {

  for (const field of [fields.url, fields.text, fields.title]) {
    const match = field?.match(/https?:\/\/\S+/);
    if (match) return match[0];
  }
  return undefined;
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

// The date a bookmark's countdown (Jobs "closing soon" list, Calendar
// "upcoming" list) should be based on. Once a job/internship is marked
// applied, the original deadline is moot — an interview/exam date, if one
// has been scheduled, takes over. Events reuse `applied` for "attending",
// so they're left out here just like before once attending is checked.
export function countdownDate(b: Bookmark): string | undefined {
  if (!REMINDER_CATEGORIES.includes(b.category)) return undefined;
  if (b.applied) return b.category !== "event" ? b.interviewDate : undefined;
  return b.deadline;
}

export function daysLeft(deadline: string): number {
  const [y, m, d] = deadline.split("-").map(Number);
  const end = new Date(y!, m! - 1, d!).getTime();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((end - startOfToday) / 86_400_000);
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

export function interviewLabel(days: number): string {
  if (days < 0) return "Interview passed";
  if (days === 0) return "Interview today";
  if (days === 1) return "Interview tomorrow";
  return `Interview in ${days} days`;
}

export function faviconFor(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}
