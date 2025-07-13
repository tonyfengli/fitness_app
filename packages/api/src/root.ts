import { authRouter } from "./router/auth";
import { businessRouter } from "./router/business";
import { exerciseRouter } from "./router/exercise";
import { postRouter } from "./router/post";
import { trainingSessionRouter } from "./router/training-session";
import { workoutRouter } from "./router/workout";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  business: businessRouter,
  post: postRouter,
  exercise: exerciseRouter,
  trainingSession: trainingSessionRouter,
  workout: workoutRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
