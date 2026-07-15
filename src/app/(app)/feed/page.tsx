"use client";

import * as React from "react";
import { 
  Rss, Loader2, AlertCircle, Clock, ChevronRight, Filter
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { createClient } from "@/lib/supabase/client";

// Import FeedItem components
import { MaterialFeedItem } from "@/components/FeedItem/MaterialFeedItem";
import { AnnouncementFeedItem } from "@/components/FeedItem/AnnouncementFeedItem";
import { TaskFeedItem } from "@/components/FeedItem/TaskFeedItem";
import { ActivityFeedItem } from "@/components/FeedItem/ActivityFeedItem";

const themeStyles: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", border: "border-blue-500/20" },
  green: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-500/20" },
  indigo: { bg: "bg-indigo-500/10", text: "text-indigo-700 dark:text-indigo-400", border: "border-indigo-500/20" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", border: "border-rose-500/20" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-500/20" },
};

export default function FeedPage() {
  const router = useRouter();
  const supabase = createClient();
  const utils = api.useUtils();

  // Dialog & Modal states
  const [viewingMaterial, setViewingMaterial] = React.useState<any | null>(null);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen] = React.useState(false);
  const [selectedHiveId, setSelectedHiveId] = React.useState<string>("all");

  // Queries
  const { data: feedData, isLoading: isLoadingFeed, isError: isErrorFeed, refetch: refetchFeed } = api.activity.getFeed.useQuery(undefined, {
    staleTime: 30000,
  });

  const { data: hivesData = [] } = api.hive.getUserHives.useQuery(undefined, {
    staleTime: 300000,
  });

  const feedItems = feedData?.items || [];

  // Filter feed items based on selected hive
  const filteredFeedItems = React.useMemo(() => {
    if (selectedHiveId === "all") return feedItems;
    return feedItems.filter((item) => item.hiveId === selectedHiveId);
  }, [feedItems, selectedHiveId]);

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
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const getActionText = (actionType: string, meta: any) => {
    switch (actionType) {
      case "hive_joined":
        return "joined the hive";
      case "announcement_created":
        return "posted an announcement";
      case "role_changed":
        return `changed ${meta?.targetName ? `${meta.targetName}'s` : "a member's"} role to ${meta?.newRole || meta?.role || "member"}`;
      case "hive_settings_updated":
        return "updated the hive settings";
      case "material_created":
        return "shared a resource";
      case "task_created":
        return "created a task";
      case "task_completed":
        return "completed a task";
      case "unit_created":
        return "added a syllabus unit";
      case "unit_updated":
        return "updated a syllabus unit";
      case "unit_deleted":
        return "deleted a syllabus unit";
      case "topic_created":
        return "added a syllabus topic";
      case "topic_updated":
        return "updated a syllabus topic";
      case "topic_deleted":
        return "deleted a syllabus topic";
      case "member_removed":
        return "removed a member from the hive";
      default:
        return `performed an action (${actionType.replace(/_/g, " ")})`;
    }
  };

  // Render attached content depending on feed item type
  const renderFeedContent = (item: any) => {
    if (!item.entity) return null;

    switch (item.entityType) {
      case "material":
        return item.entity.material ? (
          <MaterialFeedItem 
            material={item.entity.material} 
            onPreviewClick={(m) => setViewingMaterial(m)} 
          />
        ) : (
          <div className="mt-2.5 text-xs text-muted-foreground italic bg-muted/20 border border-border/40 rounded-xl p-3">
            This shared material is no longer available.
          </div>
        );

      case "announcement":
        return item.entity.announcement ? (
          <AnnouncementFeedItem 
            announcement={item.entity.announcement} 
          />
        ) : (
          <div className="mt-2.5 text-xs text-muted-foreground italic bg-muted/20 border border-border/40 rounded-xl p-3">
            This announcement has been deleted.
          </div>
        );

      case "task":
        return item.entity.task ? (
          <TaskFeedItem 
            task={item.entity.task} 
            onTaskClick={(taskId) => {
              setSelectedTaskId(taskId);
              setTaskModalOpen(true);
            }} 
          />
        ) : (
          <div className="mt-2.5 text-xs text-muted-foreground italic bg-muted/20 border border-border/40 rounded-xl p-3">
            This task has been deleted.
          </div>
        );

      default:
        return (
          <ActivityFeedItem 
            actionType={item.actionType} 
            meta={item.meta} 
          />
        );
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Rss className="size-6 text-primary" /> Community Feed
          </h1>
          <p className="text-xs text-muted-foreground font-semibold">
            See updates, announcements, and newly shared resources across all your study groups.
          </p>
        </div>
      </div>

      {/* Hive Filters / Tabs */}
      {hivesData.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none shrink-0">
          <Button
            onClick={() => setSelectedHiveId("all")}
            variant={selectedHiveId === "all" ? "default" : "outline"}
            size="xs"
            className="rounded-full px-4.5 font-bold text-xs shrink-0 cursor-pointer h-8"
          >
            All Hives
          </Button>
          {hivesData.map((hive) => {
            const isSelected = selectedHiveId === hive.id;
            const style = hive.colorTheme && themeStyles[hive.colorTheme]
              ? themeStyles[hive.colorTheme]
              : themeStyles.blue;

            return (
              <Button
                key={hive.id}
                onClick={() => setSelectedHiveId(hive.id)}
                variant={isSelected ? "default" : "outline"}
                size="xs"
                className={cn(
                  "rounded-full px-4.5 font-bold text-xs shrink-0 cursor-pointer h-8 transition-all",
                  !isSelected && cn(
                    "hover:bg-muted border-border/80",
                    hive.colorTheme === "green" && "hover:border-emerald-500/30 hover:text-emerald-600 dark:hover:text-emerald-400",
                    hive.colorTheme === "indigo" && "hover:border-indigo-500/30 hover:text-indigo-600 dark:hover:text-indigo-400",
                    hive.colorTheme === "rose" && "hover:border-rose-500/30 hover:text-rose-600 dark:hover:text-rose-400",
                    hive.colorTheme === "amber" && "hover:border-amber-500/30 hover:text-amber-600 dark:hover:text-amber-400"
                  )
                )}
              >
                {hive.courseCode || hive.name}
              </Button>
            );
          })}
        </div>
      )}

      {/* Feed Loader states */}
      {isLoadingFeed ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 bg-card border border-border/80 rounded-2xl">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-semibold">Loading feed updates...</p>
        </div>
      ) : isErrorFeed ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-destructive bg-card border border-border/80 rounded-2xl">
          <AlertCircle className="size-8" />
          <p className="text-xs font-bold">Failed to load feed events.</p>
        </div>
      ) : filteredFeedItems.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border/80 rounded-2xl flex flex-col items-center justify-center gap-2 select-none">
          <Rss className="size-8 text-muted-foreground/60 opacity-40 mb-1" />
          <h4 className="text-sm font-bold text-foreground">Your feed is quiet</h4>
          <p className="text-xs text-muted-foreground leading-normal max-w-[240px] mx-auto">
            No updates found here. Join some hives or filter other groups to get started!
          </p>
        </div>
      ) : (
      <motion.div layout className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredFeedItems.map((item) => {
              const style = item.colorTheme && themeStyles[item.colorTheme]
                ? themeStyles[item.colorTheme]
                : themeStyles.blue;

              return (
                <motion.div 
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="flex gap-4 p-4 border border-border/60 rounded-2xl bg-card hover:bg-muted/5 transition-all duration-200 shadow-xs relative group"
                >
                  {/* Timeline left line connector */}
                  <div className="flex flex-col items-center shrink-0">
                    <Avatar className="size-9 rounded-xl border border-border/40 shadow-xs">
                      <AvatarImage src={item.actor.avatarUrl || undefined} />
                      <AvatarFallback className="text-[11px] font-black rounded-xl bg-primary/10 text-primary">
                        {getInitials(item.actor.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="w-0.5 bg-border/40 grow rounded-full mt-2.5 group-hover:bg-border/60 transition-colors" />
                  </div>

                  {/* Feed content & actions */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                        <span className="font-bold text-foreground">{item.actor.fullName}</span>
                        <span className="text-muted-foreground font-medium">
                          {getActionText(item.actionType, item.meta)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Hive code/name badge */}
                        <span className={cn(
                          "text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border shrink-0",
                          style.bg,
                          style.text,
                          style.border
                        )}>
                          {item.courseCode || item.hiveName}
                        </span>

                        {/* Timestamp */}
                        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 shrink-0">
                          <Clock className="size-3" />
                          {formatTime(item.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Attached entity body (Material, Task, Announcement) */}
                    <div className="w-full">
                      {renderFeedContent(item)}
                    </div>
                  </div>
                </motion.div>
              );
            })}
            </AnimatePresence>
          </motion.div>
      )}

      {/* Text/Image Preview Dialog */}
      <Dialog open={!!viewingMaterial} onOpenChange={(open) => { if (!open) setViewingMaterial(null); }}>
        <DialogContent className="sm:max-w-lg bg-card text-card-foreground border border-border p-6 rounded-2xl shadow-xl flex flex-col max-h-[80vh]">
          <DialogHeader className="space-y-1 border-b border-border/40 pb-4 shrink-0">
            <DialogTitle className="text-base font-bold tracking-tight">
              {viewingMaterial?.contentType === "image"
                ? (viewingMaterial.title || "Image Preview")
                : (viewingMaterial?.title || "Note Preview")}
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground">
              Shared {viewingMaterial && new Date(viewingMaterial.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 flex items-center justify-center min-h-[200px]">
            {viewingMaterial?.contentType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  viewingMaterial.storagePath
                    ? supabase.storage.from("materials").getPublicUrl(viewingMaterial.storagePath).data.publicUrl
                    : viewingMaterial.ogImage || ""
                }
                alt={viewingMaterial.title || "Preview"}
                className="max-w-full max-h-[50vh] object-contain rounded-lg border border-border/60 shadow-xs"
              />
            ) : (
              <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap w-full">
                {viewingMaterial?.body}
              </div>
            )}
          </div>
          <div className="flex justify-end pt-4 border-t border-border/40 shrink-0">
            <Button variant="outline" onClick={() => setViewingMaterial(null)} className="rounded-xl px-4 h-9.5 text-xs font-semibold">
              Close Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Details Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          isOpen={taskModalOpen}
          onClose={() => {
            setTaskModalOpen(false);
            setSelectedTaskId(null);
            refetchFeed(); // Refetch feed to reflect any updates to task status/priorities
          }}
        />
      )}
    </div>
  );
}

