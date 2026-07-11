"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { 
  Layers, Star, CheckSquare, Sparkles, Plus, BookOpen, 
  FileText, Link2, Upload, Calendar, ShieldAlert, ArrowRight, 
  Clock, CheckCircle, Tag, Loader2
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/trpc/client";
import { useQuickAddStore } from "@/store/quickAddStore";
import { LibraryMaterialCard, type LibraryItem } from "@/components/LibraryMaterialCard";
import { DeleteMaterialModal } from "@/components/DeleteMaterialModal";
import { CreateHiveModal } from "@/components/CreateHiveModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskDetailModal } from "@/components/TaskDetailModal";

const themeStyles: Record<string, { bg: string; text: string; border: string; accent: string; ring: string }> = {
  blue: {
    bg: "bg-blue-500/10 dark:bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-500/20 dark:border-blue-500/30",
    accent: "bg-blue-500 text-white",
    ring: "focus-within:ring-blue-500/20",
  },
  green: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/20 dark:border-emerald-500/30",
    accent: "bg-emerald-500 text-white",
    ring: "focus-within:ring-emerald-500/20",
  },
  indigo: {
    bg: "bg-indigo-500/10 dark:bg-indigo-500/10",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-500/20 dark:border-indigo-500/30",
    accent: "bg-indigo-500 text-white",
    ring: "focus-within:ring-indigo-500/20",
  },
  rose: {
    bg: "bg-rose-500/10 dark:bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-500/20 dark:border-rose-500/30",
    accent: "bg-rose-500 text-white",
    ring: "focus-within:ring-rose-500/20",
  },
  amber: {
    bg: "bg-amber-500/10 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/20 dark:border-amber-500/30",
    accent: "bg-amber-500 text-white",
    ring: "focus-within:ring-amber-500/20",
  },
};

export default function DashboardPage() {
  const openQuickAdd = useQuickAddStore((s) => s.open);
  const supabase = createClient();
  const router = useRouter();
  const utils = api.useUtils();

  // Dialog State
  const [deletingItem, setDeletingItem] = React.useState<LibraryItem | null>(null);
  const [viewingTextItem, setViewingTextItem] = React.useState<LibraryItem | null>(null);

  // Create Hive Dialog State
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  // Queries
  const { data: user } = api.user.getMe.useQuery(undefined, {
    staleTime: 900000, // 15 mins cache
  });

  const { data: hivesData, isLoading: isLoadingHives } = api.hive.getUserHives.useQuery(undefined, {
    staleTime: 120000, // Standard hives list: 2 minutes
  });

  const starredFilter = { starredOnly: true, limit: 10 };
  const { data: starredData, isLoading: isLoadingStarred } = api.library.getLibraryMaterials.useQuery(
    starredFilter,
    {
      staleTime: 120000, // 2 mins cache
    }
  );

  const hives = hivesData || [];
  const starredItems = starredData?.items || [];

  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [toggledTaskIds, setToggledTaskIds] = React.useState<Record<string, boolean>>({});

  const { data: myTasks = [], isLoading: isLoadingTasks } = api.task.getMyTasks.useQuery(undefined, {
    staleTime: 120000,
  });

  const toggleTaskStatus = api.task.updateTask.useMutation({
    onMutate: async (updated) => {
      await utils.task.getMyTasks.cancel();
      const previous = utils.task.getMyTasks.getData();

      utils.task.getMyTasks.setData(undefined, (old) => {
        if (!old) return old;
        if (updated.status === 'done') {
          return old.filter((t) => t.id !== updated.id);
        }
        return old.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)) as any;
      });

      return { previous };
    },
    onSuccess: () => {
      utils.task.getMyTasks.invalidate();
      utils.task.getUpcomingDeadlines.invalidate();
      utils.calendar.getCalendarTasks.invalidate();
    },
    onError: (_err, _updated, context) => {
      if (context?.previous) {
        utils.task.getMyTasks.setData(undefined, context.previous);
      }
      toast.error("Failed to update task.");
    },
  });

  return (
    <div className="space-y-10 font-sans max-w-7xl mx-auto pb-12 min-w-0">
      
      {/* Welcome Banner */}
      <div className="bg-card text-card-foreground border border-border rounded-2xl p-4 md:p-5 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,var(--primary),transparent_60%)] opacity-[0.04] pointer-events-none" />
        
        <div className="space-y-1 max-w-xl z-10">
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-foreground leading-tight">
            Welcome back, {user?.fullName || "User"}!
          </h1>
          <p className="text-[11px] md:text-xs text-muted-foreground leading-normal">
            Quick capture resources to your Desk shelf, organize your permanent Library archive, or check in on your hive study groups.
          </p>
        </div>

        {/* Quick Add CTA Panel */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto z-10">
          <Button 
            onClick={() => openQuickAdd("text")}
            variant="outline"
            className="rounded-xl h-9.5 border-border/60 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20 text-xs font-semibold cursor-pointer flex items-center justify-center gap-2 shadow-xs shrink-0"
          >
            <FileText className="size-4" />
            Add Note
          </Button>
          <Button 
            onClick={() => openQuickAdd("link")}
            variant="outline"
            className="rounded-xl h-9.5 border-border/60 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/20 text-xs font-semibold cursor-pointer flex items-center justify-center gap-2 shadow-xs shrink-0"
          >
            <Link2 className="size-4" />
            Add Link
          </Button>
          <Button 
            onClick={() => openQuickAdd("file")}
            className="bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl h-9.5 text-xs font-semibold cursor-pointer flex items-center justify-center gap-2 shadow-sm shrink-0"
          >
            <Upload className="size-4" />
            Upload File
          </Button>
        </div>
      </div>

      {/* Main Grid: Left column (Hives & Starred) vs Right column (Tasks sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 min-w-0">
        
        {/* Left Columns (Span 3): Main Content */}
        <div className="lg:col-span-3 space-y-10 min-w-0">
          
          {/* Study Groups (Hives) Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2.5">
                <Layers className="size-5 text-muted-foreground" />
                Active Study Groups
              </h2>
              <div className="flex items-center gap-3">
                {hives.length > 0 && (
                  <Button 
                    onClick={() => setCreateDialogOpen(true)}
                    variant="outline" 
                    className="rounded-xl h-8.5 text-xs font-semibold border-border/60 hover:bg-muted cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="size-3.5" />
                    New Hive
                  </Button>
                )}
              </div>
            </div>

            {isLoadingHives ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, idx) => (
                  <div key={idx} className="h-32 border border-border/80 rounded-2xl bg-card animate-pulse" />
                ))}
              </div>
            ) : hives.length === 0 ? (
              /* Hives Empty State */
              <div className="border border-dashed border-border/80 rounded-2xl p-8 text-center bg-card flex flex-col items-center justify-center py-10 shadow-inner">
                <div className="size-11 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/10 flex items-center justify-center mb-3 shadow-inner">
                  <Layers className="size-5.5" />
                </div>
                <h3 className="text-xs font-bold text-foreground mb-1">Not in any study hives yet</h3>
                <p className="text-[10px] text-muted-foreground max-w-xs mb-4 leading-normal">
                  Hives are collaborative student workspaces. Create a workspace to share files, links, notes and collaborate.
                </p>
                <Button 
                  onClick={() => setCreateDialogOpen(true)} 
                  variant="outline" 
                  className="text-xs rounded-xl h-8.5 px-4 border-border/60 text-foreground cursor-pointer shadow-xs hover:bg-muted"
                >
                  Create a Hive
                </Button>
              </div>
            ) : (
              /* Hives Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hives.map((item) => {
                  const styles = themeStyles[item.colorTheme] || themeStyles.blue;
                  return (
                    <div 
                      key={item.id}
                      onClick={() => router.push(`/hive/${item.id}/overview`)}
                      onMouseEnter={() => {
                        utils.hive.getHive.prefetch({ hiveId: item.id });
                        utils.hive.getHiveOverview.prefetch({ hiveId: item.id });
                      }}
                      className={cn(
                        "group p-5 border bg-card rounded-2xl flex flex-col justify-between h-36 transition-all hover:shadow-md cursor-pointer hover:border-primary/30",
                        styles.border
                      )}
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-2.5">
                          {item.courseCode && (
                            <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide uppercase", styles.bg, styles.text)}>
                              {item.courseCode}
                            </span>
                          )}
                          <span className="text-[10px] font-semibold text-muted-foreground capitalize">
                            Role: {item.role}
                          </span>
                        </div>
                        <h3 className="font-bold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-border/40 flex items-center justify-between mt-2">
                        <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="size-3" />
                          Created {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                        
                        <div className="size-7 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-muted/80">
                          <ArrowRight className="size-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Starred Study Materials Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2.5">
                <Star className="size-5 text-yellow-500 fill-yellow-500/10" />
                Starred Study Materials
              </h2>
              {starredItems.length > 0 && (
                <span className="text-xs text-muted-foreground font-semibold">
                  Pinned {starredItems.length} items
                </span>
              )}
            </div>

            {isLoadingStarred ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <LibraryMaterialCard key={idx} viewMode="grid" isShimmer={true} />
                ))}
              </div>
            ) : starredItems.length === 0 ? (
              /* Starred Materials Empty State */
              <div className="border border-dashed border-border/80 rounded-2xl p-8 text-center bg-card flex flex-col items-center justify-center py-10 shadow-inner">
                <div className="size-11 rounded-xl bg-yellow-500/10 text-yellow-500 border border-yellow-500/10 flex items-center justify-center mb-3 shadow-inner">
                  <Star className="size-5.5 fill-current" />
                </div>
                <h3 className="text-xs font-bold text-foreground mb-1">No starred materials</h3>
                <p className="text-[10px] text-muted-foreground max-w-xs mb-4 leading-normal">
                  Pin important notes, study guides, bookmark URLs, or images from your Library to view them directly here.
                </p>
                <Button onClick={() => openQuickAdd("text")} variant="outline" className="text-xs rounded-xl h-8 px-4 border-border/60 text-foreground cursor-pointer">
                  Capture Note
                </Button>
              </div>
            ) : (
              /* Starred Materials Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {starredItems.map((item: LibraryItem) => (
                  <LibraryMaterialCard
                    key={item.id}
                    item={item}
                    viewMode="grid"
                    onDeleteClick={setDeletingItem}
                    onTextOpenClick={setViewingTextItem}
                    queryFilter={starredFilter}
                  />
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column (Span 1): Sidebar Tasks */}
        <div className="lg:col-span-1 space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2 border-b border-border/40 pb-3">
              <CheckSquare className="size-5 text-muted-foreground" />
              Tasks & Deadlines
            </h2>

            <div className="border border-border/60 bg-card rounded-2xl p-5 shadow-xs space-y-4">
              {isLoadingTasks ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Loader2 className="size-5 text-primary animate-spin" />
                  <p className="text-[10px] text-muted-foreground font-bold">Loading tasks...</p>
                </div>
              ) : myTasks.length === 0 ? (
                <div className="space-y-4 text-center py-6">
                  <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/10 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle className="size-5.5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-foreground">All caught up!</h3>
                    <p className="text-[10px] text-muted-foreground leading-normal max-w-[180px] mx-auto">
                      No upcoming tasks or deadlines assigned to you.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">My Active Tasks ({myTasks.length})</p>
                  <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                    {myTasks.map((task) => {
                      const dueAtDate = task.dueAt ? new Date(task.dueAt) : null;
                      const isOverdue = dueAtDate && dueAtDate < new Date();
                      const formattedDue = dueAtDate
                        ? dueAtDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                        : null;
                      const style = task.colorTheme && themeStyles[task.colorTheme]
                        ? themeStyles[task.colorTheme]
                        : themeStyles.blue;

                      return (
                        <div 
                          key={task.id}
                          className="flex items-start gap-3 p-3 border border-border/60 rounded-xl bg-surface hover:bg-muted/15 transition-all group/task"
                        >
                          <Checkbox
                            checked={task.status === "done" || !!toggledTaskIds[task.id]}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setToggledTaskIds((prev) => ({ ...prev, [task.id]: true }));
                                setTimeout(() => {
                                  toggleTaskStatus.mutate({ id: task.id, status: "done" });
                                }, 600);
                              }
                            }}
                            className="mt-0.5 rounded-[4px] cursor-pointer"
                          />
                          <div 
                            className="min-w-0 flex-1 cursor-pointer"
                            onClick={() => setSelectedTaskId(task.id)}
                          >
                            <p className={cn(
                              "text-[11px] font-bold text-foreground leading-snug truncate group-hover/task:text-primary transition-all",
                              (task.status === "done" || toggledTaskIds[task.id]) && "line-through text-muted-foreground/60 font-semibold"
                            )}>
                              {task.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {/* Hive Badge */}
                              {task.hiveId && (
                                <span className={cn(
                                  "text-[8px] font-bold uppercase px-1 rounded-sm border shrink-0",
                                  style.bg,
                                  style.text,
                                  style.border
                                )}>
                                  {task.courseCode || task.hiveName}
                                </span>
                              )}
                              {/* Due date */}
                              {formattedDue && (
                                <span className={cn(
                                  "text-[9px] font-semibold flex items-center gap-1 shrink-0",
                                  isOverdue ? "text-rose-600 dark:text-rose-500 font-bold" : "text-muted-foreground"
                                )}>
                                  <Clock className="size-2.5 shrink-0" />
                                  {formattedDue}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => router.push("/calendar")}
                className="w-full text-xs rounded-xl h-9 hover:bg-muted border-border/60 text-foreground font-semibold cursor-pointer"
              >
                View Schedule Calendar
              </Button>
            </div>
          </div>
        </div>

      </div>

      {/* Viewing Notes & Images Dialog */}
      <Dialog open={!!viewingTextItem} onOpenChange={(open) => { if (!open) setViewingTextItem(null); }}>
        <DialogContent className="sm:max-w-lg bg-card text-card-foreground border border-border p-6 rounded-2xl shadow-xl flex flex-col max-h-[80vh]">
          <DialogHeader className="space-y-1 border-b border-border/40 pb-4 shrink-0">
            <DialogTitle className="text-lg font-bold tracking-tight">
              {viewingTextItem?.material.contentType === "image"
                ? (viewingTextItem.material.title || "Image Preview")
                : (viewingTextItem?.material.title || "Note Preview")}
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground">
              Added {viewingTextItem && new Date(viewingTextItem.addedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 flex items-center justify-center min-h-[200px]">
            {viewingTextItem?.material.contentType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  viewingTextItem.material.storagePath
                    ? supabase.storage.from("materials").getPublicUrl(viewingTextItem.material.storagePath).data.publicUrl
                    : viewingTextItem.material.ogImage || ""
                }
                alt={viewingTextItem.material.title || "Preview"}
                className="max-w-full max-h-[50vh] object-contain rounded-lg border border-border/60 shadow-xs"
              />
            ) : (
              <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap w-full">
                {viewingTextItem?.material.body}
              </div>
            )}
          </div>
          <div className="flex justify-end pt-4 border-t border-border/40 shrink-0">
            <Button variant="outline" onClick={() => setViewingTextItem(null)} className="rounded-xl px-4 h-9.5 text-xs font-semibold">
              Close Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <DeleteMaterialModal
          item={deletingItem}
          isOpen={!!deletingItem}
          onClose={() => setDeletingItem(null)}
        />
      )}

      {/* Create Hive Dialog */}
      <CreateHiveModal
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

    </div>
  );
}
