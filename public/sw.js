self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload;

  try {
    payload = event.data.json();
  } catch {
    payload = {
      body: "PartsPro 有新的通知。",
      title: "PartsPro",
    };
  }

  const title = payload.title || "PartsPro";
  const options = {
    badge: payload.badge || "/pwa/badge-96.png",
    body: payload.body || "PartsPro 有新的通知。",
    data: payload.data || {},
    icon: payload.icon || "/pwa/icon-192.png",
    tag: payload.tag || payload.data?.notificationId || undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data?.targetUrl ||
    event.notification.data?.targetPath ||
    "/";
  const notificationId = event.notification.data?.notificationId;
  const url = new URL(targetUrl, self.location.origin).toString();

  event.waitUntil(
    (async () => {
      if (notificationId) {
        await fetch("/api/notifications/read", {
          body: JSON.stringify({ ids: [notificationId] }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }).catch(() => undefined);
      }

      const windowClients = await clients.matchAll({
        includeUncontrolled: true,
        type: "window",
      });

      for (const client of windowClients) {
        if ("focus" in client && new URL(client.url).origin === self.location.origin) {
          if ("navigate" in client) {
            await client.navigate(url);
          }
          await client.focus();
          client.postMessage({
            type: "partspro-notification-open",
            url,
          });
          return;
        }
      }

      if (clients.openWindow) {
        await clients.openWindow(url);
      }
    })()
  );
});
