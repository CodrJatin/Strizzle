"use client";

import * as React from "react";
import { Layers } from "lucide-react";

export default function DeskPage() {
  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Layers className="size-8 text-primary" /> Desk Shelf
        </h1>
        <p className="text-muted-foreground">
          This is your temporary scratchpad. Capture URLs, text notes, and files here before organizing them.
        </p>
      </div>

      <div className="border border-dashed border-border rounded-3xl p-12 text-center bg-card">
        <p className="text-sm text-muted-foreground">
          Your desk is clear. Use the quick-add options or drag files in to capture new resources.
        </p>
      </div>
    </div>
  );
}
