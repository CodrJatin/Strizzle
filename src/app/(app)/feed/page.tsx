"use client";

import * as React from "react";
import { Rss } from "lucide-react";

export default function FeedPage() {
  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Rss className="size-8 text-primary" /> Community Feed
        </h1>
        <p className="text-muted-foreground">
          See updates, announcements, and newly shared resources across all your study groups.
        </p>
      </div>

      <div className="border border-dashed border-border rounded-3xl p-12 text-center bg-card">
        <p className="text-sm text-muted-foreground">
          Your community feed is quiet. Join some hives or invite classmates to get started.
        </p>
      </div>
    </div>
  );
}
