import { TRPCError } from "@trpc/server";

import type { Database } from "@acme/db/client";
import { and, eq, ilike } from "@acme/db";
import { BusinessExercise, exercises, user } from "@acme/db/schema";

import type { SessionUser } from "../types/auth";

export class ExerciseService {
  constructor(private db: Database) {}

  /**
   * Verify that a user has a businessId
   */
  verifyUserHasBusiness(currentUser: SessionUser) {
    if (!currentUser.businessId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "User must be associated with a business",
      });
    }
    return currentUser.businessId;
  }

  /**
   * Get exercises available to a business
   */
  async getBusinessExercises(businessId: string) {
    return await this.db
      .select({
        exercise: exercises,
      })
      .from(exercises)
      .innerJoin(
        BusinessExercise,
        eq(exercises.id, BusinessExercise.exerciseId),
      )
      .where(eq(BusinessExercise.businessId, businessId));
  }

  /**
   * Search exercises by name for a business
   */
  async searchBusinessExercises(businessId: string, searchTerm: string) {
    return await this.db
      .select({
        exercise: exercises,
      })
      .from(exercises)
      .innerJoin(
        BusinessExercise,
        eq(exercises.id, BusinessExercise.exerciseId),
      )
      .where(
        and(
          eq(BusinessExercise.businessId, businessId),
          ilike(exercises.name, `%${searchTerm}%`),
        ),
      );
  }

  /**
   * Verify that an exercise is available to a business
   */
  async verifyExerciseAccess(exerciseId: string, businessId: string) {
    const result = await this.db
      .select({
        exercise: exercises,
      })
      .from(exercises)
      .innerJoin(
        BusinessExercise,
        eq(exercises.id, BusinessExercise.exerciseId),
      )
      .where(
        and(
          eq(exercises.id, exerciseId),
          eq(BusinessExercise.businessId, businessId),
        ),
      )
      .limit(1);

    if (!result[0]) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Exercise not found or not available for your business",
      });
    }

    return result[0].exercise;
  }

  /**
   * Create exercise name lookup map for matching
   */
  createExerciseNameMap(
    businessExercises: Array<{ exercise: typeof exercises.$inferSelect }>,
  ) {
    const exerciseByName = new Map<string, typeof exercises.$inferSelect>();

    businessExercises.forEach(({ exercise }) => {
      // Add exact name
      exerciseByName.set(exercise.name.toLowerCase(), exercise);

      // Add name without parentheses
      const nameWithoutParens = exercise.name
        .replace(/\s*\([^)]*\)/g, "")
        .trim();
      if (nameWithoutParens !== exercise.name) {
        exerciseByName.set(nameWithoutParens.toLowerCase(), exercise);
      }
    });

    return exerciseByName;
  }

  /**
   * Filter exercises for workout generation
   */
  async filterForWorkoutGeneration(params: {
    clientId: string;
    businessId: string;
    sessionGoal: "strength" | "stability";
    intensity: "low" | "moderate" | "high";
    template: "standard" | "circuit" | "full_body";
    includeExercises: string[];
    avoidExercises: string[];
    muscleTarget: string[];
    muscleLessen: string[];
    avoidJoints: string[];
    debug?: boolean;
  }) {
    const { clientId, businessId, ...filterParams } = params;

    // Get client to build context
    const client = await this.db
      .select()
      .from(user)
      .where(eq(user.id, clientId))
      .limit(1)
      .then((res) => res[0]);

    if (!client || client.businessId !== businessId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Client not found in your business",
      });
    }

    // Build client context
    const clientContext = {
      user_id: clientId,
      name: client.name || client.email || "Client",
      strength_capacity: "moderate" as const, // Default for now
      skill_capacity: "moderate" as const, // Default for now
      primary_goal:
        filterParams.sessionGoal === "strength"
          ? "gain_strength"
          : "improve_stability",
      muscle_target: filterParams.muscleTarget,
      muscle_lessen: filterParams.muscleLessen,
      exercise_requests: {
        include: filterParams.includeExercises,
        avoid: filterParams.avoidExercises,
      },
      avoid_joints: filterParams.avoidJoints,
      business_id: businessId,
      templateType: filterParams.template,
    };

    // Get business exercises
    const businessExercises = await this.getBusinessExercises(businessId);
    const allExercises = businessExercises.map((be) => be.exercise);

    // Return data needed for filtering
    return {
      clientContext,
      exercises: allExercises,
      intensity: filterParams.intensity,
      template: filterParams.template,
      debug: filterParams.debug,
    };
  }

  /**
   * Standard error messages
   */
  static readonly ERRORS = {
    NO_BUSINESS: "User must be associated with a business",
    EXERCISE_NOT_FOUND: "Exercise not found or not available for your business",
    INVALID_FILTER: "Invalid filter parameters",
  } as const;
}
