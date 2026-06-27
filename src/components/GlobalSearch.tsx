"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { 
  Search, FileText, Link2, File, Image, Video, CheckSquare, 
  BookOpen, Loader2, Sparkles, Plus, AlertCircle, X, Check
} from "lucide-react";
import { toast } from "sonner";
import { Command as CommandPrimitive } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";

import { api } from "@/lib/trpc/client";
import { 
  Command, CommandDialog, CommandList, 
  CommandEmpty, CommandGroup, CommandItem 
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SelectedSearchItem {
  id: string;
  type: "material" | "task" | "syllabus";
  title: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  attachMode?: boolean;
  onSelect?: (selectedItems: SelectedSearchItem[]) => void;
}

const typeIcons = {
  text: FileText,
  link: Link2,
  youtube: Video,
  file: File,
  image: Image,
};

const statusColors = {
  todo: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-850",
  in_progress: "bg-blue-50 text-blue-700 border-blue-150 dark:bg-blue-500/10 dark:text-blue-450 dark:border-blue-500/20",
  done: "bg-emerald-50 text-emerald-700 border-emerald-150 dark:bg-emerald-500/10 dark:text-emerald-450 dark:border-emerald-500/20",
  blocked: "bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-500/10 dark:text-rose-455 dark:border-rose-500/20",
};

export function GlobalSearch({ isOpen, onClose, attachMode = false, onSelect }: GlobalSearchProps) {
  const router = useRouter();

  // Search query states
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  // Attach Mode State
  const [selectedItems, setSelectedItems] = React.useState<Record<string, SelectedSearchItem>>({});

  // 200ms Search Debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  // tRPC globalSearch Query
  const { data: results, isLoading } = api.search.globalSearch.useQuery(
    { query: debouncedSearch.trim() },
    {
      enabled: debouncedSearch.trim().length >= 2,
      staleTime: 0,
    }
  );

  // Clear states when dialog closes
  React.useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setDebouncedSearch("");
      setSelectedItems({});
    }
  }, [isOpen]);

  const materials = results?.materials || [];
  const tasksList = results?.tasks || [];
  const syllabusList = results?.syllabus || [];

  const totalResults = materials.length + tasksList.length + syllabusList.length;
  const hasInput = debouncedSearch.trim().length >= 2;

  // Toggle selection handler (Attach Mode)
  const handleToggleSelectItem = (id: string, type: "material" | "task" | "syllabus", title: string) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = { id, type, title };
      }
      return next;
    });
  };

  // Trigger select callback & close
  const handleConfirmSelection = () => {
    const list = Object.values(selectedItems);
    if (list.length === 0) return;
    onSelect?.(list);
    toast.success(`Attached ${list.length} resource${list.length === 1 ? "" : "s"} successfully.`);
    onClose();
  };

  // Standard Navigation Action
  const handleItemAction = (id: string, type: "material" | "task" | "syllabus", hiveId?: string | null) => {
    if (attachMode) return;

    onClose();
    
    switch (type) {
      case "material":
        router.push("/library");
        toast.info("Navigated to Library to view study materials");
        break;
      case "task":
        router.push("/desk");
        toast.info("Navigated to Desk to view active tasks");
        break;
      case "syllabus":
        if (hiveId) {
          router.push(`/hive/${hiveId}/syllabus`);
          toast.info("Navigated to Hive Syllabus tree");
        } else {
          router.push("/dashboard");
        }
        break;
      default:
        break;
    }
  };

  return (
    <CommandDialog 
      open={isOpen} 
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Global Search"
      description="Type to run a universal search across notes, syllabus units, or tasks."
      className="sm:max-w-[650px]! bg-transparent! p-0! ring-0! border-0! shadow-none! overflow-visible! top-[12%]!"
    >
      <Command shouldFilter={false} className="bg-transparent! overflow-visible! shadow-none! border-0!">
        
        {/* Spotlight Floating Search Bar Container */}
        <div className="bg-card/95 dark:bg-zinc-900/90 backdrop-blur-xl border border-border/80 dark:border-zinc-800/80 shadow-[0_15px_30px_rgba(0,0,0,0.15)] rounded-2xl p-1 flex items-center relative gap-3 h-14 w-full">
          <Search className="size-5 text-muted-foreground/60 ml-4 shrink-0" />
          <CommandPrimitive.Input
            placeholder="Search study notes, links, uploaded files, tasks..."
            value={search}
            onValueChange={setSearch}
            className="flex-1 text-base outline-none bg-transparent border-0 shadow-none h-full px-1 placeholder:text-muted-foreground/50 text-foreground w-full focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {search && (
            <button 
              onClick={() => setSearch("")}
              className="mr-4 text-muted-foreground/80 hover:text-foreground shrink-0 cursor-pointer p-1 rounded-full hover:bg-muted/50 transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Spotlight Detached Results Container (animated) */}
        <AnimatePresence>
          {(hasInput || isLoading) && (
            <motion.div 
              initial={{ opacity: 0, y: -10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="mt-3 bg-card/98 dark:bg-zinc-950/95 backdrop-blur-xl border border-border/60 dark:border-zinc-900/60 shadow-2xl rounded-2xl overflow-hidden flex flex-col w-full"
            >
              <CommandList className="max-h-[380px] overflow-y-auto p-2 no-scrollbar">
                {isLoading && (
                  <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    Searching database...
                  </div>
                )}

                {!isLoading && totalResults === 0 && (
                  <div className="py-10 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
                    <AlertCircle className="size-5 text-muted-foreground/60 mb-1" />
                    <span>No matching items found for &ldquo;{debouncedSearch}&rdquo;</span>
                  </div>
                )}

                {/* STUDY MATERIALS SECTION */}
                {!isLoading && materials.length > 0 && (
                  <CommandGroup heading="Study Materials">
                    {materials.map((item) => {
                      const Icon = typeIcons[item.contentType] || FileText;
                      const titleStr = item.title || item.fileName || (item.body ? item.body.substring(0, 40) + "..." : "Untitled Note");
                      const isSelected = !!selectedItems[item.id];

                      return (
                        <CommandItem
                          key={item.id}
                          onSelect={() => {
                            if (attachMode) {
                              handleToggleSelectItem(item.id, "material", titleStr);
                            } else {
                              handleItemAction(item.id, "material");
                            }
                          }}
                          className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer"
                        >
                          {attachMode ? (
                            <Checkbox 
                              checked={isSelected}
                              className="rounded-md border-border/80"
                            />
                          ) : (
                            <div className="size-8 rounded-lg bg-primary/10 border border-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Icon className="size-4.5" />
                            </div>
                          )}
                          
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="text-xs font-bold text-foreground truncate">{titleStr}</p>
                            {item.tags.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.tags.slice(0, 3).map((tag, idx) => (
                                  <span key={idx} className="text-[9px] font-semibold text-muted-foreground bg-muted/60 px-1 rounded-sm">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <Badge variant="ghost" className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
                            {item.contentType}
                          </Badge>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

                {/* TASKS & DEADLINES SECTION */}
                {!isLoading && tasksList.length > 0 && (
                  <CommandGroup heading="Tasks & Deadlines">
                    {tasksList.map((item) => {
                      const isSelected = !!selectedItems[item.id];
                      const statusStyle = statusColors[item.status] || statusColors.todo;

                      return (
                        <CommandItem
                          key={item.id}
                          onSelect={() => {
                            if (attachMode) {
                              handleToggleSelectItem(item.id, "task", item.title);
                            } else {
                              handleItemAction(item.id, "task");
                            }
                          }}
                          className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer"
                        >
                          {attachMode ? (
                            <Checkbox 
                              checked={isSelected}
                              className="rounded-md border-border/80"
                            />
                          ) : (
                            <div className="size-8 rounded-lg bg-indigo-500/10 border border-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                              <CheckSquare className="size-4.5" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-foreground truncate leading-none">{item.title}</p>
                              {(item.courseCode || item.hiveName) && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0 rounded-sm font-bold uppercase bg-muted text-muted-foreground shrink-0 border-border/50">
                                  {item.courseCode || item.hiveName}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                              <span className={cn("px-1 py-0.5 rounded-xs font-semibold border text-[8px]", statusStyle)}>
                                {item.status.replace("_", " ")}
                              </span>
                              <span>&bull;</span>
                              <span className="capitalize font-medium">Priority: {item.priority}</span>
                              {item.dueAt && (
                                <>
                                  <span>&bull;</span>
                                  <span>Due {new Date(item.dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

                {/* SYLLABUS TOPICS SECTION */}
                {!isLoading && syllabusList.length > 0 && (
                  <CommandGroup heading="Syllabus Course Topics">
                    {syllabusList.map((item) => {
                      const isSelected = !!selectedItems[item.id];

                      return (
                        <CommandItem
                          key={item.id}
                          onSelect={() => {
                            if (attachMode) {
                              handleToggleSelectItem(item.id, "syllabus", item.title);
                            } else {
                              handleItemAction(item.id, "syllabus", item.hiveId);
                            }
                          }}
                          className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer"
                        >
                          {attachMode ? (
                            <Checkbox 
                              checked={isSelected}
                              className="rounded-md border-border/80"
                            />
                          ) : (
                            <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                              <BookOpen className="size-4.5" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-foreground truncate leading-none">{item.title}</p>
                              {(item.courseCode || item.hiveName) && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0 rounded-sm font-bold uppercase bg-amber-500/10 text-amber-600 shrink-0 border-amber-500/20">
                                  {item.courseCode || item.hiveName}
                                </Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-[10px] text-muted-foreground truncate">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </CommandList>

              {/* Attach Mode Footer */}
              {attachMode && (
                <div className="p-3 border-t border-border dark:border-zinc-900 bg-muted/40 flex items-center justify-between gap-3 shrink-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    {Object.keys(selectedItems).length} item{Object.keys(selectedItems).length === 1 ? "" : "s"} selected
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onClose}
                      className="text-[11px] h-8 px-3 rounded-lg border-border/80 cursor-pointer font-semibold"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleConfirmSelection}
                      disabled={Object.keys(selectedItems).length === 0}
                      className="text-[11px] h-8 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer font-semibold shadow-xs"
                    >
                      Attach Selected
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </Command>
    </CommandDialog>
  );
}
