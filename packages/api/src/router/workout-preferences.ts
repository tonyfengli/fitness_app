import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@acme/db/client";
import { WorkoutPreferences, CreateWorkoutPreferencesSchema, UserTrainingSession } from "@acme/db/schema";
import { eq, and, desc } from "@acme/db";
import { TRPCError } from "@trpc/server";

export const workoutPreferencesRouter = createTRPCRouter({
  create: protectedProcedure
    .input(CreateWorkoutPreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify user has checked in to this session
      const checkIn = await db
        .select()
        .from(UserTrainingSession)
        .where(
          and(
            eq(UserTrainingSession.userId, input.userId),
            eq(UserTrainingSession.trainingSessionId, input.trainingSessionId),
            eq(UserTrainingSession.status, "checked_in")
          )
        )
        .limit(1);

      if (!checkIn.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User must be checked in to submit preferences",
        });
      }

      // Create preferences
      const [preference] = await db
        .insert(WorkoutPreferences)
        .values(input)
        .returning();

      // Update check-in to mark preferences as collected
      await db
        .update(UserTrainingSession)
        .set({ preferenceCollectionStep: "initial_collected" })
        .where(
          and(
            eq(UserTrainingSession.userId, input.userId),
            eq(UserTrainingSession.trainingSessionId, input.trainingSessionId)
          )
        );

      return preference;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        intensity: z.enum(["low", "moderate", "high"]).optional(),
        muscleTargets: z.array(z.string()).optional(),
        muscleLessens: z.array(z.string()).optional(),
        includeExercises: z.array(z.string()).optional(),
        avoidExercises: z.array(z.string()).optional(),
        avoidJoints: z.array(z.string()).optional(),
        sessionGoal: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      
      const [updated] = await db
        .update(WorkoutPreferences)
        .set(updates)
        .where(eq(WorkoutPreferences.id, id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Preferences not found",
        });
      }

      return updated;
    }),

  getBySession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const preferences = await db
        .select()
        .from(WorkoutPreferences)
        .where(eq(WorkoutPreferences.trainingSessionId, input.sessionId))
        .orderBy(desc(WorkoutPreferences.collectedAt));

      return preferences;
    }),

  getByUser: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const preferences = await db
        .select()
        .from(WorkoutPreferences)
        .where(eq(WorkoutPreferences.userId, input.userId))
        .orderBy(desc(WorkoutPreferences.collectedAt))
        .limit(10); // Last 10 preferences

      return preferences;
    }),

  getForUserSession: protectedProcedure
    .input(z.object({ 
      userId: z.string(),
      sessionId: z.string().uuid()
    }))
    .query(async ({ ctx, input }) => {
      const [preference] = await db
        .select()
        .from(WorkoutPreferences)
        .where(
          and(
            eq(WorkoutPreferences.userId, input.userId),
            eq(WorkoutPreferences.trainingSessionId, input.sessionId)
          )
        )
        .limit(1);

      return preference || null;
    }),
});