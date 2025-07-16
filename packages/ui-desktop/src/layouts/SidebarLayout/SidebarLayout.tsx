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
    <div className={cn("flex h-screen bg-gray-50 overflow-hidden", className)}>
      {/* Sidebar */}
      <aside className={cn(
        "flex-shrink-0 bg-white border-r border-gray-200 h-full overflow-y-auto",
        sidebarWidth
      )}>
        {sidebar}
      </aside>
      
      {/* Main content */}
      <main className="flex-1 bg-gray-50 h-full overflow-hidden">
        {children}
      </main>
    </div>
  );
}