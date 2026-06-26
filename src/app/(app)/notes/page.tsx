"use client";

import * as React from "react";
import { FileText } from "lucide-react";

export default function NotesPage() {
  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FileText className="size-8 text-primary" /> Course Notes
        </h1>
        <p className="text-muted-foreground">Manage and edit your captured course notes and summaries.</p>
      </div>
      <div className="border border-dashed border-border rounded-3xl p-12 text-center bg-card">
        <p className="text-sm text-muted-foreground">No notes captured yet. Add new text notes from your Desk.</p>
      </div>
    </div>
  );
}
