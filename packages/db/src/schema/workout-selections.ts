import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { user } from "../auth-schema";
import { exercises } from "../exercise";
import { TrainingSession } from "../schema";

// Removed workoutExerciseSelections - functionality moved to workout_exercise table

export const workoutExerciseSwaps = pgTable("workout_exercise_swaps", {
  id: uuid("id").primaryKey().defaultRandom(),
  trainingSessionId: uuid("training_session_id")
    .notNull()
    .references(() => TrainingSession.id),
  clientId: text("client_id")
    .notNull()
    .references(() => user.id),
  originalExerciseId: uuid("original_exercise_id")
    .notNull()
    .references(() => exercises.id),
  newExerciseId: uuid("new_exercise_id")
    .notNull()
    .references(() => exercises.id),
  swapReason: varchar("swap_reason", { length: 255 }),
  swappedAt: timestamp("swapped_at").defaultNow(),
  swappedBy: text("swapped_by")
    .notNull()
    .references(() => user.id),
});
