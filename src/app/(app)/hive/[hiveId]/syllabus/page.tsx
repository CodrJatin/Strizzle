"use client";

import * as React from "react";
import { 
  DndContext, DragEndEvent, PointerSensor, 
  useSensor, useSensors, KeyboardSensor, closestCorners,
  DragOverlay
} from "@dnd-kit/core";
import { 
  SortableContext, verticalListSortingStrategy, 
  useSortable, sortableKeyboardCoordinates 
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  Plus, Check, Trash2, Edit3, Loader2, BookOpen,
  ChevronDown, ChevronUp, GripVertical, AlertCircle, FileText,
  Link2, CheckCircle2, ShieldAlert, X
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

import { api } from "@/lib/trpc/client";
import { useHiveStore } from "@/store/hiveStore";
import { useConfirmStore } from "@/store/confirmStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

interface PageProps {
  params: Promise<{ hiveId: string }>;
}

// Helper to capitalize the first word/letter
const capitalize = (str: string) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Sortable Syllabus Unit Component
interface SortableUnitProps {
  unit: any;
  resolveStableId: (id: string) => string;
  isAdminOrOwner: boolean;
  isMemberOrAbove: boolean;
  onDeleteUnit: (id: string) => void;
  onDeleteTopic: (id: string) => void;
  onToggleTopic: (topicId: string, completed: boolean) => void;
  topicStats?: Record<string, number>;
  totalMembers?: number;
  
  // Unit inline edit state
  editingUnitId: string | null;
  editingUnitTitle: string;
  onStartEditUnit: (id: string, currentTitle: string) => void;
  onCancelEditUnit: () => void;
  onSaveEditUnit: (id: string, title: string) => void;
  onEditingUnitTitleChange: (value: string) => void;

  // Topic inline edit state
  editingTopicId: string | null;
  editingTopicTitle: string;
  onStartEditTopic: (id: string, currentTitle: string) => void;
  onCancelEditTopic: () => void;
  onSaveEditTopic: (id: string, title: string) => void;
  onEditingTopicTitleChange: (value: string) => void;

  // Topic inline add state
  newTopicTitle: string;
  onNewTopicTitleChange: (value: string) => void;
  onAddTopic: () => void;
}

function UnitCard({
  unit,
  resolveStableId,
  isAdminOrOwner,
  isMemberOrAbove,
  onDeleteUnit,
  onDeleteTopic,
  onToggleTopic,
  topicStats,
  totalMembers,
  
  editingUnitId,
  editingUnitTitle,
  onStartEditUnit,
  onCancelEditUnit,
  onSaveEditUnit,
  onEditingUnitTitleChange,

  editingTopicId,
  editingTopicTitle,
  onStartEditTopic,
  onCancelEditTopic,
  onSaveEditTopic,
  onEditingTopicTitleChange,

  newTopicTitle,
  onNewTopicTitleChange,
  onAddTopic,

  dragHandleProps,
  isDragging,
  isOverlay,
}: SortableUnitProps & { dragHandleProps?: any; isDragging?: boolean; isOverlay?: boolean }) {
  const totalTopics = unit.topics.length;
  const completedTopics = unit.topics.filter((t: any) => t.completed).length;
  const progressPercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  const isEditingUnit = editingUnitId === unit.id;
  const isTempUnit = unit.id.startsWith("temp-unit-");

  return (
    <motion.div
      layoutId={isOverlay ? undefined : resolveStableId(unit.id)}
      initial={isOverlay ? undefined : { opacity: 0, y: 12 }}
      animate={isOverlay ? undefined : { opacity: 1, y: 0 }}
      exit={isOverlay ? undefined : { opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "bg-card rounded-2xl border border-border/80 shadow-xs overflow-hidden transition-all w-full",
        isDragging && "opacity-0 pointer-events-none",
        isOverlay && "shadow-2xl border-primary/20 scale-[1.02] rotate-1 cursor-grabbing"
      )}
    >
      {/* Unit Header Wrapper */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/15 border-b border-border/40">
        {/* Drag handle for members */}
        {isMemberOrAbove && !isEditingUnit && !isTempUnit && (
          <div
            {...dragHandleProps}
            className="text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing p-1 hover:bg-muted/50 rounded-md shrink-0"
          >
            <GripVertical className="size-4" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            {isEditingUnit ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editingUnitTitle}
                  onChange={(e) => onEditingUnitTitleChange(e.target.value)}
                  className="h-8 text-xs font-bold py-1 px-2 focus-visible:ring-1 bg-transparent flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editingUnitTitle.trim() !== unit.title && editingUnitTitle.trim().length > 0) {
                      onSaveEditUnit(unit.id, editingUnitTitle);
                    } else if (e.key === "Escape") {
                      onCancelEditUnit();
                    }
                  }}
                  autoFocus
                />
              </div>
            ) : (
              <h3 className="text-xs font-bold text-foreground truncate">{capitalize(unit.title)}</h3>
            )}
            
            {/* Admin Controls */}
            {isMemberOrAbove && (
              <div className="flex items-center gap-1.5 shrink-0 min-h-7">
                <AnimatePresence mode="wait">
                  {!isTempUnit && (
                    <motion.div
                      key="unit-controls"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-1.5"
                    >
                      {isEditingUnit ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={editingUnitTitle.trim() === unit.title || editingUnitTitle.trim().length === 0}
                            onClick={() => onSaveEditUnit(unit.id, editingUnitTitle)}
                            className="size-7 text-primary hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Check className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={onCancelEditUnit}
                            className="size-7 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onStartEditUnit(unit.id, unit.title)}
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
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
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
        {unit.topics.length > 0 && (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {unit.topics.map((topic: any) => {
                const isEditingTopic = editingTopicId === topic.id;
                const isTempTopic = topic.id.startsWith("temp-topic-");

                return (
                  <motion.div 
                    key={resolveStableId(topic.id)}
                    layoutId={isOverlay ? undefined : resolveStableId(topic.id)}
                    initial={isOverlay ? undefined : { opacity: 0, y: 8 }}
                    animate={isOverlay ? undefined : { opacity: 1, y: 0 }}
                    exit={isOverlay ? undefined : { opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      "flex items-center justify-between gap-4 p-3 rounded-xl border border-border/60 bg-surface/50 hover:bg-muted/10 transition-all",
                      topic.completed && "bg-muted/5 border-border/40"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Checkbox
                        checked={topic.completed}
                        onCheckedChange={(checked) => onToggleTopic(topic.id, !!checked)}
                        disabled={isTempTopic}
                        className="rounded-[4px] cursor-pointer shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        {isEditingTopic ? (
                          <Input
                            value={editingTopicTitle}
                            onChange={(e) => onEditingTopicTitleChange(e.target.value)}
                            className="h-8 text-xs py-1 px-2 focus-visible:ring-1 bg-transparent w-full"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editingTopicTitle.trim() !== topic.title && editingTopicTitle.trim().length > 0) {
                                onSaveEditTopic(topic.id, editingTopicTitle);
                              } else if (e.key === "Escape") {
                                onCancelEditTopic();
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-2 truncate">
                            <p className={cn(
                              "text-xs font-bold text-foreground leading-none truncate",
                              topic.completed && "line-through text-muted-foreground/60 font-semibold"
                            )}>
                              {capitalize(topic.title)}
                            </p>
                            {/* Topic Attachment Badge */}
                            {topic.materialId && (
                              <div className="inline-flex items-center gap-0.5 text-[8px] font-bold text-primary bg-primary/10 border border-primary/20 px-1 py-0.2 rounded-md shrink-0">
                                <Link2 className="size-2" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Topic Controls */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-auto self-center min-h-7">
                      <div className="flex items-center gap-1 shrink-0">
                        <AnimatePresence mode="wait">
                          {!isTempTopic && (
                            <motion.div
                              key="topic-controls"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.15 }}
                              className="flex items-center gap-1 shrink-0"
                            >
                              {isEditingTopic ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={editingTopicTitle.trim() === topic.title || editingTopicTitle.trim().length === 0}
                                    onClick={() => onSaveEditTopic(topic.id, editingTopicTitle)}
                                    className="size-7 text-primary hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Check className="size-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onCancelEditTopic}
                                    className="size-7 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                                  >
                                    <X className="size-3.5" />
                                  </Button>
                                </>
                              ) : (
                                isMemberOrAbove && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => onStartEditTopic(topic.id, topic.title)}
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
                                  </>
                                )
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {isMemberOrAbove && (
          <div className="relative flex items-center gap-2 border border-border/80 rounded-xl p-1 pr-3 bg-transparent focus-within:border-primary/50 transition-colors">
            <Input
              value={newTopicTitle}
              onChange={(e) => onNewTopicTitleChange(e.target.value)}
              placeholder="Add new topic"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTopicTitle.trim().length > 0) {
                  onAddTopic();
                }
              }}
              className="h-8 focus-visible:ring-0 text-xs flex-1 bg-transparent border-none px-2 pr-20 focus-visible:ring-offset-0 shadow-none"
            />
            <div className="absolute right-2 flex items-center gap-1.5 pointer-events-none">
              {newTopicTitle.trim().length > 0 && (
                <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted/50 px-1.5 font-mono text-[9px] font-bold text-muted-foreground/80">
                  Enter
                </kbd>
              )}
              {newTopicTitle.trim().length > 0 && (
                <Button
                  onClick={onAddTopic}
                  size="icon"
                  className="size-6 rounded-md cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 pointer-events-auto"
                >
                  <Plus className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SortableUnit(props: SortableUnitProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.unit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    pointerEvents: isDragging ? ("none" as const) : ("auto" as const),
  };

  return (
    <div ref={setNodeRef} style={style}>
      <UnitCard
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

// Main Syllabus Page Component
export default function HiveSyllabusPage({ params }: PageProps) {
  const { hiveId } = React.use(params);
  const utils = api.useUtils();
  const confirm = useConfirmStore((s) => s.confirm);

  // Keep track of optimistic temp IDs mapped to database IDs to prevent key changes and layout flashes
  const tempIdMap = React.useRef<Record<string, string>>({});

  const resolveStableId = React.useCallback((id: string) => {
    return tempIdMap.current[id] || id;
  }, []);

  // Drag-and-drop state
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // Retrieve user role from workspace Zustand store
  const userRole = useHiveStore((s) => s.userRole);
  const isAdminOrOwner = userRole === "owner" || userRole === "admin";
  const isMemberOrAbove = isAdminOrOwner || userRole === "member";

  // Inline unit/topic creation states
  const [newUnitTitle, setNewUnitTitle] = React.useState("");
  const [newTopicTitles, setNewTopicTitles] = React.useState<Record<string, string>>({});

  // Inline unit editing states
  const [editingUnitId, setEditingUnitId] = React.useState<string | null>(null);
  const [editingUnitTitle, setEditingUnitTitle] = React.useState("");

  // Inline topic editing states
  const [editingTopicId, setEditingTopicId] = React.useState<string | null>(null);
  const [editingTopicTitle, setEditingTopicTitle] = React.useState("");

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
    onMutate: async (newUnit) => {
      await utils.syllabus.getSyllabus.cancel({ hiveId });
      const previous = utils.syllabus.getSyllabus.getData({ hiveId });
      const tempId = "temp-unit-" + Math.random().toString();

      utils.syllabus.getSyllabus.setData({ hiveId }, (old) => {
        const tempUnit = {
          id: tempId,
          title: newUnit.title,
          hiveId,
          position: old ? old.length : 0,
          createdBy: "temp-creator",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          topics: [] as any[],
        };
        if (!old) return [tempUnit];
        return [...old, tempUnit];
      });

      return { previous, tempId };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        utils.syllabus.getSyllabus.setData({ hiveId }, context.previous);
      }
      toast.error("Something went wrong. Failed to create syllabus unit.");
    },
    onSuccess: (data, _variables, context) => {
      if (context?.tempId && data?.id) {
        tempIdMap.current[data.id] = context.tempId;
      }
      toast.success("Syllabus unit created!");
      setNewUnitTitle("");
    },
    onSettled: () => {
      utils.syllabus.getSyllabus.invalidate({ hiveId });
    }
  });

  const updateUnitMutation = api.syllabus.updateUnit.useMutation({
    onMutate: async (variables) => {
      await utils.syllabus.getSyllabus.cancel({ hiveId });
      const previous = utils.syllabus.getSyllabus.getData({ hiveId });

      utils.syllabus.getSyllabus.setData({ hiveId }, (old) => {
        if (!old) return old;
        return old.map((u) => u.id === variables.id ? { ...u, title: variables.title } : u);
      });

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        utils.syllabus.getSyllabus.setData({ hiveId }, context.previous);
      }
      toast.error("Something went wrong. Failed to update unit.");
    },
    onSuccess: () => {
      toast.success("Unit updated!");
      setEditingUnitId(null);
      setEditingUnitTitle("");
    },
    onSettled: () => {
      utils.syllabus.getSyllabus.invalidate({ hiveId });
    }
  });

  const deleteUnitMutation = api.syllabus.deleteUnit.useMutation({
    onMutate: async (variables) => {
      await utils.syllabus.getSyllabus.cancel({ hiveId });
      const previous = utils.syllabus.getSyllabus.getData({ hiveId });

      utils.syllabus.getSyllabus.setData({ hiveId }, (old) => {
        if (!old) return old;
        return old.filter((u) => u.id !== variables.id);
      });

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        utils.syllabus.getSyllabus.setData({ hiveId }, context.previous);
      }
      toast.error("Something went wrong. Failed to delete unit.");
    },
    onSuccess: () => {
      toast.success("Unit deleted successfully.");
    },
    onSettled: () => {
      utils.syllabus.getSyllabus.invalidate({ hiveId });
    }
  });

  const createTopicMutation = api.syllabus.createTopic.useMutation({
    onMutate: async (newTopic) => {
      await utils.syllabus.getSyllabus.cancel({ hiveId });
      const previous = utils.syllabus.getSyllabus.getData({ hiveId });
      const tempId = "temp-topic-" + Math.random().toString();

      utils.syllabus.getSyllabus.setData({ hiveId }, (old) => {
        if (!old) return old;
        return old.map((unit) => {
          if (unit.id !== newTopic.unitId) return unit;
          const tempTopic = {
            id: tempId,
            title: newTopic.title,
            unitId: newTopic.unitId,
            materialId: null,
            completed: false,
            position: unit.topics.length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            hiveId,
            searchVec: null,
          };
          return {
            ...unit,
            topics: [...unit.topics, tempTopic],
          };
        });
      });

      return { previous, tempId };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        utils.syllabus.getSyllabus.setData({ hiveId }, context.previous);
      }
      toast.error("Something went wrong. Failed to create topic.");
    },
    onSuccess: (data, variables, context) => {
      if (context?.tempId && data?.id) {
        tempIdMap.current[data.id] = context.tempId;
      }
      toast.success("Syllabus topic created!");
      setNewTopicTitles((prev) => ({ ...prev, [variables.unitId]: "" }));
    },
    onSettled: () => {
      utils.syllabus.getSyllabus.invalidate({ hiveId });
    }
  });

  const updateTopicMutation = api.syllabus.updateTopic.useMutation({
    onMutate: async (variables) => {
      await utils.syllabus.getSyllabus.cancel({ hiveId });
      const previous = utils.syllabus.getSyllabus.getData({ hiveId });

      utils.syllabus.getSyllabus.setData({ hiveId }, (old) => {
        if (!old) return old;
        return old.map((unit) => ({
          ...unit,
          topics: unit.topics.map((t) => 
            t.id === variables.id 
              ? { 
                  ...t, 
                  title: variables.title !== undefined ? variables.title : t.title,
                  materialId: variables.materialId !== undefined ? variables.materialId : t.materialId 
                } 
              : t
          ),
        }));
      });

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        utils.syllabus.getSyllabus.setData({ hiveId }, context.previous);
      }
      toast.error("Something went wrong. Failed to update topic.");
    },
    onSuccess: () => {
      toast.success("Topic updated!");
      setEditingTopicId(null);
      setEditingTopicTitle("");
    },
    onSettled: () => {
      utils.syllabus.getSyllabus.invalidate({ hiveId });
    }
  });

  const deleteTopicMutation = api.syllabus.deleteTopic.useMutation({
    onMutate: async (variables) => {
      await utils.syllabus.getSyllabus.cancel({ hiveId });
      const previous = utils.syllabus.getSyllabus.getData({ hiveId });

      utils.syllabus.getSyllabus.setData({ hiveId }, (old) => {
        if (!old) return old;
        return old.map((unit) => ({
          ...unit,
          topics: unit.topics.filter((t) => t.id !== variables.id),
        }));
      });

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        utils.syllabus.getSyllabus.setData({ hiveId }, context.previous);
      }
      toast.error("Something went wrong. Failed to delete topic.");
    },
    onSuccess: () => {
      toast.success("Topic deleted.");
    },
    onSettled: () => {
      utils.syllabus.getSyllabus.invalidate({ hiveId });
    }
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
    
    if (over && active.id !== over.id) {
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
    }

    setActiveId(null);
  };

  // Add unit handler
  const handleCreateUnit = () => {
    if (!newUnitTitle.trim()) return;
    const title = newUnitTitle.trim();
    setNewUnitTitle("");
    createUnitMutation.mutate({ hiveId, title });
  };

  // Add topic handler
  const handleCreateTopic = (unitId: string) => {
    const title = newTopicTitles[unitId] || "";
    if (!title.trim()) return;
    setNewTopicTitles((prev) => ({ ...prev, [unitId]: "" }));
    createTopicMutation.mutate({
      unitId,
      title: title.trim(),
      materialId: null,
    });
  };

  // Unit Edit handlers
  const handleStartEditUnit = (id: string, currentTitle: string) => {
    setEditingUnitId(id);
    setEditingUnitTitle(currentTitle);
  };

  const handleCancelEditUnit = () => {
    setEditingUnitId(null);
    setEditingUnitTitle("");
  };

  const handleSaveEditUnit = (id: string, title: string) => {
    if (!title.trim()) return;
    updateUnitMutation.mutate({ id, title: title.trim() });
  };

  const handleDeleteUnit = async (id: string) => {
    const confirmed = await confirm({
      title: "Delete Syllabus Unit",
      description: "Are you sure you want to delete this syllabus unit? This will delete all topics inside it.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (confirmed) {
      deleteUnitMutation.mutate({ id });
    }
  };

  // Topic Edit handlers
  const handleStartEditTopic = (id: string, currentTitle: string) => {
    setEditingTopicId(id);
    setEditingTopicTitle(currentTitle);
  };

  const handleCancelEditTopic = () => {
    setEditingTopicId(null);
    setEditingTopicTitle("");
  };

  const handleSaveEditTopic = (id: string, title: string) => {
    if (!title.trim()) return;
    updateTopicMutation.mutate({ id, title: title.trim() });
  };

  const handleDeleteTopic = async (id: string) => {
    const confirmed = await confirm({
      title: "Delete Syllabus Topic",
      description: "Are you sure you want to delete this syllabus topic?",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (confirmed) {
      deleteTopicMutation.mutate({ id });
    }
  };

  // Overall progress stats math
  const totalTopicsCount = syllabus.reduce((acc, unit) => acc + unit.topics.length, 0);
  const completedTopicsCount = syllabus.reduce((acc, unit) => acc + unit.topics.filter((t: any) => t.completed).length, 0);
  const totalProgressPercent = totalTopicsCount > 0 ? Math.round((completedTopicsCount / totalTopicsCount) * 100) : 0;

  return (
    <div className="space-y-6 font-sans">
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
            {isMemberOrAbove && (
              <div className="relative flex items-center gap-2 w-full bg-transparent p-1.5 pr-3 rounded-2xl border border-border/80 focus-within:border-primary/50 transition-colors">
                <Input
                  value={newUnitTitle}
                  onChange={(e) => setNewUnitTitle(e.target.value)}
                  placeholder="Add new unit"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateUnit();
                    }
                  }}
                  className="h-9 focus-visible:ring-0 text-xs flex-1 bg-transparent border-none focus-visible:ring-offset-0 shadow-none px-2 pr-20"
                />
                <div className="absolute right-3 flex items-center gap-2 pointer-events-none">
                  {newUnitTitle.trim().length > 0 && (
                    <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted/50 px-1.5 font-mono text-[9px] font-bold text-muted-foreground/80">
                      Enter
                    </kbd>
                  )}
                  {newUnitTitle.trim().length > 0 && (
                    <Button
                      onClick={handleCreateUnit}
                      disabled={createUnitMutation.isPending}
                      size="icon"
                      className="size-7 rounded-lg cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95 shrink-0 pointer-events-auto"
                    >
                      {createUnitMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {syllabus.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={(event) => setActiveId(event.active.id as string)}
                onDragCancel={() => setActiveId(null)}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={syllabus.map((u) => u.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    <AnimatePresence initial={false}>
                      {syllabus.map((unit) => (
                        <SortableUnit
                          key={resolveStableId(unit.id)}
                          unit={unit}
                          resolveStableId={resolveStableId}
                          isAdminOrOwner={isAdminOrOwner}
                          isMemberOrAbove={isMemberOrAbove}
                          onDeleteUnit={handleDeleteUnit}
                          onDeleteTopic={handleDeleteTopic}
                          onToggleTopic={(topicId, completed) => toggleTopicMutation.mutate({ topicId, completed })}
                          topicStats={statsData?.topicStats}
                          totalMembers={statsData?.totalMembers}
                          
                          // Unit inline editing
                          editingUnitId={editingUnitId}
                          editingUnitTitle={editingUnitTitle}
                          onStartEditUnit={handleStartEditUnit}
                          onCancelEditUnit={handleCancelEditUnit}
                          onSaveEditUnit={handleSaveEditUnit}
                          onEditingUnitTitleChange={setEditingUnitTitle}

                          // Topic inline editing
                          editingTopicId={editingTopicId}
                          editingTopicTitle={editingTopicTitle}
                          onStartEditTopic={handleStartEditTopic}
                          onCancelEditTopic={handleCancelEditTopic}
                          onSaveEditTopic={handleSaveEditTopic}
                          onEditingTopicTitleChange={setEditingTopicTitle}

                          // Topic inline adding
                          newTopicTitle={newTopicTitles[unit.id] || ""}
                          onNewTopicTitleChange={(val) => setNewTopicTitles({ ...newTopicTitles, [unit.id]: val })}
                          onAddTopic={() => handleCreateTopic(unit.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </SortableContext>

                <DragOverlay adjustScale={false} dropAnimation={null}>
                  {activeId ? (
                    <UnitCard
                      unit={syllabus.find((u) => u.id === activeId)}
                      resolveStableId={resolveStableId}
                      isAdminOrOwner={isAdminOrOwner}
                      isMemberOrAbove={isMemberOrAbove}
                      onDeleteUnit={() => {}}
                      onDeleteTopic={() => {}}
                      onToggleTopic={() => {}}
                      topicStats={statsData?.topicStats}
                      totalMembers={statsData?.totalMembers}
                      
                      // Unit inline editing
                      editingUnitId={null}
                      editingUnitTitle=""
                      onStartEditUnit={() => {}}
                      onCancelEditUnit={() => {}}
                      onSaveEditUnit={() => {}}
                      onEditingUnitTitleChange={() => {}}
                      
                      // Topic inline editing
                      editingTopicId={null}
                      editingTopicTitle=""
                      onStartEditTopic={() => {}}
                      onCancelEditTopic={() => {}}
                      onSaveEditTopic={() => {}}
                      onEditingTopicTitleChange={() => {}}
                      
                      // Topic inline adding
                      newTopicTitle=""
                      onNewTopicTitleChange={() => {}}
                      onAddTopic={() => {}}
                      isOverlay
                    />
                  ) : null}
                </DragOverlay>
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
    </div>
  );
}
