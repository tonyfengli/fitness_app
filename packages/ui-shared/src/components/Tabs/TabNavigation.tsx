"use client";

import React from "react";
import { cn } from "../../utils/cn";
import { useResponsive } from "../../utils/responsive";
import type { TabNavigationProps } from "./Tabs.types";

export function TabNavigation({
  tabs,
  activeTab,
  onChange,
  className,
  variant = "top",
}: TabNavigationProps) {
  const { isMobileView } = useResponsive();
  
  // Auto-switch to bottom navigation on mobile
  const effectiveVariant = isMobileView ? "bottom" : variant;

  return (
    <div
      className={cn(
        "bg-white border-gray-200 z-40",
        effectiveVariant === "bottom" 
          ? "fixed bottom-0 left-0 right-0 border-t safe-area-padding-bottom" 
          : "sticky top-16 border-b",
        className
      )}
    >
      <div className="flex">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset",
                isActive
                  ? "text-purple-600 border-b-2 border-purple-600"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                effectiveVariant === "bottom" && isActive && "bg-purple-50",
                effectiveVariant === "bottom" && "py-2" // Slightly smaller on mobile
              )}
            >
              {tab.icon && <span className="text-lg">{tab.icon}</span>}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}