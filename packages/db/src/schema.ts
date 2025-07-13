import { sql } from "drizzle-orm";
import { pgTable } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { user } from "./auth-schema";

export const Post = pgTable("post", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  title: t.varchar({ length: 256 }).notNull(),
  content: t.text().notNull(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const CreatePostSchema = createInsertSchema(Post, {
  title: z.string().max(256),
  content: z.string().max(256),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export * from "./auth-schema";
export * from "./exercise";
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
  notes: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Training Sessions (scheduled appointments)
export const TrainingSession = pgTable("training_session", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  businessId: t.uuid().notNull().references(() => Business.id, { onDelete: "cascade" }),
  trainerId: t.text().notNull().references(() => user.id),
  name: t.varchar({ length: 255 }).notNull(),
  scheduledAt: t.timestamp().notNull(),
  durationMinutes: t.integer(),
  maxParticipants: t.integer(), // null = unlimited
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
  createdAt: t.timestamp().defaultNow().notNull(),
}));

export const CreateUserTrainingSessionSchema = createInsertSchema(UserTrainingSession, {
  userId: z.string(),
  trainingSessionId: z.string().uuid(),
}).omit({
  id: true,
  createdAt: true,
});

// Actual workout data for a session
export const Workout = pgTable("workout", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  trainingSessionId: t.uuid().notNull().references(() => TrainingSession.id, { onDelete: "cascade" }),
  userId: t.text().notNull().references(() => user.id),
  completedAt: t.timestamp().notNull(),
  notes: t.text(),
  workoutType: t.text(), // "standard", "circuit", "full_body", etc.
  totalPlannedSets: t.integer(), // Total sets the LLM planned
  llmOutput: t.jsonb(), // Raw LLM response for reference
  templateConfig: t.jsonb(), // Template-specific configuration
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const CreateWorkoutSchema = createInsertSchema(Workout, {
  trainingSessionId: z.string().uuid(),
  userId: z.string(),
  completedAt: z.date(),
  notes: z.string().optional(),
  workoutType: z.string().optional(),
  totalPlannedSets: z.number().int().positive().optional(),
  llmOutput: z.any().optional(), // JSON type
  templateConfig: z.any().optional(), // JSON type
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

// Export all relations from the relations file
export * from "../drizzle/relations";
