"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Layers, Calendar, ArrowRight, Plus } from "lucide-react";

import { api } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CreateHiveModal } from "@/components/CreateHiveModal";

const themeStyles: Record<string, { bg: string; text: string; border: string; accent: string; ring: string }> = {
  blue: {
    bg: "bg-blue-500/10 dark:bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-500/20 dark:border-blue-500/30",
    accent: "bg-blue-500 text-white",
    ring: "focus-within:ring-blue-500/20",
  },
  green: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/20 dark:border-emerald-500/30",
    accent: "bg-emerald-500 text-white",
    ring: "focus-within:ring-emerald-500/20",
  },
  indigo: {
    bg: "bg-indigo-500/10 dark:bg-indigo-500/10",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-500/20 dark:border-indigo-500/30",
    accent: "bg-indigo-500 text-white",
    ring: "focus-within:ring-indigo-500/20",
  },
  rose: {
    bg: "bg-rose-500/10 dark:bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-500/20 dark:border-rose-500/30",
    accent: "bg-rose-500 text-white",
    ring: "focus-within:ring-rose-500/20",
  },
  amber: {
    bg: "bg-amber-500/10 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/20 dark:border-amber-500/30",
    accent: "bg-amber-500 text-white",
    ring: "focus-within:ring-amber-500/20",
  },
};

export default function HivesCatalogPage() {
  const router = useRouter();
  const utils = api.useUtils();
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  const { data: hivesData, isLoading: isLoadingHives } = api.hive.getUserHives.useQuery(undefined, {
    staleTime: 120000, // Standard hives list: 2 minutes
  });

  const hives = hivesData || [];

  return (
    <div className="space-y-6 font-sans max-w-7xl mx-auto pb-12 min-w-0">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Layers className="size-6 text-muted-foreground" />
            Study Hives
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Browse and coordinate study workspaces with your group peers.
          </p>
        </div>
        {hives.length > 0 && (
          <Button 
            onClick={() => setCreateDialogOpen(true)}
            variant="outline" 
            className="rounded-xl h-8.5 text-xs font-semibold border-border/60 hover:bg-muted cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="size-3.5" />
            New Hive
          </Button>
        )}
      </div>

      {/* Main Grid */}
      {isLoadingHives ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-36 border border-border/80 rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : hives.length === 0 ? (
        <div className="border border-dashed border-border/80 rounded-2xl p-12 text-center bg-card flex flex-col items-center justify-center py-16 shadow-inner">
          <div className="size-12 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/10 flex items-center justify-center mb-3 shadow-inner">
            <Layers className="size-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1">Not in any study hives yet</h3>
          <p className="text-xs text-muted-foreground max-w-xs mb-6 leading-normal">
            Hives are collaborative student workspaces. Create a workspace to share files, links, notes, and collaborate.
          </p>
          <Button 
            onClick={() => setCreateDialogOpen(true)} 
            className="text-xs rounded-xl h-9.5 px-5 bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer shadow-sm"
          >
            Create a Hive
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-200">
          {hives.map((item) => {
            const styles = themeStyles[item.colorTheme] || themeStyles.blue;
            return (
              <div 
                key={item.id}
                onClick={() => router.push(`/hive/${item.id}/overview`)}
                onMouseEnter={() => {
                  utils.hive.getHive.prefetch({ hiveId: item.id });
                  utils.hive.getHiveOverview.prefetch({ hiveId: item.id });
                }}
                className={cn(
                  "group p-5 border bg-card rounded-2xl flex flex-col justify-between h-36 transition-all hover:shadow-md cursor-pointer hover:border-primary/30",
                  styles.border
                )}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-2.5">
                    {item.courseCode && (
                      <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide uppercase", styles.bg, styles.text)}>
                        {item.courseCode}
                      </span>
                    )}
                    <span className="text-[10px] font-semibold text-muted-foreground capitalize">
                      Role: {item.role}
                    </span>
                  </div>
                  <h3 className="font-bold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-border/40 flex items-center justify-between mt-2">
                  <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="size-3" />
                    Created {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                  
                  <div className="size-7 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-muted/80">
                    <ArrowRight className="size-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <CreateHiveModal
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />

    </div>
  );
}
