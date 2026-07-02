"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Plus, Sparkles, Inbox, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/trpc/client";
import { useQuickAddStore } from "@/store/quickAddStore";
import { ShelfItemCard, type ShelfItem } from "@/components/ShelfItemCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DeskActionModal } from "@/components/DeskActionModal";

export default function DeskPage() {
  const openQuickAdd = useQuickAddStore((s) => s.open);
  const utils = api.useUtils();

  const [selectedItem, setSelectedItem] = React.useState<ShelfItem | null>(null);
  const [actionModalOpen, setActionModalOpen] = React.useState(false);

  // tRPC mutations for processing pending shares
  const createTextMaterial = api.material.createTextMaterial.useMutation();
  const createLinkMaterial = api.material.createLinkMaterial.useMutation();
  const createShelfItem = api.shelf.createShelfItem.useMutation();

  // Fetch captured shelf items with explicit staleTime (120,000ms as per AGENTS.md staleTime reference table for standard data)
  const { data: items, isLoading, isRefetching, refetch } = api.shelf.getShelfItems.useQuery(undefined, {
    staleTime: 120000,
    refetchOnWindowFocus: true,
  });

  // 1. Process unauthenticated Web Share Target cookie on load
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const match = document.cookie.match(/(^|;)\s*strizzle-share-payload\s*=\s*([^;]+)/);
    if (match) {
      try {
        const payload = JSON.parse(decodeURIComponent(match[2])) as {
          title?: string;
          text?: string;
          url?: string;
          hasFiles?: boolean;
        };
        // Expire the cookie immediately
        document.cookie = "strizzle-share-payload=; path=/; max-age=0; SameSite=Lax";

        const processShare = async () => {
          if (payload.url) {
            const mat = await createLinkMaterial.mutateAsync({
              url: payload.url,
            });
            await createShelfItem.mutateAsync({ materialId: mat.id });
          } else if (payload.text) {
            const mat = await createTextMaterial.mutateAsync({
              body: payload.text,
              title: payload.title || undefined,
            });
            await createShelfItem.mutateAsync({ materialId: mat.id });
          }
          if (payload.hasFiles) {
            toast.warning("Files must be shared while logged in. Please try sharing again.");
          }
          await utils.shelf.getShelfItems.invalidate();
        };

        toast.promise(processShare(), {
          loading: "Saving shared content to your Desk...",
          success: "Shared content saved successfully!",
          error: "Failed to save shared content.",
        });
      } catch (err) {
        console.error("Failed to parse share-target payload:", err);
      }
    }
  }, [utils, createTextMaterial, createLinkMaterial, createShelfItem]);

  // 2. Process direct authenticated Web Share Target redirect query params
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("shareSuccess") === "true") {
      toast.success("Shared content captured to Desk!");
      window.history.replaceState({}, "", window.location.pathname);
      utils.shelf.getShelfItems.invalidate();
    } else if (searchParams.get("shareError") === "true") {
      toast.error("Failed to capture shared content.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [utils]);

  // Callback when a card's "Organize..." or main body is clicked (opens action modal - Task 2.11)
  const handleActionClick = (item: ShelfItem) => {
    setSelectedItem(item);
    setActionModalOpen(true);
  };

  const handleRefresh = async () => {
    await refetch();
    toast.success("Desk refreshed");
  };

  const renderContent = () => {
    if (isLoading) {
      // Shimmer loading skeletons
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <ShelfItemCard key={idx} isShimmer={true} />
          ))}
        </div>
      );
    }

    if (!items || items.length === 0) {
      // Empty state
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="border border-dashed border-border/80 rounded-3xl p-16 text-center bg-card flex flex-col items-center justify-center max-w-2xl mx-auto my-8 shadow-sm"
        >
          <div className="size-16 rounded-2xl bg-primary/10 text-primary border border-primary/10 flex items-center justify-center mb-6 shadow-inner animate-pulse-slow">
            <Inbox className="size-8 text-primary/80" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground mb-2 flex items-center gap-1.5 justify-center">
            Your desk is clear <Sparkles className="size-4.5 text-primary" />
          </h2>
          <p className="text-muted-foreground text-sm max-w-sm mb-8 leading-relaxed">
            Capture text notes, URLs, YouTube videos, images, or documents. They'll wait here safely until you organize them.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              onClick={openQuickAdd}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/95 font-medium rounded-xl flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="size-4.5" />
              Quick Capture
            </Button>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              or press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-sans font-medium uppercase shadow-xs">Ctrl + Shift + A</kbd>
            </span>
          </div>
        </motion.div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{items.length}</span> captured {items.length === 1 ? "item" : "items"} waiting to be organized.
          </p>
          {isRefetching && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="size-3 animate-spin text-primary" /> Updating...
            </span>
          )}
        </div>

        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <ShelfItemCard 
                  item={item} 
                  onActionClick={handleActionClick} 
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="space-y-8 font-sans max-w-7xl mx-auto pb-12">
      {/* Header section with page identity */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/10 shadow-inner">
              <Layers className="size-7 text-primary" />
            </div>
            Desk Shelf
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">
            Your temporary digital workspace. Capture reference materials here, then convert, share, or file them to your library.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading || isRefetching}
            className="rounded-xl border-border/80 text-muted-foreground hover:text-foreground size-10"
            title="Refresh Shelf"
          >
            <RefreshCw className={cn("size-4", (isLoading || isRefetching) && "animate-spin")} />
          </Button>
          <Button
            onClick={openQuickAdd}
            className="bg-primary text-primary-foreground hover:bg-primary/95 font-medium rounded-xl flex items-center gap-2 h-10 px-4 shadow-sm"
          >
            <Plus className="size-4" />
            Capture Resource
          </Button>
        </div>
      </div>

      {/* Main page content container */}
      <div className="min-h-[400px]">
        {renderContent()}
      </div>

      {selectedItem && (
        <DeskActionModal
          item={selectedItem}
          isOpen={actionModalOpen}
          onClose={() => {
            setActionModalOpen(false);
            setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
}
