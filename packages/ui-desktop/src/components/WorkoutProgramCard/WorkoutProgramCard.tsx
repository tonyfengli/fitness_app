import React from "react";
import type { WorkoutProgramCardProps } from "./WorkoutProgramCard.types";
import { cn, Button, ExerciseItem, Icon } from "@acme/ui-shared";

// Block color configuration
const BLOCK_COLORS = {
  "Block A": { 
    border: "border-indigo-200", 
    bg: "bg-indigo-50", 
    hover: "hover:bg-indigo-50", 
    icon: "bg-indigo-100", 
    iconText: "text-indigo-500" 
  },
  "Block B": { 
    border: "border-green-200", 
    bg: "bg-green-50", 
    hover: "hover:bg-green-50", 
    icon: "bg-green-100", 
    iconText: "text-green-500" 
  },
  "Block C": { 
    border: "border-red-200", 
    bg: "bg-red-50", 
    hover: "hover:bg-red-50", 
    icon: "bg-red-100", 
    iconText: "text-red-500" 
  },
} as const;

export function WorkoutProgramCard({
  title,
  week,
  exercises,
  exerciseBlocks,
  onAddExercise,
  onEditExercise,
  className,
  showEditButton = true,
}: WorkoutProgramCardProps) {
  return (
    <div className={cn("bg-white p-8 rounded-2xl shadow-lg", className)}>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
          {week && <p className="text-gray-500">{week}</p>}
        </div>
        <button 
          className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          aria-label="More options"
        >
          <Icon name="more_vert" />
        </button>
      </div>

      <div className="space-y-8">
        {exerciseBlocks ? (
          // Render exercises grouped by blocks
          exerciseBlocks.map((block, blockIndex) => {
            const colors = BLOCK_COLORS[block.blockName as keyof typeof BLOCK_COLORS] || BLOCK_COLORS["Block A"];
            
            return (
              <div key={block.blockName}>
                <h4 className={cn("text-xl font-semibold text-gray-800 mb-4 border-b pb-2", colors.border)}>
                  {block.blockName}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {block.exercises.map((exercise) => (
                    <div 
                      key={exercise.id}
                      className={cn(
                        "bg-gray-50 p-5 rounded-xl flex items-center transition-colors duration-200",
                        colors.hover
                      )}
                    >
                      <div className={cn("p-3 rounded-full mr-4", colors.icon)}>
                        <Icon name="fitness_center" className={colors.iconText} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{exercise.name}</p>
                        <p className="text-sm text-gray-500">{exercise.sets} sets</p>
                      </div>
                      {showEditButton && onEditExercise && (
                        <button
                          onClick={() => onEditExercise(exercise.id)}
                          className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <Icon name="edit" size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        ) : exercises ? (
          // Render exercises without blocks (backward compatibility)
          exercises.map((exercise) => (
            <ExerciseItem
              key={exercise.id}
              name={exercise.name}
              sets={exercise.sets}
              showEditButton={showEditButton}
              onEdit={onEditExercise ? () => onEditExercise(exercise.id) : undefined}
            />
          ))
        ) : null}
      </div>
    </div>
  );
}