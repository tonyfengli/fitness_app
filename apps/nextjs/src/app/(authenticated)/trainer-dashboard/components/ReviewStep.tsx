import { Icon } from "@acme/ui-shared";

import type { FilteredExercisesResult, WorkoutParameters } from "../types";
import {
  EXERCISE_BLOCKS,
  EXERCISE_OPTIONS,
  JOINT_OPTIONS,
  MUSCLE_OPTIONS,
} from "../constants";
import { calculateSessionVolume } from "../utils";
import { ExerciseBlock } from "./ExerciseBlock";
import { ExerciseTable } from "./ExerciseTable";
import { PreferenceTag } from "./PreferenceTag";

interface ReviewStepProps {
  workoutParams: WorkoutParameters;
  filteredExercises: FilteredExercisesResult | null;
  error: string | null;
  showMore: boolean;
  onToggleShowMore: () => void;
}

export function ReviewStep({
  workoutParams,
  filteredExercises,
  error,
  showMore,
  onToggleShowMore,
}: ReviewStepProps) {
  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex">
            <Icon name="error" className="mr-2 text-red-500" size={20} />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Basic Settings Summary */}
      <div className="rounded-lg bg-gray-50 p-4">
        <h4 className="mb-3 font-medium text-gray-900">Basic Settings</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Session Goal:</span>
            <span className="font-medium capitalize">
              {workoutParams.sessionGoal}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Intensity:</span>
            <span className="font-medium capitalize">
              {workoutParams.intensity}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Template:</span>
            <span className="font-medium capitalize">
              {workoutParams.template.replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      {/* Preferences Summary */}
      <div className="rounded-lg bg-gray-50 p-4">
        <h4 className="mb-3 font-medium text-gray-900">Preferences</h4>
        <div className="space-y-3 text-sm">
          <PreferenceTag
            values={workoutParams.includeExercises}
            options={EXERCISE_OPTIONS}
            label="Include Exercises"
            tagColor="indigo"
          />

          <PreferenceTag
            values={workoutParams.avoidExercises}
            options={EXERCISE_OPTIONS}
            label="Avoid Exercises"
            tagColor="red"
          />

          <PreferenceTag
            values={workoutParams.muscleTarget}
            options={MUSCLE_OPTIONS}
            label="Target Muscles"
            tagColor="green"
          />

          <PreferenceTag
            values={workoutParams.muscleLessen}
            options={MUSCLE_OPTIONS}
            label="De-emphasize Muscles"
            tagColor="yellow"
          />

          <PreferenceTag
            values={workoutParams.avoidJoints}
            options={JOINT_OPTIONS}
            label="Avoid Joints"
            tagColor="red"
          />

          {workoutParams.includeExercises.length === 0 &&
            workoutParams.avoidExercises.length === 0 &&
            workoutParams.muscleTarget.length === 0 &&
            workoutParams.muscleLessen.length === 0 &&
            workoutParams.avoidJoints.length === 0 && (
              <p className="italic text-gray-500">
                No specific preferences selected
              </p>
            )}
        </div>
      </div>

      {/* Session Volume */}
      {filteredExercises && filteredExercises.exercises.length > 0 && (
        <div className="rounded-lg bg-gray-50 p-4">
          <h4 className="mb-3 font-medium text-gray-900">Session Volume</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Sets:</span>
              <span className="font-medium">
                {
                  calculateSessionVolume(
                    filteredExercises.exercises,
                    workoutParams.intensity,
                    "moderate",
                  ).minSets
                }
                -
                {
                  calculateSessionVolume(
                    filteredExercises.exercises,
                    workoutParams.intensity,
                    "moderate",
                  ).maxSets
                }{" "}
                sets
              </span>
            </div>
            <div>
              <p className="mt-1 text-xs text-gray-600">
                {
                  calculateSessionVolume(
                    filteredExercises.exercises,
                    workoutParams.intensity,
                    "moderate",
                  ).reasoning
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Show More Button */}
      {filteredExercises && filteredExercises.exercises.length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={onToggleShowMore}
            className="flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <span>{showMore ? "Show Less" : "Show More"}</span>
            <Icon
              name={showMore ? "expand_less" : "expand_more"}
              size={20}
              className="text-gray-500"
            />
          </button>
        </div>
      )}

      {/* Collapsible Content */}
      {showMore && (
        <>
          {/* Filtering Status Display */}
          {filteredExercises && (
            <div className="text-sm text-gray-600">
              <span className="font-medium text-green-600">
                Filtering Applied:
              </span>{" "}
              Showing {filteredExercises.exercises.length} filtered exercises
              {filteredExercises.timing && (
                <span className="ml-2 text-xs text-gray-500">
                  ({(filteredExercises.timing.total / 1000).toFixed(2)}s)
                </span>
              )}
            </div>
          )}

          {/* Exercise Blocks Section */}
          {filteredExercises && filteredExercises.exercises.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-center text-xl font-bold text-gray-800">
                Top Exercises
              </h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {EXERCISE_BLOCKS.map((blockConfig) => (
                  <ExerciseBlock
                    key={blockConfig.id}
                    exercises={filteredExercises.exercises}
                    blockConfig={blockConfig}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Detailed Exercise Table */}
          {filteredExercises && filteredExercises.exercises.length > 0 && (
            <ExerciseTable
              exercises={filteredExercises.exercises}
              workoutParams={workoutParams}
            />
          )}
        </>
      )}
    </div>
  );
}
