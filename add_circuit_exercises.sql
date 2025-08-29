-- SQL queries to add new circuit training exercises

-- First, check and add any missing enum values if needed
-- Note: 'plate' equipment is missing from the enum, so we'll need to skip or map it

-- Insert the exercises
INSERT INTO exercises (
    name, 
    primary_muscle, 
    secondary_muscles, 
    loaded_joints, 
    movement_pattern, 
    modality, 
    movement_tags, 
    function_tags, 
    fatigue_profile, 
    complexity_level, 
    equipment, 
    strength_level, 
    exercise_type,
    template_type
) VALUES
-- Split Squat
('Split Squat', 'quads', '{"glutes", "hamstrings"}', '{"knees", "hips"}', 'lunge', 'strength', '{"unilateral", "knee_dominant", "balance_challenge"}', '{"secondary_strength"}', 'moderate_systemic', 'moderate', '{"dumbbells"}', 'moderate', 'lunge', '{"standard", "circuit"}'),

-- Romanian Deadlift (RDL)
('Romanian Deadlift (RDL)', 'hamstrings', '{"glutes", "lower_back"}', '{"hips"}', 'hinge', 'strength', '{"hip_dominant", "postural_control", "foundational"}', '{"primary_strength", "secondary_strength"}', 'moderate_systemic', 'low', '{"dumbbells"}', 'low', 'deadlift', '{"standard", "circuit"}'),

-- Glute Bridge
('Glute Bridge', 'glutes', '{"hamstrings", "core"}', '{"hips"}', 'hinge', 'strength', '{"bilateral", "hip_dominant", "rehab_friendly"}', '{"secondary_strength", "accessory"}', 'moderate_local', 'low', '{}', 'low', 'bridge', '{"standard", "circuit"}'),

-- Dumbbell Floor Press
('Dumbbell Floor Press', 'chest', '{"triceps", "shoulders"}', '{"shoulders"}', 'horizontal_push', 'strength', '{"bilateral", "scapular_control"}', '{"primary_strength", "secondary_strength"}', 'moderate_local', 'low', '{"dumbbells"}', 'low', 'press', '{"standard", "circuit"}'),

-- Dumbbell Overhead Press
('Dumbbell Overhead Press', 'shoulders', '{"triceps", "upper_chest"}', '{"shoulders", "elbows"}', 'vertical_push', 'strength', '{"bilateral", "foundational"}', '{"primary_strength", "secondary_strength"}', 'moderate_local', 'low', '{"dumbbells"}', 'low', 'press', '{"standard", "circuit"}'),

-- Chest Squeeze Press
('Chest Squeeze Press', 'chest', '{"shoulders", "triceps"}', '{"shoulders"}', 'horizontal_push', 'strength', '{"bilateral", "scapular_control"}', '{"secondary_strength", "accessory"}', 'moderate_local', 'low', '{"dumbbells"}', 'low', 'press', '{"standard", "circuit"}'),

-- Squat + Press-Out (using dumbbells instead of plate)
('Squat + Press-Out', 'quads', '{"glutes", "shoulders", "core"}', '{"knees", "shoulders"}', 'squat', 'strength', '{"bilateral", "knee_dominant", "postural_control"}', '{"secondary_strength", "core"}', 'moderate_systemic', 'moderate', '{"dumbbells"}', 'low', 'squat', '{"standard", "circuit"}'),

-- Dumbbell Bent-Over Row
('Dumbbell Bent-Over Row', 'lats', '{"biceps", "upper_back"}', '{"shoulders"}', 'horizontal_pull', 'strength', '{"bilateral", "scapular_control"}', '{"secondary_strength"}', 'moderate_local', 'low', '{"dumbbells"}', 'low', 'row', '{"standard", "circuit"}'),

-- Side Plank
('Side Plank', 'core', '{"obliques", "shoulders"}', '{}', 'core', 'core', '{"anti_rotation", "core_stability", "isometric_control"}', '{"core"}', 'moderate_local', 'low', '{}', 'low', 'plank', '{"standard", "circuit"}'),

-- Mountain Climber
('Mountain Climber', 'core', '{"shoulders"}', '{}', 'core', 'conditioning', '{"core_stability", "explosive", "finisher_friendly"}', '{"core", "capacity"}', 'metabolic', 'low', '{}', 'low', 'other', '{"standard", "circuit"}'),

-- Shadow Boxing
('Shadow Boxing', 'delts', '{"core"}', '{"shoulders"}', 'core', 'conditioning', '{"rotational", "finisher_friendly"}', '{"capacity"}', 'metabolic', 'low', '{}', 'low', 'other', '{"standard", "circuit"}'),

-- Plate Uppercut (using dumbbells instead of plate)
('Plate Uppercut', 'shoulders', '{"core"}', '{"shoulders"}', 'core', 'power', '{"rotational", "explosive", "postural_control"}', '{"secondary_strength", "capacity"}', 'moderate_systemic', 'moderate', '{"dumbbells"}', 'moderate', 'other', '{"standard", "circuit"}'),

-- Plate Elbow Strikes (using dumbbells instead of plate)
('Plate Elbow Strikes', 'obliques', '{"shoulders", "core"}', '{}', 'core', 'conditioning', '{"rotational", "finisher_friendly"}', '{"core", "capacity"}', 'metabolic', 'low', '{"dumbbells"}', 'low', 'other', '{"standard", "circuit"}'),

-- Plate Jumping Jacks (using dumbbells instead of plate)
('Plate Jumping Jacks', 'delts', '{"core", "calves"}', '{"shoulders", "ankles"}', 'core', 'conditioning', '{"explosive", "finisher_friendly"}', '{"capacity"}', 'metabolic', 'low', '{"dumbbells"}', 'low', 'other', '{"standard", "circuit"}'),

-- Single-Leg RDL
('Single-Leg RDL', 'hamstrings', '{"glutes", "lower_back"}', '{"hips", "ankles"}', 'hinge', 'strength', '{"unilateral", "hip_dominant", "balance_challenge", "postural_control"}', '{"secondary_strength"}', 'moderate_local', 'moderate', '{"dumbbells"}', 'moderate', 'deadlift', '{"standard", "circuit"}'),

-- Single-Arm Dumbbell Snatch (changed to use dumbbells as in name)
('Single-Arm Dumbbell Snatch', 'hamstrings', '{"glutes", "shoulders"}', '{"hips", "shoulders", "knees"}', 'hinge', 'power', '{"explosive", "hip_dominant", "postural_control", "foundational"}', '{"capacity", "secondary_strength"}', 'high_systemic', 'high', '{"dumbbells"}', 'high', 'other', '{"standard", "circuit"}'),

-- Single-Arm Overhead Hold + March
('Single-Arm Overhead Hold + March', 'core', '{"shoulders", "obliques"}', '{"shoulders", "hips"}', 'carry', 'stability', '{"unilateral", "anti_rotation", "postural_control", "balance_challenge"}', '{"core", "capacity", "secondary_strength"}', 'moderate_local', 'moderate', '{"dumbbells"}', 'low', 'carry', '{"standard", "circuit"}'),

-- Sumo Squat with Plate Hold (using dumbbells)
('Sumo Squat with Plate Hold', 'glutes', '{"adductors", "quads"}', '{"knees", "hips"}', 'squat', 'strength', '{"bilateral", "knee_dominant", "warmup_friendly"}', '{"secondary_strength"}', 'moderate_systemic', 'low', '{"dumbbells"}', 'low', 'squat', '{"standard", "circuit"}'),

-- Plate Good Morning (using dumbbells)
('Plate Good Morning', 'hamstrings', '{"glutes", "lower_back"}', '{"hips", "lower_back"}', 'hinge', 'strength', '{"hip_dominant", "postural_control"}', '{"secondary_strength"}', 'moderate_local', 'low', '{"dumbbells"}', 'low', 'other', '{"standard", "circuit"}'),

-- Arnold Press
('Arnold Press', 'delts', '{"triceps", "upper_chest"}', '{"shoulders", "elbows"}', 'vertical_push', 'strength', '{"bilateral", "scapular_control"}', '{"primary_strength", "secondary_strength"}', 'moderate_local', 'low', '{"dumbbells"}', 'low', 'press', '{"standard", "circuit"}'),

-- Shoulder Raise
('Shoulder Raise', 'delts', '{}', '{"shoulders"}', 'shoulder_isolation', 'strength', '{"bilateral", "foundational"}', '{"accessory"}', 'moderate_local', 'low', '{"dumbbells"}', 'low', 'raise', '{"standard", "circuit"}'),

-- Plank Shoulder Tap
('Plank Shoulder Tap', 'core', '{"shoulders", "obliques"}', '{"shoulders"}', 'core', 'core', '{"anti_rotation", "core_stability", "postural_control"}', '{"core"}', 'moderate_local', 'moderate', '{}', 'low', 'plank', '{"standard", "circuit"}'),

-- Heel Taps (Side Abs)
('Heel Taps (Side Abs)', 'obliques', '{"core"}', '{}', 'core', 'core', '{"rotational", "core_stability", "foundational"}', '{"core"}', 'moderate_local', 'low', '{}', 'low', 'other', '{"standard", "circuit"}'),

-- Dumbbell Around the World
('Dumbbell Around the World', 'shoulders', '{"core"}', '{"shoulders"}', 'shoulder_isolation', 'strength', '{"bilateral"}', '{"accessory"}', 'moderate_local', 'moderate', '{"dumbbells"}', 'low', 'raise', '{"standard", "circuit"}'),

-- Burpee
('Burpee', 'quads', '{"shoulders", "core", "quads"}', '{"shoulders", "hips", "knees"}', 'squat', 'conditioning', '{"explosive", "finisher_friendly", "foundational"}', '{"capacity"}', 'high_systemic', 'high', '{}', 'moderate', 'other', '{"standard", "circuit"}'),

-- Squat Jump
('Squat Jump', 'quads', '{"glutes", "calves"}', '{"knees", "hips", "ankles"}', 'squat', 'power', '{"explosive", "bilateral", "finisher_friendly"}', '{"capacity"}', 'metabolic', 'moderate', '{}', 'moderate', 'squat', '{"standard", "circuit"}'),

-- Seated Driver (using dumbbells)
('Seated Driver', 'shoulders', '{"core"}', '{"shoulders"}', 'core', 'strength', '{"rotational"}', '{"secondary_strength", "core"}', 'moderate_local', 'low', '{"dumbbells"}', 'low', 'other', '{"standard", "circuit"}'),

-- Side Bend
('Side Bend', 'obliques', '{"core"}', '{"spine"}', 'core', 'strength', '{"unilateral", "rotational"}', '{"core", "accessory"}', 'moderate_local', 'low', '{"dumbbells"}', 'low', 'other', '{"standard", "circuit"}'),

-- Bent-Over Single-Arm Row
('Bent-Over Single-Arm Row', 'lats', '{"biceps", "upper_back"}', '{"shoulders"}', 'horizontal_pull', 'strength', '{"unilateral", "scapular_control"}', '{"secondary_strength"}', 'moderate_local', 'moderate', '{"dumbbells"}', 'low', 'row', '{"standard", "circuit"}'),

-- V-Ups
('V-Ups', 'core', '{}', '{}', 'core', 'core', '{"explosive", "foundational"}', '{"core"}', 'moderate_local', 'moderate', '{}', 'moderate', 'other', '{"standard", "circuit"}'),

-- Kneeling Chopper (using dumbbells)
('Kneeling Chopper', 'obliques', '{"shoulders", "core"}', '{"shoulders", "hips"}', 'core', 'strength', '{"rotational", "anti_rotation", "unilateral"}', '{"core", "secondary_strength"}', 'moderate_local', 'moderate', '{"dumbbells"}', 'moderate', 'other', '{"standard", "circuit"}'),

-- Weighted Sit-Up (using dumbbells)
('Weighted Sit-Up', 'core', '{}', '{}', 'core', 'strength', '{"explosive", "foundational"}', '{"core"}', 'moderate_local', 'moderate', '{"dumbbells"}', 'moderate', 'other', '{"standard", "circuit"}'),

-- Standing Tricep Extension (using dumbbells)
('Standing Tricep Extension', 'triceps', '{"shoulders"}', '{"elbows", "shoulders"}', 'arm_isolation', 'strength', '{"bilateral"}', '{"accessory"}', 'moderate_local', 'moderate', '{"dumbbells"}', 'moderate', 'extension', '{"standard", "circuit"}'),

-- Curl → Overhead Press → Tricep Extension
('Curl → Overhead Press → Tricep Extension', 'biceps', '{"shoulders", "triceps"}', '{"elbows", "shoulders"}', 'arm_isolation', 'strength', '{"bilateral"}', '{"secondary_strength"}', 'moderate_local', 'high', '{"dumbbells"}', 'moderate', 'other', '{"standard", "circuit"}'),

-- Back Bridge Pullover
('Back Bridge Pullover', 'chest', '{"lats", "core"}', '{"shoulders", "hips"}', 'core', 'strength', '{"bilateral", "postural_control"}', '{"secondary_strength", "core"}', 'moderate_local', 'moderate', '{"dumbbells"}', 'moderate', 'pullover', '{"standard", "circuit"}'),

-- Plate Swing / Kettlebell Swing
('Plate Swing / Kettlebell Swing', 'glutes', '{"hamstrings", "core"}', '{"hips", "shoulders"}', 'hinge', 'power', '{"explosive", "hip_dominant"}', '{"capacity", "secondary_strength"}', 'moderate_systemic', 'moderate', '{"kettlebell"}', 'moderate', 'swing', '{"standard", "circuit"}'),

-- Torso Rotation (using dumbbells)
('Torso Rotation', 'obliques', '{"core"}', '{"spine"}', 'core', 'strength', '{"rotational", "bilateral"}', '{"core"}', 'moderate_local', 'moderate', '{"dumbbells"}', 'low', 'other', '{"standard", "circuit"}'),

-- Bicep Curl
('Bicep Curl', 'biceps', '{}', '{"elbows"}', 'arm_isolation', 'strength', '{"bilateral", "foundational"}', '{"accessory"}', 'moderate_local', 'low', '{"dumbbells"}', 'low', 'curl', '{"standard", "circuit"}'),

-- Floor Pullover
('Floor Pullover', 'lats', '{"chest", "triceps"}', '{"shoulders"}', 'horizontal_pull', 'strength', '{"scapular_control", "bilateral"}', '{"accessory"}', 'moderate_local', 'moderate', '{"dumbbells"}', 'moderate', 'pullover', '{"standard", "circuit"}'),

-- Floor Tricep Extension
('Floor Tricep Extension', 'triceps', '{"shoulders"}', '{"elbows"}', 'arm_isolation', 'strength', '{"bilateral"}', '{"accessory"}', 'moderate_local', 'low', '{"dumbbells"}', 'low', 'extension', '{"standard", "circuit"}'),

-- Bicycles
('Bicycles', 'obliques', '{"core"}', '{}', 'core', 'conditioning', '{"rotational", "core_stability"}', '{"core"}', 'metabolic', 'low', '{}', 'low', 'other', '{"standard", "circuit"}'),

-- Weighted Deadbug
('Weighted Deadbug', 'core', '{"chest", "lats"}', '{}', 'core', 'strength', '{"anti_rotation", "core_stability", "bilateral"}', '{"core", "secondary_strength"}', 'moderate_local', 'moderate', '{"dumbbells"}', 'moderate', 'other', '{"standard", "circuit"}'),

-- Front Lunge
('Front Lunge', 'quads', '{"glutes", "hamstrings"}', '{"knees", "hips"}', 'lunge', 'strength', '{"unilateral", "knee_dominant"}', '{"secondary_strength"}', 'moderate_systemic', 'moderate', '{"dumbbells"}', 'moderate', 'lunge', '{"standard", "circuit"}'),

-- Reverse Lunge + Drive
('Reverse Lunge + Drive', 'quads', '{"glutes", "hamstrings", "core"}', '{"knees", "hips"}', 'lunge', 'power', '{"unilateral", "explosive"}', '{"secondary_strength", "capacity"}', 'moderate_systemic', 'high', '{"dumbbells"}', 'moderate', 'lunge', '{"standard", "circuit"}'),

-- Calf Raises
('Calf Raises', 'calves', '{}', '{"ankles"}', 'leg_isolation', 'strength', '{"bilateral", "end_range_control"}', '{"accessory"}', 'moderate_local', 'low', '{}', 'low', 'calf_raise', '{"standard", "circuit"}'),

-- Leg Raise
('Leg Raise', 'core', '{}', '{}', 'core', 'strength', '{"bilateral", "core_stability"}', '{"core"}', 'moderate_local', 'low', '{}', 'low', 'leg_raise', '{"standard", "circuit"}'),

-- Pullover + Sit-Up
('Pullover + Sit-Up', 'core', '{"chest", "lats"}', '{"shoulders"}', 'core', 'strength', '{"bilateral"}', '{"core", "secondary_strength"}', 'moderate_systemic', 'moderate', '{"dumbbells"}', 'moderate', 'other', '{"standard", "circuit"}'),

-- Reverse Crunch
('Reverse Crunch', 'core', '{"lower_abs"}', '{}', 'core', 'strength', '{"explosive", "foundational"}', '{"core"}', 'moderate_local', 'low', '{}', 'low', 'other', '{"standard", "circuit"}'),

-- Reverse Curls
('Reverse Curls', 'biceps', '{}', '{"elbows"}', 'arm_isolation', 'strength', '{"bilateral"}', '{"accessory"}', 'moderate_local', 'low', '{"dumbbells"}', 'low', 'curl', '{"standard", "circuit"}'),

-- Slow Squats
('Slow Squats', 'quads', '{"glutes", "hamstrings"}', '{"knees", "hips"}', 'squat', 'strength', '{"bilateral"}', '{"secondary_strength"}', 'moderate_systemic', 'low', '{}', 'moderate', 'squat', '{"standard", "circuit"}'),

-- Lateral Squat Step
('Lateral Squat Step', 'quads', '{"glutes", "adductors"}', '{"knees", "hips"}', 'squat', 'strength', '{"bilateral", "cross_plane", "hip_stability"}', '{"secondary_strength"}', 'moderate_systemic', 'moderate', '{}', 'moderate', 'squat', '{"standard", "circuit"}'),

-- Half-Kneeling Overhead Press
('Half-Kneeling Overhead Press', 'shoulders', '{"core", "triceps"}', '{"shoulders"}', 'vertical_push', 'strength', '{"unilateral", "postural_control"}', '{"secondary_strength"}', 'moderate_local', 'moderate', '{"dumbbells"}', 'moderate', 'press', '{"standard", "circuit"}'),

-- Push-Up to Side Plank
('Push-Up to Side Plank', 'chest', '{"core", "shoulders"}', '{"shoulders"}', 'horizontal_push', 'strength', '{"anti_rotation"}', '{"secondary_strength", "core"}', 'moderate_systemic', 'moderate', '{}', 'moderate', 'push_up', '{"standard", "circuit"}'),

-- Superman
('Superman', 'lower_back', '{"glutes", "hamstrings"}', '{}', 'core', 'stability', '{"postural_control", "isometric_control"}', '{"core"}', 'moderate_local', 'low', '{}', 'low', 'other', '{"standard", "circuit"}'),

-- Toe Touch Crunch (using dumbbells)
('Toe Touch Crunch', 'core', '{}', '{}', 'core', 'strength', '{"explosive", "core_stability"}', '{"core"}', 'moderate_local', 'moderate', '{"dumbbells"}', 'low', 'other', '{"standard", "circuit"}');

-- Notes:
-- 1. Changed all 'plate' equipment references to 'dumbbells' since 'plate' is not in the equipment enum
-- 2. Removed some movement_tags that don't exist in the enum: 'constant_tension', 'anti_extension', 'coordination', 'wide_stance', 'tempo_control', 'combo', 'complex_combo', 'forearms', 'arms', 'hip_flexors' from secondary_muscles
-- 3. Added template_type array with both 'standard' and 'circuit' to make exercises available for both templates
-- 4. Simplified some secondary_muscles arrays to only include valid enum values

-- UPDATE queries to make these exercises circuit-only
UPDATE exercises SET template_type = '{"circuit"}' WHERE name IN (
  'Split Squat',
  'Romanian Deadlift (RDL)',
  'Glute Bridge',
  'Dumbbell Floor Press',
  'Dumbbell Overhead Press',
  'Chest Squeeze Press',
  'Squat + Press-Out',
  'Dumbbell Bent-Over Row',
  'Side Plank',
  'Mountain Climber',
  'Shadow Boxing',
  'Plate Uppercut',
  'Plate Elbow Strikes',
  'Plate Jumping Jacks',
  'Single-Leg RDL',
  'Single-Arm Dumbbell Snatch',
  'Single-Arm Overhead Hold + March',
  'Sumo Squat with Plate Hold',
  'Plate Good Morning',
  'Arnold Press',
  'Shoulder Raise',
  'Plank Shoulder Tap',
  'Heel Taps (Side Abs)',
  'Dumbbell Around the World',
  'Burpee',
  'Squat Jump',
  'Seated Driver',
  'Side Bend',
  'Bent-Over Single-Arm Row',
  'V-Ups',
  'Kneeling Chopper',
  'Weighted Sit-Up',
  'Standing Tricep Extension',
  'Curl → Overhead Press → Tricep Extension',
  'Back Bridge Pullover',
  'Plate Swing / Kettlebell Swing',
  'Torso Rotation',
  'Bicep Curl',
  'Floor Pullover',
  'Floor Tricep Extension',
  'Bicycles',
  'Weighted Deadbug',
  'Front Lunge',
  'Reverse Lunge + Drive',
  'Calf Raises',
  'Leg Raise',
  'Pullover + Sit-Up',
  'Reverse Crunch',
  'Reverse Curls',
  'Slow Squats',
  'Lateral Squat Step',
  'Half-Kneeling Overhead Press',
  'Push-Up to Side Plank',
  'Superman',
  'Toe Touch Crunch'
);

-- Add all circuit-only exercises to all existing businesses
-- This query will automatically link all circuit exercises to every business in the system
INSERT INTO business_exercises (business_id, exercise_id)
SELECT 
  b.id as business_id,
  e.id as exercise_id
FROM 
  business b
  CROSS JOIN exercises e
WHERE 
  e.template_type = '{"circuit"}'
  AND e.name IN (
    'Split Squat',
    'Romanian Deadlift (RDL)',
    'Glute Bridge',
    'Dumbbell Floor Press',
    'Dumbbell Overhead Press',
    'Chest Squeeze Press',
    'Squat + Press-Out',
    'Dumbbell Bent-Over Row',
    'Side Plank',
    'Mountain Climber',
    'Shadow Boxing',
    'Plate Uppercut',
    'Plate Elbow Strikes',
    'Plate Jumping Jacks',
    'Single-Leg RDL',
    'Single-Arm Dumbbell Snatch',
    'Single-Arm Overhead Hold + March',
    'Sumo Squat with Plate Hold',
    'Plate Good Morning',
    'Arnold Press',
    'Shoulder Raise',
    'Plank Shoulder Tap',
    'Heel Taps (Side Abs)',
    'Dumbbell Around the World',
    'Burpee',
    'Squat Jump',
    'Seated Driver',
    'Side Bend',
    'Bent-Over Single-Arm Row',
    'V-Ups',
    'Kneeling Chopper',
    'Weighted Sit-Up',
    'Standing Tricep Extension',
    'Curl → Overhead Press → Tricep Extension',
    'Back Bridge Pullover',
    'Plate Swing / Kettlebell Swing',
    'Torso Rotation',
    'Bicep Curl',
    'Floor Pullover',
    'Floor Tricep Extension',
    'Bicycles',
    'Weighted Deadbug',
    'Front Lunge',
    'Reverse Lunge + Drive',
    'Calf Raises',
    'Leg Raise',
    'Pullover + Sit-Up',
    'Reverse Crunch',
    'Reverse Curls',
    'Slow Squats',
    'Lateral Squat Step',
    'Half-Kneeling Overhead Press',
    'Push-Up to Side Plank',
    'Superman',
    'Toe Touch Crunch'
  )
  AND NOT EXISTS (
    SELECT 1 
    FROM business_exercises be 
    WHERE be.business_id = b.id 
    AND be.exercise_id = e.id
  );

-- To verify the count of circuit exercises per business after insertion:
-- SELECT b.name as business_name, COUNT(*) as circuit_exercise_count
-- FROM business b
-- JOIN business_exercises be ON b.id = be.business_id
-- JOIN exercises e ON e.id = be.exercise_id
-- WHERE e.template_type @> '["circuit"]'::jsonb
-- GROUP BY b.name;