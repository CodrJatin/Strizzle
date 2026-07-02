"use client";

import * as React from "react";
import { 
  Rss, Loader2, AlertCircle, Users, MessageSquare, 
  FileText, CheckSquare, Activity, Clock, ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Custom theme mapping
const themeStyles: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", border: "border-blue-500/20" },
  green: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-500/20" },
  indigo: { bg: "bg-indigo-500/10", text: "text-indigo-700 dark:text-indigo-400", border: "border-indigo-500/20" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", border: "border-rose-500/20" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-500/20" },
};

export default function FeedPage() {
  const router = useRouter();

  const { data, isLoading, isError } = api.activity.getFeed.useQuery(undefined, {
    staleTime: 30000, // 30 seconds stale time
  });

  const feedItems = data?.items || [];

  // Get user initials for avatar
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Helper: Format relative timestamp
  const formatTime = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  // Helper: Render timeline icon based on action type
  const getActionDetails = (actionType: string, meta: any) => {
    const iconClass = "size-4";
    switch (actionType) {
      case "hive_joined":
        return {
          icon: <Users className={cn(iconClass, "text-emerald-500")} />,
          bgClass: "bg-emerald-500/10 border-emerald-500/25",
          text: "joined the hive",
        };
      case "announcement_created":
        return {
          icon: <MessageSquare className={cn(iconClass, "text-blue-500")} />,
          bgClass: "bg-blue-500/10 border-blue-500/25",
          text: `posted an announcement: "${meta?.title || "New Announcement"}"`,
        };
      case "role_changed":
        return {
          icon: <Activity className={cn(iconClass, "text-purple-500")} />,
          bgClass: "bg-purple-500/10 border-purple-500/25",
          text: `updated member role to ${meta?.role || "member"}`,
        };
      case "material_created":
        return {
          icon: <FileText className={cn(iconClass, "text-amber-500")} />,
          bgClass: "bg-amber-500/10 border-amber-500/25",
          text: `shared a resource: "${meta?.title || "Course Material"}"`,
        };
      case "task_created":
        return {
          icon: <CheckSquare className={cn(iconClass, "text-indigo-500")} />,
          bgClass: "bg-indigo-500/10 border-indigo-500/25",
          text: `created a task: "${meta?.title || "Task"}"`,
        };
      default:
        return {
          icon: <Activity className={cn(iconClass, "text-zinc-500")} />,
          bgClass: "bg-zinc-500/10 border-zinc-500/25",
          text: "performed an action",
        };
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Rss className="size-6 text-primary" /> Community Feed
        </h1>
        <p className="text-xs text-muted-foreground font-semibold">
          See updates, announcements, and newly shared resources across all your study groups.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 bg-card border border-border/80 rounded-2xl">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-semibold">Loading feed updates...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-destructive bg-card border border-border/80 rounded-2xl">
          <AlertCircle className="size-8" />
          <p className="text-xs font-bold">Failed to load feed events.</p>
        </div>
      ) : feedItems.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border/80 rounded-2xl flex flex-col items-center justify-center gap-2 select-none">
          <Rss className="size-8 text-muted-foreground/60 opacity-40 mb-1" />
          <h4 className="text-sm font-bold text-foreground">Your feed is quiet</h4>
          <p className="text-xs text-muted-foreground leading-normal max-w-[240px] mx-auto">
            Updates and resource shares from your hives will appear here. Join some hives or invite teammates to get started!
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {feedItems.map((item) => {
            const action = getActionDetails(item.actionType, item.meta);
            const style = item.colorTheme && themeStyles[item.colorTheme]
              ? themeStyles[item.colorTheme]
              : themeStyles.blue;

            return (
              <div 
                key={item.id}
                onClick={() => router.push(`/hive/${item.hiveId}/overview`)}
                className="group flex items-start gap-4 p-4 border border-border/60 rounded-2xl bg-card hover:bg-muted/15 transition-all duration-200 cursor-pointer shadow-xs"
              >
                {/* Actor Avatar */}
                <Avatar className="size-9 rounded-xl border border-border/40 shrink-0">
                  <AvatarImage src={item.actor.avatarUrl || undefined} />
                  <AvatarFallback className="text-[11px] font-black rounded-xl bg-primary/10 text-primary">
                    {getInitials(item.actor.fullName)}
                  </AvatarFallback>
                </Avatar>

                {/* Event text & details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-foreground font-semibold">
                    <span className="font-bold text-foreground">{item.actor.fullName}</span>
                    <span className="text-muted-foreground font-medium">{action.text}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Hive name badge */}
                    <span className={cn(
                      "text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border",
                      style.bg,
                      style.text,
                      style.border
                    )}>
                      {item.courseCode || item.hiveName}
                    </span>

                    {/* Time marker */}
                    <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatTime(item.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Indicator icon */}
                <div className="flex items-center gap-1.5 shrink-0 self-center">
                  <div className={cn(
                    "size-8 rounded-lg flex items-center justify-center border shrink-0",
                    action.bgClass
                  )}>
                    {action.icon}
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground/45 group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
