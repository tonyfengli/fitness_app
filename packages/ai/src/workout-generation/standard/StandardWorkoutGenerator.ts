/**
 * Two-phase workout generator for standard templates
 * Phase 1: Bucketing + Concurrent LLM calls per client for exercise selection
 * Phase 2: Single LLM call for round organization
 */

import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { StandardGroupWorkoutBlueprint } from "../../types/standardBlueprint";
import type { GroupContext } from "../../types/groupContext";
import type { Exercise } from "../../types/exercise";
import type { WorkoutTemplate } from "../../core/templates/types/dynamicBlockTypes";
import type { ExerciseSelection, WorkoutRoundOrganization, StandardWorkoutPlan } from "./types";
import { ExerciseSelectionPromptBuilder } from "./prompts/ExerciseSelectionPromptBuilder";
import { RoundOrganizationPromptBuilder } from "./prompts/RoundOrganizationPromptBuilder";
import { createLLM } from "../../config/llm";
import { WorkoutType } from "../types/workoutTypes";
import { applyFullBodyBucketing } from "../bucketing/fullBodyBucketing";
import { LLMExerciseSelector, type LLMSelectionInput, type LLMSelectionResult } from "./LLMExerciseSelector";
import { getLogger } from "../../utils/logger";

const logger = getLogger();

export class StandardWorkoutGenerator {
  private llm = createLLM();
  private captureDebugData: boolean = false;
  
  constructor(
    private favoritesByClient?: Map<string, string[]>
  ) {}
  
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
    sessionId: string
  ): Promise<StandardWorkoutPlan> {
    const startTime = Date.now();
    logger.log('[StandardWorkoutGenerator] Starting two-phase generation', {
      clients: groupContext.clients.length,
      template: template.id,
      sessionId,
      blueprintType: 'standard',
      totalExercisesPerClient: blueprint.metadata.totalExercisesPerClient,
      preAssignedCount: blueprint.metadata.preAssignedCount
    });
    
    // Phase 1: Exercise Selection
    const exerciseSelection = await this.selectExercises(blueprint, groupContext);
    
    // Phase 2: Round Organization
    const roundOrganization = await this.organizeIntoRounds(
      exerciseSelection,
      template,
      groupContext
    );
    
    const totalDuration = Date.now() - startTime;
    logger.log('[StandardWorkoutGenerator] Two-phase generation complete', {
      totalDurationMs: totalDuration,
      sessionId
    });
    
    const result: StandardWorkoutPlan = {
      exerciseSelection,
      roundOrganization,
      metadata: {
        templateType: template.id,
        clientCount: groupContext.clients.length,
        timestamp: new Date().toISOString(),
        llmModel: 'gpt-4o',
        generationDurationMs: totalDuration
      }
    };
    
    // Add debug data if enabled
    if (this.captureDebugData && (exerciseSelection as any).debugData) {
      result.debug = {
        systemPromptsByClient: {},
        llmResponsesByClient: {}
      };
      
      const debugData = (exerciseSelection as any).debugData;
      for (const [clientId, data] of Object.entries(debugData)) {
        if ((data as any).systemPrompt) {
          result.debug.systemPromptsByClient![clientId] = (data as any).systemPrompt;
        }
        if ((data as any).llmResponse) {
          result.debug.llmResponsesByClient![clientId] = (data as any).llmResponse;
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
    retryCount = 0
  ): Promise<ExerciseSelection> {
    logger.log('[StandardWorkoutGenerator] Phase 1: Bucketing + Concurrent LLM Selection', {
      attempt: retryCount + 1,
      workoutType: groupContext.workoutType
    });
    
    const startTime = Date.now();
    
    try {
      // Step 1: Apply bucketing to get candidates for each client
      const bucketingResults = await this.applyBucketingToAllClients(blueprint, groupContext);
      
      // Step 2: Prepare inputs for concurrent LLM calls
      const llmInputs = this.prepareLLMInputs(blueprint, groupContext, bucketingResults);
      
      // Step 3: Create LLM selector and make concurrent calls
      const llmSelector = new LLMExerciseSelector({
        workoutType: groupContext.workoutType || WorkoutType.FULL_BODY_WITH_FINISHER,
        sharedExercises: blueprint.sharedExercisePool,
        groupContext: groupContext.clients.map(c => ({
          clientId: c.user_id,
          name: c.name,
          muscleTargets: c.muscle_target || []
        }))
      });
      
      // Enable debug capture if requested
      if (this.captureDebugData) {
        llmSelector.enableDebugCapture();
      }
      
      const llmSelections = await llmSelector.selectExercisesForAllClients(llmInputs);
      
      // Step 4: Convert LLM results to ExerciseSelection format
      const exerciseSelection = this.buildExerciseSelection(
        blueprint, 
        groupContext, 
        llmSelections
      );
      
      const duration = Date.now() - startTime;
      logger.log(`[StandardWorkoutGenerator] Phase 1 completed in ${duration}ms`, {
        sharedExercises: exerciseSelection.sharedExercises.length,
        clientsProcessed: Object.keys(exerciseSelection.clientSelections).length
      });
      
      // Add metadata
      (exerciseSelection as any).metadata = { durationMs: duration };
      
      // Collect debug data if enabled
      if (this.captureDebugData) {
        const debugData: Record<string, { systemPrompt?: string; llmResponse?: string }> = {};
        for (const [clientId, result] of llmSelections) {
          if (result.debug) {
            debugData[clientId] = {
              systemPrompt: result.debug.systemPrompt,
              llmResponse: result.debug.llmResponse
            };
          }
        }
        (exerciseSelection as any).debugData = debugData;
      }
      
      // Validate response
      this.validateExerciseSelection(exerciseSelection, blueprint, groupContext);
      
      return exerciseSelection;
      
    } catch (error) {
      logger.error('[StandardWorkoutGenerator] Error in exercise selection:', error);
      
      // Retry logic
      if (retryCount < 2) {
        logger.warn(`[StandardWorkoutGenerator] Retrying Phase 1 (attempt ${retryCount + 2}/3)`);
        return this.selectExercises(blueprint, groupContext, retryCount + 1);
      }
      
      const errorMessage = `Exercise selection failed after 3 attempts: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Phase 2: Organize exercises into rounds
   * Made public to allow external access for the startWorkout flow
   */
  public async organizeIntoRounds(
    exerciseSelection: ExerciseSelection,
    template: WorkoutTemplate,
    groupContext: GroupContext,
    retryCount = 0
  ): Promise<WorkoutRoundOrganization> {
    logger.log('[StandardWorkoutGenerator] Phase 2: Round Organization', {
      attempt: retryCount + 1
    });
    
    // Build prompt
    const promptBuilder = new RoundOrganizationPromptBuilder(
      exerciseSelection,
      template,
      this.getEquipmentFromContext(groupContext)
    );
    const systemPrompt = promptBuilder.build();
    
    // Call LLM
    const startTime = Date.now();
    try {
      const response = await this.llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage("Organize the exercises into rounds with appropriate sets, reps, and equipment management. Return the result as a JSON object.")
      ]);
      
      const duration = Date.now() - startTime;
      logger.log(`[StandardWorkoutGenerator] Phase 2 LLM call completed in ${duration}ms`);
      
      // Parse response
      const content = response.content.toString();
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      
      if (!jsonMatch?.[1]) {
        logger.error('[StandardWorkoutGenerator] Failed to extract JSON from LLM response');
        throw new Error("Failed to parse round organization from LLM response");
      }
      
      const parsed = JSON.parse(jsonMatch[1]) as WorkoutRoundOrganization;
      
      // Add metadata
      (parsed as any).metadata = { durationMs: duration };
      
      // Validate response
      this.validateRoundOrganization(parsed, exerciseSelection);
      
      logger.log('[StandardWorkoutGenerator] Round organization complete', {
        rounds: parsed.rounds.length,
        totalDuration: parsed.workoutSummary.totalDuration
      });
      
      return parsed;
      
    } catch (error) {
      logger.error('[StandardWorkoutGenerator] Error in round organization:', error);
      
      // Retry logic
      if (retryCount < 2) {
        logger.warn(`[StandardWorkoutGenerator] Retrying Phase 2 (attempt ${retryCount + 2}/3)`);
        return this.organizeIntoRounds(exerciseSelection, template, groupContext, retryCount + 1);
      }
      
      const errorMessage = `Round organization failed after 3 attempts: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Get expected total exercises based on intensity
   */
  private getExpectedTotalExercises(intensity?: 'low' | 'moderate' | 'high' | 'intense'): number {
    switch (intensity) {
      case 'low':
        return 4;
      case 'moderate':
        return 5;
      case 'high':
        return 6;
      case 'intense':
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
    groupContext: GroupContext
  ): void {
    // Check all clients have selections
    for (const client of groupContext.clients) {
      if (!selection.clientSelections[client.user_id]) {
        throw new Error(`Missing exercise selection for client ${client.user_id}`);
      }
      
      const clientSelection = selection.clientSelections[client.user_id];
      
      // Calculate expected total based on client intensity
      const intensity = client.intensity || 'moderate';
      const expectedTotal = this.getExpectedTotalExercises(intensity);
      
      const actualTotal = clientSelection ? 
        clientSelection.preAssigned.length + clientSelection.selected.length : 0;
      
      if (actualTotal !== expectedTotal) {
        throw new Error(
          `Client ${client.user_id} has ${actualTotal} exercises, expected ${expectedTotal} for ${intensity} intensity`
        );
      }
    }
    
    // Verify shared exercises match client selections
    for (const shared of selection.sharedExercises) {
      for (const clientId of shared.clientIds) {
        const clientSelection = selection.clientSelections[clientId];
        const hasExercise = clientSelection?.selected.some(
          ex => ex.exerciseId === shared.exerciseId
        ) || false;
        
        if (!hasExercise) {
          logger.warn(
            `Shared exercise ${shared.exerciseName} not found in client ${clientId} selections`
          );
        }
      }
    }
  }
  
  /**
   * Validate round organization response
   */
  private validateRoundOrganization(
    organization: WorkoutRoundOrganization,
    exerciseSelection: ExerciseSelection
  ): void {
    // Check we have expected number of rounds
    if (organization.rounds.length !== 4) {
      throw new Error(`Expected 4 rounds, got ${organization.rounds.length}`);
    }
    
    // Verify all selected exercises are assigned to rounds
    for (const [clientId, selection] of Object.entries(exerciseSelection.clientSelections)) {
      const allExercises = [
        ...selection.preAssigned,
        ...selection.selected
      ];
      
      // Count exercises assigned in rounds
      let assignedCount = 0;
      for (const round of organization.rounds) {
        assignedCount += (round.exercises[clientId] || []).length;
      }
      
      if (assignedCount !== allExercises.length) {
        logger.warn(
          `Client ${clientId} has ${allExercises.length} exercises but ${assignedCount} assigned to rounds`
        );
      }
    }
  }
  
  /**
   * Extract equipment from context or use defaults
   */
  private getEquipmentFromContext(groupContext: GroupContext): string[] {
    // In future, this could come from business settings
    return [
      'barbell',
      'dumbbells',
      'kettlebells',
      'bench',
      'squat rack',
      'pull-up bar',
      'cables',
      'bands',
      'medicine ball',
      'floor space'
    ];
  }
  
  /**
   * Apply bucketing to all clients to get exercise candidates
   */
  private async applyBucketingToAllClients(
    blueprint: StandardGroupWorkoutBlueprint,
    groupContext: GroupContext
  ): Promise<Map<string, ReturnType<typeof applyFullBodyBucketing>>> {
    const results = new Map();
    
    // Only apply bucketing for Full Body workout types
    if (groupContext.workoutType !== WorkoutType.FULL_BODY_WITH_FINISHER && 
        groupContext.workoutType !== WorkoutType.FULL_BODY_WITHOUT_FINISHER) {
      logger.log('[StandardWorkoutGenerator] Skipping bucketing for non-Full Body workout type');
      return results;
    }
    
    for (const [clientId, pool] of Object.entries(blueprint.clientExercisePools)) {
      const client = groupContext.clients.find(c => c.user_id === clientId);
      if (!client) continue;
      
      // Get favorite IDs for this client
      const clientFavoriteIds = this.favoritesByClient?.get(clientId) || [];
      
      // Apply bucketing using client's specific workout type
      const bucketingResult = applyFullBodyBucketing(
        pool.availableCandidates,
        pool.preAssigned,
        client,
        (client.workoutType as WorkoutType) || WorkoutType.FULL_BODY_WITH_FINISHER,
        clientFavoriteIds
      );
      
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
    bucketingResults: Map<string, ReturnType<typeof applyFullBodyBucketing>>
  ): LLMSelectionInput[] {
    const inputs: LLMSelectionInput[] = [];
    
    for (const [clientId, pool] of Object.entries(blueprint.clientExercisePools)) {
      const client = groupContext.clients.find(c => c.user_id === clientId);
      if (!client) continue;
      
      const bucketingResult = bucketingResults.get(clientId);
      
      if (bucketingResult) {
        // Use bucketing results
        const bucketedCandidates = bucketingResult.exercises;
        
        // Add 2 more high-scoring exercises to reach 15
        const bucketedIds = new Set(bucketedCandidates.map(ex => ex.id));
        const additionalCandidates = pool.availableCandidates
          .filter(ex => !bucketedIds.has(ex.id))
          .slice(0, 2);
        
        
        inputs.push({
          clientId,
          client,
          preAssigned: pool.preAssigned,
          bucketedCandidates,
          additionalCandidates
        });
      } else {
        // Fallback: use top 15 from available candidates if no bucketing
        const candidates = pool.availableCandidates.slice(0, 15);
        inputs.push({
          clientId,
          client,
          preAssigned: pool.preAssigned,
          bucketedCandidates: candidates.slice(0, 13),
          additionalCandidates: candidates.slice(13, 15)
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
    llmSelections: Map<string, LLMSelectionResult>
  ): ExerciseSelection {
    const clientSelections: ExerciseSelection['clientSelections'] = {};
    const sharedExerciseMap = new Map<string, Set<string>>();
    
    // Process each client's selection
    for (const [clientId, llmResult] of llmSelections) {
      const pool = blueprint.clientExercisePools[clientId];
      const client = groupContext.clients.find(c => c.user_id === clientId);
      
      if (!pool || !client) continue;
      
      // Convert pre-assigned to expected format
      const preAssigned = pool.preAssigned.map(pa => ({
        exerciseId: pa.exercise.id,
        exerciseName: pa.exercise.name,
        movementPattern: pa.exercise.movementPattern || '',
        primaryMuscle: pa.exercise.primaryMuscle || '',
        source: pa.source
      }));
      
      // Convert LLM selections to expected format
      const selected = llmResult.selectedExercises.map(sel => ({
        exerciseId: sel.exercise.id,
        exerciseName: sel.exercise.name,
        movementPattern: sel.exercise.movementPattern || '',
        primaryMuscle: sel.exercise.primaryMuscle || '',
        score: sel.exercise.score,
        isShared: sel.isShared,
        sharedWith: [] as string[]  // Will populate below
      }));
      
      clientSelections[clientId] = {
        clientName: client.name,
        preAssigned,
        selected,
        totalExercises: preAssigned.length + selected.length
      };
      
      // Track shared exercises
      selected.forEach(ex => {
        if (ex.isShared) {
          if (!sharedExerciseMap.has(ex.exerciseId)) {
            sharedExerciseMap.set(ex.exerciseId, new Set());
          }
          sharedExerciseMap.get(ex.exerciseId)!.add(clientId);
        }
      });
    }
    
    // Update sharedWith arrays and build shared exercises list
    const sharedExercises: ExerciseSelection['sharedExercises'] = [];
    
    for (const [exerciseId, clientIds] of sharedExerciseMap) {
      if (clientIds.size >= 2) {
        const clientIdArray = Array.from(clientIds) as string[];
        
        // Update sharedWith in client selections
        clientIdArray.forEach((clientId: string) => {
          const selection = clientSelections[clientId];
          const exercise = selection?.selected.find(ex => ex.exerciseId === exerciseId);
          if (exercise) {
            exercise.sharedWith = clientIdArray.filter(id => id !== clientId);
          }
        });
        
        // Add to shared exercises list
        const firstClient = clientIdArray[0];
        const exercise = firstClient ? clientSelections[firstClient]?.selected.find((ex: any) => ex.exerciseId === exerciseId) : undefined;
        if (exercise) {
          sharedExercises.push({
            exerciseId,
            exerciseName: exercise.exerciseName,
            clientIds: clientIdArray,
            averageScore: this.calculateAverageScore(exerciseId, clientIdArray, clientSelections)
          });
        }
      }
    }
    
    return {
      clientSelections,
      sharedExercises,
      selectionReasoning: 'Exercises selected using bucketing candidates + LLM optimization'
    };
  }
  
  /**
   * Calculate average score for shared exercise
   */
  private calculateAverageScore(
    exerciseId: string,
    clientIds: string[],
    clientSelections: ExerciseSelection['clientSelections']
  ): number {
    let total = 0;
    let count = 0;
    
    clientIds.forEach(clientId => {
      const exercise = clientSelections[clientId]?.selected.find(ex => ex.exerciseId === exerciseId);
      if (exercise?.score) {
        total += exercise.score;
        count++;
      }
    });
    
    return count > 0 ? total / count : 0;
  }
}