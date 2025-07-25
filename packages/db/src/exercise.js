"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exercises = exports.strengthLevelEnum = exports.complexityLevelEnum = exports.fatigueProfileEnum = exports.modalityEnum = exports.movementPatternEnum = exports.primaryMuscleEnum = exports.exerciseTypeEnum = void 0;
var pg_core_1 = require("drizzle-orm/pg-core");
exports.exerciseTypeEnum = (0, pg_core_1.pgEnum)("exercise_type", [
    "squat",
    "lunge",
    "bench_press",
    "pull_up",
    "deadlift",
    "row",
    "press",
    "curl",
    "fly",
    "plank",
    "carry",
    "raise",
    "extension",
    "push_up",
    "dip",
    "shrug",
    "bridge",
    "step_up",
    "calf_raise",
    "crunch",
    "leg_raise",
    "pulldown",
    "pullover",
    "kickback",
    "thruster",
    "clean",
    "snatch",
    "swing",
    "turkish_get_up",
    "other"
]);
exports.primaryMuscleEnum = (0, pg_core_1.pgEnum)("primary_muscle", [
    "glutes",
    "quads",
    "hamstrings",
    "calves",
    "adductors",
    "abductors",
    "core",
    "lower_abs",
    "upper_abs",
    "obliques",
    "chest",
    "upper_chest",
    "lower_chest",
    "lats",
    "traps",
    "biceps",
    "triceps",
    "shoulders",
    "delts",
    "upper_back",
    "lower_back",
    "shins",
    "tibialis_anterior"
]);
exports.movementPatternEnum = (0, pg_core_1.pgEnum)("movement_pattern", [
    "horizontal_push",
    "horizontal_pull",
    "vertical_push",
    "vertical_pull",
    "shoulder_isolation",
    "arm_isolation",
    "leg_isolation",
    "squat",
    "lunge",
    "hinge",
    "carry",
    "core"
]);
exports.modalityEnum = (0, pg_core_1.pgEnum)("modality", [
    "strength",
    "stability",
    "core",
    "power",
    "conditioning",
    "mobility"
]);
exports.fatigueProfileEnum = (0, pg_core_1.pgEnum)("fatigue_profile", [
    "low_local",
    "moderate_local",
    "high_local",
    "moderate_systemic",
    "high_systemic",
    "metabolic"
]);
exports.complexityLevelEnum = (0, pg_core_1.pgEnum)("complexity_level", [
    "very_low",
    "low",
    "moderate",
    "high"
]);
exports.strengthLevelEnum = (0, pg_core_1.pgEnum)("strength_level", [
    "very_low",
    "low",
    "moderate",
    "high"
]);
exports.exercises = (0, pg_core_1.pgTable)("exercises", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    exerciseType: (0, exports.exerciseTypeEnum)("exercise_type"),
    primaryMuscle: (0, exports.primaryMuscleEnum)("primary_muscle").notNull(),
    secondaryMuscles: (0, pg_core_1.text)("secondary_muscles", {
        enum: [
            "glutes",
            "quads",
            "hamstrings",
            "calves",
            "adductors",
            "abductors",
            "core",
            "lower_abs",
            "upper_abs",
            "obliques",
            "chest",
            "upper_chest",
            "lower_chest",
            "lats",
            "traps",
            "biceps",
            "triceps",
            "shoulders",
            "delts",
            "upper_back",
            "lower_back",
            "shins",
            "tibialis_anterior"
        ]
    }).array(),
    loadedJoints: (0, pg_core_1.text)("loaded_joints", {
        enum: [
            "ankles",
            "knees",
            "hips",
            "shoulders",
            "elbows",
            "wrists",
            "neck",
            "lower_back",
            "spine",
            "sacroiliac_joint",
            "patella",
            "rotator_cuff"
        ]
    }).array(),
    movementPattern: (0, exports.movementPatternEnum)("movement_pattern").notNull(),
    modality: (0, exports.modalityEnum)("modality").notNull(),
    movementTags: (0, pg_core_1.text)("movement_tags", {
        enum: [
            "bilateral",
            "unilateral",
            "scapular_control",
            "core_stability",
            "postural_control",
            "hip_dominant",
            "knee_dominant",
            "balance_challenge",
            "isometric_control",
            "anti_rotation",
            "end_range_control",
            "hip_stability",
            "explosive",
            "rotational",
            "cross_plane",
            "foundational",
            "rehab_friendly",
            "warmup_friendly",
            "finisher_friendly",
            "mobility_focus"
        ]
    }).array(),
    functionTags: (0, pg_core_1.text)("function_tags", {
        enum: [
            "primary_strength",
            "secondary_strength",
            "accessory",
            "core",
            "capacity"
        ]
    }).array(),
    fatigueProfile: (0, exports.fatigueProfileEnum)("fatigue_profile").notNull(),
    complexityLevel: (0, exports.complexityLevelEnum)("complexity_level").notNull(),
    equipment: (0, pg_core_1.text)("equipment", {
        enum: [
            "barbell",
            "dumbbells",
            "bench",
            "landmine",
            "trx",
            "kettlebell",
            "cable_machine",
            "bands",
            "bosu_ball",
            "swiss_ball",
            "platform",
            "pull_up_bar",
            "back_machine",
            "ab_wheel",
            "box",
            "med_ball"
        ]
    }).array(),
    strengthLevel: (0, exports.strengthLevelEnum)("strength_level").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
