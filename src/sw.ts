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

serwist.addEventListeners();
