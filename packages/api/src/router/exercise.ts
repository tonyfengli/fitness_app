import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { desc, eq, ilike, and, inArray } from "@acme/db";
import { exercises } from "@acme/db/schema";
import { filterExercisesFromInput } from "@acme/ai";

import { protectedProcedure, publicProcedure } from "../trpc";

const CreateExerciseSchema = z.object({
  name: z.string().min(1).max(255),
  primaryMuscle: z.enum([
    "glutes", "quads", "hamstrings", "calves", "adductors", "abductors",
    "core", "lower_abs", "upper_abs", "obliques", "chest", "upper_chest",
    "lower_chest", "lats", "traps", "biceps", "triceps", "shoulders",
    "delts", "upper_back", "lower_back", "shins", "tibialis_anterior"
  ]),
  secondaryMuscles: z.array(z.enum([
    "glutes", "quads", "hamstrings", "calves", "adductors", "abductors",
    "core", "lower_abs", "upper_abs", "obliques", "chest", "upper_chest",
    "lower_chest", "lats", "traps", "biceps", "triceps", "shoulders",
    "delts", "upper_back", "lower_back", "shins", "tibialis_anterior"
  ])).optional(),
  loadedJoints: z.array(z.enum([
    "ankles", "knees", "hips", "shoulders", "elbows", "wrists",
    "neck", "lower_back", "spine", "sacroiliac_joint", "patella", "rotator_cuff"
  ])).optional(),
  movementPattern: z.enum([
    "horizontal_push", "horizontal_pull", "vertical_push", "vertical_pull",
    "shoulder_isolation", "arm_isolation", "leg_isolation", "squat",
    "lunge", "hinge", "carry", "core"
  ]),
  modality: z.enum([
    "strength", "stability", "core", "power", "conditioning", "mobility"
  ]),
  movementTags: z.array(z.enum([
    "bilateral", "unilateral", "scapular_control", "core_stability",
    "postural_control", "hip_dominant", "knee_dominant", "balance_challenge",
    "isometric_control", "anti_rotation", "end_range_control", "hip_stability",
    "explosive", "rotational", "cross_plane"
  ])).optional(),
  functionTags: z.array(z.enum([
    "foundational", "rehab_friendly", "warmup_friendly", "finisher_friendly", "mobility_focus"
  ])).optional(),
  fatigueProfile: z.enum([
    "low_local", "moderate_local", "high_local", "moderate_systemic", "high_systemic", "metabolic"
  ]),
  complexityLevel: z.enum(["very_low", "low", "moderate", "high"]),
  equipment: z.array(z.enum([
    "barbell", "dumbbells", "bench", "landmine", "trx", "kettlebell",
    "cable_machine", "bands", "bosu_ball", "swiss_ball", "platform",
    "pull_up_bar", "back_machine", "ab_wheel", "box", "med_ball"
  ])).optional(),
  strengthLevel: z.enum(["very_low", "low", "moderate", "high"]),
});

const UpdateExerciseSchema = CreateExerciseSchema.partial();

export const exerciseRouter = {
  all: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(1000).default(20),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { limit = 20, offset = 0 } = input ?? {};
      console.log(`📊 exercise.all called with limit: ${limit}, offset: ${offset}`);
      
      const startTime = Date.now();
      const result = await ctx.db.query.exercises.findMany({
        orderBy: desc(exercises.createdAt),
        limit,
        offset,
      });
      const duration = Date.now() - startTime;
      
      console.log(`✅ exercise.all completed: ${result.length} exercises in ${duration}ms`);
      return result;
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => {
      return ctx.db.query.exercises.findFirst({
        where: eq(exercises.id, input.id),
      });
    }),

  search: publicProcedure
    .input(z.object({
      query: z.string().optional(),
      primaryMuscle: z.string().optional(),
      movementPattern: z.string().optional(),
      modality: z.string().optional(),
      equipment: z.array(z.string()).optional(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(({ ctx, input }) => {
      const conditions = [];

      if (input.query) {
        conditions.push(ilike(exercises.name, `%${input.query}%`));
      }
      
      if (input.primaryMuscle) {
        conditions.push(eq(exercises.primaryMuscle, input.primaryMuscle as any));
      }
      
      if (input.movementPattern) {
        conditions.push(eq(exercises.movementPattern, input.movementPattern as any));
      }
      
      if (input.modality) {
        conditions.push(eq(exercises.modality, input.modality as any));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      return ctx.db.query.exercises.findMany({
        where: whereClause,
        orderBy: desc(exercises.createdAt),
        limit: input.limit,
      });
    }),

  filter: publicProcedure
    .input(z.object({
      // Client fitness profile
      clientName: z.string().default("Default Client"),
      strengthCapacity: z.enum(["very_low", "low", "moderate", "high", "very_high", "all"]).default("moderate"),
      skillCapacity: z.enum(["very_low", "low", "moderate", "high", "all"]).default("moderate"),
      
      // Exercise inclusion/exclusion
      includeExercises: z.array(z.string()).default([]),
      avoidExercises: z.array(z.string()).default([]),
      
      // Joint restrictions (for injuries/limitations)
      avoidJoints: z.array(z.string()).default([]),
      
      // Phase 2 Client fields
      primaryGoal: z.enum(["mobility", "strength", "general_fitness", "hypertrophy", "burn_fat"]).optional(),
      intensity: z.enum(["low_local", "moderate_local", "high_local", "moderate_systemic", "high_systemic", "metabolic", "all"]).optional(),
      muscleTarget: z.array(z.string()).default([]),
      muscleLessen: z.array(z.string()).default([]),
      
      // Routine Template fields
      routineGoal: z.enum(["hypertrophy", "mixed_focus", "conditioning", "mobility", "power", "stability_control"]).optional(),
      routineMuscleTarget: z.array(z.string()).default([]),
      routineIntensity: z.enum(["low_local", "moderate_local", "high_local", "moderate_systemic", "high_systemic", "metabolic", "all"]).optional(),
      
      // Business context
      businessId: z.string().uuid().optional(),
      
      // Optional user input for future LLM processing
      userInput: z.string().optional(),
    }))
    .query(async ({ input }) => {
      try {
        console.log('🔍 exercise.filter API called');
        const result = await filterExercisesFromInput({
          clientContext: {
            name: input.clientName,
            strength_capacity: input.strengthCapacity === "all" ? "very_high" : input.strengthCapacity,
            skill_capacity: input.skillCapacity === "all" ? "high" : input.skillCapacity,
            primary_goal: input.primaryGoal,
            intensity: input.intensity,
            muscle_target: input.muscleTarget,
            muscle_lessen: input.muscleLessen,
            exercise_requests: {
              include: input.includeExercises,
              avoid: input.avoidExercises,
            },
            avoid_joints: input.avoidJoints,
            business_id: input.businessId
          },
          routineTemplate: input.routineGoal ? {
            routine_goal: input.routineGoal,
            muscle_target: input.routineMuscleTarget,
            routine_intensity: input.routineIntensity || "moderate_local"
          } : undefined,
          userInput: input.userInput,
        });
        
        return result.filteredExercises || [];
      } catch (error) {
        console.error('❌ Exercise filtering failed:', error);
        throw new Error('Failed to filter exercises');
      }
    }),

  create: protectedProcedure
    .input(CreateExerciseSchema)
    .mutation(({ ctx, input }) => {
      return ctx.db.insert(exercises).values(input).returning();
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: UpdateExerciseSchema,
    }))
    .mutation(({ ctx, input }) => {
      return ctx.db
        .update(exercises)
        .set(input.data)
        .where(eq(exercises.id, input.id))
        .returning();
    }),

  delete: protectedProcedure
    .input(z.string().uuid())
    .mutation(({ ctx, input }) => {
      return ctx.db.delete(exercises).where(eq(exercises.id, input));
    }),
} satisfies TRPCRouterRecord;