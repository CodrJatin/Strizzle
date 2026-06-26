"use client";

import * as React from "react";
import { Layers, Star, CheckSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <div className="space-y-8 font-sans">
      {/* Welcome Banner */}
      <div className="bg-card text-card-foreground border border-border rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,var(--primary),transparent_60%)] opacity-[0.05] pointer-events-none" />
        <div className="space-y-2 max-w-lg z-10">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Welcome back! <Sparkles className="size-6 text-primary animate-pulse" />
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Here's a look at your study world today. Start capturing resources to your desk or check in on your study groups.
          </p>
        </div>
        <div className="flex gap-3 z-10">
          <Button variant="outline" className="rounded-xl h-10 font-semibold cursor-pointer">
            View Analytics
          </Button>
          <Button className="rounded-xl h-10 font-semibold cursor-pointer">
            Create Entry
          </Button>
        </div>
      </div>

      {/* Grid Layout of Placeholder Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Panel 1: Study Groups (Hives) */}
        <div className="bg-card text-card-foreground border border-border rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[200px]">
          <div className="space-y-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary border border-primary/10">
              <Layers className="size-5" />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Study Groups
            </h2>
            <p className="text-sm text-muted-foreground">
              Collaborate and share materials with classmates in hives.
            </p>
          </div>
          <div className="pt-4 border-t border-border/50 text-xs font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1">
            Browse groups &rarr;
          </div>
        </div>

        {/* Panel 2: Starred Materials */}
        <div className="bg-card text-card-foreground border border-border rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[200px]">
          <div className="space-y-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary border border-primary/10">
              <Star className="size-5" />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Starred Materials
            </h2>
            <p className="text-sm text-muted-foreground">
              Access your saved, pinned, or favorited study resources instantly.
            </p>
          </div>
          <div className="pt-4 border-t border-border/50 text-xs font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1">
            Open library &rarr;
          </div>
        </div>

        {/* Panel 3: Upcoming Deadlines */}
        <div className="bg-card text-card-foreground border border-border rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[200px] md:col-span-2 lg:col-span-1">
          <div className="space-y-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary border border-primary/10">
              <CheckSquare className="size-5" />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Tasks & Deadlines
            </h2>
            <p className="text-sm text-muted-foreground">
              Keep track of exams, assignments, and study milestones.
            </p>
          </div>
          <div className="pt-4 border-t border-border/50 text-xs font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1">
            Check calendar &rarr;
          </div>
        </div>

      </div>
    </div>
  );
}
