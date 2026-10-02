// Social CDNs (Instagram, Facebook, X, TikTok) hand out signed image URLs that
// expire after a few days. We copy cover images into our own storage and
// serve them from /api/public/thumb/<key>, so saved thumbnails never expire.

const BUCKET = "thumbnails";
const KEY_RE = /^[a-f0-9]{64}\.(jpg|png|webp|gif)$/;

export function isOwnThumb(url: string) {
  return url.startsWith("/api/public/thumb/");
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extFor(type: string) {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  return "jpg";
}

/** Download `imageUrl` and store it; returns our permanent URL, or the original on failure. */
export async function persistImage(imageUrl: string, pageUrl: string): Promise<string> {
  if (!imageUrl || isOwnThumb(imageUrl)) return imageUrl;
  try {
    const res = await fetch(imageUrl, {
      headers: { "user-agent": "Mozilla/5.0", accept: "image/*" },
      signal: AbortSignal.timeout(8000),
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return imageUrl;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > 5_000_000) return imageUrl;
    const key = `${await sha256(pageUrl)}.${extFor(type)}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(key, bytes, { contentType: type, upsert: true });
    if (error) return imageUrl;
    return `/api/public/thumb/${key}`;
  } catch {
    return imageUrl;
  }
}

export async function readThumb(key: string) {
  if (!KEY_RE.test(key)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(key);
  if (error || !data) return null;
  return data;
}
