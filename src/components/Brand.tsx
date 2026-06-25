"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface BrandProps extends React.HTMLAttributes<HTMLDivElement> {
  iconClassName?: string;
  textClassName?: string;
  size?: "sm" | "md" | "lg";
}

export function Brand({ className, iconClassName, textClassName, size = "md", ...props }: BrandProps) {
  const iconSizes = {
    sm: "size-8 rounded-lg",
    md: "size-9 rounded-xl",
    lg: "size-10 rounded-xl",
  };

  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  };

  const svgSizes = {
    sm: "size-5",
    md: "size-5.5",
    lg: "size-6",
  };

  return (
    <div className={cn("flex items-center gap-3", className)} {...props}>
      <div
        className={cn(
          "flex items-center justify-center bg-primary text-primary-foreground shadow-md shadow-primary/10 border border-primary/10",
          iconSizes[size],
          iconClassName
        )}
      >
        <svg
          className={cn("text-white fill-white/10", svgSizes[size])}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" />
          <path d="M12 22V12" />
          <path d="M12 12L3.34 7" />
          <path d="M12 12l8.66-5" />
        </svg>
      </div>
      <span className={cn("font-bold tracking-tight text-foreground", textSizes[size], textClassName)}>
        strizzle
      </span>
    </div>
  );
}
