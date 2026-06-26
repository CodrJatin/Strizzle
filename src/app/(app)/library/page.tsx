"use client";

import * as React from "react";
import { BookOpen } from "lucide-react";

export default function LibraryPage() {
  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BookOpen className="size-8 text-primary" /> My Library
        </h1>
        <p className="text-muted-foreground">
          Your permanent archive of organized study materials, documents, and notes.
        </p>
      </div>

      <div className="border border-dashed border-border rounded-3xl p-12 text-center bg-card">
        <p className="text-sm text-muted-foreground">
          No materials in your library yet. Move items here from your Desk or copy them from your study hives.
        </p>
      </div>
    </div>
  );
}
