import { pgTable, uuid, varchar, boolean, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { TrainingSession } from "../schema";
import { user } from "../auth-schema";
import { exercises } from "../exercise";

export const workoutExerciseSelections = pgTable("workout_exercise_selections", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => TrainingSession.id),
  clientId: text("client_id").notNull().references(() => user.id),
  exerciseId: uuid("exercise_id").notNull().references(() => exercises.id),
  exerciseName: varchar("exercise_name", { length: 255 }).notNull(),
  isShared: boolean("is_shared").default(false),
  sharedWithClients: text("shared_with_clients").array(),
  selectionSource: varchar("selection_source", { length: 50 }), // 'llm_phase1', 'manual_swap'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueSessionClientExercise: unique().on(table.sessionId, table.clientId, table.exerciseId),
  sessionIdx: index().on(table.sessionId),
}));

export const workoutExerciseSwaps = pgTable("workout_exercise_swaps", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => TrainingSession.id),
  clientId: text("client_id").notNull().references(() => user.id),
  originalExerciseId: uuid("original_exercise_id").notNull().references(() => exercises.id),
  newExerciseId: uuid("new_exercise_id").notNull().references(() => exercises.id),
  swapReason: varchar("swap_reason", { length: 255 }),
  swappedAt: timestamp("swapped_at").defaultNow(),
  swappedBy: text("swapped_by").notNull().references(() => user.id),
});