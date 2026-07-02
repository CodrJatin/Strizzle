"use client";

import * as React from "react";
import { 
  DndContext, DragEndEvent, PointerSensor, 
  useSensor, useSensors, KeyboardSensor, closestCorners 
} from "@dnd-kit/core";
import { 
  SortableContext, verticalListSortingStrategy, 
  useSortable, sortableKeyboardCoordinates 
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  Plus, Check, Trash2, Edit3, Loader2, BookOpen,
  ChevronDown, ChevronUp, GripVertical, AlertCircle, FileText,
  Link2, CheckCircle2, ShieldAlert
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { api } from "@/lib/trpc/client";
import { useHiveStore } from "@/store/hiveStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface PageProps {
  params: Promise<{ hiveId: string }>;
}

// Sortable Syllabus Unit Component
interface SortableUnitProps {
  unit: any;
  isAdminOrOwner: boolean;
  isMemberOrAbove: boolean;
  onEditUnit: (id: string, currentTitle: string) => void;
  onDeleteUnit: (id: string) => void;
  onAddTopic: (unitId: string) => void;
  onEditTopic: (topic: any) => void;
  onDeleteTopic: (id: string) => void;
  onToggleTopic: (topicId: string, completed: boolean) => void;
  topicStats?: Record<string, number>;
  totalMembers?: number;
}

function SortableUnit({
  unit,
  isAdminOrOwner,
  isMemberOrAbove,
  onEditUnit,
  onDeleteUnit,
  onAddTopic,
  onEditTopic,
  onDeleteTopic,
  onToggleTopic,
  topicStats,
  totalMembers,
}: SortableUnitProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: unit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const totalTopics = unit.topics.length;
  const completedTopics = unit.topics.filter((t: any) => t.completed).length;
  const progressPercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card rounded-2xl border border-border/80 shadow-xs overflow-hidden transition-all",
        isDragging && "opacity-40 shadow-md border-primary/20"
      )}
    >
      {/* Unit Header Wrapper */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/15 border-b border-border/40">
        {/* Drag handle for members */}
        {isMemberOrAbove && (
          <div
            {...attributes}
            {...listeners}
            className="text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing p-1 hover:bg-muted/50 rounded-md shrink-0"
          >
            <GripVertical className="size-4" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xs font-bold text-foreground truncate">{unit.title}</h3>
            
            {/* Admin Controls */}
            {isMemberOrAbove && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEditUnit(unit.id, unit.title)}
                  className="size-7 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                >
                  <Edit3 className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteUnit(unit.id)}
                  className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Unit Progress Bar */}
          <div className="flex items-center gap-2 mt-1.5">
            <Progress value={progressPercent} className="h-1.5 flex-1" />
            <span className="text-[9px] font-bold text-muted-foreground shrink-0 uppercase">
              {completedTopics}/{totalTopics} topics ({progressPercent}%)
            </span>
          </div>
        </div>
      </div>

      {/* Unit Topics Section */}
      <div className="p-4 space-y-3.5">
        {unit.topics.length > 0 ? (
          <div className="space-y-2">
            {unit.topics.map((topic: any) => {
              const hasStats = topicStats && topicStats[topic.id] !== undefined;
              const completionCount = hasStats ? topicStats[topic.id] : 0;
              const totalM = totalMembers || 0;

              return (
                <div 
                  key={topic.id}
                  className={cn(
                    "flex items-start justify-between gap-4 p-3.5 rounded-xl border border-border/60 bg-surface/50 hover:bg-muted/10 transition-all",
                    topic.completed && "bg-muted/5 border-border/40"
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Checkbox
                      checked={topic.completed}
                      onCheckedChange={(checked) => onToggleTopic(topic.id, !!checked)}
                      className="mt-0.5 rounded-[4px] cursor-pointer"
                    />
                    <div className="min-w-0 space-y-1">
                      <p className={cn(
                        "text-xs font-bold text-foreground leading-snug truncate",
                        topic.completed && "line-through text-muted-foreground/60 font-semibold"
                      )}>
                        {topic.title}
                      </p>
                      {topic.description && (
                        <p className="text-[10px] text-muted-foreground leading-normal line-clamp-2">
                          {topic.description}
                        </p>
                      )}
                      
                      {/* Topic Attachment Badge */}
                      {topic.materialId && (
                        <div className="inline-flex items-center gap-1 text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md mt-1">
                          <Link2 className="size-2.5" />
                          <span>Resource Reference Attached</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Topic Stats / Controls */}
                  <div className="flex items-center gap-3 shrink-0 ml-auto self-center">
                    {/* Completion stats for admins */}
                    {isAdminOrOwner && totalM > 0 && (
                      <span className="text-[8px] font-black uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-md border" title="Hive completions count">
                        {completionCount}/{totalM} Completed
                      </span>
                    )}

                    {isMemberOrAbove && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditTopic(topic)}
                          className="size-7 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                        >
                          <Edit3 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteTopic(topic.id)}
                          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground/50 border border-dashed border-border/60 rounded-xl flex flex-col items-center justify-center gap-1">
            <BookOpen className="size-5 mb-0.5 opacity-40" />
            <span className="text-[10px] font-bold">No topics added to this unit yet.</span>
          </div>
        )}

        {isMemberOrAbove && (
          <Button
            variant="outline"
            size="xs"
            onClick={() => onAddTopic(unit.id)}
            className="w-full text-[10px] font-bold gap-1 rounded-xl h-8 border-border/80 text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted/30"
          >
            <Plus className="size-3.5" />
            Add Topic to Unit
          </Button>
        )}
      </div>
    </div>
  );
}

// Main Syllabus Page Component
export default function HiveSyllabusPage({ params }: PageProps) {
  const { hiveId } = React.use(params);
  const utils = api.useUtils();

  // Retrieve user role from workspace Zustand store
  const userRole = useHiveStore((s) => s.userRole);
  const isAdminOrOwner = userRole === "owner" || userRole === "admin";
  const isMemberOrAbove = isAdminOrOwner || userRole === "member";

  // Dialog / Form States
  const [unitDialogOpen, setUnitDialogOpen] = React.useState(false);
  const [topicDialogOpen, setTopicDialogOpen] = React.useState(false);

  // Unit form fields
  const [editingUnitId, setEditingUnitId] = React.useState<string | null>(null);
  const [unitTitle, setUnitTitle] = React.useState("");

  // Topic form fields
  const [editingTopicId, setEditingTopicId] = React.useState<string | null>(null);
  const [topicUnitId, setTopicUnitId] = React.useState("");
  const [topicTitle, setTopicTitle] = React.useState("");
  const [topicDesc, setTopicDesc] = React.useState("");
  const [topicMaterialId, setTopicMaterialId] = React.useState<string | null>(null);

  // Queries
  const { data: syllabus = [], isLoading, isError } = api.syllabus.getSyllabus.useQuery(
    { hiveId },
    { staleTime: 300000 }
  );

  const { data: statsData } = api.syllabus.getProgressStats.useQuery(
    { hiveId },
    { enabled: isAdminOrOwner, staleTime: 300000 }
  );

  // Mutations
  const toggleTopicMutation = api.syllabus.toggleTopicComplete.useMutation({
    onMutate: async (variables) => {
      await utils.syllabus.getSyllabus.cancel({ hiveId });
      const previous = utils.syllabus.getSyllabus.getData({ hiveId });

      utils.syllabus.getSyllabus.setData({ hiveId }, (old) => {
        if (!old) return old;
        return old.map((unit) => ({
          ...unit,
          topics: unit.topics.map((topic) =>
            topic.id === variables.topicId
              ? { ...topic, completed: variables.completed }
              : topic
          ),
        }));
      });

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        utils.syllabus.getSyllabus.setData({ hiveId }, context.previous);
      }
      toast.error("Failed to update topic completion.");
    },
    onSuccess: () => {
      utils.syllabus.getSyllabus.invalidate({ hiveId });
      if (isAdminOrOwner) {
        utils.syllabus.getProgressStats.invalidate({ hiveId });
      }
    },
  });

  const createUnitMutation = api.syllabus.createUnit.useMutation({
    onSuccess: () => {
      toast.success("Syllabus unit created!");
      setUnitDialogOpen(false);
      setUnitTitle("");
      utils.syllabus.getSyllabus.invalidate({ hiveId });
    },
    onError: () => toast.error("Failed to create syllabus unit."),
  });

  const updateUnitMutation = api.syllabus.updateUnit.useMutation({
    onSuccess: () => {
      toast.success("Unit updated!");
      setUnitDialogOpen(false);
      setEditingUnitId(null);
      setUnitTitle("");
      utils.syllabus.getSyllabus.invalidate({ hiveId });
    },
    onError: () => toast.error("Failed to update unit."),
  });

  const deleteUnitMutation = api.syllabus.deleteUnit.useMutation({
    onSuccess: () => {
      toast.success("Unit deleted successfully.");
      utils.syllabus.getSyllabus.invalidate({ hiveId });
    },
    onError: () => toast.error("Failed to delete unit."),
  });

  const createTopicMutation = api.syllabus.createTopic.useMutation({
    onSuccess: () => {
      toast.success("Syllabus topic created!");
      setTopicDialogOpen(false);
      setTopicTitle("");
      setTopicDesc("");
      setTopicMaterialId(null);
      utils.syllabus.getSyllabus.invalidate({ hiveId });
    },
    onError: () => toast.error("Failed to create topic."),
  });

  const updateTopicMutation = api.syllabus.updateTopic.useMutation({
    onSuccess: () => {
      toast.success("Topic updated!");
      setTopicDialogOpen(false);
      setEditingTopicId(null);
      setTopicTitle("");
      setTopicDesc("");
      setTopicMaterialId(null);
      utils.syllabus.getSyllabus.invalidate({ hiveId });
    },
    onError: () => toast.error("Failed to update topic."),
  });

  const deleteTopicMutation = api.syllabus.deleteTopic.useMutation({
    onSuccess: () => {
      toast.success("Topic deleted.");
      utils.syllabus.getSyllabus.invalidate({ hiveId });
    },
    onError: () => toast.error("Failed to delete topic."),
  });

  const reorderUnitsMutation = api.syllabus.reorderUnits.useMutation({
    onMutate: async (variables) => {
      await utils.syllabus.getSyllabus.cancel({ hiveId });
      const previous = utils.syllabus.getSyllabus.getData({ hiveId });

      utils.syllabus.getSyllabus.setData({ hiveId }, (old) => {
        if (!old) return old;
        return variables.unitIds
          .map((id) => old.find((u) => u.id === id))
          .filter(Boolean) as any;
      });

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        utils.syllabus.getSyllabus.setData({ hiveId }, context.previous);
      }
      toast.error("Failed to save unit order.");
    },
    onSuccess: () => {
      utils.syllabus.getSyllabus.invalidate({ hiveId });
    },
  });

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = syllabus.findIndex((u) => u.id === active.id);
    const newIndex = syllabus.findIndex((u) => u.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedIds = [...syllabus.map((u) => u.id)];
      const [removed] = reorderedIds.splice(oldIndex, 1);
      reorderedIds.splice(newIndex, 0, removed);

      reorderUnitsMutation.mutate({
        hiveId,
        unitIds: reorderedIds,
      });
    }
  };

  // Submit Handlers
  const handleSaveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitTitle.trim()) return;

    if (editingUnitId) {
      updateUnitMutation.mutate({ id: editingUnitId, title: unitTitle });
    } else {
      createUnitMutation.mutate({ hiveId, title: unitTitle });
    }
  };

  const handleSaveTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicTitle.trim()) return;

    if (editingTopicId) {
      updateTopicMutation.mutate({
        id: editingTopicId,
        title: topicTitle,
        description: topicDesc || null,
        materialId: topicMaterialId || null,
      });
    } else {
      createTopicMutation.mutate({
        unitId: topicUnitId,
        title: topicTitle,
        description: topicDesc || null,
        materialId: topicMaterialId || null,
      });
    }
  };

  // Unit Dialog triggers
  const triggerAddUnit = () => {
    setEditingUnitId(null);
    setUnitTitle("");
    setUnitDialogOpen(true);
  };

  const triggerEditUnit = (id: string, title: string) => {
    setEditingUnitId(id);
    setUnitTitle(title);
    setUnitDialogOpen(true);
  };

  const handleDeleteUnit = (id: string) => {
    if (confirm("Are you sure you want to delete this syllabus unit? This will delete all topics inside it.")) {
      deleteUnitMutation.mutate({ id });
    }
  };

  // Topic Dialog triggers
  const triggerAddTopic = (unitId: string) => {
    setEditingTopicId(null);
    setTopicUnitId(unitId);
    setTopicTitle("");
    setTopicDesc("");
    setTopicMaterialId(null);
    setTopicDialogOpen(true);
  };

  const triggerEditTopic = (topic: any) => {
    setEditingTopicId(topic.id);
    setTopicTitle(topic.title);
    setTopicDesc(topic.description || "");
    setTopicMaterialId(topic.materialId || null);
    setTopicDialogOpen(true);
  };

  const handleDeleteTopic = (id: string) => {
    if (confirm("Are you sure you want to delete this syllabus topic?")) {
      deleteTopicMutation.mutate({ id });
    }
  };

  // Overall progress stats math
  const totalTopicsCount = syllabus.reduce((acc, unit) => acc + unit.topics.length, 0);
  const completedTopicsCount = syllabus.reduce((acc, unit) => acc + unit.topics.filter((t: any) => t.completed).length, 0);
  const totalProgressPercent = totalTopicsCount > 0 ? Math.round((completedTopicsCount / totalTopicsCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Syllabus Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <BookOpen className="size-6 text-primary" />
            Syllabus Tree
          </h2>
          <p className="text-xs text-muted-foreground font-semibold">
            Track milestones, course topics, and syllabus goals with your hive.
          </p>
        </div>
        {isMemberOrAbove && (
          <Button
            onClick={triggerAddUnit}
            className="bg-primary text-primary-foreground hover:bg-primary/95 font-bold text-xs h-9.5 px-4 rounded-xl shadow-xs cursor-pointer gap-1.5"
          >
            <Plus className="size-4.5" />
            Add Unit
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-semibold">Loading syllabus tree...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-destructive">
          <AlertCircle className="size-8" />
          <p className="text-xs font-bold">Failed to load syllabus. Please try again.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Syllabus Units Accordion List */}
          <div className="lg:col-span-2 space-y-4">
            {syllabus.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={syllabus.map((u) => u.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {syllabus.map((unit) => (
                      <SortableUnit
                        key={unit.id}
                        unit={unit}
                        isAdminOrOwner={isAdminOrOwner}
                        isMemberOrAbove={isMemberOrAbove}
                        onEditUnit={triggerEditUnit}
                        onDeleteUnit={handleDeleteUnit}
                        onAddTopic={triggerAddTopic}
                        onEditTopic={triggerEditTopic}
                        onDeleteTopic={handleDeleteTopic}
                        onToggleTopic={(topicId, completed) => toggleTopicMutation.mutate({ topicId, completed })}
                        topicStats={statsData?.topicStats}
                        totalMembers={statsData?.totalMembers}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="text-center py-16 bg-card border border-border/80 rounded-2xl flex flex-col items-center justify-center gap-2">
                <BookOpen className="size-8 text-muted-foreground/60 opacity-40" />
                <h4 className="text-sm font-bold text-foreground">Syllabus is empty</h4>
                <p className="text-xs text-muted-foreground leading-normal max-w-[240px] mx-auto">
                  Create syllabus units and add course topic checkboxes to start tracking progress.
                </p>
              </div>
            )}
          </div>

          {/* Progress Summary sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-card rounded-2xl border border-border/80 shadow-xs p-5 space-y-4">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/40 pb-2.5">
                My Progress
              </h3>

              {/* Progress visual counter */}
              <div className="flex flex-col items-center justify-center py-4 space-y-2 text-center">
                <div className="relative size-28 flex items-center justify-center">
                  <svg className="size-full transform -rotate-90">
                    <circle
                      cx="56"
                      cy="56"
                      r="48"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-muted/20 dark:text-zinc-800"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r="48"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 48}
                      strokeDashoffset={2 * Math.PI * 48 * (1 - totalProgressPercent / 100)}
                      className="text-primary transition-all duration-500 stroke-round"
                    />
                  </svg>
                  <span className="absolute text-xl font-black text-foreground">{totalProgressPercent}%</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Syllabus Checked</p>
                  <p className="text-[10px] text-muted-foreground">
                    {completedTopicsCount} out of {totalTopicsCount} topics complete
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Unit Dialog */}
      <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <DialogContent className="max-w-md rounded-xl">
          <form onSubmit={handleSaveUnit}>
            <DialogHeader className="pb-4 border-b border-border dark:border-zinc-900">
              <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
                <BookOpen className="size-4.5 text-primary" />
                {editingUnitId ? "Edit Unit Title" : "Create New Unit"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Define a major category or module of your course curriculum.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Unit Title</label>
                <Input
                  required
                  value={unitTitle}
                  onChange={(e) => setUnitTitle(e.target.value)}
                  placeholder="e.g. Unit 1: Introduction to Cytology"
                  className="h-9 focus-visible:ring-1 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border dark:border-zinc-900 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUnitDialogOpen(false)}
                className="h-8.5 text-xs rounded-lg font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-8.5 text-xs bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg font-bold cursor-pointer shadow-xs"
              >
                {editingUnitId ? "Save Changes" : "Create Unit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Save Topic Dialog */}
      <Dialog open={topicDialogOpen} onOpenChange={setTopicDialogOpen}>
        <DialogContent className="max-w-md rounded-xl">
          <form onSubmit={handleSaveTopic}>
            <DialogHeader className="pb-4 border-b border-border dark:border-zinc-900">
              <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
                <CheckCircle2 className="size-4.5 text-primary" />
                {editingTopicId ? "Edit Topic" : "Create New Topic"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Add checking points or syllabus homework topics under this unit.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4 text-xs font-semibold">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Topic Title</label>
                <Input
                  required
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  placeholder="e.g. Structure of Mitochondria"
                  className="h-9 focus-visible:ring-1 text-xs"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Description (Optional)</label>
                <Input
                  value={topicDesc}
                  onChange={(e) => setTopicDesc(e.target.value)}
                  placeholder="Brief note, page numbers, or topics included..."
                  className="h-9 focus-visible:ring-1 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border dark:border-zinc-900 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTopicDialogOpen(false)}
                className="h-8.5 text-xs rounded-lg font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-8.5 text-xs bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg font-bold cursor-pointer shadow-xs"
              >
                {editingTopicId ? "Save Changes" : "Create Topic"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
