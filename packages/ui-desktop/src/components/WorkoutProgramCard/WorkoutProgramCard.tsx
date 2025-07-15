import React from "react";
import type { WorkoutProgramCardProps } from "./WorkoutProgramCard.types";
import { cn, Card, Button, ExerciseItem } from "@acme/ui-shared";

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
        <button className="text-gray-400 hover:text-gray-600">
          <span className="material-icons">more_vert</span>
        </button>
      </div>

      <div className="space-y-2">
        {exercises.map((exercise, index) => (
          <div
            key={exercise.id}
            className={cn(
              "flex items-center justify-between py-2",
              index < exercises.length - 1 && "border-b border-gray-200"
            )}
          >
            <div className="flex items-center">
              <div className="bg-gray-100 p-3 rounded-full mr-4">
                <span className="material-icons text-gray-600">fitness_center</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800">{exercise.name}</p>
                <p className="text-sm text-gray-500">
                  {exercise.sets} sets{exercise.reps ? ` × ${exercise.reps}` : ''}
                </p>
              </div>
            </div>
            {onEditExercise && showEditButton && (
              <button
                onClick={() => onEditExercise(exercise.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="material-icons">edit</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}