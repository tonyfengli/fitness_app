import { sql } from "drizzle-orm";

// Note: The btree_gist extension must be enabled in PostgreSQL for the overlap constraint
// Run: CREATE EXTENSION IF NOT EXISTS btree_gist;
import { pgEnum, pgTable, unique, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { user } from "./auth-schema";
import { exercises } from "./exercise";

export * from "./auth-schema";
export * from "./exercise";
export * from "./schema/messages";
export * from "./schema/conversation-state";
export * from "./schema/oauth-tokens";
export * from "./schema/workout-selections";
export * from "./types/exerciseRatings";
export * from "./schema/spotify-tracks";
export * from "./schema/music-tracks";

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
  businessId: t
    .uuid()
    .notNull()
    .references(() => Business.id, { onDelete: "cascade" }),
  exerciseId: t
    .uuid()
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  createdAt: t.timestamp().defaultNow().notNull(),
}));

export const CreateBusinessExerciseSchema = createInsertSchema(
  BusinessExercise,
  {
    businessId: z.string().uuid(),
    exerciseId: z.string().uuid(),
  },
).omit({
  id: true,
  createdAt: true,
});

// User Profile table for workout-specific data
export const UserProfile = pgTable("user_profile", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t
    .text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  businessId: t
    .uuid()
    .notNull()
    .references(() => Business.id, { onDelete: "cascade" }),
  // Client fitness levels
  strengthLevel: t.text().notNull().default("moderate"), // 'very_low', 'low', 'moderate', 'high'
  skillLevel: t.text().notNull().default("moderate"), // 'very_low', 'low', 'moderate', 'high'
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
  strengthLevel: z
    .enum(["very_low", "low", "moderate", "high"])
    .default("moderate"),
  skillLevel: z
    .enum(["very_low", "low", "moderate", "high"])
    .default("moderate"),
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
  "cancelled",
]);

export const TrainingSession = pgTable("training_session", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  businessId: t
    .uuid()
    .notNull()
    .references(() => Business.id, { onDelete: "cascade" }),
  trainerId: t
    .text()
    .notNull()
    .references(() => user.id),
  name: t.varchar({ length: 255 }).notNull(),
  scheduledAt: t.timestamp().notNull(),
  durationMinutes: t.integer(),
  maxParticipants: t.integer(), // null = unlimited
  status: sessionStatusEnum("status").notNull().default("open"),
  program: t.varchar({ length: 50 }).default("unassigned").$type<"h4h_5am" | "h4h_5pm" | "saturday_cg" | "monday_cg" | "coach_frank" | "coach_steph" | "coach_kyle" | "strength" | "unassigned">(), // Training program assignment
  templateType: t.varchar({ length: 50 }).default("full_body_bmf").$type<"full_body_bmf" | "standard" | "circuit">(), // workout template type
  templateConfig: t.jsonb(), // Stores group workout blueprint and other template configuration
  workoutOrganization: t.jsonb(), // Stores Phase 2 round organization from LLM
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
  status: z
    .enum(["open", "in_progress", "completed", "cancelled"])
    .optional()
    .default("open"),
  program: z.enum(["h4h_5am", "h4h_5pm", "saturday_cg", "monday_cg", "coach_frank", "coach_steph", "coach_kyle", "strength", "unassigned"]).optional().default("unassigned"),
  templateType: z.enum(["full_body_bmf", "standard", "circuit"]).optional().default("full_body_bmf"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Favorite sessions for templates
export const FavoriteSessions = pgTable("favorite_sessions", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  trainingSessionId: t
    .uuid()
    .notNull()
    .references(() => TrainingSession.id, { onDelete: "cascade" }),
  businessId: t
    .uuid()
    .notNull()
    .references(() => Business.id, { onDelete: "cascade" }),
  category: t.text().notNull(), // 'morning_sessions', 'evening_sessions', 'mens_fitness_connect', 'other'
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t.timestamp({ mode: "date", withTimezone: true }).$onUpdateFn(() => sql`now()`),
}));

export const CreateFavoriteSessionSchema = createInsertSchema(FavoriteSessions, {
  trainingSessionId: z.string().uuid(),
  businessId: z.string().uuid(),
  category: z.enum(["morning_sessions", "evening_sessions", "mens_fitness_connect", "other"]),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Users registered for training sessions
export const UserTrainingSession = pgTable("user_training_session", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t
    .text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  trainingSessionId: t
    .uuid()
    .notNull()
    .references(() => TrainingSession.id, { onDelete: "cascade" }),
  status: t.text().notNull().default("registered"), // "registered", "checked_in", "ready", "workout_ready", "completed", "no_show"
  checkedInAt: t.timestamp(), // When the user checked in
  preferenceCollectionStep: t.text().notNull().default("not_started"), // 'not_started', 'initial_collected', 'disambiguation_pending', 'disambiguation_clarifying', 'disambiguation_resolved', 'followup_sent', 'preferences_active'
  createdAt: t.timestamp().defaultNow().notNull(),
}));

export const CreateUserTrainingSessionSchema = createInsertSchema(
  UserTrainingSession,
  {
    userId: z.string(),
    trainingSessionId: z.string().uuid(),
    status: z
      .enum(["registered", "checked_in", "ready", "workout_ready", "completed", "no_show"])
      .default("registered"),
    checkedInAt: z.date().optional(),
    preferenceCollectionStep: z
      .enum([
        "not_started",
        "initial_collected",
        "disambiguation_pending",
        "disambiguation_clarifying",
        "disambiguation_resolved",
        "followup_sent",
        "preferences_active",
      ])
      .default("not_started"),
  },
).omit({
  id: true,
  createdAt: true,
});

// Workout preferences collected from users
export const WorkoutPreferences = pgTable(
  "workout_preferences",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    userId: t
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    trainingSessionId: t
      .uuid()
      .notNull()
      .references(() => TrainingSession.id, { onDelete: "cascade" }),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),

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
    intensitySource: t.text().default("default"), // 'explicit', 'default', 'inherited'
    sessionGoalSource: t.text().default("default"), // 'explicit', 'default', 'inherited'

    // Collection metadata
    collectedAt: t.timestamp().defaultNow().notNull(),
    collectionMethod: t.text().notNull().default("sms"), // 'sms', 'web', 'manual'
  }),
  (table) => ({
    // Unique constraint: one preference per user per training session
    userSessionUnique: unique().on(table.userId, table.trainingSessionId),
  }),
);

export const CreateWorkoutPreferencesSchema = createInsertSchema(
  WorkoutPreferences,
  {
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
    workoutType: z
      .enum([
        "full_body_with_finisher",
        "full_body_without_finisher",
        "full_body_without_finisher_with_core",
        "targeted_with_finisher",
        "targeted_without_finisher",
        "targeted_without_finisher_with_core",
        "targeted_with_finisher_with_core",
      ])
      .optional(),
    intensitySource: z
      .enum(["explicit", "default", "inherited"])
      .default("default"),
    sessionGoalSource: z
      .enum(["explicit", "default", "inherited"])
      .default("default"),
    collectionMethod: z.enum(["sms", "web", "manual"]).default("sms"),
  },
).omit({
  id: true,
  collectedAt: true,
});

// Actual workout data for a session
export const Workout = pgTable("workout", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  trainingSessionId: t
    .uuid()
    .references(() => TrainingSession.id, { onDelete: "cascade" }), // Now optional
  userId: t
    .text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  completedAt: t.timestamp(), // Nullable - workouts aren't completed when created
  notes: t.text(),
  workoutType: t.text(), // workout type identifier
  totalPlannedSets: t.integer(), // Total sets the LLM planned
  llmOutput: t.jsonb(), // Raw LLM response for reference
  templateConfig: t.jsonb(), // Template-specific configuration
  context: t.text().notNull().default("individual"), // "group", "individual", "homework", "assessment"
  businessId: t
    .uuid()
    .notNull()
    .references(() => Business.id, { onDelete: "cascade" }), // Direct business reference
  createdByTrainerId: t
    .text()
    .notNull()
    .references(() => user.id), // Who created this workout
  status: t.varchar("status", { length: 50 }).default("draft"), // 'draft', 'ready', 'completed'
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
  context: z
    .enum(["group", "individual", "homework", "assessment"])
    .default("individual"),
  businessId: z.string().uuid(),
  createdByTrainerId: z.string(),
  status: z.enum(["draft", "ready", "completed"]).default("draft"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Exercises performed in a workout
export const WorkoutExercise = pgTable("workout_exercise", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  workoutId: t
    .uuid()
    .notNull()
    .references(() => Workout.id, { onDelete: "cascade" }),
  exerciseId: t
    .uuid()
    .references(() => exercises.id),
  orderIndex: t.integer().notNull(),
  setsCompleted: t.integer().notNull(),
  repsPlanned: t.integer(),
  groupName: t.text(), // "Block A", "Round 1", etc.
  stationIndex: t.integer(), // For stations rounds - groups exercises within same station
  isShared: t.boolean().default(false),
  sharedWithClients: t.text("shared_with_clients").array(),
  selectionSource: t.varchar("selection_source", { length: 50 }), // 'llm_phase1', 'manual_swap', 'pre_assigned'
  phase: t.varchar("phase", { length: 50 }), // 'main_strength', 'accessory', 'core', 'power_conditioning'
  template: t.jsonb("template"), // { type: 'reps', sets: 3, reps: '8-10' } or { type: 'time', work: '30s', rest: '15s', rounds: 3 }
  custom_exercise: t
    .jsonb("custom_exercise")
    .$type<{
      customName?: string;
      originalExerciseId?: string;
    }>(), // Custom exercise data for overrides
  createdAt: t.timestamp().defaultNow().notNull(),
}));

export const CreateWorkoutExerciseSchema = createInsertSchema(WorkoutExercise, {
  workoutId: z.string().uuid(),
  exerciseId: z.string().uuid().nullable(),
  orderIndex: z.number().int().min(1),
  setsCompleted: z.number().int().min(1),
  repsPlanned: z.number().int().min(1).nullable().optional(),
  groupName: z.string().optional(),
  stationIndex: z.number().int().min(0).nullable().optional(),
  isShared: z.boolean().optional().default(false),
  sharedWithClients: z.array(z.string()).optional(),
  selectionSource: z
    .enum(["llm_phase1", "manual_swap", "pre_assigned"])
    .optional(),
  phase: z
    .enum(["main_strength", "accessory", "core", "power_conditioning"])
    .optional(),
  template: z
    .object({
      type: z.enum(["reps", "time"]),
      sets: z.number().optional(),
      reps: z.string().optional(),
      work: z.string().optional(),
      rest: z.string().optional(),
      rounds: z.number().optional(),
    })
    .optional(),
  custom_exercise: z.object({
    customName: z.string().optional(),
    originalExerciseId: z.string().optional(),
  }).optional(),
}).omit({
  id: true,
  createdAt: true,
});

// Create rating type enum
export const exerciseRatingTypeEnum = pgEnum("exercise_rating_type", [
  "favorite",
  "avoid",
  "maybe_later",
]);

// User exercise ratings - tracks favorites, avoid, and maybe later preferences
export const UserExerciseRatings = pgTable(
  "user_exercise_ratings",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    userId: t
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    exerciseId: t
      .uuid()
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id, { onDelete: "cascade" }),
    ratingType: exerciseRatingTypeEnum("rating_type").notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t.timestamp().notNull().defaultNow(),
  }),
  (table) => ({
    // Unique constraint: one rating per user per exercise per business
    userExerciseBusinessUnique: unique().on(
      table.userId,
      table.exerciseId,
      table.businessId,
    ),
  }),
);

export const CreateUserExerciseRatingsSchema = createInsertSchema(
  UserExerciseRatings,
  {
    userId: z.string(),
    exerciseId: z.string().uuid(),
    businessId: z.string().uuid(),
    ratingType: z.enum(["favorite", "avoid", "maybe_later"]),
  },
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Exercise performance log - tracks weight lifted for progressive overload
export const ExercisePerformanceLog = pgTable(
  "exercise_performance_log",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    userId: t
      .text()
      .notNull()
      .references(() => user.id),
    exerciseId: t
      .uuid()
      .notNull()
      .references(() => exercises.id),
    workoutId: t
      .uuid()
      .notNull()
      .references(() => Workout.id),
    workoutExerciseId: t
      .uuid()
      .notNull()
      .references(() => WorkoutExercise.id),
    businessId: t
      .uuid()
      .notNull()
      .references(() => Business.id),
    
    // Performance data
    weightLbs: numeric("weight_lbs", { precision: 6, scale: 2 }),
    setsCompleted: t.integer("sets_completed"),
    repsCompleted: t.integer("reps_completed").array(),
    
    // PR flags
    isWeightPr: t.boolean("is_weight_pr").default(false),
    previousBestWeightLbs: numeric("previous_best_weight_lbs", { precision: 6, scale: 2 }),
    
    // Metadata
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  (table) => ({
    userExerciseIdx: index("idx_user_exercise").on(table.userId, table.exerciseId),
  })
);

export const CreateExercisePerformanceLogSchema = createInsertSchema(
  ExercisePerformanceLog,
  {
    userId: z.string(),
    exerciseId: z.string().uuid(),
    workoutId: z.string().uuid(),
    workoutExerciseId: z.string().uuid(),
    businessId: z.string().uuid(),
    weightLbs: z.number().positive().optional(),
    setsCompleted: z.number().int().positive().optional(),
    repsCompleted: z.array(z.number().int().positive()).optional(),
    isWeightPr: z.boolean().optional(),
    previousBestWeightLbs: z.number().positive().optional(),
  }
).omit({
  id: true,
  createdAt: true,
});

// Training packages - subscription tiers for gym members
export const TrainingPackage = pgTable("training_package", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  businessId: t
    .uuid()
    .notNull()
    .references(() => Business.id, { onDelete: "cascade" }),
  name: t.varchar({ length: 255 }).notNull(), // e.g., "1x Weekly", "2x Weekly", "3x Weekly"
  sessionsPerWeek: t.integer().notNull(), // 1, 2, or 3
  monthlyPrice: numeric("monthly_price", { precision: 10, scale: 2 }).notNull(),
  isActive: t.boolean().notNull().default(true),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const CreateTrainingPackageSchema = createInsertSchema(TrainingPackage, {
  businessId: z.string().uuid(),
  name: z.string().min(1).max(255),
  sessionsPerWeek: z.number().int().min(1).max(7),
  monthlyPrice: z.string().regex(/^\d+(\.\d{2})?$/), // String format for decimal
  isActive: z.boolean().default(true),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// User's active training package subscription
export const UserTrainingPackage = pgTable("user_training_package", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t
    .text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  trainingPackageId: t
    .uuid()
    .notNull()
    .references(() => TrainingPackage.id),
  startDate: t.date().notNull(),
  endDate: t.date().notNull(),
  status: t.text().notNull().default("active"), // 'active', 'expired', 'cancelled'
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const CreateUserTrainingPackageSchema = createInsertSchema(UserTrainingPackage, {
  userId: z.string(),
  trainingPackageId: z.string().uuid(),
  startDate: z.date(),
  endDate: z.date(),
  status: z.enum(["active", "expired", "cancelled"]).default("active"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for changing a user's package with custom transition date
export const ChangeUserPackageSchema = z.object({
  userId: z.string(),
  newPackageId: z.string().uuid(),
  transitionDate: z.date(),
  newEndDate: z.date(),
}).refine((data) => data.transitionDate < data.newEndDate, {
  message: "Transition date must be before the new package end date",
  path: ["transitionDate"],
});

// Export all relations from the relations file
export * from "../drizzle/relations";

// Re-export auth schema items
export { user, account } from "./auth-schema";

// Re-export workout selections schema items (only swaps now)
export { workoutExerciseSwaps } from "./schema/workout-selections";

// ============================================================================
// KPI MONTHLY SNAPSHOTS - Finalized monthly KPI data for agent queries
// ============================================================================

export const kpiSnapshotStatusEnum = pgEnum("kpi_snapshot_status", [
  "draft",
  "finalized",
]);

export const KpiMonthlySnapshot = pgTable(
  "kpi_monthly_snapshot",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    month: t.integer().notNull(), // 1-12
    year: t.integer().notNull(), // e.g., 2026
    status: kpiSnapshotStatusEnum("status").notNull().default("draft"),
    finalizedAt: t.timestamp({ mode: "date", withTimezone: true }),

    // Full KPI data as JSONB - includes payingMembers[], newMembers[], lostMembers[], revenue, ARM, etc.
    data: t.jsonb().notNull().$type<{
      month: string;
      year: number;
      monthKey: string;

      // Revenue
      totalRevenue: number;
      ptRevenue: number;
      smallGroupRevenue: number;
      openGymRevenue: number;
      arm: number;
      armGroups: number;

      // Membership totals
      totalMembers: number;
      groupMembers: number;

      // Member lists with details
      payingMembers: Array<{ memberId: string; name: string; revenue: number }>;
      newMembers: Array<{ memberId: string; name: string; revenue: number }>;
      lostMembers: Array<{ memberId: string; name: string; revenue: number; type: "loss" | "hold" }>;
      onHoldMembers: Array<{ memberId: string; name: string; revenue: number }>;

      // Counts
      newMembersCount: number;
      newMembersRevenue: number;
      lostMembersCount: number;
      lostMembersRevenue: number;
      onHoldCount: number;
      onHoldRevenue: number;
    }>(),

    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => ({
    // Unique constraint: one snapshot per month/year
    monthYearUnique: unique().on(table.month, table.year),
  })
);

export const CreateKpiMonthlySnapshotSchema = createInsertSchema(KpiMonthlySnapshot, {
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  status: z.enum(["draft", "finalized"]).default("draft"),
  finalizedAt: z.date().optional(),
  data: z.object({
    month: z.string(),
    year: z.number(),
    monthKey: z.string(),
    totalRevenue: z.number(),
    ptRevenue: z.number(),
    smallGroupRevenue: z.number(),
    openGymRevenue: z.number(),
    arm: z.number(),
    armGroups: z.number(),
    totalMembers: z.number(),
    groupMembers: z.number(),
    payingMembers: z.array(z.object({ memberId: z.string(), name: z.string(), revenue: z.number() })),
    newMembers: z.array(z.object({ memberId: z.string(), name: z.string(), revenue: z.number() })),
    lostMembers: z.array(z.object({ memberId: z.string(), name: z.string(), revenue: z.number(), type: z.enum(["loss", "hold"]) })),
    onHoldMembers: z.array(z.object({ memberId: z.string(), name: z.string(), revenue: z.number() })),
    newMembersCount: z.number(),
    newMembersRevenue: z.number(),
    lostMembersCount: z.number(),
    lostMembersRevenue: z.number(),
    onHoldCount: z.number(),
    onHoldRevenue: z.number(),
  }),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// KPI MEMBER OVERRIDES - Exclusions for KPI calculations
// ============================================================================

export const kpiOverrideTypeEnum = pgEnum("kpi_override_type", [
  "exclude_from_new",
  "exclude_from_lost",
  "exclude_from_at_risk",
]);

export const KpiMemberOverride = pgTable(
  "kpi_member_override",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    month: t.integer().notNull(), // 1-12
    year: t.integer().notNull(), // e.g., 2026
    memberId: t.varchar({ length: 50 }).notNull(), // GymMaster member ID
    overrideType: kpiOverrideTypeEnum("override_type").notNull(),
    reason: t.text(), // Optional reason for the override
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  (table) => ({
    // Unique constraint: one override per member/month/year/type
    memberMonthTypeUnique: unique().on(table.memberId, table.month, table.year, table.overrideType),
  })
);

export const CreateKpiMemberOverrideSchema = createInsertSchema(KpiMemberOverride, {
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  memberId: z.string().min(1).max(50),
  overrideType: z.enum(["exclude_from_new", "exclude_from_lost", "exclude_from_at_risk"]),
  reason: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

// ============================================================================
// RETENTION EVENTS - Track retention activities and outcomes
// ============================================================================

export const retentionEventTypeEnum = pgEnum("retention_event_type", [
  "flagged_at_risk",    // Member flagged as at-risk
  "outreach_sent",      // Outreach message sent to member
  "returned",           // Member returned after being at-risk
  "churned",            // Member churned (cancelled or went on hold)
]);

export const RetentionEvent = pgTable(
  "retention_event",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    memberId: t.varchar({ length: 50 }).notNull(), // GymMaster member ID
    memberName: t.varchar({ length: 255 }).notNull(),
    eventType: retentionEventTypeEnum("event_type").notNull(),
    eventDate: t.date().notNull(),

    // Context for the event
    atRiskTier: t.varchar({ length: 50 }), // "Best odds", "Fading", "Long shot", "Critical"
    daysGone: t.integer(), // Days since last attendance when flagged
    monthlyRevenue: numeric("monthly_revenue", { precision: 10, scale: 2 }), // Revenue at stake

    // Outreach details (for outreach_sent events)
    outreachMethod: t.varchar({ length: 50 }), // "sms", "email", "phone", "in_person"
    outreachMessage: t.text(), // Message sent or notes

    // Notes and metadata
    notes: t.text(),
    createdBy: t.varchar({ length: 100 }), // Who created this event (agent, staff name)
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  (table) => ({
    // Index for querying by member
    memberIdx: index("idx_retention_event_member").on(table.memberId),
    // Index for querying by event type and date
    eventTypeIdx: index("idx_retention_event_type_date").on(table.eventType, table.eventDate),
  })
);

export const CreateRetentionEventSchema = createInsertSchema(RetentionEvent, {
  memberId: z.string().min(1).max(50),
  memberName: z.string().min(1).max(255),
  eventType: z.enum(["flagged_at_risk", "outreach_sent", "returned", "churned"]),
  eventDate: z.string(), // YYYY-MM-DD format
  atRiskTier: z.string().optional(),
  daysGone: z.number().int().optional(),
  monthlyRevenue: z.string().optional(), // String for decimal
  outreachMethod: z.enum(["sms", "email", "phone", "in_person"]).optional(),
  outreachMessage: z.string().optional(),
  notes: z.string().optional(),
  createdBy: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});
