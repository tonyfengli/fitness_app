import React from "react";
import type { SearchInputProps } from "./SearchInput.types";
import { cn } from "../../utils/cn";

export function SearchInput({ 
  placeholder = "Search...", 
  className,
  ...props 
}: SearchInputProps) {
  return (
    <div className="relative">
      <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        search
      </span>
      <input
        type="search"
        className={cn(
          "w-full bg-gray-100 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500",
          className
        )}
        placeholder={placeholder}
        {...props}
      />
    </div>
  );
}