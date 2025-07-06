-- Insert new exercises with updated schema
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
    strength_level
) VALUES
-- Row 1
('Barbell Bench Press', 'chest', ARRAY['triceps', 'shoulders']::text[], ARRAY['shoulders']::text[], 'horizontal_push', 'strength', ARRAY['bilateral', 'scapular_control', 'foundational']::text[], ARRAY['primary_strength']::text[], 'moderate_local', 'moderate', ARRAY['barbell', 'bench']::text[], 'moderate'),

-- Row 2
('Dumbbell Press', 'chest', ARRAY['triceps', 'shoulders']::text[], ARRAY['shoulders']::text[], 'horizontal_push', 'strength', ARRAY['bilateral', 'scapular_control', 'foundational']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_systemic', 'low', ARRAY['dumbbells', 'bench']::text[], 'low'),

-- Row 3
('Incline Dumbbell Press', 'upper_chest', ARRAY['triceps', 'shoulders']::text[], ARRAY['shoulders']::text[], 'horizontal_push', 'strength', ARRAY['bilateral', 'scapular_control', 'foundational']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_systemic', 'low', ARRAY['dumbbells', 'bench']::text[], 'low'),

-- Row 4
('Dumbbell Bench Row', 'lats', ARRAY['biceps', 'upper_back']::text[], NULL, 'horizontal_pull', 'strength', ARRAY['unilateral', 'scapular_control', 'core_stability', 'foundational', 'rehab_friendly']::text[], ARRAY['secondary_strength']::text[], 'moderate_local', 'low', ARRAY['dumbbells', 'bench']::text[], 'low'),

-- Row 5
('Landmine T Bar Row', 'lats', ARRAY['biceps', 'upper_back']::text[], NULL, 'horizontal_pull', 'strength', ARRAY['bilateral', 'scapular_control', 'postural_control', 'rehab_friendly']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_systemic', 'moderate', ARRAY['barbell', 'landmine']::text[], 'moderate'),

-- Row 6
('TRX Mid Row', 'upper_back', ARRAY['biceps', 'lats']::text[], NULL, 'horizontal_pull', 'stability', ARRAY['bilateral', 'scapular_control', 'core_stability']::text[], ARRAY['secondary_strength']::text[], 'moderate_local', 'moderate', ARRAY['trx']::text[], 'low'),

-- Row 7
('Dumbbell Pullover', 'lats', ARRAY['chest', 'triceps']::text[], NULL, 'horizontal_pull', 'strength', ARRAY['scapular_control', 'core_stability', 'bilateral']::text[], ARRAY['accessory']::text[], 'moderate_local', 'moderate', ARRAY['dumbbells']::text[], 'moderate'),

-- Row 8
('Bent-Over Single Arm Kettlebell Row (Gorilla Row)', 'lats', ARRAY['biceps', 'upper_back']::text[], NULL, 'horizontal_pull', 'strength', ARRAY['unilateral', 'scapular_control', 'hip_dominant', 'foundational']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_local', 'moderate', ARRAY['kettlebell']::text[], 'low'),

-- Row 9
('Batwing Chest-Supported Row', 'upper_back', ARRAY['lats', 'biceps']::text[], NULL, 'horizontal_pull', 'strength', ARRAY['isometric_control', 'scapular_control', 'bilateral']::text[], ARRAY['secondary_strength']::text[], 'moderate_local', 'moderate', ARRAY['dumbbells', 'bench']::text[], 'moderate'),

-- Row 10
('Face Pulls', 'delts', ARRAY['traps']::text[], NULL, 'horizontal_pull', 'stability', ARRAY['scapular_control', 'bilateral', 'rehab_friendly', 'warmup_friendly']::text[], ARRAY['accessory']::text[], 'moderate_local', 'moderate', ARRAY['cable_machine']::text[], 'low'),

-- Row 11
('Band Pull-Apart', 'traps', ARRAY['delts']::text[], NULL, 'horizontal_pull', 'stability', ARRAY['bilateral', 'scapular_control', 'rehab_friendly', 'warmup_friendly']::text[], ARRAY['accessory']::text[], 'low_local', 'very_low', ARRAY['bands']::text[], 'very_low'),

-- Row 12
('Lateral Shoulder Raise', 'delts', NULL, ARRAY['shoulders']::text[], 'shoulder_isolation', 'strength', ARRAY['bilateral']::text[], ARRAY['accessory']::text[], 'moderate_local', 'low', ARRAY['dumbbells']::text[], 'low'),

-- Row 13
('Y/W Raises', 'delts', NULL, NULL, 'vertical_push', 'stability', ARRAY['scapular_control', 'postural_control', 'rehab_friendly', 'warmup_friendly']::text[], ARRAY['accessory']::text[], 'low_local', 'moderate', NULL, 'very_low'),

-- Row 14
('Barbell Back Squat', 'quads', ARRAY['glutes', 'hamstrings']::text[], ARRAY['knees', 'lower_back']::text[], 'squat', 'strength', ARRAY['bilateral', 'knee_dominant', 'postural_control', 'foundational']::text[], ARRAY['primary_strength']::text[], 'high_systemic', 'moderate', ARRAY['barbell']::text[], 'moderate'),

-- Row 15
('Goblet Squat', 'quads', ARRAY['glutes', 'core']::text[], ARRAY['knees', 'hips']::text[], 'squat', 'strength', ARRAY['bilateral', 'knee_dominant', 'postural_control', 'foundational', 'warmup_friendly']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_systemic', 'low', ARRAY['dumbbells']::text[], 'low'),

-- Row 16
('Jump Squat', 'quads', ARRAY['glutes', 'calves']::text[], ARRAY['knees', 'hips', 'ankles']::text[], 'squat', 'power', ARRAY['bilateral', 'knee_dominant', 'explosive', 'finisher_friendly']::text[], ARRAY['secondary_strength', 'capacity']::text[], 'metabolic', 'moderate', NULL, 'moderate'),

-- Row 17
('Lunge with Biceps Curl', 'quads', ARRAY['glutes', 'biceps']::text[], ARRAY['knees', 'hips']::text[], 'lunge', 'strength', ARRAY['unilateral', 'knee_dominant', 'balance_challenge']::text[], ARRAY['secondary_strength']::text[], 'moderate_systemic', 'moderate', ARRAY['dumbbells']::text[], 'moderate'),

-- Row 18
('Lateral Step-Up with Goblet Hold', 'quads', ARRAY['glutes', 'core']::text[], ARRAY['knees', 'hips']::text[], 'lunge', 'strength', ARRAY['unilateral', 'knee_dominant', 'balance_challenge']::text[], ARRAY['secondary_strength']::text[], 'moderate_systemic', 'moderate', ARRAY['box', 'dumbbells']::text[], 'moderate'),

-- Row 19
('Farmer''s Carry Step-Up', 'quads', ARRAY['glutes', 'core']::text[], ARRAY['knees']::text[], 'lunge', 'conditioning', ARRAY['unilateral', 'knee_dominant', 'balance_challenge']::text[], ARRAY['secondary_strength', 'capacity']::text[], 'moderate_systemic', 'moderate', ARRAY['box', 'dumbbells']::text[], 'moderate'),

-- Row 20
('Farmer''s Carry', 'core', ARRAY['traps', 'delts']::text[], NULL, 'carry', 'strength', ARRAY['bilateral', 'postural_control', 'core_stability', 'foundational']::text[], ARRAY['secondary_strength', 'core', 'capacity']::text[], 'moderate_systemic', 'low', ARRAY['dumbbells']::text[], 'low'),

-- Row 21
('Glute Bridge Thrust with Dumbbell', 'glutes', ARRAY['hamstrings', 'core']::text[], NULL, 'hinge', 'strength', ARRAY['bilateral', 'hip_dominant', 'rehab_friendly']::text[], ARRAY['secondary_strength', 'accessory']::text[], 'moderate_local', 'low', ARRAY['dumbbells']::text[], 'low'),

-- Row 22
('Nordic Hamstring Curl', 'hamstrings', ARRAY['glutes']::text[], ARRAY['knees']::text[], 'leg_isolation', 'strength', ARRAY['bilateral', 'knee_dominant']::text[], ARRAY['secondary_strength', 'accessory']::text[], 'high_local', 'moderate', ARRAY['dumbbells']::text[], 'high'),

-- Row 23
('BOSU Hamstring Curl', 'hamstrings', ARRAY['glutes']::text[], ARRAY['knees']::text[], 'leg_isolation', 'stability', ARRAY['bilateral', 'knee_dominant', 'balance_challenge', 'rehab_friendly']::text[], ARRAY['secondary_strength', 'accessory']::text[], 'moderate_local', 'moderate', ARRAY['bosu_ball', 'dumbbells']::text[], 'high'),

-- Row 24
('Dead Bug', 'core', NULL, NULL, 'core', 'core', ARRAY['core_stability', 'anti_rotation', 'isometric_control', 'rehab_friendly', 'warmup_friendly']::text[], ARRAY['core']::text[], 'low_local', 'low', NULL, 'low'),

-- Row 25
('Stir-the-Pot Plank', 'core', ARRAY['shoulders']::text[], NULL, 'core', 'core', ARRAY['core_stability', 'isometric_control', 'anti_rotation']::text[], ARRAY['core']::text[], 'moderate_local', 'moderate', ARRAY['swiss_ball']::text[], 'moderate'),

-- Row 26
('Banded Prone Overhead Press', 'core', ARRAY['shoulders']::text[], NULL, 'vertical_push', 'mobility', ARRAY['scapular_control', 'postural_control', 'rehab_friendly', 'warmup_friendly']::text[], ARRAY['accessory']::text[], 'low_local', 'low', ARRAY['bands']::text[], 'low'),

-- Row 27
('Swiss Ball Forearm Plank', 'core', ARRAY['shoulders']::text[], NULL, 'core', 'core', ARRAY['core_stability', 'isometric_control', 'balance_challenge', 'rehab_friendly']::text[], ARRAY['core']::text[], 'moderate_local', 'very_low', ARRAY['swiss_ball']::text[], 'moderate'),

-- Row 28
('Monster Walk (Banded Lateral Walk)', 'abductors', ARRAY['glutes']::text[], NULL, 'leg_isolation', 'stability', ARRAY['hip_stability', 'rehab_friendly', 'warmup_friendly']::text[], ARRAY['accessory']::text[], 'moderate_local', 'low', ARRAY['bands']::text[], 'low'),

-- Row 29
('Quadruped Fire Hydrant (Peeing Dog)', 'abductors', ARRAY['glutes', 'core']::text[], NULL, 'leg_isolation', 'stability', ARRAY['hip_stability', 'end_range_control', 'unilateral', 'rehab_friendly', 'warmup_friendly']::text[], ARRAY['accessory']::text[], 'moderate_local', 'low', ARRAY['bands']::text[], 'low'),

-- Row 30
('Medicine Ball Slam', 'core', ARRAY['shoulders', 'lats']::text[], NULL, 'core', 'power', ARRAY['explosive', 'hip_dominant', 'finisher_friendly']::text[], ARRAY['capacity']::text[], 'metabolic', 'low', ARRAY['med_ball']::text[], 'low'),

-- Row 31
('Plank Up-Down (Elbow to Hand)', 'core', ARRAY['shoulders', 'triceps']::text[], NULL, 'core', 'core', ARRAY['core_stability', 'postural_control', 'warmup_friendly']::text[], ARRAY['core']::text[], 'moderate_local', 'low', NULL, 'low'),

-- Row 32
('Australian Pull-Up', 'upper_back', ARRAY['biceps', 'lats']::text[], ARRAY['shoulders']::text[], 'vertical_pull', 'strength', ARRAY['bilateral', 'scapular_control', 'foundational']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_local', 'moderate', ARRAY['barbell']::text[], 'low'),

-- Row 33
('Straight-Arm Pull-Down', 'lats', ARRAY['triceps', 'core']::text[], ARRAY['shoulders']::text[], 'vertical_pull', 'strength', ARRAY['scapular_control']::text[], ARRAY['accessory']::text[], 'moderate_local', 'low', ARRAY['cable_machine']::text[], 'low'),

-- Row 34
('Dumbbell Bent-Over Reverse Fly', 'delts', ARRAY['traps', 'upper_back']::text[], ARRAY['shoulders']::text[], 'horizontal_pull', 'strength', ARRAY['scapular_control', 'postural_control']::text[], ARRAY['accessory']::text[], 'moderate_local', 'moderate', ARRAY['dumbbells']::text[], 'low'),

-- Row 35
('Side Plank Press-Out', 'core', ARRAY['shoulders']::text[], ARRAY['shoulders']::text[], 'core', 'core', ARRAY['anti_rotation', 'core_stability']::text[], ARRAY['secondary_strength', 'core']::text[], 'moderate_local', 'moderate', ARRAY['dumbbells']::text[], 'moderate'),

-- Row 36
('Cable Low-to-High Chest Fly', 'upper_chest', ARRAY['shoulders', 'core']::text[], ARRAY['shoulders']::text[], 'horizontal_push', 'strength', NULL, ARRAY['secondary_strength', 'accessory']::text[], 'moderate_local', 'moderate', ARRAY['cable_machine']::text[], 'low'),

-- Row 37
('Cable Side Plank Row', 'lats', ARRAY['core', 'biceps']::text[], ARRAY['shoulders']::text[], 'horizontal_pull', 'core', ARRAY['anti_rotation', 'core_stability', 'unilateral']::text[], ARRAY['secondary_strength', 'core']::text[], 'moderate_local', 'moderate', ARRAY['cable_machine']::text[], 'moderate'),

-- Row 38
('Curtsy Lunge', 'glutes', ARRAY['quads', 'adductors']::text[], ARRAY['knees', 'hips']::text[], 'lunge', 'strength', ARRAY['cross_plane', 'unilateral', 'hip_stability']::text[], ARRAY['secondary_strength']::text[], 'moderate_systemic', 'moderate', ARRAY['dumbbells']::text[], 'moderate'),

-- Row 39
('Side Plank Reverse Fly', 'delts', ARRAY['core', 'upper_back']::text[], ARRAY['shoulders']::text[], 'horizontal_pull', 'core', ARRAY['unilateral', 'scapular_control', 'core_stability']::text[], ARRAY['secondary_strength', 'core']::text[], 'moderate_local', 'moderate', ARRAY['dumbbells']::text[], 'moderate'),

-- Row 40
('Landmine Shoulder Press', 'shoulders', ARRAY['triceps', 'core']::text[], ARRAY['shoulders']::text[], 'vertical_push', 'strength', ARRAY['unilateral', 'postural_control']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_local', 'moderate', ARRAY['landmine', 'barbell']::text[], 'moderate'),

-- Row 41
('Landmine Shoulder-to-Shoulder Press', 'shoulders', ARRAY['triceps', 'core']::text[], ARRAY['shoulders']::text[], 'vertical_push', 'power', ARRAY['unilateral', 'postural_control', 'rotational']::text[], ARRAY['primary_strength', 'secondary_strength', 'capacity']::text[], 'moderate_systemic', 'high', ARRAY['landmine', 'barbell']::text[], 'high'),

-- Row 42
('Landmine Reverse Lunge', 'quads', ARRAY['glutes', 'core']::text[], ARRAY['hips', 'knees']::text[], 'lunge', 'strength', ARRAY['unilateral', 'hip_stability', 'postural_control']::text[], ARRAY['secondary_strength']::text[], 'moderate_systemic', 'moderate', ARRAY['landmine', 'barbell']::text[], 'moderate'),

-- Row 43
('Offset Lateral Lunge', 'quads', ARRAY['glutes', 'adductors']::text[], ARRAY['hips', 'knees']::text[], 'lunge', 'strength', ARRAY['unilateral', 'hip_stability', 'balance_challenge']::text[], ARRAY['secondary_strength']::text[], 'moderate_systemic', 'moderate', ARRAY['dumbbells']::text[], 'low'),

-- Row 44
('Lateral Lunge', 'quads', ARRAY['glutes', 'adductors']::text[], ARRAY['knees']::text[], 'lunge', 'strength', ARRAY['unilateral', 'hip_stability', 'balance_challenge', 'foundational']::text[], ARRAY['secondary_strength']::text[], 'moderate_systemic', 'moderate', ARRAY['dumbbells']::text[], 'low'),

-- Row 45
('Pull-Ups', 'lats', ARRAY['biceps', 'upper_back']::text[], ARRAY['shoulders']::text[], 'vertical_pull', 'strength', ARRAY['bilateral', 'scapular_control', 'foundational']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'high_local', 'high', ARRAY['pull_up_bar']::text[], 'high'),

-- Row 46
('Single-Arm Cable Row', 'lats', ARRAY['biceps', 'upper_back']::text[], ARRAY['shoulders']::text[], 'horizontal_pull', 'strength', ARRAY['unilateral', 'scapular_control', 'core_stability']::text[], ARRAY['secondary_strength']::text[], 'moderate_local', 'moderate', ARRAY['cable_machine']::text[], 'moderate'),

-- Row 47
('Russian Twist', 'obliques', ARRAY['core']::text[], NULL, 'core', 'core', ARRAY['rotational', 'core_stability']::text[], ARRAY['core']::text[], 'moderate_local', 'low', NULL, 'low'),

-- Row 48
('Cable Chest Press (variations)', 'chest', ARRAY['shoulders', 'triceps']::text[], ARRAY['shoulders']::text[], 'horizontal_push', 'strength', NULL, ARRAY['secondary_strength', 'accessory']::text[], 'moderate_local', 'low', ARRAY['cable_machine']::text[], 'low'),

-- Row 49
('Face Pull to Overhead Press', 'shoulders', ARRAY['traps', 'upper_back']::text[], ARRAY['shoulders']::text[], 'horizontal_pull', 'stability', ARRAY['scapular_control', 'postural_control', 'bilateral', 'warmup_friendly']::text[], ARRAY['accessory']::text[], 'moderate_systemic', 'moderate', ARRAY['cable_machine']::text[], 'low'),

-- Row 50
('Farmer''s Carry Reverse Lunge', 'quads', ARRAY['glutes', 'core']::text[], ARRAY['knees']::text[], 'lunge', 'strength', ARRAY['unilateral', 'postural_control', 'hip_stability', 'foundational']::text[], ARRAY['primary_strength', 'secondary_strength', 'capacity']::text[], 'moderate_systemic', 'moderate', ARRAY['dumbbells']::text[], 'low'),

-- Row 51
('Side Plank Hip Raise', 'quads', ARRAY['glutes', 'core']::text[], NULL, 'core', 'core', ARRAY['core_stability', 'isometric_control', 'hip_stability', 'rehab_friendly', 'warmup_friendly']::text[], ARRAY['core']::text[], 'moderate_local', 'moderate', NULL, 'moderate'),

-- Row 52
('Incline Bicep Curl', 'biceps', NULL, NULL, 'arm_isolation', 'strength', ARRAY['bilateral']::text[], ARRAY['accessory']::text[], 'moderate_local', 'low', ARRAY['dumbbells', 'bench']::text[], 'low'),

-- Row 53
('Suitcase Kettlebell Lunge', 'quads', ARRAY['glutes', 'core']::text[], ARRAY['knees']::text[], 'lunge', 'strength', ARRAY['unilateral', 'anti_rotation', 'hip_stability']::text[], ARRAY['secondary_strength', 'capacity']::text[], 'moderate_systemic', 'moderate', ARRAY['kettlebell']::text[], 'moderate'),

-- Row 54
('Plank Jack', 'core', ARRAY['shoulders', 'glutes']::text[], NULL, 'core', 'conditioning', ARRAY['core_stability', 'explosive', 'warmup_friendly']::text[], ARRAY['core', 'capacity']::text[], 'metabolic', 'low', NULL, 'low'),

-- Row 55
('Bosu Plank Jack', 'core', ARRAY['shoulders', 'glutes']::text[], NULL, 'core', 'conditioning', ARRAY['core_stability', 'explosive', 'balance_challenge']::text[], ARRAY['core', 'capacity']::text[], 'moderate_local', 'moderate', ARRAY['bosu_ball']::text[], 'moderate'),

-- Row 56
('Bodyweight Triceps Extension', 'triceps', ARRAY['shoulders']::text[], NULL, 'arm_isolation', 'strength', ARRAY['bilateral']::text[], ARRAY['accessory']::text[], 'moderate_local', 'moderate', NULL, 'low'),

-- Row 57
('Skull Crusher', 'triceps', NULL, ARRAY['elbows']::text[], 'arm_isolation', 'strength', ARRAY['bilateral']::text[], ARRAY['accessory']::text[], 'moderate_local', 'low', ARRAY['dumbbells']::text[], 'low'),

-- Row 58
('Incline Shoulder Raises (three-ways)', 'delts', ARRAY['traps']::text[], ARRAY['shoulders']::text[], 'shoulder_isolation', 'strength', ARRAY['bilateral']::text[], ARRAY['accessory']::text[], 'moderate_local', 'moderate', ARRAY['dumbbells']::text[], 'low'),

-- Row 59
('Incline Barbell Bench Press', 'upper_chest', ARRAY['shoulders', 'triceps']::text[], ARRAY['shoulders']::text[], 'horizontal_push', 'strength', ARRAY['bilateral', 'scapular_control', 'foundational']::text[], ARRAY['primary_strength']::text[], 'moderate_local', 'moderate', ARRAY['barbell', 'bench']::text[], 'moderate'),

-- Row 60
('Goblet Squat Pulse', 'quads', ARRAY['glutes', 'core']::text[], ARRAY['knees', 'hips']::text[], 'squat', 'strength', ARRAY['bilateral', 'knee_dominant', 'warmup_friendly']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'metabolic', 'low', ARRAY['dumbbells']::text[], 'low'),

-- Row 61
('Single-Leg Glute Bridge with Band', 'glutes', ARRAY['hamstrings', 'core']::text[], NULL, 'hinge', 'stability', ARRAY['unilateral', 'hip_dominant', 'hip_stability', 'rehab_friendly', 'warmup_friendly']::text[], ARRAY['secondary_strength', 'accessory']::text[], 'moderate_local', 'moderate', ARRAY['bands']::text[], 'low'),

-- Row 62
('Dumbbell Thruster', 'quads', ARRAY['shoulders', 'glutes']::text[], ARRAY['shoulders', 'knees']::text[], 'squat', 'conditioning', ARRAY['bilateral', 'knee_dominant', 'explosive', 'finisher_friendly']::text[], ARRAY['secondary_strength', 'capacity']::text[], 'metabolic', 'moderate', ARRAY['dumbbells']::text[], 'low'),

-- Row 63
('Dumbbell Hammer Curls', 'biceps', NULL, NULL, 'arm_isolation', 'strength', ARRAY['bilateral']::text[], ARRAY['accessory']::text[], 'moderate_local', 'very_low', ARRAY['dumbbells']::text[], 'low'),

-- Row 64
('Dumbbell Overhead Tricep Extension', 'triceps', ARRAY['shoulders']::text[], ARRAY['elbows', 'shoulders']::text[], 'arm_isolation', 'strength', ARRAY['bilateral']::text[], ARRAY['accessory']::text[], 'moderate_local', 'low', ARRAY['dumbbells']::text[], 'low'),

-- Row 65
('Rope Tricep Pressdown', 'triceps', NULL, NULL, 'arm_isolation', 'strength', ARRAY['bilateral']::text[], ARRAY['accessory']::text[], 'moderate_local', 'low', ARRAY['cable_machine']::text[], 'low'),

-- Row 66
('Pull-Ups (assisted with bands)', 'lats', ARRAY['biceps', 'upper_back']::text[], ARRAY['shoulders']::text[], 'vertical_pull', 'strength', ARRAY['bilateral', 'scapular_control', 'foundational']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_local', 'moderate', ARRAY['pull_up_bar']::text[], 'low'),

-- Row 67
('TRX Y Raise', 'traps', ARRAY['delts', 'upper_back']::text[], ARRAY['shoulders']::text[], 'shoulder_isolation', 'stability', ARRAY['scapular_control', 'postural_control', 'bilateral', 'rehab_friendly', 'warmup_friendly']::text[], ARRAY['accessory']::text[], 'moderate_local', 'moderate', ARRAY['trx']::text[], 'moderate'),

-- Row 68
('Single-Arm Kettlebell Suitcase Carry', 'core', ARRAY['obliques', 'traps']::text[], NULL, 'carry', 'stability', ARRAY['unilateral', 'anti_rotation', 'postural_control', 'foundational']::text[], ARRAY['secondary_strength', 'core', 'capacity']::text[], 'moderate_local', 'low', ARRAY['kettlebell']::text[], 'low'),

-- Row 69
('Lat Pulldown', 'lats', ARRAY['biceps', 'upper_back']::text[], ARRAY['shoulders']::text[], 'vertical_pull', 'strength', ARRAY['bilateral', 'scapular_control', 'foundational']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_local', 'low', ARRAY['back_machine']::text[], 'low'),

-- Row 70
('Bear Crawl (Forward and Back)', 'core', ARRAY['shoulders', 'quads']::text[], NULL, 'core', 'core', ARRAY['core_stability', 'postural_control', 'warmup_friendly']::text[], ARRAY['core', 'capacity']::text[], 'moderate_systemic', 'moderate', NULL, 'low'),

-- Row 71
('In-and-Out Squat Jumps', 'quads', ARRAY['glutes', 'calves']::text[], ARRAY['knees']::text[], 'squat', 'conditioning', ARRAY['bilateral', 'explosive', 'knee_dominant', 'finisher_friendly']::text[], ARRAY['capacity']::text[], 'metabolic', 'moderate', NULL, 'moderate'),

-- Row 72
('Box Pike Walkout', 'core', ARRAY['shoulders', 'hamstrings']::text[], NULL, 'hinge', 'core', ARRAY['core_stability', 'warmup_friendly']::text[], ARRAY['core', 'capacity']::text[], 'moderate_local', 'moderate', ARRAY['bench']::text[], 'moderate'),

-- Row 73
('Band-Assisted Push-Ups', 'chest', ARRAY['triceps', 'shoulders']::text[], ARRAY['shoulders']::text[], 'horizontal_push', 'strength', ARRAY['bilateral', 'foundational']::text[], ARRAY['secondary_strength']::text[], 'moderate_local', 'low', ARRAY['barbell']::text[], 'low'),

-- Row 74
('Alternating Isometric Dumbbell Curl Hold', 'biceps', ARRAY['delts']::text[], NULL, 'arm_isolation', 'strength', ARRAY['unilateral', 'isometric_control']::text[], ARRAY['accessory']::text[], 'moderate_local', 'low', ARRAY['dumbbells']::text[], 'low'),

-- Row 75
('Box Pistol Squat', 'quads', ARRAY['glutes', 'hamstrings']::text[], ARRAY['knees']::text[], 'squat', 'strength', ARRAY['unilateral', 'balance_challenge', 'hip_dominant']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_systemic', 'high', ARRAY['bench']::text[], 'moderate'),

-- Row 76
('Elevated Calf Raises', 'calves', NULL, ARRAY['ankles']::text[], 'leg_isolation', 'strength', ARRAY['bilateral', 'end_range_control', 'rehab_friendly', 'warmup_friendly']::text[], ARRAY['accessory']::text[], 'moderate_local', 'very_low', NULL, 'low'),

-- Row 77
('Anterior Tibialis Raises', 'shins', NULL, ARRAY['ankles']::text[], 'leg_isolation', 'strength', ARRAY['bilateral', 'end_range_control', 'rehab_friendly', 'warmup_friendly']::text[], ARRAY['accessory']::text[], 'moderate_local', 'very_low', NULL, 'low'),

-- Row 78
('Plank Reach', 'core', ARRAY['shoulders']::text[], NULL, 'core', 'core', ARRAY['core_stability', 'isometric_control', 'anti_rotation', 'warmup_friendly', 'rehab_friendly']::text[], ARRAY['core']::text[], 'moderate_local', 'low', NULL, 'low'),

-- Row 79
('Goblet Pause Squat (3 Seconds)', 'quads', ARRAY['glutes', 'core']::text[], ARRAY['knees', 'hips']::text[], 'squat', 'strength', ARRAY['bilateral', 'knee_dominant', 'isometric_control', 'foundational', 'mobility_focus', 'warmup_friendly']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'metabolic', 'low', ARRAY['bench']::text[], 'low'),

-- Row 80
('Flutter Kicks', 'core', ARRAY['glutes']::text[], NULL, 'core', 'core', ARRAY['core_stability', 'isometric_control', 'finisher_friendly']::text[], ARRAY['core']::text[], 'moderate_local', 'low', NULL, 'low'),

-- Row 81
('Bulgarian Split Squat', 'quads', ARRAY['glutes', 'hamstrings']::text[], ARRAY['knees', 'hips']::text[], 'lunge', 'strength', ARRAY['unilateral', 'knee_dominant', 'foundational']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_systemic', 'moderate', ARRAY['bench', 'dumbbells']::text[], 'moderate'),

-- Row 82
('Bulgarian Squat Jumps', 'quads', ARRAY['glutes', 'calves']::text[], ARRAY['knees', 'hips', 'ankles']::text[], 'lunge', 'power', ARRAY['unilateral', 'knee_dominant', 'explosive', 'finisher_friendly']::text[], ARRAY['secondary_strength', 'capacity']::text[], 'metabolic', 'high', ARRAY['bench', 'dumbbells']::text[], 'high'),

-- Row 83
('Box Jumps', 'quads', ARRAY['glutes', 'calves']::text[], ARRAY['knees', 'hips', 'ankles']::text[], 'squat', 'power', ARRAY['bilateral', 'explosive', 'finisher_friendly']::text[], ARRAY['capacity']::text[], 'high_systemic', 'moderate', ARRAY['box']::text[], 'high'),

-- Row 84
('3-Point Dumbbell Row', 'lats', ARRAY['biceps']::text[], ARRAY['shoulders']::text[], 'horizontal_pull', 'strength', ARRAY['unilateral', 'scapular_control', 'foundational']::text[], ARRAY['secondary_strength']::text[], 'moderate_local', 'moderate', ARRAY['dumbbells']::text[], 'low'),

-- Row 85
('Dragon Flag', 'core', ARRAY['glutes']::text[], ARRAY['lower_back']::text[], 'core', 'core', ARRAY['core_stability', 'isometric_control']::text[], ARRAY['core']::text[], 'high_local', 'high', ARRAY['bench']::text[], 'high'),

-- Row 86
('Hollow Body One-Arm Press', 'chest', ARRAY['core', 'shoulders']::text[], ARRAY['shoulders']::text[], 'core', 'core', ARRAY['anti_rotation', 'core_stability', 'postural_control']::text[], ARRAY['secondary_strength', 'core']::text[], 'moderate_local', 'moderate', ARRAY['bench']::text[], 'moderate'),

-- Row 87
('Alternating Incline Dumbbell Chest Press', 'chest', ARRAY['shoulders', 'triceps']::text[], ARRAY['shoulders']::text[], 'horizontal_push', 'strength', ARRAY['unilateral']::text[], ARRAY['secondary_strength']::text[], 'moderate_local', 'low', ARRAY['bench']::text[], 'moderate'),

-- Row 88
('Glute Kickbacks', 'glutes', ARRAY['hamstrings', 'core']::text[], NULL, 'leg_isolation', 'strength', ARRAY['unilateral', 'hip_dominant', 'hip_stability', 'rehab_friendly']::text[], ARRAY['accessory']::text[], 'moderate_local', 'very_low', NULL, 'low'),

-- Row 89
('Deadlift', 'hamstrings', ARRAY['glutes', 'lower_back']::text[], ARRAY['hips', 'knees', 'lower_back']::text[], 'hinge', 'strength', ARRAY['bilateral', 'hip_dominant', 'postural_control', 'foundational']::text[], ARRAY['primary_strength']::text[], 'high_systemic', 'moderate', ARRAY['platform', 'barbell']::text[], 'moderate'),

-- Row 90
('Kettlebell Bottoms-Up Press', 'shoulders', ARRAY['triceps', 'core']::text[], ARRAY['shoulders', 'wrists']::text[], 'vertical_push', 'stability', ARRAY['unilateral', 'postural_control', 'scapular_control']::text[], ARRAY['secondary_strength', 'accessory']::text[], 'moderate_local', 'high', ARRAY['kettlebell']::text[], 'moderate'),

-- Row 91
('Dumbbell Shoulder Press', 'shoulders', ARRAY['triceps', 'upper_chest']::text[], ARRAY['shoulders']::text[], 'vertical_push', 'strength', ARRAY['bilateral', 'foundational']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_local', 'low', ARRAY['dumbbells']::text[], 'low'),

-- Row 92
('TRX Bicep Curls', 'biceps', NULL, NULL, 'arm_isolation', 'strength', ARRAY['bilateral', 'scapular_control']::text[], ARRAY['accessory']::text[], 'moderate_local', 'low', ARRAY['trx']::text[], 'low'),

-- Row 93
('Ab Wheel Rollout', 'core', ARRAY['lats']::text[], ARRAY['lower_back']::text[], 'core', 'core', ARRAY['core_stability', 'anti_rotation']::text[], ARRAY['core']::text[], 'high_local', 'moderate', ARRAY['ab_wheel']::text[], 'high'),

-- Row 94
('Single-Arm Shoulder Press', 'shoulders', ARRAY['triceps', 'core']::text[], ARRAY['shoulders']::text[], 'vertical_push', 'strength', ARRAY['unilateral', 'postural_control']::text[], ARRAY['secondary_strength']::text[], 'moderate_local', 'moderate', ARRAY['dumbbells']::text[], 'moderate'),

-- Row 95
('Archer Push-Ups', 'chest', ARRAY['triceps', 'shoulders']::text[], ARRAY['shoulders']::text[], 'horizontal_push', 'strength', ARRAY['unilateral']::text[], ARRAY['secondary_strength']::text[], 'high_local', 'high', NULL, 'high'),

-- Row 96
('Copenhagen Plank', 'adductors', ARRAY['obliques', 'core']::text[], NULL, 'core', 'core', ARRAY['isometric_control', 'hip_stability', 'core_stability']::text[], ARRAY['core']::text[], 'moderate_local', 'moderate', ARRAY['bench']::text[], 'moderate'),

-- Row 97
('Plank with Weight Drag', 'core', ARRAY['shoulders', 'obliques']::text[], NULL, 'core', 'core', ARRAY['core_stability', 'anti_rotation', 'warmup_friendly']::text[], ARRAY['core']::text[], 'moderate_local', 'moderate', ARRAY['dumbbells']::text[], 'low'),

-- Row 98
('Two-Arm Cable Row', 'lats', ARRAY['biceps', 'upper_back']::text[], ARRAY['shoulders']::text[], 'horizontal_pull', 'strength', ARRAY['bilateral', 'scapular_control', 'foundational']::text[], ARRAY['secondary_strength']::text[], 'moderate_local', 'low', ARRAY['back_machine']::text[], 'low'),

-- Row 99
('Push-Ups', 'chest', ARRAY['triceps', 'shoulders']::text[], ARRAY['shoulders']::text[], 'horizontal_push', 'strength', ARRAY['bilateral', 'scapular_control', 'foundational']::text[], ARRAY['secondary_strength']::text[], 'moderate_local', 'low', NULL, 'moderate'),

-- Row 100
('Elevated Push-Ups', 'chest', ARRAY['triceps', 'shoulders']::text[], ARRAY['shoulders', 'wrists']::text[], 'horizontal_push', 'strength', ARRAY['bilateral', 'scapular_control', 'warmup_friendly']::text[], ARRAY['secondary_strength']::text[], 'moderate_local', 'low', ARRAY['dumbbells']::text[], 'low'),

-- Row 101
('Bird Dog Row', 'lats', ARRAY['core', 'upper_back']::text[], NULL, 'horizontal_pull', 'stability', ARRAY['unilateral', 'core_stability', 'anti_rotation', 'rehab_friendly', 'warmup_friendly']::text[], ARRAY['secondary_strength', 'core']::text[], 'moderate_local', 'moderate', ARRAY['dumbbells']::text[], 'moderate'),

-- Row 102
('Barbell Glute Bridge on Bench', 'glutes', ARRAY['hamstrings', 'core']::text[], ARRAY['hips']::text[], 'hinge', 'strength', ARRAY['bilateral', 'hip_dominant']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_local', 'low', ARRAY['barbell', 'bench']::text[], 'moderate'),

-- Row 103
('Hollow Body Dumbbell Press', 'chest', ARRAY['core', 'shoulders']::text[], ARRAY['shoulders']::text[], 'core', 'strength', ARRAY['core_stability', 'anti_rotation', 'postural_control']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_local', 'moderate', ARRAY['dumbbells']::text[], 'moderate'),

-- Row 104
('Wall Squat Hold', 'quads', ARRAY['glutes', 'core']::text[], ARRAY['knees', 'hips']::text[], 'squat', 'stability', ARRAY['isometric_control', 'knee_dominant']::text[], ARRAY['secondary_strength', 'accessory']::text[], 'metabolic', 'low', NULL, 'low'),

-- Row 105
('Single-Leg Banded Kettlebell Suitcase Hold', 'core', ARRAY['glutes', 'obliques']::text[], ARRAY['ankles', 'hips']::text[], 'core', 'stability', ARRAY['unilateral', 'balance_challenge', 'anti_rotation']::text[], ARRAY['secondary_strength', 'core', 'capacity']::text[], 'moderate_local', 'moderate', ARRAY['kettlebell']::text[], 'moderate'),

-- Row 106
('Single-Leg Calf Raise', 'calves', NULL, ARRAY['ankles']::text[], 'leg_isolation', 'strength', ARRAY['unilateral', 'balance_challenge']::text[], ARRAY['accessory']::text[], 'moderate_local', 'low', NULL, 'moderate'),

-- Row 107
('Banded Side Plank Clamshell', 'abductors', ARRAY['glutes', 'obliques']::text[], NULL, 'core', 'core', ARRAY['core_stability', 'hip_stability', 'anti_rotation', 'rehab_friendly']::text[], ARRAY['accessory', 'core']::text[], 'moderate_local', 'moderate', ARRAY['bands']::text[], 'moderate'),

-- Row 108
('Single-Arm Kettlebell Overhead Press', 'shoulders', ARRAY['triceps', 'core']::text[], ARRAY['shoulders']::text[], 'vertical_push', 'strength', ARRAY['unilateral', 'postural_control', 'anti_rotation']::text[], ARRAY['secondary_strength']::text[], 'moderate_local', 'moderate', ARRAY['kettlebell']::text[], 'moderate'),

-- Row 109
('Hanging Knee Raise', 'core', ARRAY['glutes']::text[], NULL, 'core', 'core', ARRAY['core_stability', 'hip_dominant']::text[], ARRAY['core']::text[], 'moderate_local', 'low', ARRAY['pull_up_bar']::text[], 'low'),

-- Row 110
('Diamond Push-Ups', 'triceps', ARRAY['chest', 'shoulders']::text[], ARRAY['shoulders']::text[], 'horizontal_push', 'strength', ARRAY['bilateral', 'scapular_control']::text[], ARRAY['secondary_strength']::text[], 'moderate_local', 'low', NULL, 'moderate'),

-- Row 111
('BOSU Bird Dog', 'core', ARRAY['glutes', 'shoulders']::text[], NULL, 'core', 'stability', ARRAY['balance_challenge', 'core_stability']::text[], ARRAY['secondary_strength', 'core']::text[], 'moderate_local', 'moderate', ARRAY['bosu_ball']::text[], 'moderate'),

-- Row 112
('Plank', 'core', ARRAY['shoulders']::text[], NULL, 'core', 'core', ARRAY['isometric_control', 'core_stability', 'rehab_friendly', 'warmup_friendly']::text[], ARRAY['core']::text[], 'low_local', 'very_low', NULL, 'low'),

-- Row 113
('Renegade Row', 'lats', ARRAY['core', 'biceps']::text[], ARRAY['shoulders']::text[], 'horizontal_pull', 'core', ARRAY['unilateral', 'anti_rotation', 'core_stability']::text[], ARRAY['secondary_strength', 'core', 'capacity']::text[], 'moderate_systemic', 'moderate', ARRAY['dumbbells']::text[], 'moderate'),

-- Row 114
('Pendlay Row', 'lats', ARRAY['upper_back', 'biceps']::text[], NULL, 'horizontal_pull', 'strength', ARRAY['bilateral', 'scapular_control', 'foundational']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_local', 'moderate', ARRAY['barbell']::text[], 'moderate'),

-- Row 115
('Twisting Pistons', 'core', ARRAY['obliques', 'shoulders']::text[], NULL, 'core', 'conditioning', ARRAY['rotational', 'core_stability', 'finisher_friendly']::text[], ARRAY['core', 'capacity']::text[], 'metabolic', 'moderate', NULL, 'moderate'),

-- Row 116
('Pistol Squat', 'quads', ARRAY['glutes', 'hamstrings']::text[], ARRAY['knees', 'ankles']::text[], 'squat', 'strength', ARRAY['unilateral', 'balance_challenge', 'knee_dominant']::text[], ARRAY['secondary_strength']::text[], 'moderate_systemic', 'high', ARRAY['dumbbells']::text[], 'high'),

-- Row 117
('Dumbbell Shrugs', 'traps', NULL, NULL, 'shoulder_isolation', 'strength', ARRAY['bilateral', 'scapular_control']::text[], ARRAY['accessory']::text[], 'moderate_local', 'very_low', ARRAY['dumbbells']::text[], 'low'),

-- Row 118
('Upright Row', 'traps', ARRAY['delts', 'biceps']::text[], ARRAY['shoulders']::text[], 'vertical_pull', 'strength', ARRAY['bilateral', 'scapular_control']::text[], ARRAY['accessory']::text[], 'moderate_local', 'low', ARRAY['dumbbells']::text[], 'low'),

-- Row 119
('Dumbbell Bridge Chest Press', 'chest', ARRAY['triceps', 'core']::text[], ARRAY['shoulders']::text[], 'horizontal_push', 'strength', ARRAY['bilateral', 'postural_control']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_systemic', 'low', ARRAY['dumbbells']::text[], 'low'),

-- Row 120
('Spanish Lunge', 'quads', ARRAY['glutes', 'hamstrings']::text[], ARRAY['hips', 'knees']::text[], 'lunge', 'mobility', ARRAY['unilateral', 'hip_stability', 'rehab_friendly']::text[], ARRAY['secondary_strength']::text[], 'low_local', 'low', ARRAY['bands']::text[], 'low'),

-- Row 121
('Cross Cable Rear Delt Fly', 'delts', ARRAY['traps', 'upper_back']::text[], ARRAY['shoulders']::text[], 'shoulder_isolation', 'strength', ARRAY['scapular_control', 'bilateral']::text[], ARRAY['accessory']::text[], 'moderate_local', 'moderate', ARRAY['cable_machine']::text[], 'low'),

-- Row 122
('Swiss Ball Plank on Bench', 'core', ARRAY['shoulders']::text[], NULL, 'core', 'core', ARRAY['core_stability', 'isometric_control', 'balance_challenge', 'rehab_friendly']::text[], ARRAY['core']::text[], 'moderate_local', 'moderate', ARRAY['swiss_ball']::text[], 'moderate'),

-- Row 123
('Hollow Body Hold', 'core', ARRAY['glutes']::text[], NULL, 'core', 'core', ARRAY['core_stability', 'isometric_control', 'warmup_friendly']::text[], ARRAY['core']::text[], 'moderate_local', 'moderate', NULL, 'moderate'),

-- Row 124
('Plank Shoulder Taps', 'core', ARRAY['shoulders', 'obliques']::text[], ARRAY['shoulders']::text[], 'core', 'core', ARRAY['anti_rotation', 'core_stability', 'postural_control', 'warmup_friendly']::text[], ARRAY['core']::text[], 'moderate_local', 'moderate', NULL, 'low'),

-- Row 125
('Landmine Explosive Press', 'shoulders', ARRAY['triceps', 'core']::text[], ARRAY['shoulders']::text[], 'vertical_push', 'power', ARRAY['explosive', 'postural_control']::text[], ARRAY['secondary_strength', 'capacity']::text[], 'moderate_systemic', 'high', ARRAY['barbell', 'landmine']::text[], 'moderate'),

-- Row 126
('Cable Rear Deadlift', 'hamstrings', ARRAY['glutes', 'lower_back']::text[], ARRAY['hips']::text[], 'hinge', 'strength', ARRAY['hip_dominant', 'postural_control']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'moderate_systemic', 'moderate', ARRAY['cable_machine']::text[], 'low'),

-- Row 127
('Upside-Down Kettlebell Press (single arm)', 'shoulders', ARRAY['triceps', 'core']::text[], ARRAY['shoulders', 'wrists']::text[], 'vertical_push', 'stability', ARRAY['unilateral', 'postural_control', 'scapular_control']::text[], ARRAY['secondary_strength']::text[], 'moderate_local', 'moderate', ARRAY['kettlebell']::text[], 'moderate'),

-- Row 128
('Banded Suitcase Marches', 'core', ARRAY['glutes', 'obliques']::text[], ARRAY['hips']::text[], 'carry', 'stability', ARRAY['anti_rotation', 'postural_control', 'balance_challenge', 'warmup_friendly']::text[], ARRAY['core', 'capacity']::text[], 'moderate_local', 'moderate', ARRAY['bands', 'dumbbells']::text[], 'low'),

-- Row 129
('Barbell Reverse Lunges', 'quads', ARRAY['glutes', 'hamstrings']::text[], ARRAY['knees', 'hips']::text[], 'lunge', 'strength', ARRAY['unilateral', 'knee_dominant', 'hip_stability', 'foundational']::text[], ARRAY['primary_strength', 'secondary_strength']::text[], 'high_systemic', 'moderate', ARRAY['barbell']::text[], 'moderate'),

-- Row 130
('Kettlebell Swings', 'glutes', ARRAY['hamstrings', 'core']::text[], ARRAY['hips', 'shoulders']::text[], 'hinge', 'power', ARRAY['hip_dominant', 'explosive', 'postural_control', 'foundational']::text[], ARRAY['secondary_strength', 'capacity']::text[], 'moderate_systemic', 'moderate', ARRAY['kettlebell']::text[], 'moderate');