"use client";

import * as React from "react";
import { 
  BookOpen, CheckSquare, Users, Bell, FileText, Tag, 
  Calendar, AlertCircle, ChevronRight, Loader2, Info
} from "lucide-react";
import { toast } from "sonner";
import type { ShelfItem } from "@/components/ShelfItemCard";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useModalKeybinds } from "@/hooks/useModalKeybinds";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface DeskActionModalProps {
  item: ShelfItem;
  isOpen: boolean;
  onClose: () => void;
}

type ActionType = "library" | "task" | "note" | "hive" | "announcement";
type LifecycleType = "keep" | "library" | "remove";

export function DeskActionModal({ item, isOpen, onClose }: DeskActionModalProps) {
  const utils = api.useUtils();
  const { material } = item;

  // State
  const [selectedAction, setSelectedAction] = React.useState<ActionType>("library");
  const [lifecycle, setLifecycle] = React.useState<LifecycleType>("remove");
  const [submitting, setSubmitting] = React.useState(false);

  // Form Fields - Save to Library / Notes
  const [tagsInput, setTagsInput] = React.useState(material.tags?.join(", ") || "");

  // Form Fields - Convert to Task
  const [taskTitle, setTaskTitle] = React.useState(material.title || material.fileName || "");
  const [taskDesc, setTaskDesc] = React.useState(
    material.contentType === "text" 
      ? material.body || "" 
      : material.contentType === "link" || material.contentType === "youtube"
      ? `${material.url || ""}\n\n${material.ogDescription || ""}`
      : `File: ${material.fileName || ""}\nSize: ${material.fileSize || ""}`
  );
  const [taskPriority, setTaskPriority] = React.useState<"low" | "medium" | "high" | "urgent">("medium");
  const [taskDueDate, setTaskDueDate] = React.useState("");

  // Form Fields - Share to Hive
  const [selectedHive, setSelectedHive] = React.useState("");
  const [selectedFolder, setSelectedFolder] = React.useState("");

  // Form Fields - Post Announcement
  const [announcementTitle, setAnnouncementTitle] = React.useState(`New Resource: ${material.title || "Untitled"}`);
  const [announcementBody, setAnnouncementBody] = React.useState(
    material.contentType === "text" 
      ? material.body || "" 
      : `Check out this captured resource: ${material.url || ""}`
  );

  // Queries
  const { data: hivesData, isLoading: isLoadingHives } = api.hive.getUserHives.useQuery(undefined, {
    staleTime: 120000,
  });

  const hives = hivesData || [];

  // Filter hives based on role for each action type
  const allowedHives = React.useMemo(() => {
    if (selectedAction === "hive") {
      return hives.filter(h => h.role === "owner" || h.role === "admin" || h.role === "member");
    }
    if (selectedAction === "announcement") {
      return hives.filter(h => h.role === "owner" || h.role === "admin");
    }
    return hives;
  }, [hives, selectedAction]);

  // Set default selected hive when allowedHives changes
  React.useEffect(() => {
    if (allowedHives.length > 0) {
      const exists = allowedHives.some(h => h.id === selectedHive);
      if (!exists) {
        setSelectedHive(allowedHives[0].id);
      }
    } else {
      setSelectedHive("");
    }
  }, [allowedHives, selectedHive]);

  // Fetch folders for selected hive
  const { data: foldersData, isLoading: isLoadingFolders } = api.folder.getHiveFolders.useQuery(
    { hiveId: selectedHive },
    {
      enabled: !!selectedHive && selectedAction === "hive",
      staleTime: 300000,
    }
  );

  const folders = foldersData?.items || [];

  // Reset folder selection when hive changes
  React.useEffect(() => {
    setSelectedFolder("");
  }, [selectedHive]);

  // Mutations
  const addToLibrary = api.library.addToLibrary.useMutation();
  const updateMaterial = api.material.updateMaterial.useMutation();
  const createTask = api.task.createTask.useMutation();
  const shareMaterialToHive = api.hiveMaterial.shareMaterialToHive.useMutation();
  const createAnnouncement = api.announcement.createAnnouncement.useMutation();
  const deleteShelfItem = api.shelf.deleteShelfItem.useMutation({
    onMutate: async (variables) => {
      await utils.shelf.getShelfItems.cancel();
      const previous = utils.shelf.getShelfItems.getData();
      utils.shelf.getShelfItems.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter(i => i.id !== variables.id);
      });
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        utils.shelf.getShelfItems.setData(undefined, context.previous);
      }
      toast.error("Failed to remove item from desk");
    },
    onSuccess: () => {
      utils.shelf.getShelfItems.invalidate();
    }
  });

  const moveToLibrary = api.shelf.moveToLibrary.useMutation({
    onMutate: async (variables) => {
      await utils.shelf.getShelfItems.cancel();
      const previous = utils.shelf.getShelfItems.getData();
      utils.shelf.getShelfItems.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter(i => i.id !== variables.shelfItemId);
      });
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        utils.shelf.getShelfItems.setData(undefined, context.previous);
      }
      toast.error("Failed to move item to library");
    },
    onSuccess: () => {
      utils.library.getLibraryMaterials.invalidate();
    },
    onSettled: () => {
      utils.shelf.getShelfItems.invalidate();
    }
  });

  // Filter actions based on content type per PRD matrix
  const getAvailableActions = (): { type: ActionType; label: string; desc: string; icon: React.ComponentType<any> }[] => {
    const allActions = [
      { 
        type: "library" as ActionType, 
        label: "Save to Library", 
        desc: "Save to your personal library index.", 
        icon: BookOpen 
      },
      { 
        type: "task" as ActionType, 
        label: "Convert to Task", 
        desc: "Add as a task on your calendar.", 
        icon: CheckSquare 
      },
      { 
        type: "note" as ActionType, 
        label: "Save as Personal Note", 
        desc: "Save as text note in library.", 
        icon: FileText 
      },
      { 
        type: "hive" as ActionType, 
        label: "Share to Hive", 
        desc: "Publish material into a study group.", 
        icon: Users 
      },
      { 
        type: "announcement" as ActionType, 
        label: "Post Announcement", 
        desc: "Alert members with a feed post.", 
        icon: Bell 
      },
    ];

    switch (material.contentType) {
      case "text":
        // All actions available for text
        return allActions;
      case "link":
      case "youtube":
        // Everything except save as personal note
        return allActions.filter(a => a.type !== "note");
      case "file":
      case "image":
        // Share to Hive, Save to Library, Convert to Task
        return allActions.filter(a => a.type === "library" || a.type === "task" || a.type === "hive");
      default:
        return [allActions[0]];
    }
  };

  // Adjust defaults when action changes
  React.useEffect(() => {
    if (selectedAction === "library" || selectedAction === "note") {
      setLifecycle("remove"); // Default to remove after saving to library
    } else if (selectedAction === "task" || selectedAction === "hive" || selectedAction === "announcement") {
      setLifecycle("library"); // Default to move to library after sharing/converting
    }
  }, [selectedAction]);

  const parseTags = (inputStr: string): string[] => {
    return inputStr
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  };

  useModalKeybinds(isOpen, () => {
    handleSubmit();
  });

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onClose();

    // Optimistically update the desk shelf cache immediately
    const previousShelfItems = utils.shelf.getShelfItems.getData();
    if (lifecycle === "remove" || lifecycle === "library") {
      utils.shelf.getShelfItems.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter(i => i.id !== item.id);
      });
    }

    // Process the operations in the background
    (async () => {
      try {
        // 1. Execute Core Conversion Action
        if (selectedAction === "library" || selectedAction === "note") {
          // Save to Library
          await addToLibrary.mutateAsync({ materialId: material.id });
          
          // Update tags if modified
          const tags = parseTags(tagsInput);
          const tagsChanged = JSON.stringify(tags) !== JSON.stringify(material.tags);
          if (tagsChanged) {
            await updateMaterial.mutateAsync({
              id: material.id,
              tags,
            });
          }
          toast.success("Saved to Library!");
        } else if (selectedAction === "task") {
          // Convert to Task
          await createTask.mutateAsync({
            title: taskTitle,
            description: taskDesc || null,
            priority: taskPriority,
            dueAt: taskDueDate ? new Date(taskDueDate).toISOString() : null,
            source: "shelf_converted",
            sourceRefId: material.id,
          });
          toast.success("Task created successfully!");
        } else if (selectedAction === "hive") {
          // Share to Hive
          if (!selectedHive) {
            throw new Error("No study hive group selected.");
          }
          await shareMaterialToHive.mutateAsync({
            materialId: material.id,
            hiveId: selectedHive,
            folderId: selectedFolder || null,
          });
          toast.success("Material shared to hive successfully!");
        } else if (selectedAction === "announcement") {
          // Post Announcement
          if (!selectedHive) {
            throw new Error("No study hive target selected.");
          }
          await createAnnouncement.mutateAsync({
            hiveId: selectedHive,
            title: announcementTitle,
            body: announcementBody,
          });
          toast.success("Announcement posted successfully!");
        }

        // 2. Execute Post-Action Lifecycle Choice
        if (lifecycle === "remove") {
          await deleteShelfItem.mutateAsync({ id: item.id });
        } else if (lifecycle === "library") {
          await moveToLibrary.mutateAsync({ shelfItemId: item.id });
        }

        // 3. Invalidate caches
        utils.shelf.getShelfItems.invalidate();
        utils.library.getLibraryMaterials.invalidate();

        if (selectedAction === "hive") {
          utils.hiveMaterial.getHiveMaterials.invalidate({ hiveId: selectedHive });
          utils.hive.getHiveOverview.invalidate({ hiveId: selectedHive });
        } else if (selectedAction === "announcement") {
          utils.hive.getHiveOverview.invalidate({ hiveId: selectedHive });
        }
      } catch (err: any) {
        console.error(err);
        if (previousShelfItems) {
          utils.shelf.getShelfItems.setData(undefined, previousShelfItems);
        }
        toast.error(err.message || "Failed to complete organization.");
      }
    })();
  };

  const availableActions = getAvailableActions();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-full md:max-w-4xl bg-card text-card-foreground border border-border p-6 rounded-2xl shadow-xl overflow-hidden min-w-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold tracking-tight">Organize Resource</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Choose what to do with this captured item and how to handle it afterward.
          </DialogDescription>
        </DialogHeader>

        {/* Two-Panel Layout */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mt-4 overflow-y-auto flex-1 pr-1.5 -mr-1.5 min-h-0">
          
          {/* Left Panel: Action Selection Grid */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Action</h3>
            <div className="grid grid-cols-1 gap-2.5">
              {availableActions.map((action) => {
                const Icon = action.icon;
                const isSelected = selectedAction === action.type;
                return (
                  <button
                    key={action.type}
                    type="button"
                    onClick={() => setSelectedAction(action.type)}
                    className={cn(
                      "flex items-start gap-3 p-3 text-left rounded-xl border transition-all cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/5 text-primary shadow-xs"
                        : "border-border/60 hover:border-border hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className={cn(
                      "p-1.5 rounded-lg border",
                      isSelected 
                        ? "bg-primary/10 border-primary/20 text-primary" 
                        : "bg-muted border-border/50 text-muted-foreground"
                    )}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-xs font-semibold leading-none", isSelected ? "text-foreground" : "text-muted-foreground")}>
                        {action.label}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                        {action.desc}
                      </p>
                    </div>
                    <ChevronRight className="size-3.5 self-center text-muted-foreground/50 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Config Form */}
          <form onSubmit={handleSubmit} className="md:col-span-3 flex flex-col justify-between space-y-6 bg-muted/20 border border-border/50 rounded-2xl p-5 min-w-0">
            <div className="space-y-4 flex-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
                Configure {availableActions.find(a => a.type === selectedAction)?.label}
              </h3>

              {/* ACTION: SAVE TO LIBRARY */}
              {(selectedAction === "library" || selectedAction === "note") && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="tags-input" className="text-xs font-semibold">Organize with Tags (comma-separated)</Label>
                    <div className="relative flex items-center">
                      <Tag className="absolute left-3 size-3.5 text-muted-foreground" />
                      <Input
                        id="tags-input"
                        placeholder="biology, lecture, study-deck"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        className="rounded-xl border border-input pl-9 text-xs h-9.5"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                      Tags make it easier to search and filter through your materials collection.
                    </p>
                  </div>
                </div>
              )}

              {/* ACTION: CONVERT TO TASK */}
              {selectedAction === "task" && (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <Label htmlFor="task-title" className="text-xs font-semibold">Task Title</Label>
                    <Input
                      id="task-title"
                      placeholder="Enter task summary..."
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="rounded-xl border border-input text-xs h-9.5"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="task-desc" className="text-xs font-semibold">Task Details & Description</Label>
                    <Textarea
                      id="task-desc"
                      placeholder="Add supplementary links or instructions..."
                      value={taskDesc}
                      onChange={(e) => setTaskDesc(e.target.value)}
                      className="min-h-[90px] text-xs rounded-xl border border-input p-2.5 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Priority Level</Label>
                      <div className="grid grid-cols-2 gap-1 bg-muted p-0.5 rounded-lg border border-border/40 text-[10px] font-semibold">
                        {(["low", "medium", "high", "urgent"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setTaskPriority(p)}
                            className={cn(
                              "py-1 rounded capitalize transition-all cursor-pointer",
                              taskPriority === p
                                ? "bg-background text-foreground shadow-xs border border-border/20 font-bold"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="task-date" className="text-xs font-semibold">Due Date (Optional)</Label>
                      <div className="relative flex items-center">
                        <Calendar className="absolute left-3 size-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          id="task-date"
                          type="datetime-local"
                          value={taskDueDate}
                          onChange={(e) => setTaskDueDate(e.target.value)}
                          className="rounded-xl border border-input pl-9 text-[11px] h-9.5 block w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTION: SHARE TO HIVE */}
              {selectedAction === "hive" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Study Hive Group</Label>
                    {isLoadingHives ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <Loader2 className="size-3.5 animate-spin text-primary" />
                        <span>Loading hives...</span>
                      </div>
                    ) : allowedHives.length === 0 ? (
                      <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                        You are not a member of any study hives yet. You must join or create a hive first.
                      </div>
                    ) : (
                      <select
                        value={selectedHive}
                        onChange={(e) => setSelectedHive(e.target.value)}
                        className="w-full bg-background border border-input rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                      >
                        {allowedHives.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} {h.courseCode ? `(${h.courseCode})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {allowedHives.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Hive Folder Location</Label>
                      {isLoadingFolders ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                          <Loader2 className="size-3.5 animate-spin text-primary" />
                          <span>Loading folders...</span>
                        </div>
                      ) : (
                        <select
                          value={selectedFolder}
                          onChange={(e) => setSelectedFolder(e.target.value)}
                          className="w-full bg-background border border-input rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                        >
                          <option value="">Root / No Folder</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ACTION: POST ANNOUNCEMENT */}
              {selectedAction === "announcement" && (
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Study Hive Target</Label>
                    {isLoadingHives ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <Loader2 className="size-3.5 animate-spin text-primary" />
                        <span>Loading hives...</span>
                      </div>
                    ) : allowedHives.length === 0 ? (
                      <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                        You must be an admin or owner of a study hive to post announcements.
                      </div>
                    ) : (
                      <select
                        value={selectedHive}
                        onChange={(e) => setSelectedHive(e.target.value)}
                        className="w-full bg-background border border-input rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                      >
                        {allowedHives.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} {h.courseCode ? `(${h.courseCode})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {allowedHives.length > 0 && (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor="ann-title" className="text-xs font-semibold">Announcement Title</Label>
                        <Input
                          id="ann-title"
                          placeholder="Title of feed announcement..."
                          value={announcementTitle}
                          onChange={(e) => setAnnouncementTitle(e.target.value)}
                          className="rounded-xl border border-input text-xs h-9.5"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="ann-body" className="text-xs font-semibold">Announcement Body</Label>
                        <Textarea
                          id="ann-body"
                          placeholder="Announce details to members..."
                          value={announcementBody}
                          onChange={(e) => setAnnouncementBody(e.target.value)}
                          className="min-h-[80px] text-xs rounded-xl border border-input p-2.5 resize-none"
                          required
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Lifecycle Choice: After This Action */}
            <div className="mt-5 pt-4 border-t border-border/40 space-y-3">
              <Label className="text-xs font-bold text-foreground">After this action:</Label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { value: "keep" as LifecycleType, label: "Keep on Desk", desc: "Leave captured item." },
                  { value: "library" as LifecycleType, label: "Move to Library", desc: "Transfer & clear." },
                  { value: "remove" as LifecycleType, label: "Remove from Desk", desc: "Permanently delete." },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLifecycle(option.value)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                      lifecycle === option.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border/50 hover:border-border hover:bg-background/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="font-bold text-[10px]">{option.label}</span>
                    <span className="text-[8px] text-muted-foreground/80 mt-0.5 leading-tight">{option.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-border/40 shrink-0">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl px-5 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                disabled={
                  submitting ||
                  isLoadingHives ||
                  ((selectedAction === "hive" || selectedAction === "announcement") && allowedHives.length === 0)
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Complete Action</span>
                )}
              </Button>
            </div>
          </form>

        </div>
      </DialogContent>
    </Dialog>
  );
}
