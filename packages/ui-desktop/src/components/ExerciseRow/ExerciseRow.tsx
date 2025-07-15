import React from "react";
import { ExerciseItem, type ExerciseItemProps } from "@acme/ui-shared";
import { cn } from "@acme/ui-shared";

export interface ExerciseRowProps extends ExerciseItemProps {
  onEdit?: () => void;
  showEditButton?: boolean;
}

export function ExerciseRow({ 
  onEdit,
  showEditButton = false,
  className,
  ...props 
}: ExerciseRowProps) {
  return (
    <div className={cn("group relative", className)}>
      <ExerciseItem {...props} />
      {showEditButton && onEdit && (
        <button
          onClick={onEdit}
          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
        >
          <span className="material-icons">edit</span>
        </button>
      )}
    </div>
  );
}