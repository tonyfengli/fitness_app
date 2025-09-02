import { TRPCError } from "@trpc/server";

import type { Database } from "@acme/db/client";
import type { Exercise } from "@acme/db/schema";
import {
  enhancedFilterExercisesFromInput,
  filterExercisesFromInput,
  saveFilterDebugData,
} from "@acme/ai";
import { and, eq } from "@acme/db";
import {
  BusinessExercise,
  exercises,
  user,
  UserProfile,
} from "@acme/db/schema";

export interface FilterInput {
  clientId?: string;
  clientName?: string;
  strengthCapacity?: "very_low" | "low" | "moderate" | "high";
  skillCapacity?: "very_low" | "low" | "moderate" | "high";
  includeExercises?: string[];
  avoidExercises?: string[];
  avoidJoints?: string[];
  primaryGoal?:
    | "mobility"
    | "strength"
    | "general_fitness"
    | "hypertrophy"
    | "burn_fat";
  intensity?: "low" | "moderate" | "high";
  muscleTarget?: string[];
  muscleLessen?: string[];
  isFullBody?: boolean;
  userInput?: string;
  debug?: boolean;
  favoriteExerciseIds?: string[];
}

export interface WorkoutGenerationInput {
  clientId: string;
  sessionGoal: "strength" | "stability";
  intensity: "low" | "moderate" | "high";
  template: "full_body_bmf" | "standard" | "circuit";
  includeExercises: string[];
  avoidExercises: string[];
  muscleTarget: string[];
  muscleLessen: string[];
  avoidJoints: string[];
  debug?: boolean;
  favoriteExerciseIds?: string[];
}

export interface FilterContext {
  userId: string;
  businessId: string;
}

export class ExerciseFilterService {
  constructor(private db: Database) {}

  /**
   * Apply equipment filters to exercises
   */
  private applyEquipmentFilters(
    exercises: Exercise[],
    equipment?: string[],
  ): Exercise[] {
    if (!equipment || equipment.length === 0) {
      return exercises;
    }

    return exercises.filter((exercise) => {
      const exerciseEquipment = exercise.equipment || [];
      return equipment.some((eq) => exerciseEquipment.includes(eq as any));
    });
  }

  /**
   * Apply muscle group filters to exercises
   */
  private applyMuscleGroupFilters(
    exercises: Exercise[],
    muscleGroups?: string[],
  ): Exercise[] {
    if (!muscleGroups || muscleGroups.length === 0) {
      return exercises;
    }

    return exercises.filter((exercise) => {
      const primaryMuscle = exercise.primaryMuscle;
      const secondaryMuscles = exercise.secondaryMuscles || [];
      return muscleGroups.some(
        (muscle) =>
          primaryMuscle === muscle || secondaryMuscles.includes(muscle as any),
      );
    });
  }

  /**
   * Apply movement pattern filters to exercises
   */
  private applyMovementPatternFilters(
    exercises: Exercise[],
    patterns?: string[],
  ): Exercise[] {
    if (!patterns || patterns.length === 0) {
      return exercises;
    }

    return exercises.filter((exercise) => {
      const movementPattern = exercise.movementPattern;
      return patterns.includes(movementPattern);
    });
  }

  /**
   * Apply difficulty filters based on skill capacity
   */
  private applyDifficultyFilters(
    exercises: Exercise[],
    skillCapacity: string,
  ): Exercise[] {
    const difficultyMap = {
      very_low: ["very_easy", "easy"],
      low: ["very_easy", "easy", "moderate"],
      moderate: ["easy", "moderate", "hard"],
      high: ["moderate", "hard", "very_hard"],
    };

    const allowedDifficulties =
      difficultyMap[skillCapacity as keyof typeof difficultyMap] ||
      difficultyMap.moderate;

    return exercises.filter((exercise) => {
      const complexity = exercise.complexityLevel || "moderate";
      return allowedDifficulties.includes(complexity);
    });
  }

  /**
   * Fetch exercises available to the business
   */
  async fetchBusinessExercises(businessId: string): Promise<Exercise[]> {
    const businessExercises = await this.db
      .select({
        exercise: exercises,
      })
      .from(exercises)
      .innerJoin(
        BusinessExercise,
        eq(exercises.id, BusinessExercise.exerciseId),
      )
      .where(eq(BusinessExercise.businessId, businessId));

    return businessExercises.map((be) => be.exercise);
  }

  /**
   * Prepare input with defaults
   */
  private prepareInput(input?: FilterInput) {
    return {
      clientName: input?.clientName || "Default Client",
      strengthCapacity: input?.strengthCapacity || "moderate",
      skillCapacity: input?.skillCapacity || "moderate",
      includeExercises: input?.includeExercises || [],
      avoidExercises: input?.avoidExercises || [],
      avoidJoints: input?.avoidJoints || [],
      muscleTarget: input?.muscleTarget || [],
      muscleLessen: input?.muscleLessen || [],
      primaryGoal: input?.primaryGoal,
      intensity: input?.intensity,
      isFullBody: input?.isFullBody || false,
      userInput: input?.userInput,
      debug: input?.debug || false,
      favoriteExerciseIds: input?.favoriteExerciseIds || [],
    };
  }

  /**
   * Main filter method - orchestrates the filtering process
   */
  async filterExercises(
    input: FilterInput | undefined,
    context: FilterContext,
  ): Promise<{
    exercises: any[];
    timing?: { database: number; filtering: number };
  }> {
    try {
      const apiStartTime = Date.now();

      // Prepare input with defaults
      const safeInput = this.prepareInput(input);

      // Fetch exercises from the database
      const dbStartTime = Date.now();
      const allExercises = await this.fetchBusinessExercises(
        context.businessId,
      );
      const dbEndTime = Date.now();

      // Choose filter function based on debug mode
      const filterFunction = safeInput.debug
        ? enhancedFilterExercisesFromInput
        : filterExercisesFromInput;

      // Apply AI-based filtering
      const filterStartTime = Date.now();

      // Debug log favorites
      // Removed exercise filter client context log

      const result = await filterFunction({
        clientContext: {
          user_id: context.userId,
          name: safeInput.clientName,
          strength_capacity: safeInput.strengthCapacity,
          skill_capacity: safeInput.skillCapacity,
          primary_goal: safeInput.primaryGoal,
          muscle_target: safeInput.muscleTarget,
          muscle_lessen: safeInput.muscleLessen,
          exercise_requests: {
            include: safeInput.includeExercises,
            avoid: safeInput.avoidExercises,
          },
          avoid_joints: safeInput.avoidJoints,
          business_id: context.businessId,
          templateType: (input as any)?.template, // Add for backward compatibility
          favoriteExerciseIds: safeInput.favoriteExerciseIds,
        } as any,
        userInput: safeInput.userInput,
        exercises: allExercises,
        intensity: safeInput.intensity,
        enableDebug: safeInput.debug,
        workoutTemplate: {
          workout_goal: safeInput.isFullBody ? "mixed_focus" : "mixed_focus",
          muscle_target: safeInput.muscleTarget,
          isFullBody: safeInput.isFullBody,
        } as any,
      });
      const filterEndTime = Date.now();

      const filteredExercises = result.filteredExercises || [];

      // Save debug data if requested
      if (safeInput.debug) {
        await this.saveDebugData(safeInput, filteredExercises);
      }

      const apiEndTime = Date.now();

      // Log performance metrics
      if (process.env.NODE_ENV !== "production") {
        // Removed exercise filter performance log
      }

      return {
        exercises: filteredExercises,
        timing: {
          database: dbEndTime - dbStartTime,
          filtering: filterEndTime - filterStartTime,
        },
      };
    } catch (error) {
      console.error("❌ Exercise filtering failed:", error);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to filter exercises",
        cause: error,
      });
    }
  }

  /**
   * Save debug data for analysis
   */
  private async saveDebugData(input: any, filteredExercises: any[]) {
    try {
      const blockA = filteredExercises.filter((ex) => ex.isSelectedBlockA);
      const blockB = filteredExercises.filter((ex) => ex.isSelectedBlockB);
      const blockC = filteredExercises.filter((ex) => ex.isSelectedBlockC);
      const blockD = filteredExercises.filter((ex) => ex.isSelectedBlockD);

      saveFilterDebugData({
        timestamp: new Date().toISOString(),
        filters: {
          clientName: input.clientName,
          strengthCapacity: input.strengthCapacity,
          skillCapacity: input.skillCapacity,
          intensity: input.intensity || "moderate",
          muscleTarget: input.muscleTarget,
          muscleLessen: input.muscleLessen,
          avoidJoints: input.avoidJoints,
          includeExercises: input.includeExercises,
          avoidExercises: input.avoidExercises,
          sessionGoal: input.primaryGoal,
          isFullBody: input.template === "full_body",
        },
        results: {
          totalExercises: filteredExercises.length,
          blockA: this.formatBlockDebugData(blockA, 5),
          blockB: this.formatBlockDebugData(blockB, 3),
          blockC: this.formatBlockDebugData(blockC, 3),
          blockD: this.formatBlockDebugData(blockD, 4),
        },
      });
    } catch (debugError) {
      console.error("Failed to save debug data:", debugError);
    }
  }

  /**
   * Format block data for debug output
   */
  private formatBlockDebugData(exercises: any[], limit: number) {
    return {
      count: exercises.length,
      exercises: exercises.slice(0, limit).map((ex) => ({
        id: ex.id,
        name: ex.name,
        score: ex.score || 0,
      })),
    };
  }

  /**
   * Filter exercises for workout generation
   * This is a specialized version that includes client validation and block organization
   */
  async filterForWorkoutGeneration(
    input: WorkoutGenerationInput,
    context: FilterContext,
  ) {
    const apiStartTime = Date.now();

    // Fetch and validate client
    const client = await this.db
      .select()
      .from(user)
      .where(eq(user.id, input.clientId))
      .limit(1)
      .then((res) => res[0]);

    if (!client || client.businessId !== context.businessId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Client not found in your business",
      });
    }

    // Get client's strength and skill capacity from profile
    const userProfile = await this.db.query.UserProfile.findFirst({
      where: and(
        eq(UserProfile.userId, input.clientId),
        eq(UserProfile.businessId, context.businessId),
      ),
    });

    const clientProfile = {
      strengthCapacity: (userProfile?.strengthLevel || "moderate") as
        | "very_low"
        | "low"
        | "moderate"
        | "high",
      skillCapacity: (userProfile?.skillLevel || "moderate") as
        | "very_low"
        | "low"
        | "moderate"
        | "high",
    };

    // Map session goal to primary goal
    const primaryGoal =
      input.sessionGoal === "strength"
        ? ("strength" as const)
        : ("mobility" as const);

    // Build filter input
    const filterInput: FilterInput & { template?: string } = {
      clientId: input.clientId,
      clientName: client.name || client.email || "Client",
      strengthCapacity: clientProfile.strengthCapacity,
      skillCapacity: clientProfile.skillCapacity,
      primaryGoal,
      intensity: input.intensity,
      muscleTarget: input.muscleTarget,
      muscleLessen: input.muscleLessen,
      includeExercises: input.includeExercises,
      avoidExercises: input.avoidExercises,
      avoidJoints: input.avoidJoints,
      debug: input.debug,
      favoriteExerciseIds: input.favoriteExerciseIds,
      template: input.template,
    };

    // Use the main filter method - pass clientId as userId for workout generation
    const filterResult = await this.filterExercises(filterInput, {
      ...context,
      userId: input.clientId, // Use clientId for workout generation
    });
    const filteredExercises = filterResult.exercises;

    // Organize into blocks
    const blockA = filteredExercises.filter((ex: any) => ex.isSelectedBlockA);
    const blockB = filteredExercises.filter((ex: any) => ex.isSelectedBlockB);
    const blockC = filteredExercises.filter((ex: any) => ex.isSelectedBlockC);
    const blockD = filteredExercises.filter((ex: any) => ex.isSelectedBlockD);

    const apiEndTime = Date.now();

    // Removed filter timing logs

    if (input.debug) {
      console.log("Block A exercises:", blockA.length);
      console.log("Block B exercises:", blockB.length);
      console.log("Block C exercises:", blockC.length);
      console.log("Block D exercises:", blockD.length);
    }

    return {
      exercises: filteredExercises,
      blocks: {
        blockA,
        blockB,
        blockC,
        blockD,
      },
      timing: {
        database: filterResult.timing?.database || 0,
        filtering: filterResult.timing?.filtering || 0,
        total: apiEndTime - apiStartTime,
      },
    };
  }
}
