"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  Calendar, Link2, AlertTriangle, User, MoreVertical,
  CheckCircle, Clock, Square, PlayCircle, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueAt?: Date | string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  assigneeAvatar?: string | null;
  materials: Array<{ id: string; title: string; contentType: string }>;
}

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onMoveColumn?: (newStatus: Task["status"]) => void;
  isOverlay?: boolean;
}

const priorityColors = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-400 border-slate-200/50 dark:border-slate-800",
  medium: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100/50 dark:border-blue-900/30",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100/50 dark:border-amber-900/30",
  urgent: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-200/50 dark:border-rose-950/30 animate-pulse",
};

const statusIcons = {
  todo: Square,
  in_progress: PlayCircle,
  blocked: AlertCircle,
  done: CheckCircle,
};

export function TaskCard({ task, onClick, onMoveColumn, isOverlay }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = isOverlay ? undefined : {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dueAtDate = task.dueAt ? new Date(task.dueAt) : null;
  const isOverdue = dueAtDate && dueAtDate < new Date() && task.status !== "done";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      // Prevent opening click handler if dropdown is focused
      if (document.activeElement?.getAttribute("role") === "menuitem") return;
      onClick();
    }
  };

  const formattedDate = dueAtDate
    ? dueAtDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      ref={isOverlay ? null : setNodeRef}
      style={style}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={cn(
        "group relative flex flex-col gap-3.5 p-4 rounded-xl border border-border bg-card text-card-foreground shadow-xs hover:shadow-md transition-all cursor-pointer select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isDragging && !isOverlay && "opacity-25 scale-98 border-dashed border-primary/20 bg-muted/10 shadow-none",
        isOverlay && "rotate-2 scale-102 shadow-xl border-primary/30 ring-2 ring-primary/20 cursor-grabbing bg-card z-50 pointer-events-none",
        task.status === "done" && "border-border/60 dark:border-zinc-900 bg-muted/5"
      )}
      onClick={onClick}
    >
      {/* Header Info (Priority + Dropdown controls) */}
      <div className="flex items-center justify-between">
        <Badge 
          variant="outline" 
          className={cn(
            "text-[9px] px-2 py-0.5 font-bold uppercase tracking-wide rounded-md border shrink-0", 
            priorityColors[task.priority]
          )}
        >
          {task.priority}
        </Badge>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Accessible Menu for Move Options */}
          {onMoveColumn && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="size-7 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer shrink-0"
                >
                  <MoreVertical className="size-4" />
                  <span className="sr-only">Move Task</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 font-semibold text-xs rounded-xl">
                <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-bold px-3 py-1.5">Move to...</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={task.status === "todo"} onClick={() => onMoveColumn("todo")} className="cursor-pointer">
                  Todo
                </DropdownMenuItem>
                <DropdownMenuItem disabled={task.status === "in_progress"} onClick={() => onMoveColumn("in_progress")} className="cursor-pointer">
                  In Progress
                </DropdownMenuItem>
                <DropdownMenuItem disabled={task.status === "blocked"} onClick={() => onMoveColumn("blocked")} className="cursor-pointer">
                  Blocked
                </DropdownMenuItem>
                <DropdownMenuItem disabled={task.status === "done"} onClick={() => onMoveColumn("done")} className="cursor-pointer">
                  Completed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Drag Handle Overlay */}
          <div 
            {...attributes} 
            {...listeners} 
            className="hidden group-hover:flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
          >
            <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM7 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM7 14a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Task Title */}
      <div className="space-y-1">
        <h4 className={cn(
          "text-sm font-bold text-foreground leading-snug line-clamp-2",
          task.status === "done" && "line-through text-muted-foreground/60 font-semibold"
        )}>
          {task.title}
        </h4>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}
      </div>

      {/* Footer Info (Due date, Ref Count, Assignee) */}
      <div className="flex items-center justify-between gap-3 pt-1 mt-auto">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Due date */}
          {formattedDate && (
            <div 
              className={cn(
                "flex items-center gap-1 text-[10px] font-bold shrink-0",
                isOverdue 
                  ? "text-rose-600 dark:text-rose-500" 
                  : "text-muted-foreground"
              )}
            >
              {isOverdue ? (
                <AlertTriangle className="size-3 shrink-0" />
              ) : (
                <Calendar className="size-3 shrink-0" />
              )}
              <span className="truncate">{formattedDate}</span>
            </div>
          )}

          {/* Linked reference count badge */}
          {task.materials.length > 0 && (
            <div 
              className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 shrink-0"
              title={`${task.materials.length} reference materials attached`}
            >
              <Link2 className="size-3 shrink-0" />
              <span>{task.materials.length}</span>
            </div>
          )}
        </div>

        {/* Assignee Avatar */}
        <div className="shrink-0 ml-auto">
          {task.assigneeId ? (
            <Avatar className="size-6 border border-border shadow-xs shrink-0" title={`Assigned to ${task.assigneeName || "Member"}`}>
              <AvatarImage src={task.assigneeAvatar || ""} alt={task.assigneeName || "Assignee"} />
              <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary uppercase">
                {task.assigneeName ? task.assigneeName.split(" ").map((n) => n[0]).join("").slice(0, 2) : <User className="size-3" />}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div 
              className="size-6 rounded-full border border-dashed border-border/80 flex items-center justify-center text-muted-foreground/60 shrink-0 hover:bg-muted/30 transition-all"
              title="Unassigned"
            >
              <User className="size-3" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
