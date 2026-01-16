import { authRouter } from "./router/auth";
import { businessRouter } from "./router/business";
import { circuitConfigRouter } from "./router/circuit-config";
import { clientsRouter } from "./router/clients";
import { exerciseRouter } from "./router/exercise";
import { lightingRouter } from "./router/lighting";
import { lightingConfigRouter } from "./router/lighting-config";
import { muscleCoverageRouter } from "./router/muscle-coverage";
import { musicRouter } from "./router/music";
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
  clients: clientsRouter,
  exercise: exerciseRouter,
  lighting: lightingRouter,
  lightingConfig: lightingConfigRouter,
  music: musicRouter,
  muscleCoverage: muscleCoverageRouter,
  postWorkoutFeedback: postWorkoutFeedbackRouter,
  trainingSession: trainingSessionRouter,
  workout: workoutRouter,
  workoutPreferences: workoutPreferencesRouter,
  workoutSelections: workoutSelectionsRouter,
  messages: messagesRouter,
} as any) as ReturnType<typeof createTRPCRouter>;

// export type definition of API
export type AppRouter = typeof appRouter;
