import { authRouter } from "./router/auth";
import { businessRouter } from "./router/business";
import { circuitConfigRouter } from "./router/circuit-config";
import { exerciseRouter } from "./router/exercise";
import { muscleCoverageRouter } from "./router/muscle-coverage";
import { postWorkoutFeedbackRouter } from "./router/post-workout-feedback";
import { trainingSessionRouter } from "./router/training-session";
import { workoutRouter } from "./router/workout";
import { workoutPreferencesRouter } from "./router/workout-preferences";
import { workoutSelectionsRouter } from "./router/workout-selections";
import { messagesRouter } from "./routers/messages";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  business: businessRouter,
  circuitConfig: circuitConfigRouter,
  exercise: exerciseRouter,
  muscleCoverage: muscleCoverageRouter,
  postWorkoutFeedback: postWorkoutFeedbackRouter,
  trainingSession: trainingSessionRouter,
  workout: workoutRouter,
  workoutPreferences: workoutPreferencesRouter,
  workoutSelections: workoutSelectionsRouter,
  messages: messagesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
