"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

export default function ExerciseList() {
  const trpc = useTRPC();
  const { data: exercises } = useSuspenseQuery(trpc.exercise.all.queryOptions());

  if (!exercises || exercises.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-lg text-gray-600">No exercises found.</p>
        <p className="text-sm text-gray-500 mt-2">
          Add some exercises to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 mb-4">
        Found {exercises.length} exercises
      </p>
      
      <div className="grid gap-4">
        {exercises.map((exercise) => (
          <div
            key={exercise.id}
            className="bg-white border rounded-lg p-4 shadow hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {exercise.name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Primary: {exercise.primaryMuscle} | Pattern: {exercise.movementPattern}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {exercise.modality} • {exercise.complexityLevel} complexity • {exercise.strengthLevel} strength
                </p>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(exercise.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}