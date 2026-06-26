"use client";

import * as React from "react";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="size-8 text-primary" /> Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account details, workspace preferences, and application settings.
        </p>
      </div>

      <div className="border border-dashed border-border rounded-3xl p-12 text-center bg-card">
        <p className="text-sm text-muted-foreground">
          Account options and system preferences will be available in subsequent stages.
        </p>
      </div>
    </div>
  );
}
