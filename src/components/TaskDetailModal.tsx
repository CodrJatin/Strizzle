"use client";

import * as React from "react";
import { 
  CheckSquare, Calendar, User, Trash2, Plus, X, 
  Link2, FileText, Video, File, Image, Loader2, AlertCircle 
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlobalSearch } from "@/components/GlobalSearch";

interface TaskDetailModalProps {
  taskId: string | null;
  hiveId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated?: () => void;
  onTaskDeleted?: () => void;
}

const typeIcons = {
  text: FileText,
  link: Link2,
  youtube: Video,
  file: File,
  image: Image,
};

export function TaskDetailModal({
  taskId,
  hiveId,
  isOpen,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailModalProps) {
  const utils = api.useUtils();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [isEditingDesc, setIsEditingDesc] = React.useState(false);

  // Queries
  const { data: task, isLoading, isError } = api.task.getTask.useQuery(
    { id: taskId || "" },
    { enabled: !!taskId && isOpen, staleTime: 120000 } // Standard task data: 2 minutes
  );

  const { data: members } = api.member.getHiveMembers.useQuery(
    { hiveId: hiveId || task?.hiveId || "" },
    { enabled: !!(hiveId || task?.hiveId) && isOpen, staleTime: 120000 } // Standard hive members data: 2 minutes
  );

  // Mutation states
  const updateTaskMutation = api.task.updateTask.useMutation({
    onMutate: async (updated) => {
      // Cancel inflight queries
      if (task?.hiveId) {
        await utils.task.getTasks.cancel({ hiveId: task.hiveId });
      }
      await utils.task.getTask.cancel({ id: updated.id });
      await utils.task.getMyTasks.cancel();

      // Snapshot for rollback
      const previousTask = utils.task.getTask.getData({ id: updated.id });
      const previousTasks = task?.hiveId 
        ? utils.task.getTasks.getData({ hiveId: task.hiveId }) 
        : undefined;
      const previousMyTasks = utils.task.getMyTasks.getData();

      // Apply optimistic updates
      if (task?.hiveId) {
        utils.task.getTasks.setData({ hiveId: task.hiveId }, (old) => {
          if (!old) return old;
          return old.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)) as any;
        });
      }
      utils.task.getTask.setData({ id: updated.id }, (old) => {
        if (!old) return old;
        return { ...old, ...updated } as any;
      });
      utils.task.getMyTasks.setData(undefined, (old) => {
        if (!old) return old;
        return old.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)) as any;
      });

      return { previousTask, previousTasks, previousMyTasks };
    },
    onError: (_err, updated, ctx) => {
      // Rollback to snapshots
      if (ctx?.previousTask) {
        utils.task.getTask.setData({ id: updated.id }, ctx.previousTask);
      }
      if (task?.hiveId && ctx?.previousTasks) {
        utils.task.getTasks.setData({ hiveId: task.hiveId }, ctx.previousTasks);
      }
      if (ctx?.previousMyTasks) {
        utils.task.getMyTasks.setData(undefined, ctx.previousMyTasks);
      }
      toast.error("Something went wrong. Failed to update task.");
    },
    onSuccess: () => {
      if (onTaskUpdated) onTaskUpdated();
      utils.calendar.getCalendarTasks.invalidate();
    },
    onSettled: (data, error, updated) => {
      if (task?.hiveId) {
        utils.task.getTasks.invalidate({ hiveId: task.hiveId });
      }
      utils.task.getTask.invalidate({ id: updated.id });
      utils.task.getMyTasks.invalidate();
    },
  });

  const deleteTaskMutation = api.task.deleteTask.useMutation({
    onMutate: async (variables) => {
      onClose();
      // Cancel queries
      if (task?.hiveId) {
        await utils.task.getTasks.cancel({ hiveId: task.hiveId });
      }
      await utils.task.getMyTasks.cancel();

      // Snapshot for rollback
      const previousTasks = task?.hiveId
        ? utils.task.getTasks.getData({ hiveId: task.hiveId })
        : undefined;
      const previousMyTasks = utils.task.getMyTasks.getData();

      // Apply optimistic update
      if (task?.hiveId) {
        utils.task.getTasks.setData({ hiveId: task.hiveId }, (old) => {
          if (!old) return old;
          return old.filter((t) => t.id !== variables.id);
        });
      }
      utils.task.getMyTasks.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter((t) => t.id !== variables.id);
      });

      return { previousTasks, previousMyTasks };
    },
    onError: (_err, _variables, ctx) => {
      // Rollback
      if (task?.hiveId && ctx?.previousTasks) {
        utils.task.getTasks.setData({ hiveId: task.hiveId }, ctx.previousTasks);
      }
      if (ctx?.previousMyTasks) {
        utils.task.getMyTasks.setData(undefined, ctx.previousMyTasks);
      }
      toast.error("Something went wrong. Failed to delete task.");
    },
    onSuccess: () => {
      toast.success("Task deleted successfully.");
      onClose();
      if (onTaskDeleted) onTaskDeleted();
      utils.calendar.getCalendarTasks.invalidate();
    },
    onSettled: () => {
      if (task?.hiveId) {
        utils.task.getTasks.invalidate({ hiveId: task.hiveId });
      }
      utils.task.getMyTasks.invalidate();
    },
  });

  // Local state fields
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState<"todo" | "in_progress" | "done" | "blocked">("todo");
  const [priority, setPriority] = React.useState<"low" | "medium" | "high" | "urgent">("medium");
  const [dueAt, setDueAt] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState<string | null>(null);

  // Sync state when task loads
  React.useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setStatus(task.status || "todo");
      setPriority(task.priority || "medium");
      setAssigneeId(task.assigneeId || null);
      if (task.dueAt) {
        // Format date to YYYY-MM-DDTHH:MM
        const date = new Date(task.dueAt);
        const tzOffset = date.getTimezoneOffset() * 60000;
        const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
        setDueAt(localISOTime);
      } else {
        setDueAt("");
      }
    }
  }, [task]);

  // Handle Cmd+Enter / Ctrl+Enter to save and close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [title, description, status, priority, dueAt, assigneeId]);

  const handleSaveField = (fields: Partial<Parameters<typeof updateTaskMutation.mutate>[0]>) => {
    if (!taskId) return;
    updateTaskMutation.mutate({
      id: taskId,
      ...fields,
    });
  };

  const handleSave = () => {
    if (!taskId || !title.trim()) return;
    updateTaskMutation.mutate({
      id: taskId,
      title,
      description,
      status,
      priority,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      assigneeId,
    });
  };

  const handleDelete = () => {
    if (!taskId) return;
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTaskMutation.mutate({ id: taskId });
    }
  };

  const handleAttachMaterials = (selected: Array<{ id: string }>) => {
    if (!taskId || !task) return;
    const existingIds = task.materials.map((m) => m.id);
    const newIds = Array.from(new Set([...existingIds, ...selected.map((s) => s.id)]));
    handleSaveField({ materialIds: newIds });
    setSearchOpen(false);
    toast.success("Materials attached successfully.");
  };

  const handleRemoveMaterial = (materialId: string) => {
    if (!taskId || !task) return;
    const newIds = task.materials.map((m) => m.id).filter((id) => id !== materialId);
    handleSaveField({ materialIds: newIds });
    toast.success("Material reference removed.");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0 overflow-hidden flex flex-col rounded-xl">
        <DialogHeader className="p-6 pb-4 border-b border-border dark:border-zinc-900 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <CheckSquare className="size-4 text-primary" />
            <span>Task Detail</span>
            {task?.hiveId && <span className="text-zinc-400 dark:text-zinc-600">• Hive Workspace</span>}
          </div>
          <DialogTitle className="hidden">Task Details</DialogTitle>
          <DialogDescription className="hidden">Detailed view and controls for this task.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="size-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground font-semibold">Loading task details...</p>
          </div>
        ) : isError || !task ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 text-destructive">
            <AlertCircle className="size-8" />
            <p className="text-sm font-semibold">Failed to load task details.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-3">
            {/* Left Content Area (Title, Desc, Materials) */}
            <div className="md:col-span-2 p-6 space-y-6 border-b md:border-b-0 md:border-r border-border dark:border-zinc-900">
              {/* Editable Title */}
              <div className="space-y-1">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => title.trim() !== task.title && handleSaveField({ title })}
                  placeholder="Task title..."
                  className="text-xl md:text-2xl font-bold border-none px-0 py-1 bg-transparent shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60 focus:outline-none"
                />
              </div>

              {/* Editable Description */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Description</label>
                {isEditingDesc ? (
                  <div className="space-y-2">
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() => {
                        setIsEditingDesc(false);
                        if (description !== task.description) {
                          handleSaveField({ description });
                        }
                      }}
                      placeholder="Add a detailed description... Markdown supported."
                      className="min-h-36 resize-y focus-visible:ring-1 text-sm rounded-lg"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div 
                    onClick={() => setIsEditingDesc(true)}
                    className="min-h-32 p-3.5 rounded-xl bg-muted/30 border border-border/60 hover:border-border cursor-pointer text-sm transition-all"
                  >
                    {description.trim() ? (
                      <p className="whitespace-pre-wrap text-foreground/90">{description}</p>
                    ) : (
                      <span className="text-muted-foreground/50 italic text-xs">Add a detailed description (Markdown supported)...</span>
                    )}
                  </div>
                )}
              </div>

              {/* Material References */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Material References</label>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setSearchOpen(true)}
                    className="text-[10px] font-bold text-primary gap-1 cursor-pointer h-7 px-2 rounded-md hover:bg-primary/10"
                  >
                    <Plus className="size-3.5" />
                    Attach
                  </Button>
                </div>

                <div className="space-y-2">
                  {task.materials.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {task.materials.map((m) => {
                        const Icon = typeIcons[m.contentType as keyof typeof typeIcons] || FileText;
                        return (
                          <div 
                            key={m.id}
                            className="flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface dark:bg-zinc-900/30 hover:bg-muted/30 transition-all text-xs font-semibold"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="size-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                <Icon className="size-4 text-zinc-500" />
                              </div>
                              <span className="truncate text-foreground/90">{m.title}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveMaterial(m.id)}
                              className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer shrink-0"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-border/80 flex flex-col items-center justify-center text-center gap-1.5 py-6">
                      <Link2 className="size-5 text-muted-foreground/60" />
                      <p className="text-[11px] font-bold text-muted-foreground">No references attached yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Sidebar (Controls) */}
            <div className="p-6 bg-muted/10 flex flex-col justify-between gap-6">
              <div className="space-y-5">
                {/* Status Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</label>
                  <Select 
                    value={status} 
                    onValueChange={(val: any) => {
                      setStatus(val);
                      handleSaveField({ status: val });
                    }}
                  >
                    <SelectTrigger className="w-full h-9 justify-between">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">Todo</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="done">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Priority</label>
                  <Select 
                    value={priority} 
                    onValueChange={(val: any) => {
                      setPriority(val);
                      handleSaveField({ priority: val });
                    }}
                  >
                    <SelectTrigger className="w-full h-9 justify-between">
                      <SelectValue placeholder="Select Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Assignee Selection (Hive Member only) */}
                {(hiveId || task?.hiveId) && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <User className="size-3.5 text-muted-foreground" />
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assignee</label>
                    </div>
                    <Select 
                      value={assigneeId || "unassigned"} 
                      onValueChange={(val) => {
                        const newAssigneeId = val === "unassigned" ? null : val;
                        setAssigneeId(newAssigneeId);
                        handleSaveField({ assigneeId: newAssigneeId });
                      }}
                    >
                      <SelectTrigger className="w-full h-9 justify-between">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {members?.map((m) => (
                          <SelectItem key={m.userId} value={m.userId}>
                            {m.user.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Due Date Selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Due Date</label>
                  </div>
                  <input
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    onBlur={() => {
                      if (dueAt) {
                        const nextDue = new Date(dueAt).toISOString();
                        if (!task.dueAt || nextDue !== new Date(task.dueAt).toISOString()) {
                          handleSaveField({ dueAt: nextDue });
                        }
                      } else if (task.dueAt) {
                        handleSaveField({ dueAt: null });
                      }
                    }}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                  />
                </div>
              </div>

              {/* Danger Zone / Delete */}
              <div className="pt-4 border-t border-border dark:border-zinc-900">
                <Button
                  variant="outline"
                  onClick={handleDelete}
                  className="w-full h-9 border-destructive/20 text-destructive hover:bg-destructive/10 hover:border-destructive/30 rounded-lg gap-2 cursor-pointer font-bold text-xs"
                >
                  <Trash2 className="size-3.5" />
                  Delete Task
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Global Search Dialog for Attaching Materials */}
      <GlobalSearch 
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        attachMode={true}
        onSelect={handleAttachMaterials}
      />
    </Dialog>
  );
}
