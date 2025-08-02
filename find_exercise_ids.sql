-- Find the actual exercise IDs for the exercises shown in the UI
SELECT id, name, movement_pattern, primary_muscle
FROM exercises
WHERE name IN (
    'Barbell Back Squat',
    '3-Point Dumbbell Row',
    'Alternating Incline Dumbbell Chest Press',
    'Banded Prone Overhead Press',
    'Australian Pull-Up',
    'Glute Bridge Thrust with Dumbbell'
)
ORDER BY name;

-- Also check what exercises are currently marked as favorites
SELECT 
    uer.user_id,
    u.name as user_name,
    uer.exercise_id,
    e.name as exercise_name
FROM user_exercise_ratings uer
JOIN "user" u ON u.id = uer.user_id
JOIN exercises e ON e.id = uer.exercise_id
WHERE uer.business_id = 'd33b41e2-f700-4a08-9489-cb6e3daa7f20'
ORDER BY u.name, e.name;