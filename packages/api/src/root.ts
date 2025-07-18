import { authRouter } from "./router/auth";
import { businessRouter } from "./router/business";
import { exerciseRouter } from "./router/exercise";
import { trainingSessionRouter } from "./router/training-session";
import { workoutRouter } from "./router/workout";
import { messagesRouter } from "./routers/messages";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  business: businessRouter,
  exercise: exerciseRouter,
  trainingSession: trainingSessionRouter,
  workout: workoutRouter,
  messages: messagesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
