import type { Exercise, WorkoutParameters } from '../types';

interface ExerciseTableProps {
  exercises: Exercise[];
  workoutParams: WorkoutParameters;
}

export function ExerciseTable({ exercises, workoutParams }: ExerciseTableProps) {
  return (
    <div className="overflow-x-auto border rounded-lg">
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full bg-white border-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Exercise
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Score
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Target
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Pattern
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Scoring Detail
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Fatigue
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {exercises.map((exercise, index) => {
              const isPrimaryTarget = workoutParams.muscleTarget.includes(exercise.primaryMuscle);
              const isSecondaryTarget = !isPrimaryTarget && exercise.secondaryMuscles?.some(m => 
                workoutParams.muscleTarget.includes(m)
              );
              const isPrimaryLessen = workoutParams.muscleLessen.includes(exercise.primaryMuscle);
              const hasSecondaryLessen = exercise.secondaryMuscles?.some(m => 
                workoutParams.muscleLessen.includes(m)
              );
              
              // Calculate intensity bonus/penalty based on fatigue profile
              let intensityAdjustment = 0;
              if (exercise.fatigueProfile && workoutParams.intensity) {
                // Extract base fatigue level from profile (e.g. "low_local" -> "low")
                const fatigueLevel = exercise.fatigueProfile.split('_')[0];
                const intensityMap: Record<string, Record<string, number>> = {
                  low: { low: 1.5, moderate: 0.75, high: -1.5 },
                  moderate: { low: -1.5, moderate: 0, high: 1.5 },
                  high: { low: -0.75, moderate: -0.75, high: 0.75 }
                };
                intensityAdjustment = intensityMap[workoutParams.intensity]?.[fatigueLevel] || 0;
              }
              
              return (
                <tr key={exercise.id || index} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {exercise.name}
                      </span>
                      {exercise.isSelectedBlockA && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">A</span>
                      )}
                      {exercise.isSelectedBlockB && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">B</span>
                      )}
                      {exercise.isSelectedBlockC && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">C</span>
                      )}
                      {exercise.isSelectedBlockD && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">D</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-sm font-semibold text-gray-700">
                      {exercise.score?.toFixed(1) || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-1 rounded ${
                      isPrimaryTarget 
                        ? 'bg-green-100 text-green-800' 
                        : isSecondaryTarget
                        ? 'bg-green-50 text-green-700'
                        : isPrimaryLessen 
                        ? 'bg-orange-100 text-orange-800'
                        : 'text-gray-600'
                    }`}>
                      {exercise.primaryMuscle}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs text-gray-600">
                      {exercise.movementPattern || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center space-x-1">
                      {isPrimaryTarget && (
                        <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          +3.0
                        </div>
                      )}
                      {isSecondaryTarget && (
                        <div className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                          +1.5
                        </div>
                      )}
                      {isPrimaryLessen && (
                        <div className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                          -3.0
                        </div>
                      )}
                      {hasSecondaryLessen && !isPrimaryLessen && (
                        <div className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded">
                          -1.5
                        </div>
                      )}
                      {intensityAdjustment > 0 && (
                        <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          +{intensityAdjustment}
                        </div>
                      )}
                      {intensityAdjustment < 0 && (
                        <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          {intensityAdjustment}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs text-gray-600">
                      {exercise.fatigueProfile || '-'}
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