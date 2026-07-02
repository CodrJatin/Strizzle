"use client";

import * as React from "react";
import { 
  DndContext, DragEndEvent, PointerSensor, 
  useSensor, useSensors, KeyboardSensor, closestCorners,
  DragOverlay, DragStartEvent
} from "@dnd-kit/core";
import { 
  SortableContext, verticalListSortingStrategy, 
  sortableKeyboardCoordinates 
} from "@dnd-kit/sortable";
import { 
  Plus, Search, Filter, Users, CheckSquare, Loader2,
  Calendar, AlertCircle, X, Shield, PlusCircle
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/trpc/client";
import { TaskCard, Task } from "@/components/TaskCard";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface PageProps {
  params: Promise<{ hiveId: string }>;
}

const COLUMNS: Array<{ id: Task["status"]; title: string; color: string }> = [
  { id: "todo", title: "Todo", color: "bg-slate-400 dark:bg-slate-500" },
  { id: "in_progress", title: "In Progress", color: "bg-blue-500 dark:bg-blue-600" },
  { id: "blocked", title: "Blocked", color: "bg-rose-500 dark:bg-rose-600" },
  { id: "done", title: "Completed", color: "bg-emerald-500 dark:bg-emerald-600" },
];

export default function HiveTasksPage({ params }: PageProps) {
  const { hiveId } = React.use(params);
  const utils = api.useUtils();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = React.useState("");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>("all");

  // Dialog & Modal State
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);

  // New Task Form State
  const [newTitle, setNewTitle] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [newPriority, setNewPriority] = React.useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newAssigneeId, setNewAssigneeId] = React.useState<string | null>(null);
  const [newDueAt, setNewDueAt] = React.useState("");

  // Queries
  const { data: tasks = [], isLoading, isError } = api.task.getTasks.useQuery(
    { hiveId },
    { staleTime: 120000 }
  );

  const { data: members = [] } = api.member.getHiveMembers.useQuery(
    { hiveId },
    { staleTime: 300000 }
  );

  // Mutations
  const createTaskMutation = api.task.createTask.useMutation({
    onMutate: async (newTask) => {
      await utils.task.getTasks.cancel({ hiveId });
      const previous = utils.task.getTasks.getData({ hiveId });
      
      utils.task.getTasks.setData({ hiveId }, (old) => {
        const optimisticTask = {
          id: Math.random().toString(),
          title: newTask.title,
          description: newTask.description,
          status: newTask.status || "todo",
          priority: newTask.priority || "medium",
          dueAt: newTask.dueAt ? new Date(newTask.dueAt) : null,
          assigneeId: newTask.assigneeId,
          creatorId: "temp-creator",
          createdAt: new Date(),
          materials: [],
          assigneeName: members.find(m => m.userId === newTask.assigneeId)?.user.fullName || null,
          assigneeAvatar: members.find(m => m.userId === newTask.assigneeId)?.user.avatarUrl || null,
        };
        return old ? [optimisticTask, ...old] : [optimisticTask] as any;
      });

      return { previous };
    },
    onSuccess: () => {
      toast.success("Task created successfully!");
      setCreateOpen(false);
      // Reset form
      setNewTitle("");
      setNewDescription("");
      setNewPriority("medium");
      setNewAssigneeId(null);
      setNewDueAt("");
      utils.task.getTasks.invalidate({ hiveId });
      utils.task.getMyTasks.invalidate();
    },
    onError: (_err, _newTask, context) => {
      if (context?.previous) {
        utils.task.getTasks.setData({ hiveId }, context.previous);
      }
      toast.error("Failed to create task.");
    },
  });

  const updateTaskMutation = api.task.updateTask.useMutation({
    onMutate: async (updated) => {
      await utils.task.getTasks.cancel({ hiveId });
      const previous = utils.task.getTasks.getData({ hiveId });

      utils.task.getTasks.setData({ hiveId }, (old) => {
        if (!old) return old;
        return old.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)) as any;
      });

      return { previous };
    },
    onSuccess: () => {
      utils.task.getTasks.invalidate({ hiveId });
      utils.task.getMyTasks.invalidate();
      utils.calendar.getCalendarTasks.invalidate();
    },
    onError: (_err, _updated, context) => {
      if (context?.previous) {
        utils.task.getTasks.setData({ hiveId }, context.previous);
      }
      toast.error("Failed to move task.");
    },
  });

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // allows clicking without triggering drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string);
  };

  const handleDragCancel = () => {
    setActiveTaskId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Determine target status
    let targetStatus: Task["status"] | null = null;

    // Check if dragged directly over a column container or another card
    const targetColumn = COLUMNS.find((col) => col.id === overId);
    if (targetColumn) {
      targetStatus = targetColumn.id;
    } else {
      const targetTask = tasks.find((t) => t.id === overId);
      if (targetTask) {
        targetStatus = targetTask.status;
      }
    }

    const draggedTask = tasks.find((t) => t.id === taskId);
    if (draggedTask && targetStatus && draggedTask.status !== targetStatus) {
      updateTaskMutation.mutate({
        id: taskId,
        status: targetStatus,
      });
    }
  };

  const handleMoveColumn = (taskId: string, newStatus: Task["status"]) => {
    updateTaskMutation.mutate({
      id: taskId,
      status: newStatus,
    });
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    createTaskMutation.mutate({
      hiveId,
      title: newTitle,
      description: newDescription,
      priority: newPriority,
      assigneeId: newAssigneeId,
      dueAt: newDueAt ? new Date(newDueAt).toISOString() : null,
      status: "todo",
    });
  };

  // Filter tasks locally
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;

    const matchesAssignee = assigneeFilter === "all" || 
      (assigneeFilter === "unassigned" && !t.assigneeId) ||
      t.assigneeId === assigneeFilter;

    return matchesSearch && matchesPriority && matchesAssignee;
  });

  return (
    <div className="space-y-6">
      {/* Header and Quick Add */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <CheckSquare className="size-6 text-primary" />
            Task Board
          </h2>
          <p className="text-xs text-muted-foreground font-semibold">
            Manage coursework objectives and assignments collaboratively.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/95 font-bold text-xs h-9.5 px-4 rounded-xl shadow-xs cursor-pointer gap-1.5"
        >
          <Plus className="size-4.5" />
          Add Task
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 bg-card p-4 rounded-2xl border border-border/80 shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="pl-9 h-9 border-border/80 focus-visible:ring-1 text-xs"
          />
        </div>

        {/* Priority Filter */}
        <div className="w-full md:w-44">
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-9 justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Filter className="size-3.5" />
                <SelectValue placeholder="Priority" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Assignee Filter */}
        <div className="w-full md:w-48">
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="h-9 justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-3.5" />
                <SelectValue placeholder="Assignee" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.user.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Kanban Board Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-semibold">Loading kanban board...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-destructive">
          <AlertCircle className="size-8" />
          <p className="text-xs font-bold">Failed to load tasks. Please try again.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);
              return (
                <div 
                  key={col.id}
                  className="flex flex-col rounded-2xl border border-border/60 bg-muted/20 dark:bg-zinc-950/20 max-h-[80vh] overflow-hidden"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between p-3.5 border-b border-border/40 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${col.color}`} />
                      <span className="text-xs font-bold text-foreground/90">{col.title}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border">
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Dropzone container */}
                  <SortableContext
                    id={col.id}
                    items={colTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div 
                      id={col.id}
                      className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[150px]"
                    >
                      {colTasks.length > 0 ? (
                        colTasks.map((t) => (
                          <TaskCard
                            key={t.id}
                            task={t as any}
                            onClick={() => setSelectedTaskId(t.id)}
                            onMoveColumn={(newStatus) => handleMoveColumn(t.id, newStatus)}
                          />
                        ))
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center py-8 text-center text-muted-foreground/40 font-semibold border-2 border-dashed border-border/30 rounded-xl">
                          <CheckSquare className="size-5 mb-1 opacity-40" />
                          <span className="text-[10px]">No tasks</span>
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>

          <DragOverlay adjustScale={false}>
            {activeTaskId ? (
              <TaskCard
                task={tasks.find((t) => t.id === activeTaskId) as any}
                onClick={() => {}}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create Task Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md rounded-xl">
          <form onSubmit={handleCreateTask}>
            <DialogHeader className="pb-4 border-b border-border dark:border-zinc-900">
              <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
                <PlusCircle className="size-4.5 text-primary" />
                Create New Task
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Add an assignment or project objective for this hive.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4 text-xs font-semibold">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Task Title</label>
                <Input
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Read Chapter 4 Biology"
                  className="h-9 focus-visible:ring-1 text-xs"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Description (Optional)</label>
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Objective details and links..."
                  className="min-h-20 text-xs"
                />
              </div>

              {/* Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Priority</label>
                  <Select value={newPriority} onValueChange={(val: any) => setNewPriority(val)}>
                    <SelectTrigger className="h-9 justify-between">
                      <SelectValue placeholder="Medium" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Assignee */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assignee</label>
                  <Select value={newAssigneeId || "unassigned"} onValueChange={(val) => setNewAssigneeId(val === "unassigned" ? null : val)}>
                    <SelectTrigger className="h-9 justify-between">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Due Date */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Due Date</label>
                </div>
                <input
                  type="datetime-local"
                  value={newDueAt}
                  onChange={(e) => setNewDueAt(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border dark:border-zinc-900 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="h-8.5 text-xs rounded-lg font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTaskMutation.isPending}
                className="h-8.5 text-xs bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg font-bold cursor-pointer shadow-xs"
              >
                {createTaskMutation.isPending ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          hiveId={hiveId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
