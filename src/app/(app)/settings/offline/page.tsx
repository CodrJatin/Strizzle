"use client";

import * as React from "react";
import { HardDrive, Trash2, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function OfflineStoragePage() {
  const [cachedItems, setCachedItems] = React.useState([
    {
      id: "1",
      name: "Advanced_Macroeconomics_Ch4.pdf",
      syncTime: "Synced 2 days ago",
      size: "8.4 MB",
    },
    {
      id: "2",
      name: "Organic_Chemistry_Lab_Manual.pdf",
      syncTime: "Synced last week",
      size: "12.1 MB",
    },
    {
      id: "3",
      name: "Syllabus_Fall2024_CompSci.pdf",
      syncTime: "Synced 3 weeks ago",
      size: "3.5 MB",
    },
  ]);

  const totalSize = 24; // MB
  const currentUsedPercentage = (totalSize / 250) * 100; // let's assume 250MB storage quota

  const handleClearData = () => {
    setCachedItems([]);
    toast.success("Offline storage cache cleared successfully");
  };

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
              {cachedItems.length > 0 ? `${totalSize} MB` : "0 MB"} <span className="text-xs text-muted-foreground font-normal">used</span>
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${cachedItems.length > 0 ? currentUsedPercentage : 0}%` }}
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
            Cached Materials
          </span>

          <div className="space-y-3">
            {cachedItems.length > 0 ? (
              cachedItems.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-card border border-border rounded-xl shadow-inner-sm hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    {/* PDF icon box */}
                    <div className="size-9 bg-rose-50 text-rose-500 rounded-lg flex items-center justify-center font-bold text-[10px] border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40">
                      PDF
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-foreground truncate max-w-[280px] sm:max-w-sm">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.syncTime} &bull; {item.size}
                      </span>
                    </div>
                  </div>
                  
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="size-3" /> Ready
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <span className="text-xs text-muted-foreground">No cached materials offline</span>
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
