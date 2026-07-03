"use client";

import * as React from "react";
import { HardDrive, Trash2, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface CachedItem {
  url: string;
  name: string;
  size: string;
  sizeBytes: number;
}

export default function OfflineStoragePage() {
  const [cachedItems, setCachedItems] = React.useState<CachedItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const getFilename = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      const pathname = decodeURIComponent(url.pathname);
      const filename = pathname.substring(pathname.lastIndexOf("/") + 1);
      return filename || "Untitled Material";
    } catch (err) {
      return urlStr;
    }
  };

  const loadCache = React.useCallback(async () => {
    if (typeof window === "undefined" || !("caches" in window)) {
      setLoading(false);
      return;
    }

    try {
      const cache = await caches.open("offline-materials");
      const keys = await cache.keys();
      const items = await Promise.all(
        keys.map(async (key) => {
          const response = await cache.match(key);
          let size = "Unknown size";
          let sizeBytes = 0;
          
          if (response) {
            const contentLength = response.headers.get("content-length");
            if (contentLength) {
              const bytes = parseInt(contentLength, 10);
              sizeBytes = bytes;
              if (bytes > 1024 * 1024) {
                size = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
              } else if (bytes > 1024) {
                size = `${(bytes / 1024).toFixed(1)} KB`;
              } else {
                size = `${bytes} B`;
              }
            }
          }
          
          return {
            url: key.url,
            name: getFilename(key.url),
            size,
            sizeBytes,
          };
        })
      );
      
      setCachedItems(items);
    } catch (err) {
      console.error("Failed to read cache keys:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCache();
  }, [loadCache]);

  const handleClearData = async () => {
    if (typeof window === "undefined" || !("caches" in window)) return;
    
    try {
      await caches.delete("offline-materials");
      setCachedItems([]);
      toast.success("Offline storage cache cleared successfully");
    } catch (err) {
      toast.error("Failed to clear cache storage");
    }
  };

  const handleDeleteItem = async (url: string) => {
    if (typeof window === "undefined" || !("caches" in window)) return;

    try {
      const cache = await caches.open("offline-materials");
      const success = await cache.delete(url);
      if (success) {
        toast.success("Material removed from offline storage");
        loadCache();
      } else {
        toast.error("Failed to remove material");
      }
    } catch (err) {
      toast.error("Failed to delete item from cache");
    }
  };

  const totalSizeBytes = cachedItems.reduce((acc, item) => acc + item.sizeBytes, 0);
  const totalSizeMB = totalSizeBytes / (1024 * 1024);
  const quotaMB = 250; // Assume standard local offline storage quota of 250MB
  const currentUsedPercentage = Math.min((totalSizeMB / quotaMB) * 100, 100);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex flex-col justify-center items-center font-sans">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-4">Reading offline cache state...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans max-w-2xl">
      <div className="space-y-4">
        <div className="flex flex-col gap-1 border-b border-border pb-3">
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <HardDrive className="size-5 text-primary" /> Storage Usage
          </h1>
        </div>

        {/* Progress block */}
        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground font-semibold">Total offline data</span>
            <span className="text-md font-bold text-foreground">
              {totalSizeMB.toFixed(1)} MB <span className="text-xs text-muted-foreground font-normal">used of {quotaMB} MB</span>
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden border border-border/50">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${currentUsedPercentage}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Offline storage allows you to access crucial materials without an internet connection.
          </p>
        </div>
      </div>

      {/* Cached materials box */}
      <div className="space-y-4">
        <div className="bg-muted/10 border border-border/80 rounded-2xl p-5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-3.5">
            Cached Materials ({cachedItems.length})
          </span>

          <div className="space-y-3">
            {cachedItems.length > 0 ? (
              cachedItems.map((item) => (
                <div 
                  key={item.url}
                  className="flex items-center justify-between p-3.5 bg-card border border-border rounded-2xl hover:shadow-xs transition-shadow gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* File icon box */}
                    <div className="size-9 bg-primary/5 text-primary rounded-xl flex items-center justify-center font-bold text-[10px] border border-primary/10 shrink-0">
                      <FileText className="size-4" />
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate max-w-[280px] sm:max-w-sm" title={item.name}>
                        {item.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.size}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="flex items-center gap-1 text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100/30 dark:border-emerald-900/30 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                      <CheckCircle2 className="size-3" /> Ready
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteItem(item.url)}
                      className="size-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      title="Remove from offline"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 border border-dashed border-border rounded-xl">
                <span className="text-xs text-muted-foreground">No cached materials offline. Select download on any course materials to make them available offline.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear block */}
      <div className="pt-6 border-t border-border space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-destructive">
            Clear all offline data
          </h3>
          <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
            This will remove all cached files and reset your offline storage. You will need an active internet connection to re-download these materials.
          </p>
        </div>
        
        <Button
          onClick={handleClearData}
          disabled={cachedItems.length === 0}
          className="h-10 rounded-xl px-5 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs flex items-center gap-2 cursor-pointer border border-transparent disabled:cursor-not-allowed shadow-sm"
        >
          <Trash2 className="size-4" /> Clear all offline data
        </Button>
      </div>
    </div>
  );
}
