import React from "react";
import type { WorkoutCardProps } from "./WorkoutCard.types";
import { cn } from "../../utils/cn";

export function WorkoutCard({
  title,
  exerciseCount,
  duration,
  date,
  variant = 'default',
  onClick,
  className,
  children,
}: WorkoutCardProps) {
  const baseClasses = cn(
    "bg-white rounded-lg shadow-sm",
    onClick && "cursor-pointer hover:shadow-md transition-shadow",
    variant === 'compact' ? "p-3" : "p-4",
    className
  );

  const content = (
    <>
      <div className="flex justify-between items-start mb-2">
        <h3 className={cn(
          "font-semibold text-gray-800",
          variant === 'compact' ? "text-base" : "text-lg"
        )}>
          {title}
        </h3>
        {date && (
          <span className="text-sm text-gray-500">{date}</span>
        )}
      </div>
      
      {(exerciseCount || duration) && (
        <div className="flex items-center gap-4 text-sm text-gray-600">
          {exerciseCount !== undefined && (
            <div className="flex items-center gap-1">
              <span className="material-icons text-base">fitness_center</span>
              <span>{exerciseCount} exercises</span>
            </div>
          )}
          {duration && (
            <div className="flex items-center gap-1">
              <span className="material-icons text-base">schedule</span>
              <span>{duration}</span>
            </div>
          )}
        </div>
      )}
      
      {children && (
        <div className={cn(
          "border-t border-gray-200",
          variant === 'compact' ? "mt-2 pt-2" : "mt-3 pt-3"
        )}>
          {children}
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={baseClasses}
        type="button"
      >
        {content}
      </button>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}