"use client";

import * as React from "react";
import { 
  CheckSquare, PlayCircle, AlertCircle, CheckCircle, 
  Calendar, AlertTriangle, Eye, ArrowUpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TaskFeedItemProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    status: "todo" | "in_progress" | "blocked" | "done";
    priority: "low" | "medium" | "high" | "urgent";
    dueAt: Date | string | null;
  };
  onTaskClick: (taskId: string) => void;
}

const statusIcons = {
  todo: CheckSquare,
  in_progress: PlayCircle,
  blocked: AlertCircle,
  done: CheckCircle,
};

const statusLabels = {
  todo: "To Do",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Completed",
};

const statusColors = {
  todo: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25",
  in_progress: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
  blocked: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
  done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
};

const priorityColors = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-400 border-slate-200/50 dark:border-slate-800",
  medium: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100/50 dark:border-blue-900/30",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100/50 dark:border-amber-900/30",
  urgent: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-200/50 dark:border-rose-950/30",
};

export function TaskFeedItem({ task, onTaskClick }: TaskFeedItemProps) {
  const StatusIcon = statusIcons[task.status] || CheckSquare;
  const dueAtDate = task.dueAt ? new Date(task.dueAt) : null;
  const isOverdue = dueAtDate && dueAtDate < new Date() && task.status !== "done";

  const formattedDate = dueAtDate
    ? dueAtDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className={cn(
      "mt-2.5 w-full border rounded-xl p-4 bg-card shadow-xs flex flex-col gap-3 hover:shadow-sm transition-all duration-200",
      task.status === "done" ? "border-border/60 bg-muted/5 opacity-80" : "border-border/80"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={cn(
            "size-6.5 rounded-md flex items-center justify-center shrink-0 mt-0.5",
            task.status === "done" 
              ? "bg-emerald-500/10 text-emerald-500" 
              : "bg-indigo-500/10 text-indigo-500"
          )}>
            <StatusIcon className="size-3.5" />
          </div>
          <div className="space-y-1 min-w-0">
            <h4 className={cn(
              "text-sm font-bold text-foreground leading-snug truncate-hover",
              task.status === "done" && "line-through text-muted-foreground/60 font-semibold"
            )}>
              {task.title}
            </h4>
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed whitespace-pre-wrap">
                {task.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-border/30 mt-1.5 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Badge */}
          <Badge 
            variant="outline" 
            className={cn("text-[9px] px-1.5 py-0.5 font-bold uppercase rounded-md border", statusColors[task.status])}
          >
            {statusLabels[task.status]}
          </Badge>

          {/* Priority Badge */}
          <Badge 
            variant="outline" 
            className={cn("text-[9px] px-1.5 py-0.5 font-bold uppercase rounded-md border", priorityColors[task.priority])}
          >
            {task.priority}
          </Badge>

          {/* Due date */}
          {formattedDate && (
            <div className={cn(
              "flex items-center gap-1 text-[10px] font-bold",
              isOverdue ? "text-rose-600 dark:text-rose-500" : "text-muted-foreground"
            )}>
              {isOverdue ? <AlertTriangle className="size-3" /> : <Calendar className="size-3" />}
              <span>{formattedDate}</span>
            </div>
          )}
        </div>

        <Button
          onClick={() => onTaskClick(task.id)}
          variant="outline"
          size="xs"
          className="h-7 text-[10px] font-semibold text-primary hover:bg-primary/5 cursor-pointer ml-auto border-primary/20 hover:border-primary/45"
        >
          <Eye className="size-3 mr-1" /> Task Details
        </Button>
      </div>
    </div>
  );
}
