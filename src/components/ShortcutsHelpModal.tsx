"use client";

import * as React from "react";
import { Keyboard, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsHelpModal({ isOpen, onClose }: ShortcutsHelpModalProps) {
  const shortcutGroups = [
    {
      title: "Global Navigation",
      items: [
        { keys: ["Shift", "D"], description: "Navigate to Dashboard" },
        { keys: ["Shift", "W"], description: "Navigate to Workspace / Desk" },
        { keys: ["Shift", "L"], description: "Navigate to Library" },
        { keys: ["Shift", "C"], description: "Navigate to Community Feed" },
        { keys: ["/"], description: "Toggle Global Search" },
        { keys: ["Ctrl", "Shift", "A"], description: "Open Quick Capture Note (or Cmd+Shift+A)" },
        { keys: ["Shift", "T"], description: "Toggle Light / Dark Theme" },
        { keys: ["?"], description: "Toggle Keyboard Shortcuts Help" },
      ],
    },
    {
      title: "Active Sidebar Navigation",
      items: [
        { keys: ["Shift", "1"], description: "Go to 1st item in active sidebar" },
        { keys: ["Shift", "2"], description: "Go to 2nd item in active sidebar" },
        { keys: ["Shift", "3"], description: "Go to 3rd item in active sidebar" },
        { keys: ["Shift", "4"], description: "Go to 4th item in active sidebar" },
        { keys: ["Shift", "5"], description: "Go to 5th item in active sidebar" },
      ],
    },
    {
      title: "Modals & Overlays",
      items: [
        { keys: ["Enter"], description: "Run primary action button (Confirm/Submit)" },
        { keys: ["Esc"], description: "Close modal / cancel action" },
      ],
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg md:max-w-3xl border-border bg-card p-6 rounded-2xl shadow-xl">
        <DialogHeader className="border-b border-border/40 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Keyboard className="size-5 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Speed up your study workflow with system-wide hotkeys.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6 max-h-[60vh] overflow-y-auto pr-1">
          {/* Left Column: Global Navigation */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/40 pb-1.5">
              {shortcutGroups[0].title}
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {shortcutGroups[0].items.map((item) => (
                <div
                  key={item.description}
                  className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-muted/30 transition-colors text-xs"
                >
                  <span className="text-muted-foreground font-medium text-[11px] leading-tight mr-2">{item.description}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.keys.map((key, i) => (
                      <React.Fragment key={key}>
                        {i > 0 && <span className="text-[10px] text-muted-foreground/60 font-semibold">+</span>}
                        <kbd className="min-w-[22px] h-5 px-1.5 text-[10px] font-bold font-mono flex items-center justify-center rounded bg-muted text-foreground border border-border shadow-[0_1px_0_0_rgba(0,0,0,0.15)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.1)]">
                          {key}
                        </kbd>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Sidebar Navigation & Modals */}
          <div className="space-y-6">
            {/* Active Sidebar */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/40 pb-1.5">
                {shortcutGroups[1].title}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {shortcutGroups[1].items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-muted/30 transition-colors text-xs"
                  >
                    <span className="text-muted-foreground font-medium text-[11px] leading-tight mr-2">{item.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((key, i) => (
                        <React.Fragment key={key}>
                          {i > 0 && <span className="text-[10px] text-muted-foreground/60 font-semibold">+</span>}
                          <kbd className="min-w-[22px] h-5 px-1.5 text-[10px] font-bold font-mono flex items-center justify-center rounded bg-muted text-foreground border border-border shadow-[0_1px_0_0_rgba(0,0,0,0.15)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.1)]">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modals & Overlays */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/40 pb-1.5">
                {shortcutGroups[2].title}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {shortcutGroups[2].items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-muted/30 transition-colors text-xs"
                  >
                    <span className="text-muted-foreground font-medium text-[11px] leading-tight mr-2">{item.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((key, i) => (
                        <React.Fragment key={key}>
                          {i > 0 && <span className="text-[10px] text-muted-foreground/60 font-semibold">+</span>}
                          <kbd className="min-w-[22px] h-5 px-1.5 text-[10px] font-bold font-mono flex items-center justify-center rounded bg-muted text-foreground border border-border shadow-[0_1px_0_0_rgba(0,0,0,0.15)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.1)]">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border/40">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm cursor-pointer transition-colors"
          >
            Got it
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
