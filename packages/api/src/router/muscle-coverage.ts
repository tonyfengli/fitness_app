import { z } from "zod";
import { and, eq, gte, lte, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { exercises, Workout, WorkoutExercise } from "@acme/db/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const muscleCoverageRouter = createTRPCRouter({
  getClientMuscleCoverage: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        startDate: z.date(),
        endDate: z.date(),
        includeExercises: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { clientId, startDate, endDate, includeExercises } = input;

      // Set times to beginning and end of day
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch all workout exercises for the client in the date range
      const workoutExercises = await db
        .select({
          exerciseId: WorkoutExercise.exerciseId,
          exerciseName: exercises.name,
          primaryMuscle: exercises.primaryMuscle,
          secondaryMuscles: exercises.secondaryMuscles,
          createdAt: WorkoutExercise.createdAt,
          workoutId: WorkoutExercise.workoutId,
          template: WorkoutExercise.template, // Add template field
          orderIndex: WorkoutExercise.orderIndex, // Add orderIndex to identify draft exercises
        })
        .from(WorkoutExercise)
        .innerJoin(Workout, eq(WorkoutExercise.workoutId, Workout.id))
        .innerJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
        .where(
          and(
            eq(Workout.userId, clientId),
            gte(WorkoutExercise.createdAt, startOfDay),
            lte(WorkoutExercise.createdAt, endOfDay),
          ),
        )
        .orderBy(WorkoutExercise.createdAt);

      // Calculate muscle counts
      const muscleCounts: Record<string, { primary: number; secondary: number }> = {};

      workoutExercises.forEach((we) => {
        // Count primary muscle
        if (we.primaryMuscle) {
          const muscle = we.primaryMuscle;
          if (!muscleCounts[muscle]) {
            muscleCounts[muscle] = { primary: 0, secondary: 0 };
          }
          muscleCounts[muscle].primary++;
        }

        // Count secondary muscles
        if (we.secondaryMuscles && Array.isArray(we.secondaryMuscles)) {
          we.secondaryMuscles.forEach((muscle) => {
            if (!muscleCounts[muscle]) {
              muscleCounts[muscle] = { primary: 0, secondary: 0 };
            }
            muscleCounts[muscle].secondary++;
          });
        }
      });

      // Convert to total bubble count with circuit adjustments
      // Standard: primary = 1, secondary = 0.5
      // Circuit: primary = 0.25, secondary = 0.125
      const muscleScores: Record<string, number> = {};
      const muscleDraftScores: Record<string, number> = {}; // Track draft points separately
      
      // We need to track points per muscle with template consideration
      workoutExercises.forEach((we) => {
        // Check if this is a draft exercise (orderIndex = 999)
        const isDraft = we.orderIndex === 999;
        
        // Check if this is a circuit exercise
        const isCircuit = we.template === "circuit";
        const primaryMultiplier = isCircuit ? 0.25 : 1;
        const secondaryMultiplier = isCircuit ? 0.125 : 0.5;
        
        // Add primary muscle points
        if (we.primaryMuscle) {
          const muscle = we.primaryMuscle;
          if (isDraft) {
            if (!muscleDraftScores[muscle]) {
              muscleDraftScores[muscle] = 0;
            }
            muscleDraftScores[muscle] += primaryMultiplier;
          } else {
            if (!muscleScores[muscle]) {
              muscleScores[muscle] = 0;
            }
            muscleScores[muscle] += primaryMultiplier;
          }
        }
        
        // Add secondary muscle points
        if (we.secondaryMuscles && Array.isArray(we.secondaryMuscles)) {
          we.secondaryMuscles.forEach((muscle) => {
            if (isDraft) {
              if (!muscleDraftScores[muscle]) {
                muscleDraftScores[muscle] = 0;
              }
              muscleDraftScores[muscle] += secondaryMultiplier;
            } else {
              if (!muscleScores[muscle]) {
                muscleScores[muscle] = 0;
              }
              muscleScores[muscle] += secondaryMultiplier;
            }
          });
        }
      });

      const result: any = {
        workoutCount: workoutExercises.length,
        muscleCounts,
        muscleScores,
        muscleDraftScores, // Include draft scores separately
        dateRange: {
          start: startOfDay,
          end: endOfDay,
        },
      };

      // Include exercise details if requested
      if (includeExercises) {
        result.exercises = workoutExercises.map(we => ({
          id: we.exerciseId,
          name: we.exerciseName,
          primaryMuscle: we.primaryMuscle,
          secondaryMuscles: we.secondaryMuscles,
          createdAt: we.createdAt,
          workoutId: we.workoutId,
        }));
      }

      return result;
    }),
});