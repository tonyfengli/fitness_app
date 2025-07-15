import React from "react";
import type { ExerciseItemProps } from "./ExerciseItem.types";
import { cn } from "../../utils/cn";
import { Icon } from "../Icon";

export function ExerciseItem({
  name,
  sets,
  icon,
  variant = 'default',
  onRemove,
  onAdd,
  onEdit,
  onDragStart,
  isDraggable = false,
  showEditButton = false,
  className,
}: ExerciseItemProps) {
  const baseClasses = cn(
    "flex items-center justify-between p-3 bg-gray-50 rounded-lg",
    showEditButton && onEdit ? "group relative" : "",
    className
  );

  const renderIcon = () => {
    if (icon) return icon;
    return (
      <div className="p-2 bg-gray-200 rounded-full">
        <Icon name="fitness_center" color="#4B5563" />
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
        <Icon name="drag_indicator" />
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
            <Icon name="remove_circle_outline" />
          </button>
        ) : null;
      case 'selectable':
        return onAdd ? (
          <button 
            onClick={onAdd}
            className="text-blue-600 hover:text-blue-800"
            aria-label="Add exercise"
          >
            <Icon name="add_circle_outline" />
          </button>
        ) : null;
      default:
        return null;
    }
  };

  const renderEditButton = () => {
    if (!showEditButton || !onEdit) return null;
    return (
      <button
        onClick={onEdit}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
        aria-label="Edit exercise"
      >
        <Icon name="edit" />
      </button>
    );
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
      {renderEditButton()}
    </div>
  );
}