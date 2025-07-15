import React from "react";
import { cn } from "@acme/ui-shared";

export interface GridLayoutProps {
  children: React.ReactNode;
  columns?: number;
  gap?: string;
  className?: string;
}

export function GridLayout({ 
  children, 
  columns = 3, 
  gap = "gap-6",
  className 
}: GridLayoutProps) {
  return (
    <div className={cn(
      `grid grid-cols-${columns}`,
      gap,
      className
    )}>
      {children}
    </div>
  );
}