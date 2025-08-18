import type { Exercise, WorkoutParameters } from "../types";

interface ExerciseTableProps {
  exercises: Exercise[];
  workoutParams: WorkoutParameters;
}

export function ExerciseTable({
  exercises,
  workoutParams,
}: ExerciseTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full border-gray-200 bg-white">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="border-b px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Exercise
              </th>
              <th className="border-b px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Score
              </th>
              <th className="border-b px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Target
              </th>
              <th className="border-b px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Pattern
              </th>
              <th className="border-b px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Scoring Detail
              </th>
              <th className="border-b px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Fatigue
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {exercises.map((exercise, index) => {
              const isPrimaryTarget = workoutParams.muscleTarget.includes(
                exercise.primaryMuscle,
              );
              const isSecondaryTarget =
                !isPrimaryTarget &&
                exercise.secondaryMuscles?.some((m) =>
                  workoutParams.muscleTarget.includes(m),
                );
              const isPrimaryLessen = workoutParams.muscleLessen.includes(
                exercise.primaryMuscle,
              );
              const hasSecondaryLessen = exercise.secondaryMuscles?.some((m) =>
                workoutParams.muscleLessen.includes(m),
              );

              // Calculate intensity bonus/penalty based on fatigue profile
              let intensityAdjustment = 0;
              if (exercise.fatigueProfile && workoutParams.intensity) {
                // Extract base fatigue level from profile (e.g. "low_local" -> "low")
                const fatigueLevel = exercise.fatigueProfile.split("_")[0];
                const intensityMap: Record<string, Record<string, number>> = {
                  low: { low: 1.0, moderate: 0.5, high: 0 },
                  moderate: { low: 0, moderate: 0, high: 0 },
                  high: { low: 0, moderate: 0, high: 1.0 },
                };
                intensityAdjustment =
                  intensityMap[workoutParams.intensity]?.[fatigueLevel] || 0;
              }

              return (
                <tr key={exercise.id || index} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {exercise.name}
                      </span>
                      {exercise.isSelectedBlockA && (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                          A
                        </span>
                      )}
                      {exercise.isSelectedBlockB && (
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          B
                        </span>
                      )}
                      {exercise.isSelectedBlockC && (
                        <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                          C
                        </span>
                      )}
                      {exercise.isSelectedBlockD && (
                        <span className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                          D
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-sm font-semibold text-gray-700">
                      {exercise.score?.toFixed(1) || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        isPrimaryTarget
                          ? "bg-green-100 text-green-800"
                          : isSecondaryTarget
                            ? "bg-green-50 text-green-700"
                            : isPrimaryLessen
                              ? "bg-orange-100 text-orange-800"
                              : "text-gray-600"
                      }`}
                    >
                      {exercise.primaryMuscle}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs text-gray-600">
                      {exercise.movementPattern || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center space-x-1">
                      {isPrimaryTarget && (
                        <div className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                          +3.0
                        </div>
                      )}
                      {isSecondaryTarget && (
                        <div className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">
                          +1.5
                        </div>
                      )}
                      {isPrimaryLessen && (
                        <div className="rounded bg-orange-100 px-2 py-1 text-xs text-orange-800">
                          -3.0
                        </div>
                      )}
                      {hasSecondaryLessen && !isPrimaryLessen && (
                        <div className="rounded bg-orange-50 px-2 py-1 text-xs text-orange-700">
                          -1.5
                        </div>
                      )}
                      {intensityAdjustment > 0 && (
                        <div className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">
                          +{intensityAdjustment}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs text-gray-600">
                      {exercise.fatigueProfile || "-"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
