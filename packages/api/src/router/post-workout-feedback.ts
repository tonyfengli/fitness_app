import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq, desc, inArray, or } from "@acme/db";
import { 
  TrainingSession, 
  UserExerciseRatings, 
  ExercisePerformanceLog,
  Workout,
  WorkoutExercise 
} from "@acme/db/schema";

import type { SessionUser } from "../types/auth";
import { PostWorkoutFeedbackService } from "../services/post-workout-feedback-service";
import { protectedProcedure, publicProcedure } from "../trpc";

export const postWorkoutFeedbackRouter = {
  // Get exercises that need feedback for a session
  getExercisesForFeedback: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const sessionUser = ctx.session.user as SessionUser;
      
      if (!sessionUser.businessId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User must have a business",
        });
      }

      const feedbackService = new PostWorkoutFeedbackService(ctx.db);
      
      return feedbackService.getFeedbackExercisesGrouped({
        sessionId: input.sessionId,
        userId: input.userId,
        businessId: sessionUser.businessId,
      });
    }),

  // Submit feedback for a single exercise
  submitExerciseFeedback: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string(),
        exerciseId: z.string().uuid(),
        feedbackType: z.enum(["performed", "swapped_out"]),
        rating: z.enum(["favorite", "avoid", "maybe_later"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sessionUser = ctx.session.user as SessionUser;
      
      if (!sessionUser.businessId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User must have a business",
        });
      }

      // Check if rating already exists
      const existingRating = await ctx.db.query.UserExerciseRatings.findFirst({
        where: and(
          eq(UserExerciseRatings.userId, input.userId),
          eq(UserExerciseRatings.exerciseId, input.exerciseId),
          eq(UserExerciseRatings.businessId, sessionUser.businessId)
        ),
      });

      let result;
      if (existingRating) {
        // Update existing rating
        const [updated] = await ctx.db
          .update(UserExerciseRatings)
          .set({
            ratingType: input.rating,
            updatedAt: new Date(),
          })
          .where(eq(UserExerciseRatings.id, existingRating.id))
          .returning();
        
        result = { rating: updated, action: "updated" as const };
      } else {
        // Create new rating
        const [created] = await ctx.db
          .insert(UserExerciseRatings)
          .values({
            userId: input.userId,
            exerciseId: input.exerciseId,
            businessId: sessionUser.businessId,
            ratingType: input.rating,
          })
          .returning();
        
        result = { rating: created, action: "created" as const };
      }

      return {
        ...result,
        sessionId: input.sessionId,
        feedbackType: input.feedbackType,
      };
    }),

  // Batch submit feedback (for better UX when submitting multiple at once)
  submitBatchFeedback: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string(),
        feedback: z.array(
          z.object({
            exerciseId: z.string().uuid(),
            feedbackType: z.enum(["performed", "swapped_out"]),
            rating: z.enum(["favorite", "avoid", "maybe_later"]),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sessionUser = ctx.session.user as SessionUser;
      
      if (!sessionUser.businessId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User must have a business",
        });
      }

      const results = [];

      // Process each feedback item
      for (const item of input.feedback) {
        // Check if rating already exists
        const existingRating = await ctx.db.query.UserExerciseRatings.findFirst({
          where: and(
            eq(UserExerciseRatings.userId, input.userId),
            eq(UserExerciseRatings.exerciseId, item.exerciseId),
            eq(UserExerciseRatings.businessId, sessionUser.businessId)
          ),
        });

        if (existingRating) {
          // Update existing rating
          const [updated] = await ctx.db
            .update(UserExerciseRatings)
            .set({
              ratingType: item.rating,
              updatedAt: new Date(),
            })
            .where(eq(UserExerciseRatings.id, existingRating.id))
            .returning();
          
          results.push({
            exerciseId: item.exerciseId,
            rating: updated,
            action: "updated" as const,
          });
        } else {
          // Create new rating
          const [created] = await ctx.db
            .insert(UserExerciseRatings)
            .values({
              userId: input.userId,
              exerciseId: item.exerciseId,
              businessId: sessionUser.businessId,
              ratingType: item.rating,
            })
            .returning();
          
          results.push({
            exerciseId: item.exerciseId,
            rating: created,
            action: "created" as const,
          });
        }
      }

      return {
        sessionId: input.sessionId,
        results,
        totalProcessed: results.length,
      };
    }),

  // Public endpoint for client-side feedback collection
  getExercisesForFeedbackPublic: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get the business ID from the training session
      const session = await ctx.db.query.TrainingSession.findFirst({
        where: eq(TrainingSession.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training session not found",
        });
      }

      const feedbackService = new PostWorkoutFeedbackService(ctx.db);
      
      return feedbackService.getFeedbackExercisesGrouped({
        sessionId: input.sessionId,
        userId: input.userId,
        businessId: session.businessId,
      });
    }),

  // Save exercise performance (weight lifted)
  saveExercisePerformance: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string(),
        exerciseId: z.string().uuid(),
        weightLbs: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get the workout for this session and user
      const workout = await ctx.db.query.Workout.findFirst({
        where: and(
          eq(Workout.trainingSessionId, input.sessionId),
          eq(Workout.userId, input.userId)
        ),
      });

      if (!workout) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workout not found for this session and user",
        });
      }

      // Get the workout exercise record
      const workoutExercise = await ctx.db.query.WorkoutExercise.findFirst({
        where: and(
          eq(WorkoutExercise.workoutId, workout.id),
          eq(WorkoutExercise.exerciseId, input.exerciseId)
        ),
      });

      if (!workoutExercise) {
        throw new TRPCError({
          code: "NOT_FOUND", 
          message: "Exercise not found in workout",
        });
      }

      // Check if this is a PR by finding the previous best
      const previousBest = await ctx.db.query.ExercisePerformanceLog.findFirst({
        where: and(
          eq(ExercisePerformanceLog.userId, input.userId),
          eq(ExercisePerformanceLog.exerciseId, input.exerciseId)
        ),
        orderBy: [desc(ExercisePerformanceLog.weightLbs)],
      });

      const isWeightPr = !previousBest || input.weightLbs > Number(previousBest.weightLbs);
      const previousBestWeight = previousBest ? Number(previousBest.weightLbs) : null;

      // Insert the performance log
      const [performanceLog] = await ctx.db
        .insert(ExercisePerformanceLog)
        .values({
          userId: input.userId,
          exerciseId: input.exerciseId,
          workoutId: workout.id,
          workoutExerciseId: workoutExercise.id,
          businessId: workout.businessId,
          weightLbs: input.weightLbs.toString(),
          isWeightPr,
          previousBestWeightLbs: previousBestWeight?.toString(),
        })
        .returning();

      return {
        success: true,
        performanceLog,
        isNewRecord: isWeightPr,
        previousBest: previousBestWeight,
      };
    }),

  // Get performance metrics by workout exercise IDs (for TV app)
  getPerformanceByWorkoutExerciseIds: publicProcedure
    .input(
      z.object({
        workoutExerciseIds: z.array(z.string().uuid()),
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.workoutExerciseIds.length === 0) {
        return [];
      }

      // Get all performance logs for these workout exercises
      const performanceLogs = await ctx.db.query.ExercisePerformanceLog.findMany({
        where: inArray(
          ExercisePerformanceLog.workoutExerciseId,
          input.workoutExerciseIds
        ),
        orderBy: [desc(ExercisePerformanceLog.createdAt)],
      });

      // Group by workoutExerciseId and take the latest entry
      const latestByExercise = new Map();
      performanceLogs.forEach(log => {
        const existing = latestByExercise.get(log.workoutExerciseId);
        if (!existing || log.createdAt > existing.createdAt) {
          latestByExercise.set(log.workoutExerciseId, {
            workoutExerciseId: log.workoutExerciseId,
            weight: Number(log.weightLbs),
            isPersonalRecord: log.isWeightPr,
            createdAt: log.createdAt,
          });
        }
      });

      return Array.from(latestByExercise.values());
    }),

  // Get latest performance by user-exercise pairs (for TV app - shows historical data)
  getLatestPerformanceByUserExercises: publicProcedure
    .input(
      z.object({
        userExercisePairs: z.array(z.object({
          userId: z.string(),
          exerciseId: z.string().uuid(),
          workoutExerciseId: z.string().uuid(), // Keep for mapping back
        })),
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.userExercisePairs.length === 0) {
        return [];
      }

      // Log input pairs for debugging
      console.log('[getLatestPerformanceByUserExercises] Input pairs:', input.userExercisePairs);
      
      // Build OR conditions for each user-exercise pair
      const conditions = input.userExercisePairs.map(pair => 
        and(
          eq(ExercisePerformanceLog.userId, pair.userId),
          eq(ExercisePerformanceLog.exerciseId, pair.exerciseId)
        )
      );

      // Get all performance logs for these user-exercise combinations
      const performanceLogs = await ctx.db.query.ExercisePerformanceLog.findMany({
        where: conditions.length === 1 ? conditions[0] : or(...conditions),
        orderBy: [desc(ExercisePerformanceLog.createdAt)],
      });

      // Log fetched performance logs
      console.log('[getLatestPerformanceByUserExercises] Found performance logs:', performanceLogs.length);
      
      // Group by userId+exerciseId and take the latest entry
      const latestByUserExercise = new Map();
      performanceLogs.forEach(log => {
        const key = `${log.userId}-${log.exerciseId}`;
        const existing = latestByUserExercise.get(key);
        if (!existing || log.createdAt > existing.createdAt) {
          // Find the corresponding workoutExerciseId from input
          const pair = input.userExercisePairs.find(p => 
            p.userId === log.userId && p.exerciseId === log.exerciseId
          );
          
          console.log('[getLatestPerformanceByUserExercises] Mapping:', {
            logUserId: log.userId,
            logExerciseId: log.exerciseId,
            foundPair: !!pair,
            currentWorkoutExerciseId: pair?.workoutExerciseId,
            weight: Number(log.weightLbs)
          });
          
          if (pair?.workoutExerciseId) {
            latestByUserExercise.set(key, {
              workoutExerciseId: pair.workoutExerciseId, // Map to current workout exercise
              userId: log.userId,
              exerciseId: log.exerciseId,
              weight: Number(log.weightLbs),
              isPersonalRecord: log.isWeightPr,
              createdAt: log.createdAt,
            });
          }
        }
      });

      const result = Array.from(latestByUserExercise.values());
      console.log('[getLatestPerformanceByUserExercises] Returning:', result);
      return result;
    }),
} satisfies TRPCRouterRecord;