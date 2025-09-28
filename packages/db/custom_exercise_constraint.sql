-- Add constraint to ensure exercise_id and custom_exercise are mutually exclusive
-- This ensures data integrity for custom exercises

ALTER TABLE workout_exercise 
ADD CONSTRAINT check_exercise_or_custom 
CHECK (
  (exercise_id IS NOT NULL AND custom_exercise IS NULL) OR
  (exercise_id IS NULL AND custom_exercise IS NOT NULL)
);

-- Note: This constraint ensures that:
-- 1. Regular exercises have exercise_id set and custom_exercise NULL
-- 2. Custom exercises have exercise_id NULL and custom_exercise with data
-- 3. We can't have both or neither