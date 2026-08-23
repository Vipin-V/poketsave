import { REMINDER_CATEGORIES, daysLeft, deadlineLabel, type Bookmark } from "./bookmarks";

function line(b: Bookmark): string {
  const lines = [b.title || b.domain];
  if (b.category === "job" || b.category === "internship") {
    if (b.company) lines.push(b.company);
    if (b.role) lines.push(b.role);
  }
  if (b.category === "event" && b.company) lines.push(b.company);
  lines.push(b.url);
  if (REMINDER_CATEGORIES.includes(b.category) && b.deadline) {
    const when = b.category === "event" ? `on ${b.deadline}` : `apply before ${b.deadline}`;
    lines.push(`${deadlineLabel(daysLeft(b.deadline))} (${when})`);
  }
  if (b.notes) lines.push(b.notes);
  return lines.join("\n");
}

export function shareText(list: Bookmark[], heading?: string): string {
  const body = list.map(line).join("\n\n");
  return heading ? `${heading}\n\n${body}` : body;
}

export async function shareBookmarks(
  list: Bookmark[],
  opts: { title?: string; heading?: string } = {},
): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (list.length === 0) return "failed";
  const text = shareText(list, opts.heading);
  const title = opts.title ?? "PoketSave bookmarks";

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "cancelled";
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

export async function shareLink(
  url: string,
  opts: { title?: string; text?: string } = {},
): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      const data: ShareData = { url };
      if (opts.title) data.title = opts.title;
      if (opts.text) data.text = opts.text;
      await navigator.share(data);
      return "shared";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "cancelled";
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
