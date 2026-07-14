"use client";

import * as React from "react";
import { Bell, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { DropdownSelect } from "@/components/DropdownSelect";

type NotificationLevel = "all" | "mentions" | "muted" | "highlights";

export default function NotificationsSettingsPage() {
  // Fetch user hives dynamically
  const { data: hivesList, isLoading: isLoadingHives } = api.hive.getUserHives.useQuery(
    undefined,
    { staleTime: 120000 } // Standard hives list: 2 minutes
  );

  const {
    permissionState,
    isSubscribed,
    loading: loadingPermission,
    subscribeUser,
    unsubscribeUser,
  } = useNotificationPermission();

  const [hiveSettings, setHiveSettings] = React.useState<Record<string, NotificationLevel>>({});

  const notificationOptions = [
    { value: "all", label: "All Activity" },
    { value: "mentions", label: "Mentions Only" },
    { value: "highlights", label: "Highlights" },
    { value: "muted", label: "Muted" },
  ];

  // Initialize hive settings
  React.useEffect(() => {
    if (hivesList) {
      const initialSettings: Record<string, NotificationLevel> = {};
      hivesList.forEach((hive) => {
        // Mock default to 'all' or check current state if possible
        initialSettings[hive.id] = hive.name.toLowerCase().includes("history") ? "muted" : "all";
      });
      setHiveSettings(initialSettings);
    }
  }, [hivesList]);

  const handleHiveSettingChange = (hiveId: string, value: NotificationLevel) => {
    setHiveSettings((prev) => ({
      ...prev,
      [hiveId]: value,
    }));
    toast.success("Notification preferences updated");
  };

  const getThemeColorClass = (colorTheme: string) => {
    switch (colorTheme) {
      case "purple":
        return "bg-purple-500";
      case "blue":
        return "bg-blue-500";
      case "amber":
      case "orange":
        return "bg-amber-500";
      case "green":
      case "emerald":
        return "bg-emerald-500";
      default:
        return "bg-primary";
    }
  };

  if (isLoadingHives) {
    return (
      <div className="min-h-[50vh] flex flex-col justify-center items-center font-sans">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-4">Loading notification settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans max-w-2xl">
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Notifications
        </h1>
      </div>
      {/* Global Push Toggle Box */}
      <div className="flex items-center justify-between p-5 bg-muted/10 border border-border/80 rounded-2xl">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold text-foreground">
              Global Push Notifications
            </span>
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full select-none border",
              isSubscribed
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                : "bg-muted text-muted-foreground border-border"
            )}>
              {isSubscribed ? "ENABLED" : "DISABLED"}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Receive alerts across your devices for important academic updates.
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isSubscribed}
            disabled={loadingPermission}
            onChange={() => {
              if (isSubscribed) {
                unsubscribeUser();
              } else {
                subscribeUser();
              }
            }}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
        </label>
      </div>

      {permissionState === "denied" && (
        <div className="flex items-center gap-2.5 p-4 bg-rose-50/50 text-rose-700 dark:bg-rose-950/10 dark:text-rose-450 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-xs font-semibold">
          <AlertTriangle className="size-4.5 text-rose-600 dark:text-rose-500 shrink-0" />
          <span>Browser notifications are blocked. Please reset permissions in your browser address bar to enable notifications.</span>
        </div>
      )}

      {/* Hive Notifications Configuration */}
      <div className="space-y-4 pt-2">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-foreground">
            Hive Notifications
          </h2>
          <p className="text-xs text-muted-foreground">
            Customize how you receive updates from your active study groups and subjects.
          </p>
        </div>

        <div className="space-y-3.5 mt-2">
          {hivesList && hivesList.length > 0 ? (
            hivesList.map((hive) => {
              const currentVal = hiveSettings[hive.id] || "all";
              const isMuted = currentVal === "muted";

              return (
                <div
                  key={hive.id}
                  className="flex items-center justify-between p-3.5 hover:bg-muted/10 rounded-2xl border border-border/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn("size-3 rounded-full shrink-0", getThemeColorClass(hive.colorTheme))} />
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {hive.name}
                      </span>
                      {isMuted && (
                        <span className="text-[9px] font-bold text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded-md uppercase">
                          MUTED
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <DropdownSelect
                      value={currentVal}
                      onValueChange={(val) => handleHiveSettingChange(hive.id, val as NotificationLevel)}
                      options={notificationOptions}
                      className="min-w-[140px]"
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 border border-dashed border-border rounded-2xl">
              <span className="text-xs text-muted-foreground">You are not joined in any hives yet.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
