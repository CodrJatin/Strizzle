"use client";

import * as React from "react";
import { 
  BookOpen, Search, Star, LayoutGrid, List, Layers, Plus, 
  HelpCircle, ArrowUpDown, ShieldAlert, Sparkles, FolderOpen, Loader2
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/trpc/client";
import { useQuickAddStore } from "@/store/quickAddStore";
import { LibraryMaterialCard, type LibraryItem } from "@/components/LibraryMaterialCard";
import { DeleteMaterialModal } from "@/components/DeleteMaterialModal";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
  
  // Search & Filtering States
  const [search, setSearch] = React.useState("");
  const [searchDebounced, setSearchDebounced] = React.useState("");
  const [selectedType, setSelectedType] = React.useState<ContentTypeFilter>("all");
  const [starredOnly, setStarredOnly] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<"addedAt" | "title">("addedAt");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");

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

  const items = data?.pages.flatMap((page) => page.items) || [];

  const handleRefresh = async () => {
    await refetch();
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
            <Search className="absolute left-3.5 size-4 text-muted-foreground pointer-events-none" />
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
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-background border border-input rounded-xl px-3 py-2 text-xs font-semibold h-10 focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
              >
                <option value="addedAt">Date Added</option>
                <option value="title">Title / Name</option>
              </select>
              
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

      {/* Two Layout Columns: My Materials & From My Hives */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 min-w-0">
        
        {/* Main Column: My Materials */}
        <div className="lg:col-span-3 space-y-6 min-w-0">
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

        {/* Right Sidebar: From My Hives placeholder */}
        <div className="lg:col-span-1 space-y-6 shrink-0">
          <h2 className="text-lg font-bold tracking-tight text-foreground">From My Hives</h2>
          
          <div className="border border-border/60 bg-card rounded-2xl p-5 shadow-xs text-center space-y-4">
            <div className="size-11 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/10 flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert className="size-5.5" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 justify-center">
                Study Hives <Sparkles className="size-3.5 text-indigo-500" />
              </h3>
              <p className="text-[11px] text-muted-foreground leading-normal max-w-[200px] mx-auto">
                Hives are scheduled for Phase 3. Here you will see shared resources from your hives, sorted by course code.
              </p>
            </div>

            <Button
              variant="outline"
              disabled
              className="w-full text-xs rounded-xl h-9 hover:bg-muted border-border/60 text-muted-foreground font-semibold"
            >
              Locked (Phase 3)
            </Button>
          </div>
        </div>

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
