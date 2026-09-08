import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Client, Databases, Query, Users, type Models } from "node-appwrite";
import webpush from "web-push";

// Runs hourly via Vercel Cron (see vercel.json). Finds every personal job,
// internship or event bookmark whose deadline is exactly 4, 1 or 0 days
// away and notifies whoever saved it — by push, email, or both, depending
// on what they've turned on — but only during the one hour of the day
// (UTC) they chose, so each user gets notified once per matching bookmark
// per day rather than on every hourly run. Once a job/internship is marked
// applied, an interview/exam date can be added, which gets the same
// 4/1/0-day reminders as the original deadline did. Multiple due bookmarks
// for the same user in the same run are combined into a single digest
// email rather than one email each.
//
// Scoped to personal bookmarks only: album bookmarks don't carry a single
// owner, and the "show this album in my Calendar" preference is stored in
// each member's own browser (localStorage), not on the server, so there's
// no server-side way to know who opted an album in. Extending this to
// albums would need that preference to move server-side first.

const DEFAULT_NOTIFY_HOUR_UTC = 14;

type BookmarkDoc = Models.Document & {
  category: string;
  title: string;
  deadline: string | null;
  applied: boolean;
  interviewDate: string | null;
  albumId: string | null;
};

const PAGE_SIZE = 100;

function daysLeft(deadline: string): number {
  const [y, m, d] = deadline.split("-").map(Number);
  const end = Date.UTC(y!, m! - 1, d!);
  const now = new Date();
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((end - startOfToday) / 86_400_000);
}

function ownerIdFromPermissions(permissions: string[]): string | null {
  for (const p of permissions) {
    const match = /^read\("user:(.+)"\)$/.exec(p);
    if (match?.[1]) return match[1];
  }
  return null;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

type DigestItem = { title: string; body: string; url: string };

function digestEmailHtml(items: DigestItem[], siteUrl: string): string {
  const rows = items
    .map(
      (item) => `<tr><td style="padding:14px 0;border-bottom:1px solid #e6e6e6">
        <a href="${siteUrl}${item.url}" style="color:#0f172a;text-decoration:none;font-size:15px;font-weight:600">${escapeHtml(item.title)}</a>
        <div style="color:#64748b;font-size:13px;margin-top:2px">${escapeHtml(item.body)}</div>
      </td></tr>`,
    )
    .join("");

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;color:#0f172a">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#0d9488;font-weight:700">PoketSave</p>
    <h1 style="margin:0 0 20px;font-size:20px">${items.length} deadline${items.length === 1 ? "" : "s"} coming up</h1>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <a href="${siteUrl}/jobs" style="display:inline-block;margin-top:24px;padding:11px 22px;background:#0d9488;color:#fff;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px">Open PoketSave</a>
  </div>`;
}

async function sendDigestEmail(
  resendApiKey: string,
  from: string,
  to: string,
  items: DigestItem[],
  siteUrl: string,
) {
  const subject = items.length === 1 ? items[0]!.title : `${items.length} deadlines coming up`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html: digestEmailHtml(items, siteUrl) }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env["CRON_SECRET"]}`) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const endpoint = process.env["VITE_APPWRITE_ENDPOINT"];
  const projectId = process.env["VITE_APPWRITE_PROJECT_ID"];
  const databaseId = process.env["VITE_APPWRITE_DATABASE_ID"];
  const bookmarksCollectionId = process.env["VITE_APPWRITE_BOOKMARKS_COLLECTION_ID"];
  const apiKey = process.env["APPWRITE_API_KEY"];
  const vapidPublicKey = process.env["VITE_VAPID_PUBLIC_KEY"];
  const vapidPrivateKey = process.env["VAPID_PRIVATE_KEY"];
  const vapidSubject = process.env["VAPID_SUBJECT"];
  // Email is an independent, optional channel: if these aren't set, the
  // cron just skips email and keeps sending push as before.
  const resendApiKey = process.env["RESEND_API_KEY"];
  const resendFrom = process.env["RESEND_FROM_EMAIL"];
  const siteUrl = (
    process.env["SITE_URL"] ||
    (process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"]}` : "")
  ).replace(/\/$/, "");
  const emailConfigured = Boolean(resendApiKey && resendFrom && siteUrl);

  if (
    !endpoint ||
    !projectId ||
    !databaseId ||
    !bookmarksCollectionId ||
    !apiKey ||
    !vapidPublicKey ||
    !vapidPrivateKey ||
    !vapidSubject
  ) {
    res.status(500).json({ ok: false, error: "not_configured" });
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);
  const users = new Users(client);

  type Kind = "deadline" | "interview";
  const dueBookmarks: { doc: BookmarkDoc; ownerId: string; daysLeft: 4 | 1 | 0; kind: Kind }[] = [];
  let cursor: string | undefined;
  for (;;) {
    const queries = [
      Query.equal("category", ["job", "internship", "event"]),
      Query.isNull("albumId"),
      Query.limit(PAGE_SIZE),
    ];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await databases.listDocuments<BookmarkDoc>(
      databaseId,
      bookmarksCollectionId,
      queries,
    );

    for (const doc of page.documents) {
      const ownerId = ownerIdFromPermissions(doc.$permissions);
      if (!ownerId) continue;

      if (!doc.applied && doc.deadline) {
        const left = daysLeft(doc.deadline);
        if (left === 4 || left === 1 || left === 0) {
          dueBookmarks.push({ doc, ownerId, daysLeft: left, kind: "deadline" });
        }
      }

      if (doc.applied && doc.interviewDate && doc.category !== "event") {
        const left = daysLeft(doc.interviewDate);
        if (left === 4 || left === 1 || left === 0) {
          dueBookmarks.push({ doc, ownerId, daysLeft: left, kind: "interview" });
        }
      }
    }

    const last = page.documents.at(-1);
    if (page.documents.length < PAGE_SIZE || !last) break;
    cursor = last.$id;
  }

  let pushed = 0;
  let emailed = 0;
  const usersCache = new Map<string, Models.User<Models.DefaultPreferences> | null>();
  const emailDigests = new Map<string, { to: string; items: DigestItem[] }>();

  for (const { doc, ownerId, daysLeft: left, kind } of dueBookmarks) {
    if (!usersCache.has(ownerId)) {
      try {
        usersCache.set(ownerId, await users.get<Models.DefaultPreferences>(ownerId));
      } catch {
        usersCache.set(ownerId, null);
      }
    }
    const owner = usersCache.get(ownerId);
    const prefs = owner?.prefs;
    const subscription = prefs?.["pushSubscription"] as webpush.PushSubscription | undefined;
    // Email alerts are on by default — only an explicit `false` opts out.
    const wantsEmail =
      emailConfigured && prefs?.["emailAlerts"] !== false && Boolean(owner?.email);
    if (!subscription && !wantsEmail) continue;

    const notifyHour = Number(prefs?.["notifyHour"] ?? DEFAULT_NOTIFY_HOUR_UTC);
    if (new Date().getUTCHours() !== notifyHour) continue;

    const body =
      kind === "interview"
        ? left === 0
          ? `Interview/exam today — ${doc.interviewDate}`
          : left === 1
            ? `Interview/exam tomorrow — ${doc.interviewDate}`
            : `Interview/exam in ${left} days — ${doc.interviewDate}`
        : doc.category === "event"
          ? left === 0
            ? `Happening today — ${doc.deadline}`
            : left === 1
              ? `Happening tomorrow — ${doc.deadline}`
              : `Happening in ${left} days — ${doc.deadline}`
          : left === 0
            ? `Last day to apply — ${doc.deadline}`
            : left === 1
              ? `Closes tomorrow — apply before ${doc.deadline}`
              : `Closes in ${left} days — apply before ${doc.deadline}`;

    const url = `/bookmark/${doc.$id}`;
    const title = doc.title || "A saved link";

    if (subscription) {
      try {
        await webpush.sendNotification(subscription, JSON.stringify({ title, body, url }));
        pushed++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription is gone (browser data cleared, unsubscribed elsewhere,
          // etc.) — clear it so future runs don't keep retrying it.
          await users
            .updatePrefs(ownerId, { ...prefs, pushSubscription: null })
            .catch(() => undefined);
        }
      }
    }

    if (wantsEmail) {
      const digest = emailDigests.get(ownerId) ?? { to: owner!.email, items: [] };
      digest.items.push({ title, body, url });
      emailDigests.set(ownerId, digest);
    }
  }

  if (resendApiKey && resendFrom && siteUrl) {
    for (const { to, items } of emailDigests.values()) {
      try {
        await sendDigestEmail(resendApiKey, resendFrom, to, items, siteUrl);
        emailed++;
      } catch {
        // best-effort; a failed email shouldn't block other users' emails
      }
    }
  }

  res.status(200).json({ ok: true, checked: dueBookmarks.length, pushed, emailed });
}
