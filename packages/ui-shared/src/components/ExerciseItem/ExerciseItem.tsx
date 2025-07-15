import React from "react";
import type { ExerciseItemProps } from "./ExerciseItem.types";
import { cn } from "../../utils/cn";

export function ExerciseItem({
  name,
  sets,
  icon,
  variant = 'default',
  onRemove,
  onAdd,
  onDragStart,
  isDraggable = false,
  className,
}: ExerciseItemProps) {
  const baseClasses = cn(
    "flex items-center justify-between p-3 bg-gray-50 rounded-lg",
    className
  );

  const renderIcon = () => {
    if (icon) return icon;
    return (
      <div className="p-2 bg-gray-200 rounded-full">
        <span className="material-icons text-gray-600">fitness_center</span>
      </div>
    );
  };

  const renderDragHandle = () => {
    if (!isDraggable || variant !== 'editable') return null;
    return (
      <button 
        className="text-gray-400 hover:text-gray-600 mr-2 cursor-grab active:cursor-grabbing"
        onMouseDown={onDragStart}
        aria-label="Drag to reorder"
      >
        <span className="material-icons">drag_indicator</span>
      </button>
    );
  };

  const renderAction = () => {
    switch (variant) {
      case 'editable':
        return onRemove ? (
          <button 
            onClick={onRemove}
            className="text-red-500 hover:text-red-700"
            aria-label="Remove exercise"
          >
            <span className="material-icons">remove_circle_outline</span>
          </button>
        ) : null;
      case 'selectable':
        return onAdd ? (
          <button 
            onClick={onAdd}
            className="text-blue-600 hover:text-blue-800"
            aria-label="Add exercise"
          >
            <span className="material-icons">add_circle_outline</span>
          </button>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className={baseClasses}>
      <div className="flex items-center">
        {renderDragHandle()}
        <div className="mr-3">
          {renderIcon()}
        </div>
        <div>
          <p className="font-medium text-gray-800">{name}</p>
          {sets && <p className="text-sm text-gray-500">{sets} sets</p>}
        </div>
      </div>
      {renderAction()}
    </div>
  );
}