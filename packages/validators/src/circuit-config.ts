import { z } from "zod";

// Define validation limits locally to avoid circular dependencies
const CIRCUIT_CONFIG_LIMITS = {
  rounds: { min: 1, max: 10 },
  exercisesPerRound: { min: 2, max: 7 },
  workDuration: { min: 10, max: 300 },      // 10 seconds to 5 minutes
  restDuration: { min: 5, max: 120 },       // 5 seconds to 2 minutes  
  restBetweenRounds: { min: 10, max: 300 }  // 10 seconds to 5 minutes
} as const;

/**
 * Zod schemas for circuit configuration validation
 */

// Individual field schemas with constraints
export const CircuitRoundsSchema = z
  .number()
  .int()
  .min(CIRCUIT_CONFIG_LIMITS.rounds.min)
  .max(CIRCUIT_CONFIG_LIMITS.rounds.max);

export const CircuitExercisesSchema = z
  .number()
  .int()
  .min(CIRCUIT_CONFIG_LIMITS.exercisesPerRound.min)
  .max(CIRCUIT_CONFIG_LIMITS.exercisesPerRound.max);

export const CircuitWorkDurationSchema = z
  .number()
  .int()
  .min(CIRCUIT_CONFIG_LIMITS.workDuration.min)
  .max(CIRCUIT_CONFIG_LIMITS.workDuration.max);

export const CircuitRestDurationSchema = z
  .number()
  .int()
  .min(CIRCUIT_CONFIG_LIMITS.restDuration.min)
  .max(CIRCUIT_CONFIG_LIMITS.restDuration.max);

export const CircuitRestBetweenRoundsSchema = z
  .number()
  .int()
  .min(CIRCUIT_CONFIG_LIMITS.restBetweenRounds.min)
  .max(CIRCUIT_CONFIG_LIMITS.restBetweenRounds.max);

// Complete circuit config schema
export const CircuitConfigSchema = z.object({
  type: z.literal('circuit'),
  config: z.object({
    rounds: CircuitRoundsSchema,
    exercisesPerRound: CircuitExercisesSchema,
    workDuration: CircuitWorkDurationSchema,
    restDuration: CircuitRestDurationSchema,
    restBetweenRounds: CircuitRestBetweenRoundsSchema,
    repeatRounds: z.boolean().optional().default(false),
  }),
  lastUpdated: z.string().optional(),
  updatedBy: z.string().optional(),
});

// Schema for updating circuit config (all fields optional)
export const UpdateCircuitConfigSchema = z.object({
  rounds: CircuitRoundsSchema.optional(),
  exercisesPerRound: CircuitExercisesSchema.optional(),
  workDuration: CircuitWorkDurationSchema.optional(),
  restDuration: CircuitRestDurationSchema.optional(),
  restBetweenRounds: CircuitRestBetweenRoundsSchema.optional(),
  repeatRounds: z.boolean().optional(),
});

// Input schema for TRPC endpoints
export const CircuitConfigInputSchema = z.object({
  sessionId: z.string().uuid(),
  config: UpdateCircuitConfigSchema,
});

export type CircuitConfig = z.infer<typeof CircuitConfigSchema>;
export type UpdateCircuitConfig = z.infer<typeof UpdateCircuitConfigSchema>;
export type CircuitConfigInput = z.infer<typeof CircuitConfigInputSchema>;