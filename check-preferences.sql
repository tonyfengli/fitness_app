-- Check if workout preferences are being saved with exercises
SELECT 
  wp.id,
  wp.user_id,
  wp.training_session_id,
  wp.intensity,
  wp.muscle_targets,
  wp.muscle_lessens,
  wp.include_exercises,
  wp.avoid_exercises,
  wp.avoid_joints,
  wp.session_goal,
  wp.collected_at
FROM workout_preferences wp
ORDER BY wp.collected_at DESC
LIMIT 5;

-- Check the most recent messages to see exercise validation info
SELECT 
  m.id,
  m.user_id,
  m.direction,
  m.content,
  m.metadata->>'type' as message_type,
  m.metadata->'llmParsing'->'exerciseValidation' as exercise_validation,
  m.created_at
FROM messages m
WHERE m.metadata->>'type' IN ('preference_collection', 'preference_collection_response')
  AND m.metadata->'llmParsing'->'exerciseValidation' IS NOT NULL
ORDER BY m.created_at DESC
LIMIT 5;