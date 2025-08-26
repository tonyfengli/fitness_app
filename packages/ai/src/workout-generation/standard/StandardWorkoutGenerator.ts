/**
 * Two-phase workout generator for standard templates
 * Phase 1: Bucketing + Concurrent LLM calls per client for exercise selection
 * Phase 2: Single LLM call for round organization
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import type { WorkoutTemplate } from "../../core/templates/types/dynamicBlockTypes";
import type { Exercise } from "../../types/exercise";
import type { GroupContext } from "../../types/groupContext";
import type { StandardGroupWorkoutBlueprint } from "../../types/standardBlueprint";
import type {
  LLMSelectionInput,
  LLMSelectionResult,
} from "./LLMExerciseSelector";
import type {
  ExerciseSelection,
  StandardWorkoutPlan,
} from "./types";
import { createLLM } from "../../config/llm";
import { getLogger } from "../../utils/logger";
import { applyFullBodyBucketing } from "../bucketing/fullBodyBucketing";
import { applyTargetedBucketing } from "../bucketing/targetedBucketing";
import { WorkoutType } from "../types/workoutTypes";
import { LLMExerciseSelector } from "./LLMExerciseSelector";
import { ExerciseSelectionPromptBuilder } from "./prompts/ExerciseSelectionPromptBuilder";
import { Phase2SelectionPromptBuilder } from "./prompts/Phase2SelectionPromptBuilder";
import { AllowedSlotsResult, Phase2SelectionResult } from "../../types/phase2Types";
import { ExerciseWithTier } from "../../types/exerciseTiers";
// import { RoundOrganizationPromptBuilder } from "./prompts/RoundOrganizationPromptBuilder"; // REMOVED - Phase 2 being replaced

const logger = getLogger();

export class StandardWorkoutGenerator {
  private llm = createLLM({
    modelName: "gpt-5",
    maxTokens: 4000,
    reasoning_effort: "high",
    verbosity: "normal",
    // Note: GPT-5 only supports default temperature (1.0)
  });
  private captureDebugData: boolean = false;

  constructor(private favoritesByClient?: Map<string, string[]>) {}

  /**
   * Enable debug data capture
   */
  enableDebugCapture(): void {
    this.captureDebugData = true;
  }

  async generate(
    blueprint: StandardGroupWorkoutBlueprint,
    groupContext: GroupContext,
    template: WorkoutTemplate,
    sessionId: string,
  ): Promise<StandardWorkoutPlan> {
    const startTime = Date.now();
    logger.log("[StandardWorkoutGenerator] Starting two-phase generation", {
      clients: groupContext.clients.length,
      template: template.id,
      sessionId,
      blueprintType: "standard",
      totalExercisesPerClient: blueprint.metadata.totalExercisesPerClient,
      preAssignedCount: blueprint.metadata.preAssignedCount,
    });

    // Phase 1: Exercise Selection
    const exerciseSelection = await this.selectExercises(
      blueprint,
      groupContext,
    );

    // Phase 2: Round Organization - REMOVED for new implementation
    // const roundOrganization = await this.organizeIntoRounds(
    //   exerciseSelection,
    //   template,
    //   groupContext,
    // );

    const totalDuration = Date.now() - startTime;
    logger.log("[StandardWorkoutGenerator] Phase 1 generation complete", {
      totalDurationMs: totalDuration,
      sessionId,
    });

    const result: StandardWorkoutPlan = {
      exerciseSelection,
      // roundOrganization, // Removed - will be handled by new Phase 2
      metadata: {
        templateType: template.id,
        clientCount: groupContext.clients.length,
        timestamp: new Date().toISOString(),
        llmModel: "gpt-5",
        generationDurationMs: totalDuration,
      },
    };

    // Add debug data if enabled
    if (this.captureDebugData && (exerciseSelection as any).debugData) {
      result.debug = {
        systemPromptsByClient: {},
        llmResponsesByClient: {},
      };

      const debugData = (exerciseSelection as any).debugData;
      for (const [clientId, data] of Object.entries(debugData)) {
        if ((data as any).systemPrompt) {
          result.debug.systemPromptsByClient![clientId] = (
            data as any
          ).systemPrompt;
        }
        if ((data as any).llmResponse) {
          result.debug.llmResponsesByClient![clientId] = (
            data as any
          ).llmResponse;
        }
      }
    }

    return result;
  }

  /**
   * Phase 1: Select exercises for each client using bucketing + concurrent LLM
   */
  private async selectExercises(
    blueprint: StandardGroupWorkoutBlueprint,
    groupContext: GroupContext,
    retryCount = 0,
  ): Promise<ExerciseSelection> {
    // Get workout type from first client (they should all be the same for group workouts)
    const workoutType = groupContext.clients[0]?.workoutType as WorkoutType;

    logger.log(
      "[StandardWorkoutGenerator] Phase 1: Bucketing + Concurrent LLM Selection",
      {
        attempt: retryCount + 1,
        workoutType: workoutType,
      },
    );

    const startTime = Date.now();

    try {
      // Step 1: Apply bucketing to get candidates for each client
      const bucketingResults = await this.applyBucketingToAllClients(
        blueprint,
        groupContext,
      );

      // Step 2: Prepare inputs for concurrent LLM calls
      const llmInputs = this.prepareLLMInputs(
        blueprint,
        groupContext,
        bucketingResults,
      );

      // Step 3: Create LLM selector and make concurrent calls
      const llmSelector = new LLMExerciseSelector({
        workoutType: workoutType || WorkoutType.FULL_BODY_WITH_FINISHER,
        sharedExercises: blueprint.sharedExercisePool,
        groupContext: groupContext.clients.map((c) => ({
          clientId: c.user_id,
          name: c.name,
          muscleTargets: c.muscle_target || [],
        })),
      });

      // Debug capture is now always enabled for visualization
      // (removed the conditional check)

      logger.log(
        "[StandardWorkoutGenerator] Calling LLM selector for clients:",
        {
          clientCount: llmInputs.length,
          clientIds: llmInputs.map((input) => input.clientId),
        },
      );

      const llmSelections =
        await llmSelector.selectExercisesForAllClients(llmInputs);

      // Step 4: Convert LLM results to ExerciseSelection format
      const exerciseSelection = this.buildExerciseSelection(
        blueprint,
        groupContext,
        llmSelections,
      );

      const duration = Date.now() - startTime;
      logger.log(
        `[StandardWorkoutGenerator] Phase 1 completed in ${duration}ms`,
        {
          sharedExercises: exerciseSelection.sharedExercises.length,
          clientsProcessed: Object.keys(exerciseSelection.clientSelections)
            .length,
        },
      );

      // Add metadata
      (exerciseSelection as any).metadata = { durationMs: duration };

      // Always collect debug data for visualization
      // (previously this was only done when captureDebugData was true)
      const debugData: Record<
        string,
        { systemPrompt?: string; llmResponse?: string }
      > = {};
      const llmTimings: Record<
        string,
        { start: string; end: string; durationMs: number }
      > = {};
      
      for (const [clientId, result] of llmSelections) {
        if (result.debug) {
          debugData[clientId] = {
            systemPrompt: result.debug.systemPrompt,
            llmResponse: result.debug.llmResponse,
          };
        }
        if (result.timing) {
          llmTimings[clientId] = result.timing;
        }
      }
      
      if (Object.keys(debugData).length > 0) {
        (exerciseSelection as any).debugData = debugData;
        logger.log(
          "[StandardWorkoutGenerator] Debug data collected for clients:",
          Object.keys(debugData),
        );
      }
      
      // Add LLM timing data
      if (Object.keys(llmTimings).length > 0) {
        (exerciseSelection as any).llmTimings = llmTimings;
        logger.log(
          "[StandardWorkoutGenerator] LLM timing data collected for clients:",
          Object.keys(llmTimings),
        );
      }

      // Validate response
      this.validateExerciseSelection(
        exerciseSelection,
        blueprint,
        groupContext,
      );

      return exerciseSelection;
    } catch (error) {
      logger.error(
        "[StandardWorkoutGenerator] Error in exercise selection:",
        error,
      );

      // Retry logic
      if (retryCount < 2) {
        logger.warn(
          `[StandardWorkoutGenerator] Retrying Phase 1 (attempt ${retryCount + 2}/3)`,
        );
        return this.selectExercises(blueprint, groupContext, retryCount + 1);
      }

      const errorMessage = `Exercise selection failed after 3 attempts: ${error instanceof Error ? error.message : "Unknown error"}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Phase 2: Organize exercises into rounds
   * Made public to allow external access for the startWorkout flow
   * REMOVED - Being replaced with new Phase 2 implementation
   */
  /*
  public async organizeIntoRounds(
    exerciseSelection: ExerciseSelection,
    template: WorkoutTemplate,
    groupContext: GroupContext,
    retryCount = 0,
  ): Promise<WorkoutRoundOrganization> {
    logger.log("[StandardWorkoutGenerator] Phase 2: Round Organization", {
      attempt: retryCount + 1,
    });

    // Build prompt
    const promptBuilder = new RoundOrganizationPromptBuilder(
      exerciseSelection,
      template,
      this.getEquipmentFromContext(groupContext),
    );
    const systemPrompt = promptBuilder.build();

    // Call LLM
    const startTime = Date.now();
    try {
      const response = await this.llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(
          "Organize the exercises into rounds with appropriate sets, reps, and equipment management. Return the result as a JSON object.",
        ),
      ]);

      const duration = Date.now() - startTime;
      logger.log(
        `[StandardWorkoutGenerator] Phase 2 LLM call completed in ${duration}ms`,
      );

      // Parse response
      const content = response.content.toString();
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);

      if (!jsonMatch?.[1]) {
        logger.error(
          "[StandardWorkoutGenerator] Failed to extract JSON from LLM response",
        );
        throw new Error("Failed to parse round organization from LLM response");
      }

      const parsed = JSON.parse(jsonMatch[1]) as WorkoutRoundOrganization;

      // Add metadata
      (parsed as any).metadata = { durationMs: duration };

      // Validate response
      this.validateRoundOrganization(parsed, exerciseSelection);

      logger.log("[StandardWorkoutGenerator] Round organization complete", {
        rounds: parsed.rounds.length,
        totalDuration: parsed.workoutSummary.totalDuration,
      });

      return parsed;
    } catch (error) {
      logger.error(
        "[StandardWorkoutGenerator] Error in round organization:",
        error,
      );

      // Retry logic
      if (retryCount < 2) {
        logger.warn(
          `[StandardWorkoutGenerator] Retrying Phase 2 (attempt ${retryCount + 2}/3)`,
        );
        return this.organizeIntoRounds(
          exerciseSelection,
          template,
          groupContext,
          retryCount + 1,
        );
      }

      const errorMessage = `Round organization failed after 3 attempts: ${error instanceof Error ? error.message : "Unknown error"}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
  */

  /**
   * Get expected total exercises based on intensity
   */
  private getExpectedTotalExercises(
    intensity?: "low" | "moderate" | "high" | "intense",
  ): number {
    switch (intensity) {
      case "low":
        return 4;
      case "moderate":
        return 5;
      case "high":
        return 6;
      case "intense":
        return 7;
      default:
        return 5; // Default to moderate
    }
  }

  /**
   * Validate exercise selection response
   */
  private validateExerciseSelection(
    selection: ExerciseSelection,
    blueprint: StandardGroupWorkoutBlueprint,
    groupContext: GroupContext,
  ): void {
    // Check all clients have selections
    for (const client of groupContext.clients) {
      if (!selection.clientSelections[client.user_id]) {
        throw new Error(
          `Missing exercise selection for client ${client.user_id}`,
        );
      }

      const clientSelection = selection.clientSelections[client.user_id];

      // Calculate expected total based on client intensity
      const intensity = client.intensity || "moderate";
      const expectedTotal = this.getExpectedTotalExercises(intensity);

      const actualTotal = clientSelection
        ? clientSelection.preAssigned.length + clientSelection.selected.length
        : 0;

      if (actualTotal !== expectedTotal) {
        throw new Error(
          `Client ${client.user_id} has ${actualTotal} exercises, expected ${expectedTotal} for ${intensity} intensity`,
        );
      }
    }

    // Verify shared exercises match client selections
    for (const shared of selection.sharedExercises) {
      for (const clientId of shared.clientIds) {
        const clientSelection = selection.clientSelections[clientId];
        const hasExercise =
          clientSelection?.selected.some(
            (ex) => ex.exerciseId === shared.exerciseId,
          ) || false;

        if (!hasExercise) {
          logger.warn(
            `Shared exercise ${shared.exerciseName} not found in client ${clientId} selections`,
          );
        }
      }
    }
  }

  /**
   * Validate round organization response
   * REMOVED - Part of old Phase 2 implementation
   */
  /*
  private validateRoundOrganization(
    organization: WorkoutRoundOrganization,
    exerciseSelection: ExerciseSelection,
  ): void {
    // Check we have expected number of rounds
    if (organization.rounds.length !== 4) {
      throw new Error(`Expected 4 rounds, got ${organization.rounds.length}`);
    }

    // Verify all selected exercises are assigned to rounds
    for (const [clientId, selection] of Object.entries(
      exerciseSelection.clientSelections,
    )) {
      const allExercises = [...selection.preAssigned, ...selection.selected];

      // Count exercises assigned in rounds
      let assignedCount = 0;
      for (const round of organization.rounds) {
        assignedCount += (round.exercises[clientId] || []).length;
      }

      if (assignedCount !== allExercises.length) {
        logger.warn(
          `Client ${clientId} has ${allExercises.length} exercises but ${assignedCount} assigned to rounds`,
        );
      }
    }
  }
  */

  /**
   * Extract equipment from context or use defaults
   */
  private getEquipmentFromContext(groupContext: GroupContext): string[] {
    // In future, this could come from business settings
    return [
      "barbell",
      "dumbbells",
      "kettlebells",
      "bench",
      "squat rack",
      "pull-up bar",
      "cables",
      "bands",
      "medicine ball",
      "floor space",
    ];
  }

  /**
   * Apply bucketing to all clients to get exercise candidates
   */
  private async applyBucketingToAllClients(
    blueprint: StandardGroupWorkoutBlueprint,
    groupContext: GroupContext,
  ): Promise<Map<string, ReturnType<typeof applyFullBodyBucketing>>> {
    const results = new Map();

    logger.log("[Bucketing Debug] Starting applyBucketingToAllClients", {
      clientCount: groupContext.clients.length,
      clientWorkoutTypes: groupContext.clients.map(c => ({
        name: c.name,
        workoutType: c.workoutType
      }))
    });

    logger.log("[Bucketing Debug] Processing individual clients");

    for (const [clientId, pool] of Object.entries(
      blueprint.clientExercisePools,
    )) {
      const client = groupContext.clients.find((c) => c.user_id === clientId);
      if (!client) {
        logger.log(`[Bucketing Debug] Client ${clientId} not found in groupContext`);
        continue;
      }

      // Get favorite IDs for this client
      const clientFavoriteIds = this.favoritesByClient?.get(clientId) || [];

      // Apply appropriate bucketing based on THIS client's workout type
      const clientWorkoutType = (client.workoutType as WorkoutType) ||
        WorkoutType.FULL_BODY_WITH_FINISHER;
      
      // Check if THIS client's workout type is Full Body or Targeted
      const isClientFullBody = [
        WorkoutType.FULL_BODY_WITH_FINISHER,
        WorkoutType.FULL_BODY_WITHOUT_FINISHER,
        WorkoutType.FULL_BODY_WITHOUT_FINISHER_WITH_CORE
      ].includes(clientWorkoutType);
      
      const isClientTargeted = [
        WorkoutType.TARGETED_WITH_FINISHER,
        WorkoutType.TARGETED_WITHOUT_FINISHER,
        WorkoutType.TARGETED_WITHOUT_FINISHER_WITH_CORE,
        WorkoutType.TARGETED_WITH_FINISHER_WITH_CORE
      ].includes(clientWorkoutType);

      if (!isClientFullBody && !isClientTargeted) {
        logger.log(
          `[Bucketing Debug] Skipping bucketing for client ${client.name} - unsupported workout type: ${clientWorkoutType}`
        );
        continue;
      }

      logger.log(`[Bucketing Debug] Applying bucketing for client ${client.name}`, {
        workoutType: clientWorkoutType,
        isFullBody: isClientFullBody,
        isTargeted: isClientTargeted
      });
      
      const bucketingResult = isClientFullBody
        ? applyFullBodyBucketing(
            pool.availableCandidates,
            pool.preAssigned,
            client,
            clientWorkoutType,
            clientFavoriteIds,
          )
        : applyTargetedBucketing(
            pool.availableCandidates,
            pool.preAssigned,
            client,
            clientWorkoutType,
            clientFavoriteIds,
          );

      // Store the bucketing result in the pool for frontend visualization
      pool.bucketedSelection = {
        exercises: bucketingResult.exercises,
        bucketAssignments: bucketingResult.bucketAssignments,
      };

      results.set(clientId, bucketingResult);
    }

    return results;
  }

  /**
   * Prepare inputs for LLM selection
   */
  private prepareLLMInputs(
    blueprint: StandardGroupWorkoutBlueprint,
    groupContext: GroupContext,
    bucketingResults: Map<string, ReturnType<typeof applyFullBodyBucketing>>,
  ): LLMSelectionInput[] {
    const inputs: LLMSelectionInput[] = [];

    for (const [clientId, pool] of Object.entries(
      blueprint.clientExercisePools,
    )) {
      const client = groupContext.clients.find((c) => c.user_id === clientId);
      if (!client) continue;

      const bucketingResult = bucketingResults.get(clientId);

      if (bucketingResult) {
        // Use bucketing results
        const bucketedCandidates = bucketingResult.exercises;

        // Add 2 more high-scoring exercises to reach 15
        const bucketedIds = new Set(bucketedCandidates.map((ex) => ex.id));
        const additionalCandidates = pool.availableCandidates
          .filter((ex) => !bucketedIds.has(ex.id))
          .slice(0, 2);

        inputs.push({
          clientId,
          client,
          preAssigned: pool.preAssigned,
          bucketedCandidates,
          additionalCandidates,
        });
      } else {
        // Fallback: use top 15 from available candidates if no bucketing
        const candidates = pool.availableCandidates.slice(0, 15);
        inputs.push({
          clientId,
          client,
          preAssigned: pool.preAssigned,
          bucketedCandidates: candidates.slice(0, 13),
          additionalCandidates: candidates.slice(13, 15),
        });
      }
    }

    return inputs;
  }

  /**
   * Build ExerciseSelection from LLM results
   */
  private buildExerciseSelection(
    blueprint: StandardGroupWorkoutBlueprint,
    groupContext: GroupContext,
    llmSelections: Map<string, LLMSelectionResult>,
  ): ExerciseSelection {
    const clientSelections: ExerciseSelection["clientSelections"] = {};
    const sharedExerciseMap = new Map<string, Set<string>>();

    // Process each client's selection
    for (const [clientId, llmResult] of llmSelections) {
      const pool = blueprint.clientExercisePools[clientId];
      const client = groupContext.clients.find((c) => c.user_id === clientId);

      if (!pool || !client) continue;

      // Convert pre-assigned to expected format
      const preAssigned = pool.preAssigned.map((pa) => ({
        exerciseId: pa.exercise.id,
        exerciseName: pa.exercise.name,
        movementPattern: pa.exercise.movementPattern || "",
        primaryMuscle: pa.exercise.primaryMuscle || "",
        source: pa.source,
      }));

      // Convert LLM selections to expected format
      const selected = llmResult.selectedExercises.map((sel) => ({
        exerciseId: sel.exercise.id,
        exerciseName: sel.exercise.name,
        movementPattern: sel.exercise.movementPattern || "",
        primaryMuscle: sel.exercise.primaryMuscle || "",
        score: sel.exercise.score,
        isShared: sel.isShared,
        sharedWith: [] as string[], // Will populate below
      }));

      clientSelections[clientId] = {
        clientName: client.name,
        preAssigned,
        selected,
        totalExercises: preAssigned.length + selected.length,
      };

      // Track shared exercises
      selected.forEach((ex) => {
        if (ex.isShared) {
          if (!sharedExerciseMap.has(ex.exerciseId)) {
            sharedExerciseMap.set(ex.exerciseId, new Set());
          }
          sharedExerciseMap.get(ex.exerciseId)!.add(clientId);
        }
      });
    }

    // Update sharedWith arrays and build shared exercises list
    const sharedExercises: ExerciseSelection["sharedExercises"] = [];

    for (const [exerciseId, clientIds] of sharedExerciseMap) {
      if (clientIds.size >= 2) {
        const clientIdArray = Array.from(clientIds) as string[];

        // Update sharedWith in client selections
        clientIdArray.forEach((clientId: string) => {
          const selection = clientSelections[clientId];
          const exercise = selection?.selected.find(
            (ex) => ex.exerciseId === exerciseId,
          );
          if (exercise) {
            exercise.sharedWith = clientIdArray.filter((id) => id !== clientId);
          }
        });

        // Add to shared exercises list
        const firstClient = clientIdArray[0];
        const exercise = firstClient
          ? clientSelections[firstClient]?.selected.find(
              (ex: any) => ex.exerciseId === exerciseId,
            )
          : undefined;
        if (exercise) {
          sharedExercises.push({
            exerciseId,
            exerciseName: exercise.exerciseName,
            clientIds: clientIdArray,
            averageScore: this.calculateAverageScore(
              exerciseId,
              clientIdArray,
              clientSelections,
            ),
          });
        }
      }
    }

    return {
      clientSelections,
      sharedExercises,
      selectionReasoning:
        "Exercises selected using bucketing candidates + LLM optimization",
    };
  }

  /**
   * Calculate average score for shared exercise
   */
  private calculateAverageScore(
    exerciseId: string,
    clientIds: string[],
    clientSelections: ExerciseSelection["clientSelections"],
  ): number {
    let total = 0;
    let count = 0;

    clientIds.forEach((clientId) => {
      const exercise = clientSelections[clientId]?.selected.find(
        (ex) => ex.exerciseId === exerciseId,
      );
      if (exercise?.score) {
        total += exercise.score;
        count++;
      }
    });

    return count > 0 ? total / count : 0;
  }

  /**
   * Phase 2: Select remaining exercises for each client/round
   * Takes preprocessing results and uses LLM to make final selections
   */
  public async selectRemainingExercises(
    preprocessingResult: AllowedSlotsResult,
    exercises: ExerciseWithTier[],
    totalRounds: number,
    clientPlans: Array<{ clientId: string; bundleSkeleton: number[] }>
  ): Promise<{
    systemPrompt: string;
    humanMessage: string;
    llmResponse: string;
    selections: Phase2SelectionResult;
  }> {
    const startTime = Date.now();
    const promptBuilder = new Phase2SelectionPromptBuilder();

    // Build system prompt
    const systemPrompt = promptBuilder.buildSystemPrompt();

    // Transform preprocessing data to compact format
    // First, update slots remaining with actual client plan data
    const compactInput = promptBuilder.transformToCompactFormat(
      preprocessingResult,
      exercises,
      totalRounds
    );

    // Override slots remaining with actual bundle skeleton data
    clientPlans.forEach(plan => {
      if (!compactInput.slotsRemaining[plan.clientId]) {
        compactInput.slotsRemaining[plan.clientId] = Array(totalRounds).fill(0);
      }
      
      // Calculate actual slots remaining based on bundle skeleton and used slots
      plan.bundleSkeleton.forEach((maxSlots, roundIndex) => {
        const usedSlots = preprocessingResult.clientUsedSlots[plan.clientId]?.[roundIndex] || 0;
        const slotsRemaining = compactInput.slotsRemaining[plan.clientId];
        if (slotsRemaining) {
          slotsRemaining[roundIndex] = maxSlots - usedSlots;
        }
      });
    });

    // Build human message
    const humanMessage = promptBuilder.buildHumanMessage(compactInput);

    try {
      // Call LLM with gpt-5-mini (same as Phase 1)
      const llm = createLLM({
        modelName: "gpt-5-mini",
        maxTokens: 1000,
        reasoning_effort: "medium",
        verbosity: "low",
      });

      logger.log("[Phase2] Calling LLM for exercise selection", {
        totalOptions: compactInput.options.length,
        totalRounds,
        clients: Object.keys(compactInput.slotsRemaining).length,
      });

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(humanMessage),
      ];

      const response = await llm.invoke(messages);
      const llmResponse = response.content as string;

      logger.log("[Phase2] LLM response received", {
        responseLength: llmResponse.length,
        duration: Date.now() - startTime,
      });

      // Parse response
      const selections = this.parsePhase2Response(llmResponse);

      return {
        systemPrompt,
        humanMessage,
        llmResponse,
        selections,
      };
    } catch (error) {
      logger.error("[Phase2] Error in LLM call", error);
      throw new Error(
        `Phase 2 selection failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Parse Phase 2 LLM response
   */
  private parsePhase2Response(response: string): Phase2SelectionResult {
    try {
      // Try to extract JSON from markdown code blocks first
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      const jsonStr = jsonMatch?.[1] || response;

      // Parse JSON
      const parsed = JSON.parse(jsonStr);

      // Validate structure
      if (!parsed.placements || !Array.isArray(parsed.placements)) {
        throw new Error("Response missing 'placements' array");
      }

      // Validate each placement
      const validPlacements: Array<[string, number]> = [];
      for (const placement of parsed.placements) {
        if (
          Array.isArray(placement) &&
          placement.length === 2 &&
          typeof placement[0] === "string" &&
          typeof placement[1] === "number"
        ) {
          validPlacements.push(placement as [string, number]);
        } else {
          logger.warn("[Phase2] Invalid placement format", placement);
        }
      }

      return {
        placements: validPlacements,
        roundNames: parsed.roundNames || {},
      };
    } catch (error) {
      logger.error("[Phase2] Failed to parse LLM response", { response, error });
      throw new Error(
        `Failed to parse Phase 2 response: ${error instanceof Error ? error.message : "Invalid JSON"}`
      );
    }
  }
}
