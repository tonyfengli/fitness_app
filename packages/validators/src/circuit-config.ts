import { z } from "zod/v4";

// Define validation limits locally to avoid circular dependencies
const CIRCUIT_CONFIG_LIMITS = {
  rounds: { min: 0, max: 10 },
  exercisesPerRound: { min: 2, max: 10 },   // Default minimum for backwards compatibility
  workDuration: { min: 1 },                 // Minimum 1 second, no maximum
  restDuration: { min: 5, max: 120 },       // 5 seconds to 2 minutes  
  restBetweenRounds: { min: 10, max: 300 }  // 10 seconds to 5 minutes
} as const;

/**
 * Zod schemas for circuit configuration validation
 */

// Round template schemas
export const CircuitRoundTemplateSchema = z.object({
  type: z.literal('circuit_round'),
  exercisesPerRound: z.number().int().min(1).max(CIRCUIT_CONFIG_LIMITS.exercisesPerRound.max), // Allow 1 exercise for circuit rounds
  workDuration: z.number().int().min(CIRCUIT_CONFIG_LIMITS.workDuration.min),
  restDuration: z.number().int().min(0).max(CIRCUIT_CONFIG_LIMITS.restDuration.max),
  repeatTimes: z.number().int().min(1).max(5).default(1),
  restBetweenSets: z.number().int().min(5).max(CIRCUIT_CONFIG_LIMITS.restBetweenRounds.max).optional(),
});

// Station circuit configuration schema
export const StationCircuitConfigSchema = z.object({
  workDuration: z.number().int().min(CIRCUIT_CONFIG_LIMITS.workDuration.min),
  restDuration: z.number().int().min(0).max(CIRCUIT_CONFIG_LIMITS.restDuration.max),
  sets: z.number().int().min(2).max(10),
});

export const StationsRoundTemplateSchema = z.object({
  type: z.literal('stations_round'),
  exercisesPerRound: z.number().int().min(2).max(CIRCUIT_CONFIG_LIMITS.exercisesPerRound.max), // Stations require at least 2 exercises
  workDuration: z.number().int().min(CIRCUIT_CONFIG_LIMITS.workDuration.min),
  restDuration: z.number().int().min(CIRCUIT_CONFIG_LIMITS.restDuration.min).max(CIRCUIT_CONFIG_LIMITS.restDuration.max),
  repeatTimes: z.number().int().min(1).max(5).default(1),
  restBetweenSets: z.number().int().min(5).max(CIRCUIT_CONFIG_LIMITS.restBetweenRounds.max).optional(),
  stationCircuits: z.record(z.string().regex(/^\d+$/), StationCircuitConfigSchema).optional(),
});

export const AMRAPRoundTemplateSchema = z.object({
  type: z.literal('amrap_round'),
  exercisesPerRound: z.number().int().min(1).max(CIRCUIT_CONFIG_LIMITS.exercisesPerRound.max), // Allow 1 exercise for AMRAP rounds
  totalDuration: z.number().int().min(60), // Minimum 1 minute, no maximum
});


// Union for future round types
export const RoundTemplateSchema = z.discriminatedUnion('type', [
  CircuitRoundTemplateSchema,
  StationsRoundTemplateSchema,
  AMRAPRoundTemplateSchema,
  // Future: EMOMRoundTemplateSchema,
]);

// Music trigger schema for a specific phase
export const MusicTriggerSchema = z.object({
  enabled: z.boolean(),
  trackId: z.string().uuid().optional(),
  useStartTimestamp: z.boolean().optional(),
  energy: z.enum(['high', 'low']).optional(),
});

// Music configuration schema for a round
export const RoundMusicConfigSchema = z.object({
  roundPreview: MusicTriggerSchema.optional(),
  exercises: z.array(MusicTriggerSchema).optional(),
  rests: z.array(MusicTriggerSchema).optional(),
  setBreaks: z.array(MusicTriggerSchema).optional(),
});

export const RoundConfigSchema = z.object({
  roundNumber: z.number().int().positive(),
  template: RoundTemplateSchema,
  music: RoundMusicConfigSchema.optional(),
});

// Individual field schemas with constraints (kept for backward compatibility)
export const CircuitRoundsSchema = z
  .number()
  .int()
  .min(0)
  .max(CIRCUIT_CONFIG_LIMITS.rounds.max);

export const CircuitExercisesSchema = z
  .number()
  .int()
  .min(CIRCUIT_CONFIG_LIMITS.exercisesPerRound.min)
  .max(CIRCUIT_CONFIG_LIMITS.exercisesPerRound.max);

export const CircuitWorkDurationSchema = z
  .number()
  .int()
  .min(CIRCUIT_CONFIG_LIMITS.workDuration.min);

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


// Complete circuit config schema with round templates
export const CircuitConfigSchema = z.object({
  type: z.literal('circuit'),
  config: z.object({
    rounds: CircuitRoundsSchema,
    restBetweenRounds: CircuitRestBetweenRoundsSchema,
    repeatRounds: z.boolean().optional().default(false),
    roundTemplates: z.array(RoundConfigSchema),
    // Template workout source
    sourceWorkoutId: z.string().uuid().optional(),
    // Legacy fields (optional for backward compatibility)
    exercisesPerRound: CircuitExercisesSchema.optional(),
    workDuration: CircuitWorkDurationSchema.optional(),
    restDuration: CircuitRestDurationSchema.optional(),
  }),
  lastUpdated: z.string().optional(),
  updatedBy: z.string().optional(),
});

// Legacy circuit config schema (for parsing old format)
export const LegacyCircuitConfigSchema = z.object({
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
  roundTemplates: z.array(RoundConfigSchema).optional(),
  // Template workout source
  sourceWorkoutId: z.string().uuid().optional(),
});

// Input schema for TRPC endpoints
export const CircuitConfigInputSchema = z.object({
  sessionId: z.string().uuid(),
  config: UpdateCircuitConfigSchema,
});

export type CircuitConfig = z.infer<typeof CircuitConfigSchema>;
export type UpdateCircuitConfig = z.infer<typeof UpdateCircuitConfigSchema>;
export type CircuitConfigInput = z.infer<typeof CircuitConfigInputSchema>;
export type MusicTrigger = z.infer<typeof MusicTriggerSchema>;
export type RoundMusicConfig = z.infer<typeof RoundMusicConfigSchema>;