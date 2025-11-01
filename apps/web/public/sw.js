// public/sw.js - Service worker with caching and push notifications

// Import Workbox for caching (this will be injected by next-pwa)
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/6.6.0/workbox-sw.js",
)

let CACHE_VERSION = "{{CACHE_VERSION}}" // This will be replaced during build

const IS_DEV =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  location.hostname.includes("dev")

// Only enable caching in production
if (!IS_DEV) {
  self.addEventListener("activate", function (event) {
    event.waitUntil(
      caches.keys().then(function (cacheNames) {
        // In production, only delete old caches
        return Promise.all(
          cacheNames
            .map(function (cacheName) {
              if (cacheName.indexOf(CACHE_VERSION) === -1) {
                console.log(`Deleting old cache: ${cacheName}`)
                return caches.delete(cacheName)
              }
            })
            .filter(Boolean),
        )
      }),
    )
  })

  if (workbox) {
    // Enable workbox logging in development
    workbox.setConfig({ debug: false })

    // Precache files (next-pwa will inject the manifest)
    workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || [])

    // Cache pages
    workbox.routing.registerRoute(
      /^https?.*\/$/,
      new workbox.strategies.StaleWhileRevalidate({
        cacheName: "pages-cache",
      }),
    )

    // NEVER cache AI API calls - always fetch fresh
    workbox.routing.registerRoute(
      ({ url }) => url.pathname.startsWith("/api/ai"),
      new workbox.strategies.NetworkOnly(),
    )

    // Cache other API calls (excluding /api/ai)
    workbox.routing.registerRoute(
      ({ url }) =>
        url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/api/ai") &&
        !url.pathname.startsWith("/api/messages"),
      new workbox.strategies.NetworkFirst({
        cacheName: "api-cache",
        networkTimeoutSeconds: 10,
      }),
    )

    // Cache static assets
    workbox.routing.registerRoute(
      /\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js)$/i,
      new workbox.strategies.CacheFirst({
        cacheName: "static-assets",
      }),
    )
  }
}
// Your existing push notification handlers (unchanged)
self.addEventListener("push", function (event) {
  const data = event.data.json()
  event.waitUntil(self.registration.showNotification(data.title, data))
})

self.addEventListener("notificationclick", function (event) {
  event.notification.close()

  if (event.notification.data && event.notification.data.url) {
    const url = event.notification.data.url
    event.waitUntil(
      clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then(function (clientList) {
          const targetOrigin = new URL(url).origin

          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i]
            try {
              const clientOrigin = new URL(client.url).origin
              if (clientOrigin === targetOrigin) {
                return client.focus().then(() => {
                  if (client.navigate) {
                    return client.navigate(url)
                  } else {
                    client.postMessage({ type: "NAVIGATE_TO_URL", url })
                    return client
                  }
                })
              }
            } catch (_) {
              // ignore malformed client URLs
            }
          }
          return clients.openWindow(url)
        }),
    )
  }
})
