import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const primaryMuscleEnum = pgEnum("primary_muscle", [
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
export const movementPatternEnum = pgEnum("movement_pattern", [
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
export const modalityEnum = pgEnum("modality", [
  "strength",
  "stability",
  "core",
  "power",
  "conditioning",
  "mobility"
]);
export const fatigueProfileEnum = pgEnum("fatigue_profile", [
  "low_local",
  "moderate_local",
  "high_local",
  "moderate_systemic",
  "high_systemic",
  "metabolic"
]);
export const complexityLevelEnum = pgEnum("complexity_level", [
  "very_low",
  "low",
  "moderate",
  "high"
]);
export const strengthLevelEnum = pgEnum("strength_level", [
  "very_low",
  "low",
  "moderate",
  "high"
]);

export const exercises = pgTable("exercises", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  primaryMuscle: primaryMuscleEnum("primary_muscle").notNull(),
  secondaryMuscles: text("secondary_muscles", {
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
  loadedJoints: text("loaded_joints", {
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
  movementPattern: movementPatternEnum("movement_pattern").notNull(),
  modality: modalityEnum("modality").notNull(),
  movementTags: text("movement_tags", {
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
      "cross_plane"
    ]
  }).array(),
  functionTags: text("function_tags", {
    enum: [
      "foundational",
      "rehab_friendly",
      "warmup_friendly",
      "finisher_friendly",
      "mobility_focus"
    ]
  }).array(),
  fatigueProfile: fatigueProfileEnum("fatigue_profile").notNull(),
  complexityLevel: complexityLevelEnum("complexity_level").notNull(),
  equipment: text("equipment", {
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
  strengthLevel: strengthLevelEnum("strength_level").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});