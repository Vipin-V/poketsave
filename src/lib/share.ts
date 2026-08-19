import { daysLeft, deadlineLabel, type Bookmark } from "./bookmarks";

function line(b: Bookmark): string {
  const bits = [b.title || b.domain];
  if (b.category === "job") {
    const meta = [b.role, b.company].filter(Boolean).join(" · ");
    if (meta) bits.push(meta);
    if (b.deadline) bits.push(`${deadlineLabel(daysLeft(b.deadline))} (apply before ${b.deadline})`);
  }
  return `${bits.join(" — ")}\n${b.url}`;
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
  const title = opts.title ?? "Pocket bookmarks";

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(
        list.length === 1 && list[0] ? { title, text: list[0].title, url: list[0].url } : { title, text },
      );
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
