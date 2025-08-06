-- Add selection-related fields to workout_exercise table
ALTER TABLE workout_exercise 
ADD COLUMN is_shared BOOLEAN DEFAULT FALSE,
ADD COLUMN shared_with_clients TEXT[],
ADD COLUMN selection_source VARCHAR(50);

-- Add index for selection queries
CREATE INDEX idx_workout_exercise_selection_source ON workout_exercise(selection_source);