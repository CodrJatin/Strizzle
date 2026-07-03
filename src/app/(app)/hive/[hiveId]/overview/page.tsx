"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { 
  Users, FileText, CheckSquare, Plus, Trash2, Edit3, Loader2,
  Calendar, AlertCircle, Check, MessageSquare, Shield, Activity
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ hiveId: string }>;
}

export default function OverviewPage({ params }: PageProps) {
  const { hiveId } = React.use(params);
  const router = useRouter();
  const utils = api.useUtils();

  // Queries
  const { data: hive, isLoading: isLoadingHive } = api.hive.getHive.useQuery(
    { hiveId },
    { staleTime: 300000 } // Slow-changing hive details: 5 minutes
  );
  const { data: overview, isLoading: isLoadingOverview } = api.hive.getHiveOverview.useQuery(
    { hiveId },
    { staleTime: 30000 } // High-frequency live data (hive overview): 30 seconds
  );

  // Mutations
  const createAnnouncementMutation = api.announcement.createAnnouncement.useMutation({
    onMutate: async (newAnn) => {
      await utils.hive.getHiveOverview.cancel({ hiveId });
      const previous = utils.hive.getHiveOverview.getData({ hiveId });
      const me = utils.user.getMe.getData();

      utils.hive.getHiveOverview.setData({ hiveId }, (old) => {
        if (!old) return old;
        const tempAnn = {
          id: "temp-ann-" + Math.random().toString(),
          hiveId,
          title: newAnn.title,
          body: newAnn.body,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          authorId: me?.id || "temp-author",
          author: {
            fullName: me?.fullName || "Me",
            avatarUrl: me?.avatarUrl || null,
          },
        };
        return {
          ...old,
          announcements: [tempAnn, ...old.announcements],
        };
      });

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        utils.hive.getHiveOverview.setData({ hiveId }, context.previous);
      }
      toast.error(error.message || "Something went wrong. Failed to post announcement.");
    },
    onSuccess: () => {
      toast.success("Announcement posted successfully!");
      setPostDialogOpen(false);
      setNewTitle("");
      setNewBody("");
    },
    onSettled: () => {
      utils.hive.getHiveOverview.invalidate({ hiveId });
    }
  });

  const deleteAnnouncementMutation = api.announcement.deleteAnnouncement.useMutation({
    onMutate: async (variables) => {
      await utils.hive.getHiveOverview.cancel({ hiveId });
      const previous = utils.hive.getHiveOverview.getData({ hiveId });

      utils.hive.getHiveOverview.setData({ hiveId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          announcements: old.announcements.filter((a) => a.id !== variables.announcementId),
        };
      });

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        utils.hive.getHiveOverview.setData({ hiveId }, context.previous);
      }
      toast.error(error.message || "Something went wrong. Failed to delete announcement.");
    },
    onSuccess: () => {
      toast.success("Announcement deleted.");
    },
    onSettled: () => {
      utils.hive.getHiveOverview.invalidate({ hiveId });
    }
  });

  // State
  const [postDialogOpen, setPostDialogOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newBody, setNewBody] = React.useState("");

  const [expandedAnnouncements, setExpandedAnnouncements] = React.useState<Record<string, boolean>>({});

  // Helper: Get user's initials
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
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Helper: Render timeline icon based on action type
  const getTimelineIcon = (actionType: string) => {
    const baseClass = "flex items-center justify-center size-8 rounded-full border shadow-sm";
    switch (actionType) {
      case "hive_joined":
        return (
          <div className={`${baseClass} bg-green-50 text-green-600 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800/30`}>
            <Users className="size-4" />
          </div>
        );
      case "announcement_created":
        return (
          <div className={`${baseClass} bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800/30`}>
            <MessageSquare className="size-4" />
          </div>
        );
      case "role_changed":
        return (
          <div className={`${baseClass} bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-800/30`}>
            <Shield className="size-4" />
          </div>
        );
      case "material_created":
        return (
          <div className={`${baseClass} bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/30`}>
            <FileText className="size-4" />
          </div>
        );
      case "task_created":
        return (
          <div className={`${baseClass} bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-800/30`}>
            <CheckSquare className="size-4" />
          </div>
        );
      default:
        return (
          <div className={`${baseClass} bg-muted text-muted-foreground border-border`}>
            <Activity className="size-4" />
          </div>
        );
    }
  };

  const [addedCalendars, setAddedCalendars] = React.useState<Record<string, boolean>>({});

  const addToCalendarMutation = api.task.addToCalendar.useMutation({
    onSuccess: (data, variables) => {
      setAddedCalendars((prev) => ({ ...prev, [variables.sourceRefId]: true }));
      toast.success("Added to your personal calendar!");
      utils.calendar.getCalendarTasks.invalidate();
      utils.task.getMyTasks.invalidate();
    },
    onError: () => {
      toast.error("Failed to add deadline to calendar.");
    }
  });

  const handleAddToCalendar = (task: any) => {
    if (!task.dueAt) return;
    addToCalendarMutation.mutate({
      sourceRefId: task.id,
      title: task.title,
      dueAt: new Date(task.dueAt).toISOString(),
      hiveId: hiveId,
    });
  };

  // Loading states
  const isLoading = isLoadingHive || isLoadingOverview;

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading overview dashboard...</p>
        </div>
      </div>
    );
  }

  if (!hive || !overview) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-2xl bg-card">
        <AlertCircle className="size-12 text-destructive mb-3" />
        <h2 className="text-lg font-bold">Failed to load overview</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm mt-1">
          Make sure you are a member of this hive and have sufficient permissions.
        </p>
        <Button onClick={() => router.push("/dashboard")} variant="outline" className="mt-4">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const isAdminOrOwner = hive.role === "admin" || hive.role === "owner";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hive Header Section */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 pb-6 border-b border-border/60">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {hive.courseCode && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100/80 text-green-800 border border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/30">
                {hive.courseCode}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-muted-foreground bg-muted/60 border border-border/50">
              <Calendar className="size-3.5" />
              Created {new Date(hive.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
            {hive.name}
          </h1>

          {hive.description && (
            <p className="text-muted-foreground max-w-2xl leading-relaxed text-sm md:text-base">
              {hive.description}
            </p>
          )}

          {/* Quick info pills */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-card border border-border shadow-sm text-foreground">
              <Users className="size-4 text-primary" />
              {overview.memberCount} Members
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-card border border-border shadow-sm text-foreground">
              <FileText className="size-4 text-primary" />
              {overview.materialsCount} Materials
            </span>
          </div>
        </div>

        {/* Edit Button for Admins / Owners */}
        {isAdminOrOwner && (
          <Button 
            onClick={() => router.push(`/hive/${hiveId}/settings`)}
            variant="outline" 
            className="rounded-xl flex items-center gap-2 h-10 border-border bg-card shadow-sm cursor-pointer"
          >
            <Edit3 className="size-4" />
            Edit Details
          </Button>
        )}
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Announcements */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <MessageSquare className="size-5 text-primary" />
              Announcements
            </h2>

            {/* Post button for admins */}
            {isAdminOrOwner && (
              <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl flex items-center gap-1.5 h-9 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-4 shadow-sm">
                    <Plus className="size-4" />
                    Post
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md border-border bg-card">
                  <DialogHeader>
                    <DialogTitle>Post Announcement</DialogTitle>
                    <DialogDescription>Broadcast a new announcement to all members of this workspace.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Title</label>
                      <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Midterm Exam Details" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Body</label>
                      <Textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={5} placeholder="Good afternoon class, the exam will consist of..." />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setPostDialogOpen(false)}>Cancel</Button>
                    <Button 
                      onClick={() => createAnnouncementMutation.mutate({ hiveId, title: newTitle, body: newBody })}
                      disabled={createAnnouncementMutation.isPending || !newTitle.trim() || !newBody.trim()}
                    >
                      {createAnnouncementMutation.isPending ? <Loader2 className="animate-spin size-4" /> : "Publish Announcement"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Announcements List */}
          {overview.announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border/80 rounded-2xl bg-card text-center">
              <MessageSquare className="size-10 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-semibold text-foreground">No announcements posted yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Check back later or check settings for workspace updates.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {overview.announcements.map((item) => {
                const isExpanded = !!expandedAnnouncements[item.id];
                const authorName = item.author?.fullName || "User";
                const isAuthorOrAdmin = hive.role === "owner" || hive.role === "admin" || item.authorId === hive.ownerId; // simplify author delete check

                return (
                  <Card key={item.id} className="border-border shadow-sm bg-card overflow-hidden hover:shadow-md transition-all duration-200">
                    <CardHeader className="flex flex-row items-start justify-between gap-4 p-5 pb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10 border border-border shadow-sm">
                          <AvatarImage src={item.author?.avatarUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                            {getInitials(authorName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-foreground truncate">{authorName}</span>
                          <span className="text-xs text-muted-foreground">{formatTime(item.createdAt)}</span>
                        </div>
                      </div>

                      {/* Delete Trigger */}
                      {isAuthorOrAdmin && (
                        <Button 
                          onClick={() => deleteAnnouncementMutation.mutate({ announcementId: item.id })}
                          variant="ghost" 
                          size="icon" 
                          className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="size-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="p-5 pt-0 space-y-3">
                      <h3 className="text-base font-bold text-foreground leading-snug">
                        {item.title}
                      </h3>
                      <p 
                        className={cn(
                          "text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap",
                          !isExpanded && "line-clamp-3"
                        )}
                      >
                        {item.body}
                      </p>
                      <button
                        onClick={() => setExpandedAnnouncements((prev) => ({ ...prev, [item.id]: !isExpanded }))}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer focus:outline-none"
                      >
                        {isExpanded ? "Show less" : "Read more ->"}
                      </button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Deadlines and Activity */}
        <div className="space-y-6">
          {/* Card 1: Upcoming Deadlines */}
          <Card className="border-border shadow-sm bg-card overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between p-5 border-b border-border/40 bg-muted/10">
              <div className="flex items-center gap-2">
                <Calendar className="size-4.5 text-primary" />
                <CardTitle className="text-sm font-bold tracking-tight text-foreground">Upcoming Deadlines</CardTitle>
              </div>
              <Button onClick={() => router.push(`/hive/${hiveId}/tasks`)} variant="link" className="text-xs font-semibold p-0 h-auto text-primary">
                View All
              </Button>
            </CardHeader>
            <CardContent className="p-4 divide-y divide-border/40">
              {overview.deadlines.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No upcoming deadlines.</p>
              ) : (
                overview.deadlines.map((task) => {
                  const isOverdue = task.dueAt ? new Date() > new Date(task.dueAt) : false;
                  const isAdded = !!addedCalendars[task.id];

                  // Map priority to dots
                  const priorityColors = {
                    low: "bg-gray-400 border-gray-500",
                    medium: "bg-green-500 border-green-600",
                    high: "bg-orange-500 border-orange-600",
                    urgent: "bg-red-500 border-red-600",
                  };

                  return (
                    <div key={task.id} className="flex items-center justify-between gap-3 py-3.5 first:pt-1 last:pb-1">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span 
                          className={cn(
                            "size-2 rounded-full border shrink-0 mt-1.5 shadow-sm",
                            priorityColors[task.priority]
                          )} 
                          title={`Priority: ${task.priority}`}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-foreground truncate">{task.title}</span>
                          <span className={cn("text-[10px] font-medium", isOverdue ? "text-destructive font-semibold" : "text-muted-foreground")}>
                            {task.dueAt ? formatTime(task.dueAt) : "No due date"}
                          </span>
                        </div>
                      </div>

                      {/* Add to Calendar / Action Button */}
                      {isAdded ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                          <Check className="size-3" />
                          Added
                        </span>
                      ) : (
                        <Button 
                          onClick={() => handleAddToCalendar(task)}
                          variant="outline" 
                          className="h-7 text-[10px] font-semibold px-2.5 rounded-lg border-border hover:bg-muted bg-card shadow-sm cursor-pointer"
                        >
                          Add
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Card 2: Recent Activity log */}
          <Card className="border-border shadow-sm bg-card overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-2 p-5 border-b border-border/40 bg-muted/10">
              <CardTitle className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                Activity
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {overview.activity.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No recent workspace activity.</p>
              ) : (
                <div className="relative pl-6 border-l-2 border-border/60 space-y-6">
                  {overview.activity.map((log) => {
                    const formattedTime = formatTime(log.createdAt);

                    // Create friendly activity description strings
                    const renderActivityDescription = () => {
                      switch (log.actionType) {
                        case "hive_joined":
                          return <>Joined the hive.</>;
                        case "announcement_created":
                          return <>Posted a new announcement.</>;
                        case "role_changed":
                          return (
                            <>
                              Role updated to{" "}
                              <span className="font-semibold capitalize text-foreground">
                                {String((log.meta as Record<string, unknown> | null)?.newRole || "")}
                              </span>
                            </>
                          );
                        case "material_created":
                          return <>Shared a new material.</>;
                        case "task_created":
                          return <>Created a new workspace task.</>;
                        default:
                          return <>Performed an activity.</>;
                      }
                    };

                    return (
                      <div key={log.id} className="relative">
                        {/* Timeline Icon */}
                        <div className="absolute -left-10 top-0.5">
                          {getTimelineIcon(log.actionType)}
                        </div>
                        <div className="flex flex-col text-xs leading-normal">
                          <span className="text-muted-foreground">
                            <span className="font-bold text-foreground">
                              {log.actor?.fullName || "Member"}
                            </span>{" "}
                            {renderActivityDescription()}
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">{formattedTime}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
