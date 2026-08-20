import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Client, Databases, Query, Users, type Models } from "node-appwrite";
import webpush from "web-push";

// Runs daily via Vercel Cron (see vercel.json). Finds every personal job
// bookmark whose deadline is exactly 4 or 1 days away and pushes a
// notification to whoever saved it, if they've turned deadline alerts on.
//
// Scoped to personal bookmarks only: album bookmarks don't carry a single
// owner, and the "show this album in my Calendar" preference is stored in
// each member's own browser (localStorage), not on the server, so there's
// no server-side way to know who opted an album in. Extending this to
// albums would need that preference to move server-side first.

type BookmarkDoc = Models.Document & {
  category: string;
  title: string;
  deadline: string | null;
  applied: boolean;
  albumId: string | null;
};

const PAGE_SIZE = 100;

function daysLeft(deadline: string): number {
  const end = new Date(`${deadline}T23:59:59`);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
}

function ownerIdFromPermissions(permissions: string[]): string | null {
  for (const p of permissions) {
    const match = /^read\("user:(.+)"\)$/.exec(p);
    if (match?.[1]) return match[1];
  }
  return null;
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

  const dueBookmarks: { doc: BookmarkDoc; ownerId: string; daysLeft: 4 | 1 }[] = [];
  let cursor: string | undefined;
  for (;;) {
    const queries = [
      Query.equal("category", "job"),
      Query.equal("applied", false),
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
      if (!doc.deadline) continue;
      const left = daysLeft(doc.deadline);
      if (left !== 4 && left !== 1) continue;
      const ownerId = ownerIdFromPermissions(doc.$permissions);
      if (!ownerId) continue;
      dueBookmarks.push({ doc, ownerId, daysLeft: left });
    }

    const last = page.documents.at(-1);
    if (page.documents.length < PAGE_SIZE || !last) break;
    cursor = last.$id;
  }

  let notified = 0;
  const prefsCache = new Map<string, Models.DefaultPreferences | null>();

  for (const { doc, ownerId, daysLeft: left } of dueBookmarks) {
    if (!prefsCache.has(ownerId)) {
      try {
        prefsCache.set(ownerId, await users.getPrefs<Models.DefaultPreferences>(ownerId));
      } catch {
        prefsCache.set(ownerId, null);
      }
    }
    const prefs = prefsCache.get(ownerId);
    const subscription = prefs?.["pushSubscription"] as webpush.PushSubscription | undefined;
    if (!subscription) continue;

    const payload = JSON.stringify({
      title: doc.title || "A saved job",
      body:
        left === 1
          ? `Closes tomorrow — apply before ${doc.deadline}`
          : `Closes in ${left} days — apply before ${doc.deadline}`,
      url: `/bookmark/${doc.$id}`,
    });

    try {
      await webpush.sendNotification(subscription, payload);
      notified++;
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

  res.status(200).json({ ok: true, checked: dueBookmarks.length, notified });
}
