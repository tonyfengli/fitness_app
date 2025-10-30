"use client";

import { ReactNode } from "react";
import { ChevronLeftIcon } from "@acme/ui-shared";

interface CircuitHeaderProps {
  onBack: () => void;
  backText: string;
  title: string;
  subtitle?: string | ReactNode;
  rightAction?: ReactNode;
}

export function CircuitHeader({
  onBack,
  backText,
  title,
  subtitle,
  rightAction,
}: CircuitHeaderProps) {
  return (
    <div className="sticky top-0 z-50 bg-gradient-to-r from-slate-900 to-purple-900 text-white shadow-lg">
      <div className="flex items-center justify-between px-4 py-4 h-16">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 active:opacity-70 transition-opacity min-w-0"
        >
          <ChevronLeftIcon className="w-6 h-6 flex-shrink-0" />
          <span className="text-sm font-medium truncate">{backText}</span>
        </button>
        
        <div className="text-center flex-1 min-w-0 mx-4">
          <h1 className="text-lg font-semibold truncate">{title}</h1>
          {subtitle && (
            <div className="text-xs text-purple-200 mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-end min-w-0">
          {rightAction || <div className="w-14" />} {/* Spacer for centering when no action */}
        </div>
      </div>
    </div>
  );
}