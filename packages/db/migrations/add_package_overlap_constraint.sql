-- Enable the btree_gist extension for the exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop the existing constraint if it exists
ALTER TABLE user_training_package 
DROP CONSTRAINT IF EXISTS no_overlapping_packages;

-- Add exclusion constraint to prevent overlapping date ranges for the same user
ALTER TABLE user_training_package 
ADD CONSTRAINT no_overlapping_packages 
EXCLUDE USING gist (
  user_id WITH =,
  daterange(start_date, end_date, '[]') WITH &&
) WHERE (status = 'active');

-- This constraint ensures that for any given user, there cannot be overlapping
-- date ranges for packages with 'active' status. This allows:
-- 1. Sequential packages (one ends, next starts)
-- 2. Historical expired/cancelled packages to overlap
-- 3. Proper package transitions (upgrades/downgrades)