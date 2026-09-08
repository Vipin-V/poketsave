import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const fetchLinkMetadata = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ url: z.string().min(3) }).parse(data))
  .handler(async ({ data }) => {
    const url = /^https?:\/\//i.test(data.url) ? data.url : `https://${data.url}`;
    let host = "";
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return { ok: false as const, url, domain: "", title: "", description: "", image: "" };
    }

    const favicon = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;

    try {
      const res = await fetch(url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; PocketBookmarks/1.0; +https://github.com/Vipin-V/poketsave) AppleWebKit/537.36",
          accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(8000),
      });
      const html = (await res.text()).slice(0, 400_000);

      const meta = (prop: string) => {
        const patterns = [
          new RegExp(
            `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`,
            "i",
          ),
          new RegExp(
            `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
            "i",
          ),
        ];
        for (const p of patterns) {
          const m = html.match(p);
          if (m?.[1]) return decode(m[1]);
        }
        return "";
      };

      const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
      let title = meta("og:title") || meta("twitter:title") || decode(titleTag.trim());
      // Social embeds (Instagram, X, Threads, ...) stuff the post caption into
      // og:title as `Name on Instagram: "caption..."` — the caption is the
      // relevant title, so use it (falling back to the "who/where" header).
      const embedCaption = title.match(/^.+ on .+?:\s*["“]([\s\S]+?)["”]?\s*\.{0,3}\s*$/);
      if (embedCaption?.[1]) title = embedCaption[1].trim() || title;
      const description =
        meta("og:description") || meta("twitter:description") || meta("description");
      let image = meta("og:image") || meta("twitter:image");
      if (image && image.startsWith("/")) image = new URL(image, url).toString();
      // Instagram/X/TikTok/Reddit serve a login or app wall to plain fetches,
      // so there's no cover image in the HTML — fall back to their oEmbed /
      // preview services so social saves still get a thumbnail.
      if (!image) image = await fallbackImage(url);

      return {
        ok: true as const,
        url,
        domain: host,
        title: title.slice(0, 200),
        description: description.slice(0, 300),
        image,
        favicon,
      };
    } catch {
      return {
        ok: false as const,
        url,
        domain: host,
        title: "",
        description: "",
        image: "",
        favicon,
      };
    }
  });

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/\s+/g, " ")
    .trim();
}
