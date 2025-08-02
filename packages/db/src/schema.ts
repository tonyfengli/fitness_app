import { sql } from "drizzle-orm";
import { pgTable, pgEnum, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { user, account } from "./auth-schema";

export * from "./auth-schema";
export * from "./exercise";
export * from "./schema/messages";
export * from "./schema/conversation-state";
export * from "./types/exerciseRatings";
import { exercises } from "./exercise";

export const Business = pgTable("business", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  name: t.varchar({ length: 255 }).notNull(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const CreateBusinessSchema = createInsertSchema(Business, {
  name: z.string().min(1).max(255),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const BusinessExercise = pgTable("business_exercise", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  businessId: t.uuid().notNull().references(() => Business.id, { onDelete: "cascade" }),
  exerciseId: t.uuid().notNull().references(() => exercises.id, { onDelete: "cascade" }),
  createdAt: t.timestamp().defaultNow().notNull(),
}));

export const CreateBusinessExerciseSchema = createInsertSchema(BusinessExercise, {
  businessId: z.string().uuid(),
  exerciseId: z.string().uuid(),
}).omit({
  id: true,
  createdAt: true,
});

// User Profile table for workout-specific data
export const UserProfile = pgTable("user_profile", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t.text().notNull().references(() => user.id, { onDelete: "cascade" }),
  businessId: t.uuid().notNull().references(() => Business.id, { onDelete: "cascade" }),
  // Client fitness levels
  strengthLevel: t.text().notNull().default('moderate'), // 'very_low', 'low', 'moderate', 'high'
  skillLevel: t.text().notNull().default('moderate'), // 'very_low', 'low', 'moderate', 'high'
  // Default workout parameters
  defaultSets: t.integer().notNull().default(20), // Default number of sets for this client
  // Additional profile fields can be added here
  notes: t.text(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const CreateUserProfileSchema = createInsertSchema(UserProfile, {
  userId: z.string(),
  businessId: z.string().uuid(),
  strengthLevel: z.enum(["very_low", "low", "moderate", "high"]).default("moderate"),
  skillLevel: z.enum(["very_low", "low", "moderate", "high"]).default("moderate"),
  defaultSets: z.number().int().min(10).max(40).default(20),
  notes: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Training Sessions (scheduled appointments)
// Session status enum
export const sessionStatusEnum = pgEnum("session_status", [
  "open",
  "in_progress", 
  "completed",
  "cancelled"
]);

export const TrainingSession = pgTable("training_session", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  businessId: t.uuid().notNull().references(() => Business.id, { onDelete: "cascade" }),
  trainerId: t.text().notNull().references(() => user.id),
  name: t.varchar({ length: 255 }).notNull(),
  scheduledAt: t.timestamp().notNull(),
  durationMinutes: t.integer(),
  maxParticipants: t.integer(), // null = unlimited
  status: sessionStatusEnum("status").notNull().default("open"),
  templateType: t.varchar({ length: 50 }).default("full_body_bmf"), // workout template type
  templateConfig: t.jsonb(), // Stores group workout blueprint and other template configuration
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const CreateTrainingSessionSchema = createInsertSchema(TrainingSession, {
  businessId: z.string().uuid(),
  trainerId: z.string(),
  name: z.string().min(1).max(255),
  scheduledAt: z.date(),
  durationMinutes: z.number().int().positive().optional(),
  maxParticipants: z.number().int().positive().optional(),
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional().default("open"),
  templateType: z.string().max(50).optional().default("full_body_bmf"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Users registered for training sessions
export const UserTrainingSession = pgTable("user_training_session", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t.text().notNull().references(() => user.id, { onDelete: "cascade" }),
  trainingSessionId: t.uuid().notNull().references(() => TrainingSession.id, { onDelete: "cascade" }),
  status: t.text().notNull().default("registered"), // "registered", "checked_in", "completed", "no_show"
  checkedInAt: t.timestamp(), // When the user checked in
  preferenceCollectionStep: t.text().notNull().default("not_started"), // 'not_started', 'initial_collected', 'disambiguation_pending', 'disambiguation_clarifying', 'disambiguation_resolved', 'followup_sent', 'preferences_active'
  createdAt: t.timestamp().defaultNow().notNull(),
}));

export const CreateUserTrainingSessionSchema = createInsertSchema(UserTrainingSession, {
  userId: z.string(),
  trainingSessionId: z.string().uuid(),
  status: z.enum(["registered", "checked_in", "completed", "no_show"]).default("registered"),
  checkedInAt: z.date().optional(),
  preferenceCollectionStep: z.enum(["not_started", "initial_collected", "disambiguation_pending", "disambiguation_clarifying", "disambiguation_resolved", "followup_sent", "preferences_active"]).default("not_started"),
}).omit({
  id: true,
  createdAt: true,
});

// Workout preferences collected from users
export const WorkoutPreferences = pgTable("workout_preferences", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t.text().notNull().references(() => user.id, { onDelete: "cascade" }),
  trainingSessionId: t.uuid().notNull().references(() => TrainingSession.id, { onDelete: "cascade" }),
  businessId: t.uuid().notNull().references(() => Business.id, { onDelete: "cascade" }),
  
  // Workout parameters
  intensity: t.text(), // 'low', 'moderate', 'high'
  muscleTargets: t.text().array(), // Array of muscle groups to target
  muscleLessens: t.text().array(), // Array of muscles to avoid
  
  // Exercise filtering (matches workout engine architecture naming)
  includeExercises: t.text().array(), // Exercises to include (overrides other filters)
  avoidExercises: t.text().array(), // Exercises to exclude (final filter)
  avoidJoints: t.text().array(), // Joints to avoid loading
  
  // Session goal
  sessionGoal: t.text(), // 'strength', 'stability', etc.
  
  // Workout type for group workouts
  workoutType: t.text(), // 'full_body_with_finisher', 'full_body_without_finisher', 'targeted_with_finisher', 'targeted_without_finisher'
  
  // Additional notes
  notes: t.text().array(), // Array of additional notes/preferences
  
  // Source tracking for fields (to differentiate explicit, default, inherited)
  intensitySource: t.text().default('default'), // 'explicit', 'default', 'inherited'
  sessionGoalSource: t.text().default('default'), // 'explicit', 'default', 'inherited'
  
  // Collection metadata
  collectedAt: t.timestamp().defaultNow().notNull(),
  collectionMethod: t.text().notNull().default('sms'), // 'sms', 'web', 'manual'
}), (table) => ({
  // Unique constraint: one preference per user per training session
  userSessionUnique: unique().on(table.userId, table.trainingSessionId),
}));

export const CreateWorkoutPreferencesSchema = createInsertSchema(WorkoutPreferences, {
  userId: z.string(),
  trainingSessionId: z.string().uuid(),
  businessId: z.string().uuid(),
  intensity: z.enum(["low", "moderate", "high", "intense"]).optional(),
  muscleTargets: z.array(z.string()).optional(),
  muscleLessens: z.array(z.string()).optional(),
  includeExercises: z.array(z.string()).optional(),
  avoidExercises: z.array(z.string()).optional(),
  avoidJoints: z.array(z.string()).optional(),
  sessionGoal: z.string().optional(),
  workoutType: z.enum(["full_body_with_finisher", "full_body_without_finisher", "targeted_with_finisher", "targeted_without_finisher"]).optional(),
  intensitySource: z.enum(["explicit", "default", "inherited"]).default("default"),
  sessionGoalSource: z.enum(["explicit", "default", "inherited"]).default("default"),
  collectionMethod: z.enum(["sms", "web", "manual"]).default("sms"),
}).omit({
  id: true,
  collectedAt: true,
});

// Actual workout data for a session
export const Workout = pgTable("workout", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  trainingSessionId: t.uuid().references(() => TrainingSession.id, { onDelete: "cascade" }), // Now optional
  userId: t.text().notNull().references(() => user.id, { onDelete: "cascade" }),
  completedAt: t.timestamp(), // Nullable - workouts aren't completed when created
  notes: t.text(),
  workoutType: t.text(), // workout type identifier
  totalPlannedSets: t.integer(), // Total sets the LLM planned
  llmOutput: t.jsonb(), // Raw LLM response for reference
  templateConfig: t.jsonb(), // Template-specific configuration
  context: t.text().notNull().default("individual"), // "group", "individual", "homework", "assessment"
  businessId: t.uuid().notNull().references(() => Business.id, { onDelete: "cascade" }), // Direct business reference
  createdByTrainerId: t.text().notNull().references(() => user.id), // Who created this workout
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const CreateWorkoutSchema = createInsertSchema(Workout, {
  trainingSessionId: z.string().uuid().optional(), // Now optional
  userId: z.string(),
  completedAt: z.date(),
  notes: z.string().optional(),
  workoutType: z.string().optional(),
  totalPlannedSets: z.number().int().positive().optional(),
  llmOutput: z.any().optional(), // JSON type
  templateConfig: z.any().optional(), // JSON type
  context: z.enum(["group", "individual", "homework", "assessment"]).default("individual"),
  businessId: z.string().uuid(),
  createdByTrainerId: z.string(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Exercises performed in a workout
export const WorkoutExercise = pgTable("workout_exercise", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  workoutId: t.uuid().notNull().references(() => Workout.id, { onDelete: "cascade" }),
  exerciseId: t.uuid().notNull().references(() => exercises.id),
  orderIndex: t.integer().notNull(),
  setsCompleted: t.integer().notNull(),
  groupName: t.text(), // "Block A", "Round 1", etc.
  createdAt: t.timestamp().defaultNow().notNull(),
}));

export const CreateWorkoutExerciseSchema = createInsertSchema(WorkoutExercise, {
  workoutId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  orderIndex: z.number().int().min(1),
  setsCompleted: z.number().int().min(1),
  groupName: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

// Create rating type enum
export const exerciseRatingTypeEnum = pgEnum("exercise_rating_type", ["favorite"]);

// User exercise ratings (simplified - just favorites for now)
export const UserExerciseRatings = pgTable("user_exercise_ratings", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t.text().notNull().references(() => user.id, { onDelete: "cascade" }),
  exerciseId: t.uuid().notNull().references(() => exercises.id, { onDelete: "cascade" }),
  businessId: t.uuid().notNull().references(() => Business.id, { onDelete: "cascade" }),
  ratingType: exerciseRatingTypeEnum("rating_type").notNull().default("favorite"),
}), (table) => ({
  // Unique constraint: one rating per user per exercise per business
  userExerciseBusinessUnique: unique().on(table.userId, table.exerciseId, table.businessId),
}));

export const CreateUserExerciseRatingsSchema = createInsertSchema(UserExerciseRatings, {
  userId: z.string(),
  exerciseId: z.string().uuid(),
  businessId: z.string().uuid(),
  ratingType: z.enum(['favorite']).default('favorite'),
}).omit({
  id: true,
});

// Export all relations from the relations file
export * from "../drizzle/relations";

// Re-export auth schema items
export { user, account } from "./auth-schema";
