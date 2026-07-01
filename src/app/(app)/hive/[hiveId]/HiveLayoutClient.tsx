"use client";

import * as React from "react";
import { useHiveStore, HiveRole } from "@/store/hiveStore";
import { useRealtimeHive } from "@/hooks/useRealtimeHive";

interface HiveLayoutClientProps {
  hiveId: string;
  hiveName: string;
  courseCode: string | null;
  userRole: HiveRole;
  children: React.ReactNode;
}

export function HiveLayoutClient({
  hiveId,
  userRole,
  children,
}: HiveLayoutClientProps) {
  const setHiveContext = useHiveStore((s) => s.setHiveContext);
  const clearHiveContext = useHiveStore((s) => s.clearHiveContext);

  // Mount real-time subscription for activity log and notifications
  useRealtimeHive(hiveId);

  // Set the workspace context in Zustand on load
  React.useEffect(() => {
    setHiveContext(hiveId, userRole);
    return () => {
      clearHiveContext();
    };
  }, [hiveId, userRole, setHiveContext, clearHiveContext]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Workspace Pages Content Container */}
      <main className="flex-1 bg-muted/10 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
