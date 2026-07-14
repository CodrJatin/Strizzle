"use client";

import * as React from "react";
import { 
  BookOpen, Search, Star, LayoutGrid, List, Layers, Plus, 
  HelpCircle, ArrowUpDown, ShieldAlert, Sparkles, FolderOpen, Loader2, FileText,
  ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { api } from "@/lib/trpc/client";
import { useQuickAddStore } from "@/store/quickAddStore";
import { LibraryMaterialCard, type LibraryItem } from "@/components/LibraryMaterialCard";
import { DropdownSelect } from "@/components/DropdownSelect";
import { DeleteMaterialModal } from "@/components/DeleteMaterialModal";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";

// Content type filter options
const filterPills = [
  { value: "all", label: "All Types" },
  { value: "text", label: "Notes" },
  { value: "link", label: "Links" },
  { value: "youtube", label: "Videos" },
  { value: "file", label: "Files" },
  { value: "image", label: "Images" },
] as const;

type ContentTypeFilter = typeof filterPills[number]["value"];

export default function LibraryPage() {
  const openQuickAdd = useQuickAddStore((s) => s.open);
  const supabase = createClient();
  const utils = api.useUtils();
  
  // Search & Filtering States
  const [search, setSearch] = React.useState("");
  const [searchDebounced, setSearchDebounced] = React.useState("");
  const [selectedType, setSelectedType] = React.useState<ContentTypeFilter>("all");
  const [starredOnly, setStarredOnly] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<"addedAt" | "title">("addedAt");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");

  // Expanded/collapsed hives state mapping
  const [expandedHives, setExpandedHives] = React.useState<Record<string, boolean>>({});

  const sortOptions = [
    { value: "addedAt", label: "Date Added" },
    { value: "title", label: "Title / Name" },
  ];

  const toggleHiveExpand = (hiveId: string) => {
    setExpandedHives((prev) => ({
      ...prev,
      [hiveId]: prev[hiveId] === false ? true : false,
    }));
  };

  // Dialog State
  const [deletingItem, setDeletingItem] = React.useState<LibraryItem | null>(null);
  const [viewingTextItem, setViewingTextItem] = React.useState<LibraryItem | null>(null);

  // Debounce search input (300ms)
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setSearchDebounced(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Memoized query filter for library materials
  const queryFilter = React.useMemo(() => ({
    search: searchDebounced.trim() || undefined,
    starredOnly,
    contentType: selectedType === "all" ? undefined : selectedType,
    sortBy,
    sortOrder,
    limit: 18,
  }), [searchDebounced, starredOnly, selectedType, sortBy, sortOrder]);

  // tRPC Infinite Query for Library Materials
  const { 
    data, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage, 
    isLoading, 
    isRefetching, 
    refetch 
  } = api.library.getLibraryMaterials.useInfiniteQuery(
    queryFilter,
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: 120000, // 2 mins cache
    }
  );

  // tRPC Query for Hive Materials
  const { data: hiveMaterials, isLoading: isLoadingHiveMaterials, refetch: refetchHiveMaterials } = 
    api.library.getHiveMaterialsForLibrary.useQuery(undefined, {
      staleTime: 120000,
    });

  const addToLibraryMutation = api.library.addToLibrary.useMutation({
    onMutate: async (variables) => {
      await utils.library.getLibraryMaterials.cancel();
      const previousLibrary = utils.library.getLibraryMaterials.getInfiniteData();

      // Find the material in hiveMaterials to copy
      const copiedMaterial = hiveMaterials?.find((m) => m.material.id === variables.materialId);

      if (copiedMaterial && previousLibrary) {
        utils.library.getLibraryMaterials.setInfiniteData({}, (old: any) => {
          if (!old) return old;
          
          // Construct the new LibraryItem
          const newItem = {
            id: "temp-copied-id-" + Math.random().toString(),
            userId: "me",
            materialId: variables.materialId,
            starred: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            material: copiedMaterial.material,
          };

          // Prepend newItem to the first page's items
          return {
            ...old,
            pages: old.pages.map((page: any, idx: number) => {
              if (idx === 0) {
                return {
                  ...page,
                  items: [newItem, ...page.items],
                };
              }
              return page;
            }),
          };
        });
      }
      return { previousLibrary };
    },
    onError: (err, _variables, context) => {
      if (context?.previousLibrary) {
        utils.library.getLibraryMaterials.setInfiniteData({}, context.previousLibrary);
      }
      toast.error(err.message || "Something went wrong. Please try again.");
    },
    onSuccess: () => {
      toast.success("Copied to your personal library!");
    },
    onSettled: () => {
      utils.library.getLibraryMaterials.invalidate();
      refetchHiveMaterials();
    }
  });

  const items = data?.pages.flatMap((page) => page.items) || [];

  // Group hive materials by hiveId for sidebar
  const groupedHiveMaterials = React.useMemo(() => {
    if (!hiveMaterials) return [];
    const groups: Record<string, { hiveId: string; hiveName: string; hiveCode: string | null; items: typeof hiveMaterials }> = {};
    
    hiveMaterials.forEach((item) => {
      if (!groups[item.hiveId]) {
        groups[item.hiveId] = {
          hiveId: item.hiveId,
          hiveName: item.hiveName,
          hiveCode: item.hiveCode,
          items: [],
        };
      }
      groups[item.hiveId].items.push(item);
    });
    
    return Object.values(groups);
  }, [hiveMaterials]);

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchHiveMaterials()]);
    toast.success("Library updated");
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <div className="space-y-8 font-sans max-w-7xl mx-auto pb-12 min-w-0">
      {/* Header section with page identity */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/10 shadow-inner">
              <BookOpen className="size-7 text-primary" />
            </div>
            My Library
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">
            Your permanent search index and archive of organized study materials, documents, and reference bookmarks.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
          <Button
            onClick={openQuickAdd}
            className="bg-primary text-primary-foreground hover:bg-primary/95 font-medium rounded-xl flex items-center justify-center gap-2 h-10 px-4 shadow-sm cursor-pointer"
          >
            <Plus className="size-4" />
            Add Material
          </Button>
        </div>
      </div>

      {/* Control Bar: Search, Filters, Sorters */}
      <div className="space-y-4 bg-muted/20 border border-border/40 rounded-2xl p-4 md:p-5">
        <div className="flex flex-col md:flex-row gap-3 min-w-0">
          {/* Search bar */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search library by text, title or domain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 text-xs h-10 rounded-xl border border-input bg-background w-full"
            />
          </div>

          {/* Sort, Star, Grid selectors */}
          <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto w-full md:w-auto justify-end">
            {/* Sort Select */}
            <div className="flex items-center gap-1">
              <DropdownSelect
                value={sortBy}
                onValueChange={(val) => setSortBy(val as any)}
                options={sortOptions}
                className="h-10 w-32 bg-background border border-input rounded-xl text-xs font-semibold"
              />
              
              <Button
                variant="outline"
                size="icon"
                onClick={toggleSortOrder}
                className="size-10 rounded-xl border-border/80 text-muted-foreground hover:text-foreground"
                title={`Sort ${sortOrder === "asc" ? "Ascending" : "Descending"}`}
              >
                <ArrowUpDown className="size-4" />
              </Button>
            </div>

            {/* Starred Toggle */}
            <Button
              variant="outline"
              onClick={() => setStarredOnly((prev) => !prev)}
              className={cn(
                "h-10 rounded-xl border-border/80 px-3 flex items-center gap-1.5 font-semibold text-xs cursor-pointer",
                starredOnly 
                  ? "bg-yellow-400/10 border-yellow-400/30 text-yellow-500 hover:bg-yellow-400/20" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Star className={cn("size-4", starredOnly && "fill-current")} />
              <span className="hidden sm:inline">Starred</span>
            </Button>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-0.5 bg-muted p-1.5 rounded-xl border border-border/40">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setViewMode("grid")}
                className="size-7 rounded-lg"
                title="Grid view"
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setViewMode("list")}
                className="size-7 rounded-lg"
                title="List view"
              >
                <List className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 -mx-1 px-1 shrink-0 scrollbar-none">
          {filterPills.map((pill) => {
            const isActive = selectedType === pill.value;
            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => setSelectedType(pill.value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer",
                  isActive
                    ? "bg-primary border-primary text-primary-foreground shadow-xs"
                    : "border-border/50 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* My Materials Section */}
      <div className="space-y-6 min-w-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            My Materials 
            {isRefetching && <Loader2 className="size-4 animate-spin text-primary" />}
          </h2>
          <span className="text-xs text-muted-foreground">
            Total: {items.length} {items.length === 1 ? "material" : "materials"}
          </span>
        </div>

        {/* Skeletons Loading */}
        {isLoading && (
          <div className={cn(
            viewMode === "grid" 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
              : "flex flex-col gap-3"
          )}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <LibraryMaterialCard key={idx} viewMode={viewMode} isShimmer={true} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && items.length === 0 && (
          <div className="border border-dashed border-border/80 rounded-2xl p-16 text-center bg-card flex flex-col items-center justify-center max-w-xl mx-auto my-6 shadow-xs">
            <FolderOpen className="size-12 text-muted-foreground mb-4 opacity-60" />
            <h3 className="text-sm font-bold text-foreground mb-1">No library materials found</h3>
            <p className="text-xs text-muted-foreground max-w-xs mb-6 leading-relaxed">
              {searchDebounced 
                ? "Adjust search keywords or check active filter pills above." 
                : "Organize items from your Desk shelf, or use the quick capture dialog to add resources."}
            </p>
            {!searchDebounced && (
              <Button onClick={openQuickAdd} variant="outline" className="rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer">
                Capture Resource
              </Button>
            )}
          </div>
        )}

        {/* Card List / Grid Content */}
        {!isLoading && items.length > 0 && (
          <div className="space-y-6">
            <div className={cn(
              viewMode === "grid" 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
                : "flex flex-col gap-3"
            )}>
              {items.map((item) => (
                <LibraryMaterialCard
                  key={item.id}
                  item={item}
                  viewMode={viewMode}
                  onDeleteClick={setDeletingItem}
                  onTextOpenClick={setViewingTextItem}
                  queryFilter={queryFilter}
                />
              ))}
            </div>

            {/* Load More Trigger */}
            {hasNextPage && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="rounded-xl px-6 h-10 border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/40 font-semibold text-xs"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="size-4 animate-spin text-primary mr-2" />
                      Loading more...
                    </>
                  ) : (
                    "Load More Materials"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* From My Hives Section */}
      <div className="space-y-6 min-w-0 pt-8 border-t border-border/40">
        <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center justify-between">
          From My Hives
          {isLoadingHiveMaterials && <Loader2 className="size-4 animate-spin text-primary" />}
        </h2>
        
        {isLoadingHiveMaterials ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-24 w-full bg-muted/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : groupedHiveMaterials.length === 0 ? (
          <div className="border border-border/60 bg-card rounded-2xl p-8 shadow-xs text-center space-y-4 max-w-md mx-auto">
            <div className="size-11 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/10 flex items-center justify-center mx-auto shadow-inner">
              <Layers className="size-5.5" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">No shared materials</h3>
              <p className="text-xs text-muted-foreground leading-normal max-w-[240px] mx-auto">
                Resources shared by classmates in your active hives will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedHiveMaterials.map((group) => {
              const isExpanded = expandedHives[group.hiveId] !== false;
              return (
                <div key={group.hiveId} className="border border-border/60 bg-card rounded-2xl overflow-hidden shadow-xs">
                  {/* Hive Section Header */}
                  <button
                    type="button"
                    onClick={() => toggleHiveExpand(group.hiveId)}
                    className="w-full px-5 py-4 flex items-center justify-between bg-muted/20 hover:bg-muted/40 transition-colors text-left border-b border-border/40 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Layers className="size-4.5 text-primary shrink-0" />
                      <span className="text-sm font-bold text-foreground truncate">
                        {group.hiveCode ? `${group.hiveCode} - ` : ""}{group.hiveName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-semibold text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full">
                        {group.items.length} {group.items.length === 1 ? "item" : "items"}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 text-muted-foreground transition-transform duration-200",
                          !isExpanded && "-rotate-90"
                        )}
                      />
                    </div>
                  </button>

                  {/* Collapsible Content */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="p-5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {group.items.map((item) => {
                              const m = item.material;
                              return (
                                <Card 
                                  key={item.shareId} 
                                  className="group relative border-border/55 shadow-xs bg-card hover:shadow-sm rounded-xl overflow-hidden transition-all duration-200"
                                >
                                  <CardContent className="p-3 flex items-center gap-3">
                                    {/* Small Icon Badge */}
                                    <div className="size-9 rounded-lg bg-muted/40 border border-border/40 flex items-center justify-center shrink-0">
                                      <FileText className="size-4.5 text-muted-foreground" />
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-xs font-bold text-foreground truncate" title={m.title || "Untitled"}>
                                        {m.title || "Untitled shared material"}
                                      </h4>
                                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate uppercase">
                                        {m.contentType}
                                      </p>
                                    </div>
                                  </CardContent>

                                  {/* Hover Overlay with Copy to Library */}
                                  <div className="absolute inset-0 bg-background/95 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center gap-2 px-3">
                                    <Button
                                      onClick={() => addToLibraryMutation.mutate({ materialId: m.id })}
                                      variant="default"
                                      size="xs"
                                      disabled={addToLibraryMutation.isPending}
                                      className="h-7.5 text-[10px] font-bold rounded-lg shadow-sm w-full cursor-pointer"
                                    >
                                      {addToLibraryMutation.isPending ? (
                                        <Loader2 className="size-3 animate-spin" />
                                      ) : (
                                        "Copy to Library"
                                      )}
                                    </Button>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Viewing Notes & Images Dialog */}
      <Dialog open={!!viewingTextItem} onOpenChange={(open) => { if (!open) setViewingTextItem(null); }}>
        <DialogContent className="sm:max-w-lg bg-card text-card-foreground border border-border p-6 rounded-2xl shadow-xl flex flex-col max-h-[80vh]">
          <DialogHeader className="space-y-1 border-b border-border/40 pb-4 shrink-0">
            <DialogTitle className="text-lg font-bold tracking-tight">
              {viewingTextItem?.material.contentType === "image"
                ? (viewingTextItem.material.title || "Image Preview")
                : (viewingTextItem?.material.title || "Note Preview")}
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground">
              Added {viewingTextItem && new Date(viewingTextItem.addedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 flex items-center justify-center min-h-[200px]">
            {viewingTextItem?.material.contentType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  viewingTextItem.material.storagePath
                    ? supabase.storage.from("materials").getPublicUrl(viewingTextItem.material.storagePath).data.publicUrl
                    : viewingTextItem.material.ogImage || ""
                }
                alt={viewingTextItem.material.title || "Preview"}
                className="max-w-full max-h-[50vh] object-contain rounded-lg border border-border/60 shadow-xs"
              />
            ) : (
              <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap w-full">
                {viewingTextItem?.material.body}
              </div>
            )}
          </div>
          <div className="flex justify-end pt-4 border-t border-border/40 shrink-0">
            <Button variant="outline" onClick={() => setViewingTextItem(null)} className="rounded-xl px-4 h-9.5 text-xs font-semibold">
              Close Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <DeleteMaterialModal
          item={deletingItem}
          isOpen={!!deletingItem}
          onClose={() => setDeletingItem(null)}
          queryFilter={queryFilter}
        />
      )}

    </div>
  );
}
