"use client";

import * as React from "react";
import { MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnnouncementFeedItemProps {
  announcement: {
    id: string;
    title: string;
    body: string;
  };
}

export function AnnouncementFeedItem({ announcement }: AnnouncementFeedItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const shouldTruncate = announcement.body.length > 280;

  return (
    <div className="mt-2.5 w-full bg-blue-500/5 dark:bg-blue-500/2 border border-blue-500/10 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-start gap-2.5">
        <div className="size-6.5 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
          <MessageSquare className="size-3.5" />
        </div>
        <div className="space-y-1 min-w-0 flex-1">
          <h4 className="text-sm font-bold text-foreground leading-snug">{announcement.title}</h4>
          <p className={`text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap ${!isExpanded && shouldTruncate ? "line-clamp-4" : ""}`}>
            {announcement.body}
          </p>
        </div>
      </div>

      {shouldTruncate && (
        <div className="flex justify-start border-t border-border/30 pt-2 shrink-0">
          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            variant="ghost"
            size="xs"
            className="h-7 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
          >
            {isExpanded ? (
              <><ChevronUp className="size-3 mr-1" /> Show Less</>
            ) : (
              <><ChevronDown className="size-3 mr-1" /> Read More</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
