import React from "react";
import type { SidebarLayoutProps } from "./SidebarLayout.types";
import { cn } from "@acme/ui-shared";

export function SidebarLayout({
  sidebar,
  children,
  sidebarWidth = "w-64",
  className,
}: SidebarLayoutProps) {
  return (
    <div className={cn("flex h-full bg-gray-50", className)}>
      {/* Sidebar */}
      <aside className={cn(
        "flex-shrink-0 bg-white border-r border-gray-200",
        sidebarWidth
      )}>
        {sidebar}
      </aside>
      
      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}