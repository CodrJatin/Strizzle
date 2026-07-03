import * as React from "react";
import { toast } from "sonner";

export function useMaterialCache() {
  const [cachedUrls, setCachedUrls] = React.useState<string[]>([]);
  const [downloadingIds, setDownloadingIds] = React.useState<Record<string, boolean>>({});

  const updateCachedList = React.useCallback(async () => {
    if (typeof window === "undefined" || !("caches" in window)) return;
    try {
      const cache = await caches.open("offline-materials");
      const keys = await cache.keys();
      setCachedUrls(keys.map((k) => k.url));
    } catch (err) {
      console.error("Failed to query cache:", err);
    }
  }, []);

  React.useEffect(() => {
    updateCachedList();
  }, [updateCachedList]);

  // Listen for CACHED messages from the service worker
  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "CACHED") {
        const { materialId, success, error } = event.data;
        
        setDownloadingIds((prev) => {
          const next = { ...prev };
          delete next[materialId];
          return next;
        });

        if (success) {
          toast.success("Material saved for offline study!");
          updateCachedList();
        } else {
          toast.error(`Download failed: ${error || "Unknown error"}`);
        }
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [updateCachedList]);

  const downloadMaterial = async (materialId: string, url: string) => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      toast.error("Offline storage is not supported in this browser.");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) {
        toast.error("Service Worker is not active yet.");
        return;
      }

      setDownloadingIds((prev) => ({ ...prev, [materialId]: true }));
      registration.active.postMessage({
        type: "CACHE_MATERIAL",
        materialId,
        url,
      });
    } catch (err: any) {
      toast.error(`Failed to trigger offline download: ${err.message}`);
    }
  };

  const isCached = React.useCallback((url: string | null | undefined) => {
    if (!url) return false;
    return cachedUrls.some((cached) => cached === url || cached.endsWith(url));
  }, [cachedUrls]);

  return {
    isCached,
    isDownloading: (materialId: string) => !!downloadingIds[materialId],
    downloadMaterial,
    refreshCache: updateCachedList,
  };
}
