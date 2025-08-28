import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { and, desc, eq, ilike } from "@acme/db";
import { BusinessExercise, exercises, TrainingSession, UserExerciseRatings } from "@acme/db/schema";

import type { SessionUser } from "../types/auth";
import { ExerciseFilterService } from "../services/exercise-filter-service";
import { ExerciseService } from "../services/exercise-service";
import { protectedProcedure, publicProcedure } from "../trpc";

const CreateExerciseSchema = z.object({
  name: z.string().min(1).max(255),
  primaryMuscle: z.enum([
    "glutes",
    "quads",
    "hamstrings",
    "calves",
    "adductors",
    "abductors",
    "core",
    "lower_abs",
    "upper_abs",
    "obliques",
    "chest",
    "upper_chest",
    "lower_chest",
    "lats",
    "traps",
    "biceps",
    "triceps",
    "shoulders",
    "delts",
    "upper_back",
    "lower_back",
    "shins",
    "tibialis_anterior",
  ]),
  secondaryMuscles: z
    .array(
      z.enum([
        "glutes",
        "quads",
        "hamstrings",
        "calves",
        "adductors",
        "abductors",
        "core",
        "lower_abs",
        "upper_abs",
        "obliques",
        "chest",
        "upper_chest",
        "lower_chest",
        "lats",
        "traps",
        "biceps",
        "triceps",
        "shoulders",
        "delts",
        "upper_back",
        "lower_back",
        "shins",
        "tibialis_anterior",
      ]),
    )
    .optional(),
  loadedJoints: z
    .array(
      z.enum([
        "ankles",
        "knees",
        "hips",
        "shoulders",
        "elbows",
        "wrists",
        "neck",
        "lower_back",
        "spine",
        "sacroiliac_joint",
        "patella",
        "rotator_cuff",
      ]),
    )
    .optional(),
  movementPattern: z.enum([
    "horizontal_push",
    "horizontal_pull",
    "vertical_push",
    "vertical_pull",
    "shoulder_isolation",
    "arm_isolation",
    "leg_isolation",
    "squat",
    "lunge",
    "hinge",
    "carry",
    "core",
  ]),
  modality: z.enum([
    "strength",
    "stability",
    "core",
    "power",
    "conditioning",
    "mobility",
  ]),
  movementTags: z
    .array(
      z.enum([
        "bilateral",
        "unilateral",
        "scapular_control",
        "core_stability",
        "postural_control",
        "hip_dominant",
        "knee_dominant",
        "balance_challenge",
        "isometric_control",
        "anti_rotation",
        "end_range_control",
        "hip_stability",
        "explosive",
        "rotational",
        "cross_plane",
        "foundational",
        "rehab_friendly",
        "warmup_friendly",
        "finisher_friendly",
        "mobility_focus",
      ]),
    )
    .optional(),
  functionTags: z
    .array(
      z.enum([
        "primary_strength",
        "secondary_strength",
        "accessory",
        "core",
        "capacity",
      ]),
    )
    .optional(),
  fatigueProfile: z.enum([
    "low_local",
    "moderate_local",
    "high_local",
    "moderate_systemic",
    "high_systemic",
    "metabolic",
  ]),
  complexityLevel: z.enum(["very_low", "low", "moderate", "high"]),
  equipment: z
    .array(
      z.enum([
        "barbell",
        "dumbbells",
        "bench",
        "landmine",
        "trx",
        "kettlebell",
        "cable_machine",
        "bands",
        "bosu_ball",
        "swiss_ball",
        "platform",
        "pull_up_bar",
        "back_machine",
        "ab_wheel",
        "box",
        "med_ball",
      ]),
    )
    .optional(),
  strengthLevel: z.enum(["very_low", "low", "moderate", "high"]),
});

const UpdateExerciseSchema = CreateExerciseSchema.partial();

export const exerciseRouter = {
  all: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(1000).default(20),
          offset: z.number().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { limit = 20, offset = 0 } = input ?? {};

      // If user is authenticated and has a business, filter by business
      const user = ctx.session?.user as SessionUser | undefined;
      const businessId = user?.businessId;

      if (businessId) {
        // Get exercises that belong to this business
        const businessExercises = await ctx.db
          .select({
            exercise: exercises,
          })
          .from(exercises)
          .innerJoin(
            BusinessExercise,
            eq(exercises.id, BusinessExercise.exerciseId),
          )
          .where(eq(BusinessExercise.businessId, businessId))
          .orderBy(desc(exercises.createdAt))
          .limit(limit)
          .offset(offset);

        const result = businessExercises.map((be) => be.exercise);
        return result;
      } else {
        // No business context - return all exercises (for public/demo access)
        const result = await ctx.db.query.exercises.findMany({
          orderBy: desc(exercises.createdAt),
          limit,
          offset,
        });
        return result;
      }
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => {
      return ctx.db.query.exercises.findFirst({
        where: eq(exercises.id, input.id),
      });
    }),

  search: publicProcedure
    .input(
      z.object({
        query: z.string().optional(),
        primaryMuscle: z.string().optional(),
        movementPattern: z.string().optional(),
        modality: z.string().optional(),
        equipment: z.array(z.string()).optional(),
        limit: z.number().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.query) {
        conditions.push(ilike(exercises.name, `%${input.query}%`));
      }

      if (input.primaryMuscle) {
        conditions.push(
          eq(exercises.primaryMuscle, input.primaryMuscle as any),
        );
      }

      if (input.movementPattern) {
        conditions.push(
          eq(exercises.movementPattern, input.movementPattern as any),
        );
      }

      if (input.modality) {
        conditions.push(eq(exercises.modality, input.modality as any));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // If user has a business, filter by business
      const user = ctx.session?.user as SessionUser | undefined;
      const businessId = user?.businessId;

      if (businessId) {
        // Get exercises that belong to this business AND match search criteria
        const results = await ctx.db
          .select({
            exercise: exercises,
          })
          .from(exercises)
          .innerJoin(
            BusinessExercise,
            eq(exercises.id, BusinessExercise.exerciseId),
          )
          .where(and(eq(BusinessExercise.businessId, businessId), whereClause))
          .orderBy(desc(exercises.createdAt))
          .limit(input.limit);

        return results.map((r) => r.exercise);
      } else {
        // No business context - search all exercises
        return ctx.db.query.exercises.findMany({
          where: whereClause,
          orderBy: desc(exercises.createdAt),
          limit: input.limit,
        });
      }
    }),

  filter: protectedProcedure
    .input(
      z
        .object({
          // Client identification
          clientId: z.string().optional(), // User ID of the client

          // Client fitness profile
          clientName: z.string().default("Default Client"),
          strengthCapacity: z
            .enum(["very_low", "low", "moderate", "high"])
            .default("moderate"),
          skillCapacity: z
            .enum(["very_low", "low", "moderate", "high"])
            .default("moderate"),

          // Exercise inclusion/exclusion
          includeExercises: z.array(z.string()).default([]),
          avoidExercises: z.array(z.string()).default([]),

          // Joint restrictions (for injuries/limitations)
          avoidJoints: z.array(z.string()).default([]),

          // Phase 2 Client fields
          primaryGoal: z
            .enum([
              "mobility",
              "strength",
              "general_fitness",
              "hypertrophy",
              "burn_fat",
            ])
            .optional(),
          intensity: z.enum(["low", "moderate", "high"]).optional(),
          muscleTarget: z.array(z.string()).default([]),
          muscleLessen: z.array(z.string()).default([]),

          // Template selection
          isFullBody: z.boolean().default(false),

          // Business context - removed, will use from session

          // Optional user input for future LLM processing
          userInput: z.string().optional(),

          // Enable enhanced debug mode
          debug: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        const user = ctx.session?.user as SessionUser;
        const exerciseService = new ExerciseService(ctx.db);
        const businessId = exerciseService.verifyUserHasBusiness(user);

        const filterService = new ExerciseFilterService(ctx.db);
        const result = await filterService.filterExercises(input, {
          userId: user.id,
          businessId,
        });
        return result.exercises;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new Error("Failed to filter exercises");
      }
    }),

  create: protectedProcedure
    .input(CreateExerciseSchema)
    .mutation(({ ctx, input }) => {
      return ctx.db.insert(exercises).values(input).returning();
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: UpdateExerciseSchema,
      }),
    )
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

  // Filter exercises for workout generation modal
  filterForWorkoutGeneration: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        sessionGoal: z.enum(["strength", "stability"]),
        intensity: z.enum(["low", "moderate", "high"]),
        template: z.enum(["standard", "circuit", "full_body"]),
        includeExercises: z.array(z.string()),
        avoidExercises: z.array(z.string()),
        muscleTarget: z.array(z.string()),
        muscleLessen: z.array(z.string()),
        avoidJoints: z.array(z.string()),
        debug: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionUser = ctx.session.user as SessionUser;
      const exerciseService = new ExerciseService(ctx.db);
      const businessId = exerciseService.verifyUserHasBusiness(sessionUser);

      const filterService = new ExerciseFilterService(ctx.db);
      return filterService.filterForWorkoutGeneration(input, {
        userId: sessionUser.id,
        businessId,
      });
    }),

  // Public endpoint for clients to get available exercises
  getAvailablePublic: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Get the user's business from their training session
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: and(eq(TrainingSession.id, input.sessionId)),
      });

      if (!session) {
        return { exercises: [] };
      }

      // Get exercises for this business
      const businessExercises = await ctx.db
        .select({
          id: exercises.id,
          name: exercises.name,
          primaryMuscle: exercises.primaryMuscle,
          secondaryMuscles: exercises.secondaryMuscles,
          equipment: exercises.equipment,
          movementPattern: exercises.movementPattern,
          modality: exercises.modality,
        })
        .from(exercises)
        .innerJoin(
          BusinessExercise,
          eq(exercises.id, BusinessExercise.exerciseId),
        )
        .where(eq(BusinessExercise.businessId, session.businessId))
        .orderBy(exercises.name);

      return { exercises: businessExercises };
    }),

  // Get user's favorite exercises
  getUserFavorites: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const sessionUser = ctx.session.user as SessionUser;
      const exerciseService = new ExerciseService(ctx.db);
      const businessId = exerciseService.verifyUserHasBusiness(sessionUser);

      // Get all favorite exercises for the user in this business
      const favorites = await ctx.db
        .select({
          id: UserExerciseRatings.id,
          exerciseId: exercises.id,
          exerciseName: exercises.name,
          primaryMuscle: exercises.primaryMuscle,
          secondaryMuscles: exercises.secondaryMuscles,
          equipment: exercises.equipment,
          movementPattern: exercises.movementPattern,
          modality: exercises.modality,
          ratingType: UserExerciseRatings.ratingType,
        })
        .from(UserExerciseRatings)
        .innerJoin(exercises, eq(UserExerciseRatings.exerciseId, exercises.id))
        .where(
          and(
            eq(UserExerciseRatings.userId, input.userId),
            eq(UserExerciseRatings.businessId, businessId),
            eq(UserExerciseRatings.ratingType, "favorite")
          )
        )
        .orderBy(exercises.name);

      return { favorites };
    }),

  // Get all user exercise ratings (favorites, avoid, maybe_later)
  getUserRatings: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        ratingType: z.enum(["favorite", "avoid", "maybe_later"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const sessionUser = ctx.session.user as SessionUser;
      const exerciseService = new ExerciseService(ctx.db);
      const businessId = exerciseService.verifyUserHasBusiness(sessionUser);

      const conditions = [
        eq(UserExerciseRatings.userId, input.userId),
        eq(UserExerciseRatings.businessId, businessId),
      ];

      // Add rating type filter if provided
      if (input.ratingType) {
        conditions.push(eq(UserExerciseRatings.ratingType, input.ratingType));
      }

      const ratings = await ctx.db
        .select({
          id: UserExerciseRatings.id,
          exerciseId: exercises.id,
          exerciseName: exercises.name,
          primaryMuscle: exercises.primaryMuscle,
          secondaryMuscles: exercises.secondaryMuscles,
          equipment: exercises.equipment,
          movementPattern: exercises.movementPattern,
          modality: exercises.modality,
          ratingType: UserExerciseRatings.ratingType,
          createdAt: UserExerciseRatings.createdAt,
          updatedAt: UserExerciseRatings.updatedAt,
        })
        .from(UserExerciseRatings)
        .innerJoin(exercises, eq(UserExerciseRatings.exerciseId, exercises.id))
        .where(and(...conditions))
        .orderBy(desc(UserExerciseRatings.updatedAt));

      return { ratings };
    }),

  // Set or update exercise rating (favorite, avoid, maybe_later)
  setRating: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        exerciseId: z.string().uuid(),
        ratingType: z.enum(["favorite", "avoid", "maybe_later"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionUser = ctx.session.user as SessionUser;
      const exerciseService = new ExerciseService(ctx.db);
      const businessId = exerciseService.verifyUserHasBusiness(sessionUser);

      // Check if rating already exists
      const existingRating = await ctx.db.query.UserExerciseRatings.findFirst({
        where: and(
          eq(UserExerciseRatings.userId, input.userId),
          eq(UserExerciseRatings.exerciseId, input.exerciseId),
          eq(UserExerciseRatings.businessId, businessId)
        ),
      });

      if (existingRating) {
        // Update existing rating
        const [updated] = await ctx.db
          .update(UserExerciseRatings)
          .set({
            ratingType: input.ratingType,
            updatedAt: new Date(),
          })
          .where(eq(UserExerciseRatings.id, existingRating.id))
          .returning();
        
        return { rating: updated, action: "updated" };
      } else {
        // Create new rating
        const [created] = await ctx.db
          .insert(UserExerciseRatings)
          .values({
            userId: input.userId,
            exerciseId: input.exerciseId,
            businessId,
            ratingType: input.ratingType,
          })
          .returning();
        
        return { rating: created, action: "created" };
      }
    }),

  // Remove exercise rating
  removeRating: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        exerciseId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionUser = ctx.session.user as SessionUser;
      const exerciseService = new ExerciseService(ctx.db);
      const businessId = exerciseService.verifyUserHasBusiness(sessionUser);

      const deleted = await ctx.db
        .delete(UserExerciseRatings)
        .where(
          and(
            eq(UserExerciseRatings.userId, input.userId),
            eq(UserExerciseRatings.exerciseId, input.exerciseId),
            eq(UserExerciseRatings.businessId, businessId)
          )
        )
        .returning();

      return { deleted: deleted.length > 0 };
    }),
} satisfies TRPCRouterRecord;
