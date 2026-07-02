"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LayoutDashboard, Search, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { GlobalSearch } from "@/components/GlobalSearch";

export default function NotFound() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });
  }, []);

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      
      {/* Background Geometric Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(120,119,198,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,119,198,0.05)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Top Left Back Button */}
      <button
        onClick={() => router.back()}
        className="absolute top-8 left-8 flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group z-10 cursor-pointer"
      >
        <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to previous page
      </button>

      {/* Main Content Card/Box */}
      <div className="max-w-md w-full text-center space-y-8 z-10">
        
        {/* Error Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
          <AlertTriangle className="size-3.5" />
          Error 404
        </div>

        {/* Title & Desc */}
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15]">
            Looks like you're <span className="text-primary bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">off the flight path</span>
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
            The page you're looking for has been moved, deleted, or never existed in this hive. Let's get you back to your studies.
          </p>
        </div>

        {/* Primary Action */}
        <div className="flex justify-center">
          <Button
            onClick={() => router.push("/dashboard")}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/95 font-semibold rounded-xl flex items-center gap-2 shadow-md shadow-primary/10 h-12 px-6 cursor-pointer"
          >
            <LayoutDashboard className="size-4.5" />
            Back to Dashboard
          </Button>
        </div>

        {/* Authenticated Search Section */}
        {isAuthenticated && (
          <div className="pt-8 border-t border-border/60 space-y-4">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              Try Searching Instead
            </span>
            <div 
              onClick={() => setSearchOpen(true)}
              className="relative max-w-xs mx-auto flex items-center bg-card hover:bg-muted/50 border border-border/80 rounded-xl px-4 h-11 text-xs font-medium text-muted-foreground/60 cursor-pointer shadow-xs hover:shadow-sm transition-all group"
            >
              <Search className="size-4.5 text-muted-foreground/50 mr-3 group-hover:text-primary transition-colors" />
              <span>Search study notes, links, tasks...</span>
            </div>
            
            <GlobalSearch 
              isOpen={searchOpen}
              onClose={() => setSearchOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
