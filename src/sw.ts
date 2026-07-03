/// <reference lib="webworker" />

import { 
  Serwist,
  NetworkFirst,
  CacheFirst,
  StaleWhileRevalidate,
} from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: any;
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  navigationPreload: true,
  runtimeCaching: [
    // Custom asset caching (images, fonts, static assets)
    {
      matcher: ({ request }: { request: Request }) => 
        request.destination === "style" || 
        request.destination === "script" || 
        request.destination === "worker",
      handler: new StaleWhileRevalidate({
        cacheName: "static-resources",
      }),
    },
    {
      matcher: ({ request }: { request: Request }) => request.destination === "image",
      handler: new CacheFirst({
        cacheName: "images",
      }),
    },
    {
      matcher: ({ request }: { request: Request }) => request.destination === "font",
      handler: new CacheFirst({
        cacheName: "fonts",
      }),
    },
    // Cache-first for offline-materials (so if it's cached, serve it, otherwise fetch and cache it)
    {
      matcher: ({ request }: { request: Request }) => {
        return request.url.includes("/storage/v1/object/public/");
      },
      handler: new CacheFirst({
        cacheName: "offline-materials",
      }),
    },
    // API/tRPC routes (try network first, fallback to offline if needed)
    {
      matcher: ({ url }: { url: URL }) => url.pathname.startsWith("/api/") || url.pathname.startsWith("/trpc/"),
      handler: new NetworkFirst({
        cacheName: "api-routes",
        networkTimeoutSeconds: 5,
      }),
    },
  ],
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CACHE_MATERIAL") {
    const { materialId, url } = event.data;

    event.waitUntil(
      caches.open("offline-materials").then(async (cache) => {
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error("Fetch failed");
          await cache.put(url, response.clone());

          // Send success message back to the client
          if (event.source) {
            event.source.postMessage({
              type: "CACHED",
              materialId,
              success: true,
            });
          }
        } catch (err: any) {
          console.error("Failed to cache material in Service Worker:", err);
          if (event.source) {
            event.source.postMessage({
              type: "CACHED",
              materialId,
              success: false,
              error: err.message,
            });
          }
        }
      })
    );
  }
});

serwist.addEventListeners();
