import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function MaterialPreviewLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Top Navigation & Info Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3.5 min-w-0">
          <Skeleton className="size-10 rounded-xl shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64 rounded" />
            <div className="flex gap-2">
              <Skeleton className="h-4.5 w-16 rounded" />
              <Skeleton className="h-4.5 w-24 rounded" />
              <Skeleton className="h-4.5 w-20 rounded" />
            </div>
          </div>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Skeleton className="h-9.5 w-20 rounded-xl" />
          <Skeleton className="h-9.5 w-32 rounded-xl" />
          <Skeleton className="h-9.5 w-24 rounded-xl" />
          <Skeleton className="h-9.5 w-28 rounded-xl" />
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Dynamic Preview Content */}
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-[60vh] w-full rounded-2xl border" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>

        {/* Right Side: Metadata / Side Panel */}
        <div className="space-y-6">
          <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/15">
              <Skeleton className="h-4 w-32 rounded" />
            </div>
            <div className="p-5 space-y-5">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-4 w-28 rounded" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-4 w-12 rounded" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
