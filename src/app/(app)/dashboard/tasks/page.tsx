"use client";

import * as React from "react";
import { 
  DndContext, DragEndEvent, PointerSensor, 
  useSensor, useSensors, KeyboardSensor, closestCorners,
  DragOverlay, DragStartEvent, DragOverEvent, useDroppable
} from "@dnd-kit/core";
import { 
  SortableContext, verticalListSortingStrategy, 
  sortableKeyboardCoordinates 
} from "@dnd-kit/sortable";
import { 
  Plus, Search, Filter, Layers, CheckSquare, Loader2,
  Calendar, AlertCircle, Clock, CheckCircle, Square, PlayCircle, List, LayoutGrid, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useConfirmStore } from "@/store/confirmStore";

import { api } from "@/lib/trpc/client";
import { TaskCard, Task } from "@/components/TaskCard";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DropdownSelect } from "@/components/DropdownSelect";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const COLUMNS: Array<{ id: Task["status"]; title: string; color: string; border: string; text: string }> = [
  { id: "todo", title: "Todo", color: "bg-slate-400 dark:bg-slate-500", border: "border-slate-500/10", text: "text-slate-600 dark:text-slate-400" },
  { id: "in_progress", title: "In Progress", color: "bg-blue-500 dark:bg-blue-600", border: "border-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  { id: "blocked", title: "Blocked", color: "bg-rose-500 dark:bg-rose-600", border: "border-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
  { id: "done", title: "Completed", color: "bg-emerald-500 dark:bg-emerald-600", border: "border-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
];

const priorityColors = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-400 border-slate-200/50 dark:border-slate-800",
  medium: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100/50 dark:border-blue-900/30",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100/50 dark:border-amber-900/30",
  urgent: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-200/50 dark:border-rose-950/30",
};

const themeStyles: Record<string, { bg: string; text: string; border: string }> = {
  blue: {
    bg: "bg-blue-500/10 dark:bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-500/20 dark:border-blue-500/30",
  },
  green: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/20 dark:border-emerald-500/30",
  },
  indigo: {
    bg: "bg-indigo-500/10 dark:bg-indigo-500/10",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-500/20 dark:border-indigo-500/30",
  },
  rose: {
    bg: "bg-rose-500/10 dark:bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-500/20 dark:border-rose-500/30",
  },
  amber: {
    bg: "bg-amber-500/10 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/20 dark:border-amber-500/30",
  },
};

interface TaskColumnProps {
  id: Task["status"];
  title: string;
  color: string;
  tasks: Task[];
  overColumnId: string | null;
  onTaskClick: (taskId: string) => void;
  onMoveColumn: (taskId: string, newStatus: Task["status"]) => void;
  onDeleteClick: (taskId: string) => void;
}

function TaskColumn({ id, title, color, tasks, overColumnId, onTaskClick, onMoveColumn, onDeleteClick }: TaskColumnProps) {
  const { setNodeRef } = useDroppable({ id });
  const isOver = overColumnId === id;

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-2xl border bg-muted/20 dark:bg-zinc-950/20 max-h-[75vh] overflow-hidden transition-all duration-200",
        isOver 
          ? "border-primary bg-primary/5 dark:bg-primary/5 ring-2 ring-primary/10" 
          : "border-border/60"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${color}`} />
          <span className="text-xs font-bold text-foreground/90">{title}</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border">
          {tasks.length}
        </span>
      </div>

      {/* Dropzone container */}
      <SortableContext
        id={id}
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div 
          className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[150px]"
        >
          {tasks.length > 0 ? (
            tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onClick={() => onTaskClick(t.id)}
                onMoveColumn={(newStatus) => onMoveColumn(t.id, newStatus)}
                onDeleteClick={() => onDeleteClick(t.id)}
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
}

export default function WorkspaceTasksPage() {
  const utils = api.useUtils();
  const confirm = useConfirmStore((s) => s.confirm);
  const [viewMode, setViewMode] = React.useState<"kanban" | "list">("kanban");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = React.useState("");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");
  const [hiveFilter, setHiveFilter] = React.useState<string>("all");

  // Dialog & Modal State
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);
  const [overColumnId, setOverColumnId] = React.useState<string | null>(null);

  // New Task Form State
  const [newTitle, setNewTitle] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [newPriority, setNewPriority] = React.useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newHiveId, setNewHiveId] = React.useState<string>("personal");
  const [newDueAt, setNewDueAt] = React.useState("");

  // Queries
  const getTasksFilter = { includeCompleted: true };
  const { data: myTasks = [], isLoading, isError } = api.task.getMyTasks.useQuery(
    getTasksFilter,
    { staleTime: 120000 }
  );

  const { data: hives = [] } = api.hive.getUserHives.useQuery(undefined, {
    staleTime: 120000,
  });

  const hiveOptions = React.useMemo(() => {
    return [
      { value: "all", label: "All Workspaces / Hives" },
      { value: "personal", label: "Personal (no hive)" },
      ...hives.map((h) => ({
        value: h.id,
        label: h.courseCode || h.name,
      })),
    ];
  }, [hives]);

  const dialogHiveOptions = React.useMemo(() => {
    return [
      { value: "personal", label: "Personal (no hive)" },
      ...hives.map((h) => ({
        value: h.id,
        label: h.courseCode || h.name,
      })),
    ];
  }, [hives]);

  const priorityOptions = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" },
  ];

  // Mutations
  const createTaskMutation = api.task.createTask.useMutation({
    onMutate: async (newTask) => {
      setCreateOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewPriority("medium");
      setNewHiveId("personal");
      setNewDueAt("");

      await utils.task.getMyTasks.cancel(getTasksFilter);
      await utils.task.getMyTasks.cancel(undefined); // Active tasks only
      const previousFull = utils.task.getMyTasks.getData(getTasksFilter);
      const previousActive = utils.task.getMyTasks.getData(undefined);

      const targetHive = hives.find((h) => h.id === newTask.hiveId);
      const optimisticTask = {
        id: "temp-task-" + Math.random().toString(),
        title: newTask.title,
        description: newTask.description ?? null,
        status: newTask.status || "todo",
        priority: newTask.priority || "medium",
        dueAt: newTask.dueAt ? new Date(newTask.dueAt) : null,
        hiveId: newTask.hiveId || null,
        hiveName: targetHive?.name || null,
        courseCode: targetHive?.courseCode || null,
        colorTheme: targetHive?.colorTheme || null,
        materials: [],
      };

      utils.task.getMyTasks.setData(getTasksFilter, (old) => {
        return old ? [optimisticTask, ...old] : [optimisticTask] as any;
      });

      if (optimisticTask.status !== "done") {
        utils.task.getMyTasks.setData(undefined, (old) => {
          return old ? [optimisticTask, ...old] : [optimisticTask] as any;
        });
      }

      return { previousFull, previousActive };
    },
    onSuccess: () => {
      toast.success("Task created successfully!");
      utils.task.getMyTasks.invalidate(getTasksFilter);
      utils.task.getMyTasks.invalidate(undefined);
      utils.calendar.getCalendarTasks.invalidate();
    },
    onError: (err, _newTask, context) => {
      if (context?.previousFull) {
        utils.task.getMyTasks.setData(getTasksFilter, context.previousFull);
      }
      if (context?.previousActive) {
        utils.task.getMyTasks.setData(undefined, context.previousActive);
      }
      toast.error(err.message || "Failed to create task.");
    },
  });

  const updateTaskMutation = api.task.updateTask.useMutation({
    onMutate: async (updated) => {
      await utils.task.getMyTasks.cancel(getTasksFilter);
      await utils.task.getMyTasks.cancel(undefined);

      const previousFull = utils.task.getMyTasks.getData(getTasksFilter);
      const previousActive = utils.task.getMyTasks.getData(undefined);

      utils.task.getMyTasks.setData(getTasksFilter, (old) => {
        if (!old) return old;
        return old.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)) as any;
      });

      utils.task.getMyTasks.setData(undefined, (old) => {
        if (!old) return old;
        if (updated.status === "done") {
          return old.filter((t) => t.id !== updated.id);
        }
        return old.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)) as any;
      });

      return { previousFull, previousActive };
    },
    onSuccess: () => {
      utils.task.getMyTasks.invalidate(getTasksFilter);
      utils.task.getMyTasks.invalidate(undefined);
      utils.calendar.getCalendarTasks.invalidate();
    },
    onError: (_err, _updated, context) => {
      if (context?.previousFull) {
        utils.task.getMyTasks.setData(getTasksFilter, context.previousFull);
      }
      if (context?.previousActive) {
        utils.task.getMyTasks.setData(undefined, context.previousActive);
      }
      toast.error("Failed to update task.");
    },
  });

  const deleteTaskMutation = api.task.deleteTask.useMutation({
    onMutate: async (variables) => {
      await utils.task.getMyTasks.cancel(getTasksFilter);
      await utils.task.getMyTasks.cancel(undefined);

      const previousFull = utils.task.getMyTasks.getData(getTasksFilter);
      const previousActive = utils.task.getMyTasks.getData(undefined);

      utils.task.getMyTasks.setData(getTasksFilter, (old) => {
        if (!old) return old;
        return old.filter((t) => t.id !== variables.id);
      });

      utils.task.getMyTasks.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter((t) => t.id !== variables.id);
      });

      return { previousFull, previousActive };
    },
    onSuccess: () => {
      toast.success("Task deleted successfully.");
      utils.task.getMyTasks.invalidate(getTasksFilter);
      utils.task.getMyTasks.invalidate(undefined);
      utils.calendar.getCalendarTasks.invalidate();
    },
    onError: (_err, _variables, context) => {
      if (context?.previousFull) {
        utils.task.getMyTasks.setData(getTasksFilter, context.previousFull);
      }
      if (context?.previousActive) {
        utils.task.getMyTasks.setData(undefined, context.previousActive);
      }
      toast.error("Failed to delete task.");
    },
  });

  const handleDeleteTask = async (taskId: string) => {
    const confirmed = await confirm({
      title: "Delete Task",
      description: "Are you sure you want to delete this task?",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (confirmed) {
      deleteTaskMutation.mutate({ id: taskId });
    }
  };

  // Sensors for Dragging
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setOverColumnId(null);
      return;
    }

    const overId = over.id as string;
    const targetColumn = COLUMNS.find((col) => col.id === overId);
    if (targetColumn) {
      setOverColumnId(targetColumn.id);
    } else {
      const targetTask = myTasks.find((t) => t.id === overId);
      if (targetTask) {
        setOverColumnId(targetTask.status as any);
      }
    }
  };

  const handleDragCancel = () => {
    setActiveTaskId(null);
    setOverColumnId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);
    setOverColumnId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    let targetStatus: Task["status"] | null = null;

    const targetColumn = COLUMNS.find((col) => col.id === overId);
    if (targetColumn) {
      targetStatus = targetColumn.id;
    } else {
      const targetTask = myTasks.find((t) => t.id === overId);
      if (targetTask) {
        targetStatus = targetTask.status as any;
      }
    }

    const draggedTask = myTasks.find((t) => t.id === taskId);
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
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      priority: newPriority,
      dueAt: newDueAt ? new Date(newDueAt).toISOString() : null,
      hiveId: newHiveId === "personal" ? null : newHiveId,
      status: "todo",
    });
  };

  // Filter tasks locally
  const filteredTasks = React.useMemo(() => {
    return myTasks.filter((t) => {
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;

      const matchesHive = hiveFilter === "all" ||
        (hiveFilter === "personal" && !t.hiveId) ||
        t.hiveId === hiveFilter;

      return matchesSearch && matchesPriority && matchesHive;
    });
  }, [myTasks, searchQuery, priorityFilter, hiveFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <CheckSquare className="size-6 text-primary" />
            My Task Studio
          </h1>
          <p className="text-xs text-muted-foreground font-semibold">
            Track and manage your coursework goals, study timelines, and hive objectives.
          </p>
        </div>
        
        <div className="flex items-center gap-2.5">
          {/* View Toggle */}
          <div className="flex items-center border border-border/60 rounded-xl p-0.5 bg-muted/20 shrink-0">
            <Button
              onClick={() => setViewMode("kanban")}
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 rounded-lg cursor-pointer",
                viewMode === "kanban" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
              title="Kanban Board"
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              onClick={() => setViewMode("list")}
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 rounded-lg cursor-pointer",
                viewMode === "list" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
              title="List View"
            >
              <List className="size-4" />
            </Button>
          </div>

          <Button
            onClick={() => {
              const today = new Date();
              today.setHours(12, 0, 0, 0);
              const tzOffset = today.getTimezoneOffset() * 60000;
              const formatted = new Date(today.getTime() - tzOffset).toISOString().slice(0, 16);
              setNewDueAt(formatted);
              setCreateOpen(true);
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/95 font-bold text-xs h-9 px-4 rounded-xl shadow-sm cursor-pointer gap-1.5 shrink-0"
          >
            <Plus className="size-4" />
            Create Task
          </Button>
        </div>
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

        {/* Hive Filter */}
        <div className="w-full md:w-56">
          <Select value={hiveFilter} onValueChange={setHiveFilter}>
            <SelectTrigger className="h-9 justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Layers className="size-3.5" />
                <SelectValue placeholder="Workspace" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {hiveOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Kanban / List Board Main Body */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-semibold animate-pulse">Loading task list...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-destructive">
          <AlertCircle className="size-8" />
          <p className="text-xs font-bold">Failed to load tasks. Please try again.</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === "kanban" ? (
            <motion.div
              key="kanban"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                  {COLUMNS.map((col) => {
                    const colTasks = filteredTasks.filter((t) => t.status === col.id);
                    return (
                      <TaskColumn
                        key={col.id}
                        id={col.id}
                        title={col.title}
                        color={col.color}
                        tasks={colTasks as any}
                        overColumnId={overColumnId}
                        onTaskClick={setSelectedTaskId}
                        onMoveColumn={handleMoveColumn}
                        onDeleteClick={handleDeleteTask}
                      />
                    );
                  })}
                </div>

                <DragOverlay adjustScale={false}>
                  {activeTaskId ? (
                    <TaskCard
                      task={myTasks.find((t) => t.id === activeTaskId) as any}
                      onClick={() => {}}
                      isOverlay
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {COLUMNS.map((col) => {
                const colTasks = filteredTasks.filter((t) => t.status === col.id);
                return (
                  <div key={col.id} className="border border-border/80 rounded-2xl bg-card p-5 shadow-xs space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-2 border-b border-border/40 pb-2.5">
                      <span className={cn("size-2.5 rounded-full", col.color)} />
                      <h3 className="text-xs font-bold text-foreground capitalize">{col.title} ({colTasks.length})</h3>
                    </div>

                    {colTasks.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground/60 font-semibold py-4 text-center">No tasks in this stage.</p>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {colTasks.map((task) => {
                          const dueAtDate = task.dueAt ? new Date(task.dueAt) : null;
                          const isOverdue = dueAtDate && dueAtDate < new Date() && task.status !== "done";
                          const formattedDue = dueAtDate
                            ? dueAtDate.toLocaleDateString(undefined, { 
                                month: "short", 
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })
                            : null;
                          
                          return (
                            <div 
                              key={task.id}
                              className="flex items-center justify-between gap-4 py-3.5 hover:bg-muted/10 px-2 rounded-xl transition-all cursor-pointer group/list"
                              onClick={() => setSelectedTaskId(task.id)}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {task.status === "done" ? (
                                  <CheckCircle className="size-4.5 text-emerald-500 shrink-0" />
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveColumn(task.id, "done");
                                    }}
                                    className="text-muted-foreground/40 hover:text-emerald-500 shrink-0 cursor-pointer transition-colors"
                                  >
                                    <Square className="size-4.5" />
                                  </button>
                                )}
                                
                                <div className="min-w-0 flex-1">
                                  <h4 className={cn(
                                    "text-xs font-bold text-foreground leading-snug truncate group-hover/list:text-primary transition-all",
                                    task.status === "done" && "line-through text-muted-foreground/60 font-semibold"
                                  )}>
                                    {task.title}
                                  </h4>
                                  {task.description && (
                                    <p className="text-[10px] text-muted-foreground/80 line-clamp-1 mt-0.5">
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                                {/* Hive Badge */}
                                {task.hiveId ? (
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-[8px] font-bold px-1.5 py-0.5 rounded-md shrink-0 border uppercase",
                                      themeStyles[task.colorTheme || "blue"]?.bg || "bg-blue-500/10",
                                      themeStyles[task.colorTheme || "blue"]?.text || "text-blue-700",
                                      themeStyles[task.colorTheme || "blue"]?.border || "border-blue-500/20"
                                    )}
                                  >
                                    {task.courseCode || task.hiveName}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[8px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 text-muted-foreground border-border/80">
                                    Personal
                                  </Badge>
                                )}

                                {/* Priority Badge */}
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-[8px] font-bold px-1.5 py-0.5 rounded-md shrink-0 border uppercase",
                                    priorityColors[task.priority]
                                  )}
                                >
                                  {task.priority}
                                </Badge>

                                {/* Due Date */}
                                {formattedDue && (
                                  <span className={cn(
                                    "text-[10px] font-bold flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-md border",
                                    isOverdue 
                                      ? "text-rose-600 border-rose-500/20 bg-rose-500/5 dark:text-rose-500" 
                                      : "text-muted-foreground border-border/60 bg-muted/10"
                                  )}>
                                    <Clock className="size-3 shrink-0" />
                                    {formattedDue}
                                  </span>
                                )}

                                {/* Quick dropdown selector */}
                                <Select 
                                  value={task.status} 
                                  onValueChange={(val: any) => handleMoveColumn(task.id, val)}
                                >
                                  <SelectTrigger className="h-7 w-28 text-[9px] font-bold rounded-lg border-border/80">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="text-[10px] font-semibold">
                                    <SelectItem value="todo">Todo</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="blocked">Blocked</SelectItem>
                                    <SelectItem value="done">Completed</SelectItem>
                                  </SelectContent>
                                </Select>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTask(task.id);
                                  }}
                                  className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-all"
                                  title="Delete Task"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Create Task Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { 
        if (!open) {
          setCreateOpen(false); 
          setNewTitle("");
          setNewDescription("");
          setNewPriority("medium");
          setNewHiveId("personal");
          setNewDueAt("");
        }
      }}>
        <DialogContent className="max-w-md bg-card border border-border p-6 rounded-2xl shadow-xl text-card-foreground">
          <form onSubmit={handleCreateTask}>
            <DialogHeader className="pb-4 border-b border-border/40">
              <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
                <Plus className="size-4.5 text-primary" />
                Create New Task
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Add a coursework task or personal objective.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4 text-xs font-semibold">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Title</label>
                <Input
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Solve calculus exercise sheet 3"
                  className="h-9 focus-visible:ring-1 text-xs"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Description (Optional)</label>
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Write details or add URLs..."
                  className="min-h-20 text-xs"
                />
              </div>

              {/* Priority & Hive Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Priority</label>
                  <DropdownSelect
                    value={newPriority}
                    onValueChange={(val) => setNewPriority(val as any)}
                    options={priorityOptions}
                    className="w-full h-9 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Associate with Hive</label>
                  <DropdownSelect
                    value={newHiveId}
                    onValueChange={setNewHiveId}
                    options={dialogHiveOptions}
                    className="w-full h-9 rounded-lg"
                  />
                </div>
              </div>

              {/* Due Date */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Due Date</label>
                </div>
                <Input
                  type="datetime-local"
                  value={newDueAt}
                  onChange={(e) => setNewDueAt(e.target.value)}
                  className="h-9 text-xs focus-visible:ring-1 cursor-pointer bg-transparent"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border/40 gap-2">
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
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

    </div>
  );
}
