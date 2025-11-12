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
  
  // Keep tabs at top regardless of screen size
  const effectiveVariant = variant;

  return (
    <div
      className={cn(
        "bg-white z-40 relative",
        effectiveVariant === "bottom" 
          ? "fixed bottom-0 left-0 right-0 safe-area-padding-bottom shadow-lg" 
          : "",
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
                "flex-1 flex items-center justify-center gap-2 py-3.5 px-4 text-base font-medium transition-colors relative",
                "focus:outline-none",
                isActive
                  ? "text-purple-600"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                effectiveVariant === "bottom" && isActive && "bg-purple-50",
                effectiveVariant === "bottom" && "py-2" // Slightly smaller on mobile
              )}
            >
              {tab.icon && <span className="text-lg">{tab.icon}</span>}
              <span>{tab.label}</span>
              {/* Clean active indicator - extends to match border */}
              {isActive && (
                <div className="absolute bottom-0 -left-4 -right-4 h-0.5 bg-purple-600" />
              )}
            </button>
          );
        })}
      </div>
      {/* Unified bottom border - extends beyond container */}
      <div className="absolute bottom-0 -left-4 -right-4 h-px bg-gray-200" />
    </div>
  );
}