-- Make exercise_id nullable in workout_exercise table to support custom exercises
ALTER TABLE workout_exercise 
ALTER COLUMN exercise_id DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN workout_exercise.exercise_id IS 'Reference to exercise. NULL when using custom_exercise field for custom workouts';