"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly DropdownOption[] | DropdownOption[];
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function DropdownSelect({
  value,
  onValueChange,
  options,
  disabled = false,
  className,
  placeholder,
}: DropdownSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn("h-9.5 text-xs rounded-xl bg-card border-border justify-between text-left", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="cursor-pointer text-xs font-semibold">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
