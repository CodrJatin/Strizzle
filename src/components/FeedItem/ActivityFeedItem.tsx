"use client";

import * as React from "react";
import { Users, ShieldAlert, BookOpen, Layers, Settings, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityFeedItemProps {
  actionType: string;
  meta: any;
}

export function ActivityFeedItem({ actionType, meta }: ActivityFeedItemProps) {
  const getFallbackDetails = () => {
    const iconClass = "size-4 text-primary";
    const bgClass = "bg-primary/5 border-primary/10";
    
    switch (actionType) {
      case "hive_joined":
        return {
          icon: <Users className="size-4 text-emerald-500" />,
          bg: "bg-emerald-500/5 dark:bg-emerald-500/2 border-emerald-500/10",
          title: "New member joined!",
          body: meta?.userName ? `${meta.userName} is now a member of the hive.` : "A new member joined the hive.",
        };
      case "role_changed":
        return {
          icon: <Settings className="size-4 text-purple-500" />,
          bg: "bg-purple-500/5 dark:bg-purple-500/2 border-purple-500/10",
          title: "Role updated",
          body: `Member role was updated to ${meta?.role || "member"}.`,
        };
      case "unit_created":
        return {
          icon: <BookOpen className="size-4 text-blue-500" />,
          bg: "bg-blue-500/5 dark:bg-blue-500/2 border-blue-500/10",
          title: "Syllabus unit added",
          body: meta?.title ? `New unit created: "${meta.title}"` : "A new unit was added to the syllabus.",
        };
      case "unit_updated":
        return {
          icon: <BookOpen className="size-4 text-sky-500" />,
          bg: "bg-sky-500/5 dark:bg-sky-500/2 border-sky-500/10",
          title: "Syllabus unit updated",
          body: meta?.title ? `Unit updated: "${meta.title}"` : "A unit in the syllabus was updated.",
        };
      case "unit_deleted":
        return {
          icon: <BookOpen className="size-4 text-rose-500" />,
          bg: "bg-rose-500/5 dark:bg-rose-500/2 border-rose-500/10",
          title: "Syllabus unit removed",
          body: meta?.title ? `Unit deleted: "${meta.title}"` : "A syllabus unit was deleted.",
        };
      case "topic_created":
        return {
          icon: <Layers className="size-4 text-indigo-500" />,
          bg: "bg-indigo-500/5 dark:bg-indigo-500/2 border-indigo-500/10",
          title: "Syllabus topic added",
          body: meta?.title ? `Topic added: "${meta.title}"` : "A new topic was added to the syllabus.",
        };
      case "topic_updated":
        return {
          icon: <Layers className="size-4 text-violet-500" />,
          bg: "bg-violet-500/5 dark:bg-violet-500/2 border-violet-500/10",
          title: "Syllabus topic updated",
          body: meta?.title ? `Topic updated: "${meta.title}"` : "A topic in the syllabus was updated.",
        };
      case "topic_deleted":
        return {
          icon: <Layers className="size-4 text-rose-500" />,
          bg: "bg-rose-500/5 dark:bg-rose-500/2 border-rose-500/10",
          title: "Syllabus topic removed",
          body: meta?.title ? `Topic deleted: "${meta.title}"` : "A topic in the syllabus was deleted.",
        };
      default:
        return {
          icon: <Activity className={iconClass} />,
          bg: bgClass,
          title: "General Activity",
          body: meta?.description || "An action was recorded in the hive.",
        };
    }
  };

  const details = getFallbackDetails();

  return (
    <div className={cn(
      "mt-2.5 w-full border rounded-xl p-3.5 flex items-start gap-3 text-xs leading-normal",
      details.bg
    )}>
      <div className="size-6.5 rounded-md bg-background flex items-center justify-center border border-border/40 shrink-0 mt-0.5 shadow-2xs">
        {details.icon}
      </div>
      <div className="space-y-0.5 min-w-0 flex-1">
        <h5 className="font-bold text-foreground">{details.title}</h5>
        <p className="text-muted-foreground">{details.body}</p>
      </div>
    </div>
  );
}
