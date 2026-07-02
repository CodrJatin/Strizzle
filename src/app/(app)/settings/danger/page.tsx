"use client";

import * as React from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function SettingsDangerPage() {
  const handleDeleteAccount = () => {
    toast.error("Account deletion must be performed by contacting support.");
  };

  return (
    <div className="space-y-6 font-sans max-w-2xl">
      <div className="border border-destructive/30 shadow-sm bg-card rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-destructive/20 bg-destructive/[0.02]">
          <h3 className="text-sm font-bold text-destructive flex items-center gap-1.5">
            <AlertTriangle className="size-4.5 stroke-[2]" />
            Advanced Settings (Danger Zone)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Destructive actions can cause permanent data loss.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border border-destructive/20 p-5 rounded-xl bg-destructive/[0.01] gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-destructive">Delete account</h4>
              <p className="text-[11px] text-muted-foreground leading-normal max-w-md">
                Once you delete your account, there is no going back. This action will permanently remove all associated settings, materials, and study context. Please be certain.
              </p>
            </div>
            <Button
              onClick={handleDeleteAccount}
              variant="destructive"
              className="rounded-xl text-xs font-semibold px-4 h-9 shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="size-3.5" />
              Delete Account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
