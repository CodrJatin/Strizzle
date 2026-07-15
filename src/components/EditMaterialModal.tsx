"use client";

import * as React from "react";
import { Edit3, Loader2, Tag, FileText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useModalKeybinds } from "@/hooks/useModalKeybinds";

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditMaterialModalProps {
  material: {
    id: string;
    title: string | null;
    tags: string[];
    contentType: string;
    ytPlaylistId: string | null;
    ytVideoRange: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
  hiveId?: string; // Optional context if editing inside a hive page
  queryFilter?: any;
}

export function EditMaterialModal({ material, isOpen, onClose, hiveId, queryFilter }: EditMaterialModalProps) {
  const utils = api.useUtils();
  
  const [title, setTitle] = React.useState(material.title || "");
  const [tagsInput, setTagsInput] = React.useState(material.tags?.join(", ") || "");
  const [ytVideoRange, setYtVideoRange] = React.useState(material.ytVideoRange || "");

  const qFilter = queryFilter || { limit: 18 };

  React.useEffect(() => {
    if (isOpen) {
      setTitle(material.title || "");
      setTagsInput(material.tags?.join(", ") || "");
      setYtVideoRange(material.ytVideoRange || "");
    }
  }, [isOpen, material]);

  // Update mutation with full optimistic updates and rollback
  const updateMutation = api.material.updateMaterial.useMutation({
    onMutate: async (variables) => {
      onClose();
      // Cancel inflight queries
      await utils.library.getLibraryMaterials.cancel(qFilter);
      if (hiveId) {
        await utils.hiveMaterial.getHiveMaterials.cancel({ hiveId, limit: 50 });
      }

      // Snapshot caches
      const previousInfinite = utils.library.getLibraryMaterials.getInfiniteData(qFilter);
      const previousStandard = utils.library.getLibraryMaterials.getData(qFilter);
      const previousHiveMaterials = hiveId ? utils.hiveMaterial.getHiveMaterials.getData({ hiveId, limit: 50 }) : null;

      const updateObj = (oldMat: any) => {
        if (!oldMat) return oldMat;
        return {
          ...oldMat,
          title: variables.title ?? oldMat.title,
          tags: variables.tags ?? oldMat.tags,
          ytVideoRange: variables.ytVideoRange !== undefined ? (variables.ytVideoRange.trim() === "" ? null : variables.ytVideoRange) : oldMat.ytVideoRange,
        };
      };

      // 1. Update library materials
      if (previousInfinite) {
        utils.library.getLibraryMaterials.setInfiniteData(qFilter, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              items: page.items.map((i: any) =>
                i.material.id === variables.id ? { ...i, material: updateObj(i.material) } : i
              ),
            })),
          };
        });
      }

      if (previousStandard) {
        utils.library.getLibraryMaterials.setData(qFilter, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((i: any) =>
              i.material.id === variables.id ? { ...i, material: updateObj(i.material) } : i
            ),
          };
        });
      }

      // 2. Update hive materials
      if (previousHiveMaterials && hiveId) {
        utils.hiveMaterial.getHiveMaterials.setData({ hiveId, limit: 50 }, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((i: any) =>
              i.material.id === variables.id ? { ...i, material: updateObj(i.material) } : i
            ),
          };
        });
      }

      // 3. Update single material details if page is open
      await utils.material.getMaterial.cancel({ id: variables.id });
      const previousSingle = utils.material.getMaterial.getData({ id: variables.id });
      if (previousSingle) {
        utils.material.getMaterial.setData({ id: variables.id }, (old: any) => {
          if (!old) return old;
          return updateObj(old);
        });
      }

      return { previousInfinite, previousStandard, previousHiveMaterials, previousSingle };
    },
    onError: (err: any, _variables, context) => {
      // Rollback
      if (context?.previousInfinite) {
        utils.library.getLibraryMaterials.setInfiniteData(qFilter, context.previousInfinite);
      }
      if (context?.previousStandard) {
        utils.library.getLibraryMaterials.setData(qFilter, context.previousStandard);
      }
      if (context?.previousHiveMaterials && hiveId) {
        utils.hiveMaterial.getHiveMaterials.setData({ hiveId, limit: 50 }, context.previousHiveMaterials);
      }
      if (context?.previousSingle) {
        utils.material.getMaterial.setData({ id: _variables.id }, context.previousSingle);
      }
      toast.error(err.message || "Failed to update material.");
    },
    onSuccess: () => {
      toast.success("Material updated successfully");
    },
    onSettled: () => {
      utils.library.getLibraryMaterials.invalidate(qFilter);
      if (hiveId) {
        utils.hiveMaterial.getHiveMaterials.invalidate({ hiveId });
      }
      utils.material.getMaterial.invalidate({ id: material.id });
    }
  });

  useModalKeybinds(isOpen, () => {
    handleUpdateSubmit();
  });

  const handleUpdateSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Parse tags
    const parsedTags = tagsInput
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Validate youtube playlist range format if set
    if (material.ytPlaylistId && ytVideoRange.trim()) {
      const formatRegex = /^[0-9\s,-]+$/;
      if (!formatRegex.test(ytVideoRange)) {
        toast.error("Invalid playlist range format. Use numbers, spaces, commas and hyphens (e.g. 1-10 12, 14-20).");
        return;
      }
    }

    updateMutation.mutate({
      id: material.id,
      title: title.trim() || undefined,
      tags: parsedTags,
      ytVideoRange: material.ytPlaylistId ? ytVideoRange.trim() : undefined,
    });
  };

  const isUpdating = updateMutation.isPending;
  const isPlaylist = material.ytPlaylistId !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isUpdating) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-card text-card-foreground border border-border p-6 rounded-2xl shadow-xl">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Edit3 className="size-5 shrink-0 text-primary" /> Edit Resource Details
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-normal">
            Modify the tags, title, or playlist configurations for this shared resource.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleUpdateSubmit} className="space-y-4 py-2">
          {/* Title field */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-title" className="text-xs font-semibold">Title / Name</Label>
            <div className="relative flex items-center">
              <FileText className="absolute left-3 size-3.5 text-muted-foreground" />
              <Input 
                id="edit-title"
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="Physics Lecture 01"
                className="pl-9 rounded-xl border border-input text-xs h-9.5"
                required
              />
            </div>
          </div>

          {/* Tags field */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-tags" className="text-xs font-semibold">Tags (comma-separated)</Label>
            <div className="relative flex items-center">
              <Tag className="absolute left-3 size-3.5 text-muted-foreground" />
              <Input 
                id="edit-tags"
                value={tagsInput} 
                onChange={(e) => setTagsInput(e.target.value)} 
                placeholder="physics, kinematics, lecture"
                className="pl-9 rounded-xl border border-input text-xs h-9.5"
              />
            </div>
          </div>

          {/* Range selection field for playlists */}
          {isPlaylist && (
            <div className="space-y-1.5 pt-2 border-t border-border/30">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="edit-range" className="text-xs font-semibold">Video Selection Range</Label>
                <span className="text-[10px] text-muted-foreground">Specify playlist videos to count for duration/watching.</span>
              </div>
              <Input 
                id="edit-range"
                value={ytVideoRange} 
                onChange={(e) => setYtVideoRange(e.target.value)} 
                placeholder="1-19 22 27 30-36"
                className="rounded-xl border border-input text-xs h-9.5 font-mono"
              />
              <div className="rounded-lg bg-muted/30 border border-border/30 p-2.5 text-[9px] text-muted-foreground leading-normal">
                <p className="font-semibold text-foreground mb-0.5">Format guidelines:</p>
                <ul className="list-disc pl-3.5 space-y-0.5">
                  <li>Use hyphens for ranges: <code className="font-mono bg-muted px-1 rounded">1-19</code></li>
                  <li>Use spaces or commas to separate: <code className="font-mono bg-muted px-1 rounded">22, 27</code></li>
                  <li>Leave empty to count all videos in the playlist.</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer"
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl px-5 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
