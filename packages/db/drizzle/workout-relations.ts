import { relations } from "drizzle-orm/relations";
import { 
  Workout, 
  WorkoutExercise, 
  TrainingSession, 
  UserTrainingSession, 
  user,
  exercises,
  Business 
} from "../src/schema";

export const workoutRelations = relations(Workout, ({ one, many }) => ({
  trainingSession: one(TrainingSession, {
    fields: [Workout.trainingSessionId],
    references: [TrainingSession.id],
  }),
  user: one(user, {
    fields: [Workout.userId],
    references: [user.id],
  }),
  business: one(Business, {
    fields: [Workout.businessId],
    references: [Business.id],
  }),
  createdByTrainer: one(user, {
    fields: [Workout.createdByTrainerId],
    references: [user.id],
  }),
  exercises: many(WorkoutExercise),
}));

export const workoutExerciseRelations = relations(WorkoutExercise, ({ one }) => ({
  workout: one(Workout, {
    fields: [WorkoutExercise.workoutId],
    references: [Workout.id],
  }),
  exercise: one(exercises, {
    fields: [WorkoutExercise.exerciseId],
    references: [exercises.id],
  }),
}));

export const trainingSessionRelations = relations(TrainingSession, ({ one, many }) => ({
  business: one(Business, {
    fields: [TrainingSession.businessId],
    references: [Business.id],
  }),
  trainer: one(user, {
    fields: [TrainingSession.trainerId],
    references: [user.id],
  }),
  workouts: many(Workout),
  userSessions: many(UserTrainingSession),
}));

export const userTrainingSessionRelations = relations(UserTrainingSession, ({ one }) => ({
  user: one(user, {
    fields: [UserTrainingSession.userId],
    references: [user.id],
  }),
  trainingSession: one(TrainingSession, {
    fields: [UserTrainingSession.trainingSessionId],
    references: [TrainingSession.id],
  }),
}));