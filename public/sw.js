// Deadline reminder push notifications. Registered from the client when the
// user turns on alerts (see AccountButton) — this file only handles what
// happens once a push actually arrives, while the app may not even be open.

self.addEventListener("push", (event) => {
  let payload = { title: "PoketSave", body: "A saved job is closing soon.", url: "/jobs" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Keep the fallback payload above.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/jobs";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
