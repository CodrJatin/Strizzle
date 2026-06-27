"use client";

import * as React from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { LibraryItem } from "@/components/LibraryMaterialCard";

interface DeleteMaterialModalProps {
  item: LibraryItem;
  isOpen: boolean;
  onClose: () => void;
  queryFilter?: any;
}

export function DeleteMaterialModal({ item, isOpen, onClose, queryFilter }: DeleteMaterialModalProps) {
  const utils = api.useUtils();
  const { material } = item;
  
  const [removeFromHives, setRemoveFromHives] = React.useState(false);

  const qFilter = queryFilter || { limit: 18 };

  // Check if material is shared to any hives
  const { data: shareData, isLoading: isLoadingShares } = api.material.checkMaterialShares.useQuery(
    { materialId: material.id },
    { enabled: isOpen, staleTime: 30000 }
  );

  // Delete Mutation with Optimistic Updates
  const deleteMutation = api.material.deleteMaterial.useMutation({
    onMutate: async (variables) => {
      // Cancel inflight queries
      await utils.library.getLibraryMaterials.cancel(qFilter);

      // Snapshot caches for rollback
      const previousInfinite = utils.library.getLibraryMaterials.getInfiniteData(qFilter);
      const previousStandard = utils.library.getLibraryMaterials.getData(qFilter);

      // 1. Update infinite query cache (if exists)
      if (previousInfinite) {
        utils.library.getLibraryMaterials.setInfiniteData(qFilter, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              items: page.items.filter((i: any) => i.material.id !== variables.id),
            })),
          };
        });
      }

      // 2. Update standard query cache (if exists)
      if (previousStandard) {
        utils.library.getLibraryMaterials.setData(qFilter, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.filter((i: any) => i.material.id !== variables.id),
          };
        });
      }

      return { previousInfinite, previousStandard };
    },
    onError: (err: any, _variables, context) => {
      // Rollback to snapshot
      if (context?.previousInfinite) {
        utils.library.getLibraryMaterials.setInfiniteData(qFilter, context.previousInfinite);
      }
      if (context?.previousStandard) {
        utils.library.getLibraryMaterials.setData(qFilter, context.previousStandard);
      }
      toast.error(err.message || "Failed to delete material.");
    },
    onSuccess: () => {
      toast.success("Material deleted successfully");
      onClose();
    },
    onSettled: () => {
      utils.library.getLibraryMaterials.invalidate(qFilter);
    }
  });

  const handleDeleteSubmit = async () => {
    deleteMutation.mutate({
      id: material.id,
      removeFromHives,
    });
  };

  const isDeleting = deleteMutation.isPending;
  const isShared = shareData?.shared === true;
  const shareCount = shareData?.count || 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isDeleting) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-card text-card-foreground border border-border p-6 rounded-2xl shadow-xl">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-lg font-bold tracking-tight text-destructive flex items-center gap-2">
            <Trash2 className="size-5 shrink-0" /> Delete Material
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-normal">
            Are you sure you want to delete <span className="font-semibold text-foreground">"{material.title || material.fileName}"</span>? This action is permanent.
          </DialogDescription>
        </DialogHeader>

        {/* Loading state for shares check */}
        {isLoadingShares && (
          <div className="py-6 flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Checking sharing status...</span>
          </div>
        )}

        {/* Hive Share Warnings */}
        {!isLoadingShares && isShared && (
          <div className="space-y-4 my-2">
            <div className="flex gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-500">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold leading-none">Shared Resource Warning</h4>
                <p className="text-[10px] font-medium leading-normal">
                  This material has been shared in <span className="font-semibold">{shareCount}</span> study group hive{shareCount === 1 ? "" : "s"}.
                  Deleting it from your library will hide it here, but it will remain active inside those hives.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 px-1">
              <Checkbox
                id="remove-hives"
                checked={removeFromHives}
                onCheckedChange={(checked) => setRemoveFromHives(checked === true)}
                className="mt-0.5 rounded border-border"
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="remove-hives"
                  className="text-xs font-semibold text-foreground cursor-pointer select-none"
                >
                  Also request removal from shared hives
                </label>
                <p className="text-[9px] text-muted-foreground leading-normal">
                  This will attempts to unshare the material from all study hives you shared it to.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Normal warnings */}
        {!isLoadingShares && !isShared && (
          <div className="py-2 text-xs text-muted-foreground leading-relaxed">
            The file and database entries associated with this material will be cleared. If this is a document uploaded to Supabase storage, it will be deleted once all references reach zero.
          </div>
        )}

        <DialogFooter className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer"
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDeleteSubmit}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/95 rounded-xl px-5 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            disabled={isDeleting || isLoadingShares}
          >
            {isDeleting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Permanently</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
