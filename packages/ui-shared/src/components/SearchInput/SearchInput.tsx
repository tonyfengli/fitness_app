import React from "react";
import type { SearchInputProps } from "./SearchInput.types";
import { cn } from "../../utils/cn";
import { Icon } from "../Icon";

export function SearchInput({ 
  placeholder = "Search...", 
  className,
  ...props 
}: SearchInputProps) {
  return (
    <div className="relative">
      <Icon 
        name="search" 
        className="absolute left-3 top-1/2 -translate-y-1/2" 
        color="#9CA3AF"
      />
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