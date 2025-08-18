import type { WorkoutParameters } from "../types";
import { EXERCISE_OPTIONS, JOINT_OPTIONS, MUSCLE_OPTIONS } from "../constants";
import { SearchableMultiSelect } from "./SearchableMultiSelect";

interface PreferencesStepProps {
  workoutParams: WorkoutParameters;
  onChange: (params: WorkoutParameters) => void;
}

export function PreferencesStep({
  workoutParams,
  onChange,
}: PreferencesStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Include Specific Exercises
          </label>
          <SearchableMultiSelect
            options={EXERCISE_OPTIONS}
            selected={workoutParams.includeExercises}
            onChange={(selected) =>
              onChange({ ...workoutParams, includeExercises: selected })
            }
            placeholder="Search and select exercises to include..."
            tagColor="indigo"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Avoid Specific Exercises
          </label>
          <SearchableMultiSelect
            options={EXERCISE_OPTIONS}
            selected={workoutParams.avoidExercises}
            onChange={(selected) =>
              onChange({ ...workoutParams, avoidExercises: selected })
            }
            placeholder="Search and select exercises to avoid..."
            tagColor="red"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Target Muscle Groups
          </label>
          <SearchableMultiSelect
            options={MUSCLE_OPTIONS}
            selected={workoutParams.muscleTarget}
            onChange={(selected) =>
              onChange({ ...workoutParams, muscleTarget: selected })
            }
            placeholder="Search and select muscles to target..."
            tagColor="green"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            De-emphasize Muscle Groups
          </label>
          <SearchableMultiSelect
            options={MUSCLE_OPTIONS}
            selected={workoutParams.muscleLessen}
            onChange={(selected) =>
              onChange({ ...workoutParams, muscleLessen: selected })
            }
            placeholder="Search and select muscles to de-emphasize..."
            tagColor="yellow"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Avoid Joint Loading
          </label>
          <SearchableMultiSelect
            options={JOINT_OPTIONS}
            selected={workoutParams.avoidJoints}
            onChange={(selected) =>
              onChange({ ...workoutParams, avoidJoints: selected })
            }
            placeholder="Search and select joints to avoid loading..."
            tagColor="red"
            dropdownDirection="up"
          />
        </div>
      </div>
    </div>
  );
}
