import type { BlockConfig, Exercise } from "../types";
import {
  filterExercisesByFunctionTags,
  isExerciseSelectedForBlock,
  sortExercisesByScore,
} from "../utils";

interface ExerciseBlockProps {
  exercises: Exercise[];
  blockConfig: BlockConfig;
}

export function ExerciseBlock({ exercises, blockConfig }: ExerciseBlockProps) {
  const { id, name, functionTags, colorScheme } = blockConfig;

  const blockExercises = sortExercisesByScore(
    filterExercisesByFunctionTags(exercises, functionTags),
  );

  return (
    <div className={`${colorScheme.container} rounded-lg border p-3`}>
      <h3 className={`text-base font-semibold ${colorScheme.header} mb-2`}>
        {name}
      </h3>
      <div className="space-y-2">
        {blockExercises.map((exercise, idx) => {
          const isSelected = isExerciseSelectedForBlock(exercise, id);

          return (
            <div
              key={exercise.id || idx}
              className={`rounded p-2 text-sm ${
                isSelected ? `${colorScheme.selected} border` : ""
              }`}
            >
              <span className="font-medium">{exercise.name}</span>
              {exercise.score !== undefined && (
                <span className={`${colorScheme.score} ml-2`}>
                  ({exercise.score.toFixed(1)})
                </span>
              )}
              {isSelected && (
                <span className={`ml-2 text-xs font-bold ${colorScheme.label}`}>
                  SELECTED
                </span>
              )}
            </div>
          );
        })}
        {blockExercises.length === 0 && (
          <p className="text-sm italic text-gray-500">No exercises found</p>
        )}
      </div>
    </div>
  );
}
