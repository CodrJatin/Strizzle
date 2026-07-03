"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckSquare, 
  Loader2, Plus, AlertCircle, Clock, Tag, User, Link2, ExternalLink
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/trpc/client";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Custom theme mapping
const themeStyles: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  blue: {
    bg: "bg-blue-500/10 dark:bg-blue-500/15",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-500/20 dark:border-blue-500/30",
    accent: "bg-blue-500",
  },
  green: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/20 dark:border-emerald-500/30",
    accent: "bg-emerald-500",
  },
  indigo: {
    bg: "bg-indigo-500/10 dark:bg-indigo-500/15",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-500/20 dark:border-indigo-500/30",
    accent: "bg-indigo-500",
  },
  rose: {
    bg: "bg-rose-500/10 dark:bg-rose-500/15",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-500/20 dark:border-rose-500/30",
    accent: "bg-rose-500",
  },
  amber: {
    bg: "bg-amber-500/10 dark:bg-amber-500/15",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/20 dark:border-amber-500/30",
    accent: "bg-amber-500",
  },
  personal: {
    bg: "bg-zinc-500/10 dark:bg-zinc-500/15",
    text: "text-zinc-700 dark:text-zinc-400",
    border: "border-zinc-500/20 dark:border-zinc-500/30",
    accent: "bg-zinc-500",
  }
};

const priorityColors = {
  low: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400",
  medium: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  high: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  urgent: "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400",
};

interface CalendarPageProps {
  defaultView?: "month" | "week" | "day" | "deadlines";
}

function CalendarPageContent({ defaultView }: CalendarPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();

  // Read view type from URL query or props
  const viewParam = (searchParams.get("view") || defaultView || "month") as "month" | "week" | "day" | "deadlines";

  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

  // Task creation states
  const [createTaskDate, setCreateTaskDate] = React.useState<Date | null>(null);
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskDesc, setNewTaskDesc] = React.useState("");
  const [newTaskPriority, setNewTaskPriority] = React.useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newTaskHiveId, setNewTaskHiveId] = React.useState<string>("personal");

  // Set date back to today
  const handleToday = () => setCurrentDate(new Date());

  // Date navigation handlers
  const handlePrev = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewParam === "month") next.setMonth(prev.getMonth() - 1);
      else if (viewParam === "week") next.setDate(prev.getDate() - 7);
      else next.setDate(prev.getDate() - 1);
      return next;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewParam === "month") next.setMonth(prev.getMonth() + 1);
      else if (viewParam === "week") next.setDate(prev.getDate() + 7);
      else next.setDate(prev.getDate() + 1);
      return next;
    });
  };

  // Calculate start & end bounds of the query range based on selected date
  const rangeBounds = React.useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewParam === "month") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      // Include starting offsets of the month grid
      const dayOffset = start.getDay();
      start.setDate(start.getDate() - dayOffset);

      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      // Include trailing offsets
      const trailingOffset = 6 - end.getDay();
      end.setDate(end.getDate() + trailingOffset);
    } else if (viewParam === "week") {
      const dayOffset = start.getDay();
      start.setDate(start.getDate() - dayOffset);
      start.setHours(0, 0, 0, 0);

      end.setTime(start.getTime());
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      // Day view or default
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setHours(23, 59, 59, 999);
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }, [currentDate, viewParam]);

  // Queries
  const { data: tasks = [], isLoading, isError } = api.calendar.getCalendarTasks.useQuery(
    { start: rangeBounds.start, end: rangeBounds.end },
    { staleTime: 30000 }
  );

  const { data: hivesData = [] } = api.hive.getUserHives.useQuery(undefined, {
    staleTime: 120000, // Standard hives list: 2 minutes
  });

  // Mutations
  const updateTaskMutation = api.task.updateTask.useMutation({
    onMutate: async (updated) => {
      await utils.calendar.getCalendarTasks.cancel({ start: rangeBounds.start, end: rangeBounds.end });
      const previous = utils.calendar.getCalendarTasks.getData({ start: rangeBounds.start, end: rangeBounds.end });

      utils.calendar.getCalendarTasks.setData({ start: rangeBounds.start, end: rangeBounds.end }, (old) => {
        if (!old) return old;
        return old.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)) as any;
      });

      return { previous };
    },
    onSuccess: () => {
      toast.success("Task rescheduled!");
      utils.calendar.getCalendarTasks.invalidate();
      utils.task.getMyTasks.invalidate();
    },
    onError: (_err, _updated, context) => {
      if (context?.previous) {
        utils.calendar.getCalendarTasks.setData({ start: rangeBounds.start, end: rangeBounds.end }, context.previous);
      }
      toast.error("Failed to reschedule task.");
    },
  });

  const createTaskMutation = api.task.createTask.useMutation({
    onSuccess: () => {
      toast.success("Task created successfully!");
      utils.calendar.getCalendarTasks.invalidate();
      utils.task.getMyTasks.invalidate();
      setCreateTaskDate(null);
      // Reset form
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskPriority("medium");
      setNewTaskHiveId("personal");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create task.");
    }
  });

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    updateTaskMutation.mutate({
      id: taskId,
      dueAt: targetDate.toISOString(),
    });
  };

  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !createTaskDate) return;

    createTaskMutation.mutate({
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || null,
      priority: newTaskPriority,
      dueAt: createTaskDate.toISOString(),
      hiveId: newTaskHiveId === "personal" ? null : newTaskHiveId,
    });
  };

  // Switch view URL parameter
  const setView = (view: typeof viewParam) => {
    router.push(`/calendar?view=${view}`);
  };

  // Grid dates generator
  const daysGrid = React.useMemo(() => {
    const grid = [];
    const date = new Date(rangeBounds.start);
    const end = new Date(rangeBounds.end);

    while (date <= end) {
      grid.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return grid;
  }, [rangeBounds]);

  // Current time marker offset for Week View
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM to 10 PM

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <CalendarIcon className="size-6 text-primary" />
            Schedule Calendar
          </h2>
          <p className="text-xs text-muted-foreground font-semibold">
            Organise and view all deadlines, milestones, and personal tasks.
          </p>
        </div>

        {/* View Switcher Button Group */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border w-fit shrink-0">
          <Button
            variant={viewParam === "month" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setView("month")}
            className="text-[10px] font-bold h-7 px-3 rounded-lg cursor-pointer"
          >
            Month
          </Button>
          <Button
            variant={viewParam === "week" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setView("week")}
            className="text-[10px] font-bold h-7 px-3 rounded-lg cursor-pointer"
          >
            Week
          </Button>
          <Button
            variant={viewParam === "day" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setView("day")}
            className="text-[10px] font-bold h-7 px-3 rounded-lg cursor-pointer"
          >
            Day
          </Button>
        </div>
      </div>

      {/* Date Navigation Toolbar */}
      <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev} className="size-8 rounded-lg cursor-pointer border-border/85">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday} className="text-xs font-bold h-8 px-3 rounded-lg cursor-pointer border-border/85">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext} className="size-8 rounded-lg cursor-pointer border-border/85">
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <span className="text-sm font-black text-foreground">
          {currentDate.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
            ...(viewParam !== "month" && { day: "numeric" }),
          })}
        </span>
      </div>

      {/* Main Calendar View Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3 bg-card border border-border/80 rounded-2xl">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-semibold">Loading schedule tasks...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-destructive bg-card border border-border/80 rounded-2xl">
          <AlertCircle className="size-8" />
          <p className="text-xs font-bold">Failed to load calendar events.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border/80 shadow-xs overflow-hidden">
          
          {/* MONTH VIEW */}
          {viewParam === "month" && (
            <div className="grid grid-cols-7 border-b border-border/40 text-center text-[10px] font-bold text-muted-foreground bg-muted/10 uppercase tracking-wider">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="py-2 border-r border-border/20 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
          )}

          {viewParam === "month" && (
            <div className="grid grid-cols-7 auto-rows-[120px] divide-x divide-y divide-border/20 bg-surface">
              {daysGrid.map((day) => {
                const dayTasks = tasks.filter(
                  (t) => t.dueAt && new Date(t.dueAt).toDateString() === day.toDateString()
                );
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = day.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={day.toISOString()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      // drop default to noon 12:00
                      const d = new Date(day);
                      d.setHours(12, 0, 0, 0);
                      handleDrop(e, d);
                    }}
                    onClick={() => {
                      const d = new Date(day);
                      d.setHours(12, 0, 0, 0);
                      setCreateTaskDate(d);
                    }}
                    className={cn(
                      "p-2 flex flex-col gap-1.5 min-w-0 transition-colors select-none cursor-pointer hover:bg-muted/5",
                      !isCurrentMonth && "bg-muted/10 text-muted-foreground/40",
                      isToday && "bg-primary/5 border border-primary/20"
                    )}
                  >
                    {/* Day Number */}
                    <span className={cn(
                      "text-[10px] font-black size-5 rounded-full flex items-center justify-center",
                      isToday && "bg-primary text-primary-foreground",
                      !isToday && isCurrentMonth && "text-foreground",
                      !isToday && !isCurrentMonth && "text-muted-foreground/30"
                    )}>
                      {day.getDate()}
                    </span>

                    {/* Day Task Badges */}
                    <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
                      {dayTasks.map((t) => {
                        const style = t.hiveId && t.colorTheme && themeStyles[t.colorTheme]
                          ? themeStyles[t.colorTheme]
                          : t.hiveId ? themeStyles.blue : themeStyles.personal;

                        return (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTaskId(t.id);
                            }}
                            className={cn(
                              "text-[9px] px-2 py-0.5 rounded-md border truncate font-bold cursor-pointer hover:opacity-85 transition-all shadow-inner",
                              style.bg,
                              style.text,
                              style.border
                            )}
                          >
                            {t.title}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* WEEK VIEW */}
          {viewParam === "week" && (
            <div className="overflow-x-auto">
              <div className="min-w-[800px] flex flex-col">
                {/* Week Header */}
                <div className="flex border-b border-border/40 bg-muted/10">
                  <div className="w-16 py-2.5 text-center text-[10px] font-bold text-muted-foreground shrink-0 border-r border-border/20 uppercase tracking-wider">
                    Time
                  </div>
                  {daysGrid.slice(0, 7).map((day) => {
                    const isToday = day.toDateString() === new Date().toDateString();
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "flex-1 py-2 text-center text-xs font-bold border-r border-border/20 last:border-r-0 flex flex-col items-center justify-center gap-0.5",
                          isToday && "bg-primary/5 text-primary"
                        )}
                      >
                        <span className="text-[10px] text-muted-foreground uppercase">{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
                        <span className={cn(
                          "text-xs font-black size-6 rounded-full flex items-center justify-center",
                          isToday && "bg-primary text-primary-foreground"
                        )}>
                          {day.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Week Hour Slots */}
                <div className="flex flex-col relative divide-y divide-border/20">
                  {hours.map((hour) => (
                    <div key={hour} className="flex h-14 items-stretch divide-x divide-border/20">
                      {/* Hour Label */}
                      <div className="w-16 text-[9px] font-bold text-muted-foreground text-center py-2 shrink-0 border-r border-border/20 uppercase tracking-wider select-none bg-muted/5">
                        {hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`}
                      </div>

                      {/* Day Dropzones */}
                      {daysGrid.slice(0, 7).map((day) => {
                        const targetTime = new Date(day);
                        targetTime.setHours(hour, 0, 0, 0);

                        // Find tasks falling inside this hour segment
                        const hourTasks = tasks.filter((t) => {
                          if (!t.dueAt) return false;
                          const d = new Date(t.dueAt);
                          return d.toDateString() === day.toDateString() && d.getHours() === hour;
                        });

                        return (
                          <div
                            key={day.toISOString() + hour}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, targetTime)}
                            onClick={() => setCreateTaskDate(targetTime)}
                            className="flex-1 relative p-1 bg-surface hover:bg-muted/5 transition-colors group cursor-pointer"
                          >
                            <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-primary/5 pointer-events-none">
                              <span className="text-[8px] font-bold text-primary tracking-wide uppercase opacity-75">Reschedule / Create here</span>
                            </div>

                            {/* Render hour task cards */}
                            <div className="relative h-full w-full flex flex-col gap-1 z-10">
                              {hourTasks.map((t) => {
                                const style = t.hiveId && t.colorTheme && themeStyles[t.colorTheme]
                                  ? themeStyles[t.colorTheme]
                                  : t.hiveId ? themeStyles.blue : themeStyles.personal;

                                return (
                                  <div
                                    key={t.id}
                                    draggable
                                    onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTaskId(t.id);
                                    }}
                                    className={cn(
                                      "text-[9px] p-1.5 rounded-lg border font-bold cursor-pointer hover:opacity-90 shadow-sm truncate flex items-center justify-between gap-1",
                                      style.bg,
                                      style.text,
                                      style.border
                                    )}
                                  >
                                    <span className="truncate">{t.title}</span>
                                    <Clock className="size-3 text-muted-foreground opacity-60 shrink-0" />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Red Current Time Line Indicator */}
                  {viewParam === "week" && now.getHours() >= 6 && now.getHours() <= 22 && (
                    <div 
                      className="absolute left-16 right-0 border-t-2 border-rose-500 pointer-events-none z-20 flex items-center"
                      style={{
                        top: `${((now.getHours() - 6) * 56) + (now.getMinutes() / 60 * 56)}px`
                      }}
                    >
                      <span className="size-2 rounded-full bg-rose-500 -ml-1 shrink-0" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DAY VIEW */}
          {viewParam === "day" && (
            <div className="flex flex-col divide-y divide-border/20 bg-surface">
              {hours.map((hour) => {
                const targetTime = new Date(currentDate);
                targetTime.setHours(hour, 0, 0, 0);

                const hourTasks = tasks.filter((t) => {
                  if (!t.dueAt) return false;
                  const d = new Date(t.dueAt);
                  return d.toDateString() === currentDate.toDateString() && d.getHours() === hour;
                });

                return (
                  <div key={hour} className="flex h-16 items-stretch divide-x divide-border/20">
                    <div className="w-20 text-[10px] font-bold text-muted-foreground text-center py-4 shrink-0 uppercase tracking-wider select-none bg-muted/5">
                      {hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`}
                    </div>

                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, targetTime)}
                      onClick={() => setCreateTaskDate(targetTime)}
                      className="flex-1 relative p-2 bg-surface hover:bg-muted/5 transition-colors flex items-center gap-2 group cursor-pointer"
                    >
                      <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-primary/5 pointer-events-none">
                        <span className="text-[9px] font-bold text-primary tracking-wide uppercase opacity-75">Reschedule / Create here</span>
                      </div>

                      {hourTasks.map((t) => {
                        const style = t.hiveId && t.colorTheme && themeStyles[t.colorTheme]
                          ? themeStyles[t.colorTheme]
                          : t.hiveId ? themeStyles.blue : themeStyles.personal;

                        return (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTaskId(t.id);
                            }}
                            className={cn(
                              "text-xs px-3 py-2 rounded-xl border font-bold cursor-pointer hover:opacity-90 shadow-sm flex items-center justify-between gap-4 max-w-sm min-w-[200px]",
                              style.bg,
                              style.text,
                              style.border
                            )}
                          >
                            <span className="truncate">{t.title}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={cn("text-[9px] font-bold uppercase", priorityColors[t.priority])}>
                                {t.priority}
                              </Badge>
                              {t.courseCode && (
                                <Badge variant="outline" className="text-[9px] font-black uppercase bg-muted/50 text-muted-foreground border-border/80">
                                  {t.courseCode}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Create Task Dialog */}
      <Dialog open={!!createTaskDate} onOpenChange={(open) => { if (!open) setCreateTaskDate(null); }}>
        <DialogContent className="max-w-md bg-card border border-border p-6 rounded-2xl shadow-xl">
          <form onSubmit={handleCreateTaskSubmit}>
            <DialogHeader className="pb-4 border-b border-border/40">
              <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
                <Plus className="size-4.5 text-primary" />
                Create New Task
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Add a task directly to your schedule.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Title</label>
                <Input
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Study Chemistry Chapter 4"
                  className="h-9 focus-visible:ring-1 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Description (Optional)</label>
                <Input
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Brief notes or links..."
                  className="h-9 focus-visible:ring-1 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full h-9 bg-card border border-border rounded-lg text-xs px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Associate with Hive</label>
                  <select
                    value={newTaskHiveId}
                    onChange={(e) => setNewTaskHiveId(e.target.value)}
                    className="w-full h-9 bg-card border border-border rounded-lg text-xs px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="personal">Personal (no hive)</option>
                    {hivesData.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.courseCode || h.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Due At</label>
                <div className="text-muted-foreground bg-muted/30 p-2.5 rounded-lg border text-xs">
                  {createTaskDate?.toLocaleString()}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border/40 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateTaskDate(null)}
                className="h-8.5 text-xs rounded-lg font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-8.5 text-xs bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg font-bold cursor-pointer shadow-xs"
              >
                Create Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CalendarPage(props: CalendarPageProps) {
  return (
    <React.Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-semibold animate-pulse">Loading calendar...</p>
        </div>
      </div>
    }>
      <CalendarPageContent {...props} />
    </React.Suspense>
  );
}
