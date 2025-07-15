import React from "react";
import { cn } from "@acme/ui-shared";
import type { GridLayoutProps } from "./GridLayout.types";

export function GridLayout({ 
  children, 
  columns = 3, 
  gap = "gap-6",
  className 
}: GridLayoutProps) {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  };

  return (
    <div className={cn(
      "grid",
      columnClasses[columns as keyof typeof columnClasses] || 'grid-cols-3',
      gap,
      className
    )}>
      {children}
    </div>
  );
}