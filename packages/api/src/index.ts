import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./root";
import { appRouter } from "./root";
import { createTRPCContext } from "./trpc";

/**
 * Inference helpers for input types
 * @example
 * type PostByIdInput = RouterInputs['post']['byId']
 *      ^? { id: number }
 **/
type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helpers for output types
 * @example
 * type AllPostsOutput = RouterOutputs['post']['all']
 *      ^? Post[]
 **/
type RouterOutputs = inferRouterOutputs<AppRouter>;

export { createTRPCContext, appRouter };
export type { AppRouter, RouterInputs, RouterOutputs };

// Export services for SMS webhook
export { processCheckIn, setBroadcastFunction } from "./services/checkInService";
export { saveMessage } from "./services/messageService";
export { getUserByPhone } from "./services/userService";
export { twilioClient, normalizePhoneNumber } from "./services/twilio";
export { createLogger } from "./utils/logger";
export { WorkoutPreferenceService, setPreferenceBroadcastFunction } from "./services/workoutPreferenceService";
export { ExerciseValidationService } from "./services/exerciseValidationService";
export { ExerciseMatchingLLMService } from "./services/exerciseMatchingLLMService";

// Export new SMS handler components
export { SMSWebhookHandler } from "./services/sms";
