import { authRouter } from "./router/auth";
import { businessRouter } from "./router/business";
import { exerciseRouter } from "./router/exercise";
import { postRouter } from "./router/post";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  business: businessRouter,
  post: postRouter,
  exercise: exerciseRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
