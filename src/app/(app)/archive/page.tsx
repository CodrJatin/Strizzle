"use client";

import * as React from "react";
import { Archive } from "lucide-react";

export default function ArchivePage() {
  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Archive className="size-8 text-primary" /> Archive
        </h1>
        <p className="text-muted-foreground">View your archived workspaces and resources.</p>
      </div>
      <div className="border border-dashed border-border rounded-3xl p-12 text-center bg-card">
        <p className="text-sm text-muted-foreground">Archive is currently empty.</p>
      </div>
    </div>
  );
}
