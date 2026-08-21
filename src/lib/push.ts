import { account } from "@/integrations/appwrite/client";

export const pushSupported =
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

export type EnableResult = "enabled" | "unsupported" | "denied" | "not_configured";

// Requests notification permission, registers the service worker, and
// subscribes to push — then saves the subscription on the user's own
// Appwrite account prefs so the cron job can look it up later. Uses the
// signed-in user's own session (no admin key needed for this step).
export async function enableDeadlineAlerts(): Promise<EnableResult> {
  if (!pushSupported) return "unsupported";
  const publicKey = import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined;
  if (!publicKey) return "not_configured";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await navigator.serviceWorker.register("/sw.js");
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  // Re-fetch prefs right before writing rather than trusting a caller-held
  // user object — it may be stale from an earlier fetch, and merging onto
  // it would silently undo any other pref saved since then (e.g. the
  // notify hour or email toggle).
  const current = await account.get();
  await account.updatePrefs({ ...current.prefs, pushSubscription: subscription.toJSON() });
  return "enabled";
}

export async function disableDeadlineAlerts() {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
  const current = await account.get();
  await account.updatePrefs({ ...current.prefs, pushSubscription: null });
}

// The cron job runs on UTC hours, so the user's chosen local hour is
// converted to UTC before it's saved and converted back for display.
// Matches the default the cron falls back to when a user has no
// preference saved yet (see api/cron/deadline-notifications.ts).
export const DEFAULT_NOTIFY_HOUR_UTC = 9;

export function localHourToUtcHour(localHour: number): number {
  const d = new Date();
  d.setHours(localHour, 0, 0, 0);
  return d.getUTCHours();
}

export function utcHourToLocalHour(utcHour: number): number {
  const d = new Date();
  d.setUTCHours(utcHour, 0, 0, 0);
  return d.getHours();
}

export async function setNotifyHour(utcHour: number) {
  const current = await account.get();
  await account.updatePrefs({ ...current.prefs, notifyHour: utcHour });
}

// Email alerts need no browser permission — just a preference the cron job
// reads before emailing the account's own address.
export async function setEmailAlerts(enabled: boolean) {
  const current = await account.get();
  await account.updatePrefs({ ...current.prefs, emailAlerts: enabled });
}
