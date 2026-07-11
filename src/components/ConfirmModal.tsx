"use client";

import * as React from "react";
import { useConfirmStore } from "@/store/confirmStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info } from "lucide-react";

export function ConfirmModal() {
  const { isOpen, options, onConfirm, onCancel } = useConfirmStore();

  if (!options) return null;

  const {
    title = "Confirm Action",
    description = "Are you sure you want to proceed?",
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default",
  } = options;

  const isDestructive = variant === "destructive";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-md rounded-xl bg-card border-border p-6 shadow-xl">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            {isDestructive ? (
              <AlertTriangle className="size-5 text-destructive shrink-0" />
            ) : (
              <Info className="size-5 text-primary shrink-0" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-normal">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="pt-4 border-t border-border/40 gap-2 mt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="rounded-xl text-xs font-semibold h-9.5 px-4 cursor-pointer"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className={
              isDestructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs font-semibold h-9.5 px-5 cursor-pointer"
                : "bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-semibold h-9.5 px-5 cursor-pointer"
            }
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
