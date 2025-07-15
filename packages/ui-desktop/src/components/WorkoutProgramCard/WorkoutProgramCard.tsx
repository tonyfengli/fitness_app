import React from "react";
import type { WorkoutProgramCardProps } from "./WorkoutProgramCard.types";
import { cn, Card, Button, ExerciseItem, Icon } from "@acme/ui-shared";

export function WorkoutProgramCard({
  title,
  week,
  exercises,
  onAddExercise,
  onEditExercise,
  className,
  showEditButton = true,
}: WorkoutProgramCardProps) {
  return (
    <Card className={cn("p-6", className)}>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
          {week && <p className="text-sm text-gray-500 mt-1">{week}</p>}
        </div>
        <button 
          className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
          aria-label="More options"
        >
          <Icon name="more_vert" />
        </button>
      </div>

      <div className="space-y-2">
        {exercises.map((exercise) => (
          <ExerciseItem
            key={exercise.id}
            name={exercise.name}
            sets={exercise.sets}
            showEditButton={showEditButton}
            onEdit={onEditExercise ? () => onEditExercise(exercise.id) : undefined}
          />
        ))}
      </div>
    </Card>
  );
}