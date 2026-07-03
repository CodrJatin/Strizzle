"use client";

import * as React from "react";
import { X, Share, PlusSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function IOSOnboardingBanner() {
  const [showBanner, setShowBanner] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Check if iOS device
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
    
    // 2. Check if already in standalone (installed) mode
    const isStandalone = 
      // @ts-ignore
      navigator.standalone || 
      window.matchMedia("(display-mode: standalone)").matches;

    // 3. Check if recently dismissed
    const dismissedTime = localStorage.getItem("strizzle_ios_pwa_dismissed");
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const isRecentlyDismissed = 
      dismissedTime && 
      Date.now() - parseInt(dismissedTime, 10) < sevenDays;

    if (isIOS && !isStandalone && !isRecentlyDismissed) {
      setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("strizzle_ios_pwa_dismissed", Date.now().toString());
    setShowBanner(false);
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-4.5 shadow-2xl z-50 flex gap-3 font-sans"
        >
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-primary tracking-wider uppercase">
                Install Strizzle
              </span>
              <button 
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-full hover:bg-muted transition-colors"
                title="Dismiss banner"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <h3 className="text-sm font-bold text-foreground leading-snug">
              Add Strizzle to your Home Screen
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              iOS requires launching Strizzle from your Home Screen to enable real-time push notification settings.
            </p>
            
            <div className="pt-1.5 space-y-2 text-[11px] text-foreground font-semibold">
              <div className="flex items-center gap-2.5">
                <div className="size-6 rounded-lg bg-muted/80 flex items-center justify-center border border-border/50 shrink-0">
                  <Share className="size-3.5 text-muted-foreground" />
                </div>
                <span>Tap the <strong className="font-bold">Share</strong> button in Safari</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="size-6 rounded-lg bg-muted/80 flex items-center justify-center border border-border/50 shrink-0">
                  <PlusSquare className="size-3.5 text-muted-foreground" />
                </div>
                <span>Select <strong className="font-bold">Add to Home Screen</strong> from the list</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
