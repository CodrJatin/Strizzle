"use client";

import * as React from "react";
import { Users } from "lucide-react";

export default function GroupsPage() {
  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Users className="size-8 text-primary" /> Study Groups
        </h1>
        <p className="text-muted-foreground">Browse and manage your active study groups and hives.</p>
      </div>
      <div className="border border-dashed border-border rounded-3xl p-12 text-center bg-card">
        <p className="text-sm text-muted-foreground">You haven't joined any hives yet. Create a new hive to get started.</p>
      </div>
    </div>
  );
}
