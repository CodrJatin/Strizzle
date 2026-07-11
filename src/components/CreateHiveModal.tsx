"use client";

import * as React from "react";
import { Layers, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

interface CreateHiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const colorThemes = [
  { name: "blue", hex: "bg-blue-600 hover:bg-blue-700" },
  { name: "green", hex: "bg-emerald-600 hover:bg-emerald-700" },
  { name: "indigo", hex: "bg-indigo-600 hover:bg-indigo-700" },
  { name: "rose", hex: "bg-rose-600 hover:bg-rose-700" },
  { name: "amber", hex: "bg-amber-600 hover:bg-amber-700" },
];

export function CreateHiveModal({ isOpen, onClose }: CreateHiveModalProps) {
  const utils = api.useUtils();

  const [name, setName] = React.useState("");
  const [courseCode, setCourseCode] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [colorTheme, setColorTheme] = React.useState("blue");

  const resetForm = () => {
    setName("");
    setCourseCode("");
    setDescription("");
    setColorTheme("blue");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const createHiveMutation = api.hive.createHive.useMutation({
    onMutate: async (newHive) => {
      handleClose();
      await utils.hive.getUserHives.cancel();
      const previousHives = utils.hive.getUserHives.getData();

      utils.hive.getUserHives.setData(undefined, (old) => {
        const tempHive = {
          id: "temp-id-" + Math.random().toString(),
          name: newHive.name,
          description: newHive.description ?? null,
          courseCode: newHive.courseCode ?? null,
          colorTheme: newHive.colorTheme ?? "blue",
          createdAt: new Date().toISOString(),
          role: "owner" as const,
          memberCount: 1,
        };
        if (!old) return [tempHive];
        return [tempHive, ...old];
      });

      return { previousHives };
    },
    onError: (err, newHive, context) => {
      if (context?.previousHives) {
        utils.hive.getUserHives.setData(undefined, context.previousHives);
      }
      toast.error(err.message || "Failed to create study group.");
    },
    onSuccess: () => {
      toast.success("Study group created successfully!");
      utils.hive.getUserHives.invalidate();
      handleClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Hive name is required.");
      return;
    }

    createHiveMutation.mutate({
      name: name.trim(),
      courseCode: courseCode.trim() || undefined,
      description: description.trim() || undefined,
      colorTheme: colorTheme,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md border-border bg-card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              Create a New Study Hive
            </DialogTitle>
            <DialogDescription>
              Establish a new workspace to coordinate files, announcements, schedules, and materials with your group.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 select-none">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Hive Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Biology 101"
                className="rounded-xl border-border bg-card text-xs h-9.5"
              />
            </div>

            {/* Course Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Course Code (Optional)</label>
              <Input
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="BIO 201"
                className="rounded-xl border-border bg-card text-xs h-9.5 max-w-[180px]"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <span className="text-[10px] text-muted-foreground font-medium">{description.length}/250</span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 250))}
                placeholder="Group description..."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-border bg-card focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-muted-foreground/60 transition-all"
              />
            </div>

            {/* Color Theme */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-semibold text-muted-foreground">Appearance Color Theme</label>
              <div className="flex items-center gap-3 pt-1">
                {colorThemes.map((theme) => {
                  const isSelected = colorTheme === theme.name;
                  return (
                    <button
                      key={theme.name}
                      type="button"
                      onClick={() => setColorTheme(theme.name)}
                      className={cn(
                        "size-8 rounded-full flex items-center justify-center transition-transform cursor-pointer relative shadow-sm border border-black/10 text-white shrink-0 hover:scale-105",
                        theme.hex
                      )}
                    >
                      {isSelected && <Check className="size-4 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button 
              type="button"
              variant="ghost" 
              onClick={handleClose} 
              className="rounded-xl text-xs font-semibold h-9.5 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createHiveMutation.isPending}
              className="rounded-xl text-xs font-semibold h-9.5 px-5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              {createHiveMutation.isPending ? <Loader2 className="animate-spin size-4" /> : "Create Hive"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
