/**
 * Two-phase workout generator for standard templates
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

export class StandardWorkoutGenerator {
  private llm = createLLM();
  
  async generate(
    blueprint: StandardGroupWorkoutBlueprint,
    groupContext: GroupContext,
    template: WorkoutTemplate,
    sessionId: string
  ): Promise<StandardWorkoutPlan> {
    const startTime = Date.now();
    console.log('[StandardWorkoutGenerator] Starting two-phase generation', {
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
    console.log('[StandardWorkoutGenerator] Two-phase generation complete', {
      totalDurationMs: totalDuration,
      phase1DurationMs: exerciseSelection.metadata?.durationMs,
      phase2DurationMs: roundOrganization.metadata?.durationMs,
      sessionId
    });
    
    return {
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
  }
  
  /**
   * Phase 1: Select exercises for each client
   */
  private async selectExercises(
    blueprint: StandardGroupWorkoutBlueprint,
    groupContext: GroupContext,
    retryCount = 0
  ): Promise<ExerciseSelection> {
    console.log('[StandardWorkoutGenerator] Phase 1: Exercise Selection', {
      attempt: retryCount + 1
    });
    
    // Build prompt
    const promptBuilder = new ExerciseSelectionPromptBuilder(blueprint, groupContext);
    const systemPrompt = promptBuilder.build();
    
    // Call LLM
    const startTime = Date.now();
    try {
      const response = await this.llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage("Select exercises for each client following the constraints and priorities. Return the result as a JSON object.")
      ]);
      
      const duration = Date.now() - startTime;
      console.log(`[StandardWorkoutGenerator] Phase 1 LLM call completed in ${duration}ms`);
      
      // Parse response
      const content = response.content.toString();
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      
      if (!jsonMatch?.[1]) {
        console.error('[StandardWorkoutGenerator] Failed to extract JSON from LLM response');
        throw new Error("Failed to parse exercise selection from LLM response");
      }
      
      const parsed = JSON.parse(jsonMatch[1]) as ExerciseSelection;
      
      // Add metadata
      (parsed as any).metadata = { durationMs: duration };
      
      // Validate response
      this.validateExerciseSelection(parsed, blueprint, groupContext);
      
      console.log('[StandardWorkoutGenerator] Exercise selection complete', {
        sharedExercises: parsed.sharedExercises.length,
        clients: Object.keys(parsed.clientSelections).length
      });
      
      return parsed;
      
    } catch (error) {
      console.error('[StandardWorkoutGenerator] Error in exercise selection:', error);
      
      // Retry logic
      if (retryCount < 2) {
        console.log(`[StandardWorkoutGenerator] Retrying Phase 1 (attempt ${retryCount + 2}/3)`);
        return this.selectExercises(blueprint, groupContext, retryCount + 1);
      }
      
      throw new Error(`Exercise selection failed after 3 attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Phase 2: Organize exercises into rounds
   */
  private async organizeIntoRounds(
    exerciseSelection: ExerciseSelection,
    template: WorkoutTemplate,
    groupContext: GroupContext,
    retryCount = 0
  ): Promise<WorkoutRoundOrganization> {
    console.log('[StandardWorkoutGenerator] Phase 2: Round Organization', {
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
      console.log(`[StandardWorkoutGenerator] Phase 2 LLM call completed in ${duration}ms`);
      
      // Parse response
      const content = response.content.toString();
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      
      if (!jsonMatch?.[1]) {
        console.error('[StandardWorkoutGenerator] Failed to extract JSON from LLM response');
        throw new Error("Failed to parse round organization from LLM response");
      }
      
      const parsed = JSON.parse(jsonMatch[1]) as WorkoutRoundOrganization;
      
      // Add metadata
      (parsed as any).metadata = { durationMs: duration };
      
      // Validate response
      this.validateRoundOrganization(parsed, exerciseSelection);
      
      console.log('[StandardWorkoutGenerator] Round organization complete', {
        rounds: parsed.rounds.length,
        totalDuration: parsed.workoutSummary.totalDuration
      });
      
      return parsed;
      
    } catch (error) {
      console.error('[StandardWorkoutGenerator] Error in round organization:', error);
      
      // Retry logic
      if (retryCount < 2) {
        console.log(`[StandardWorkoutGenerator] Retrying Phase 2 (attempt ${retryCount + 2}/3)`);
        return this.organizeIntoRounds(exerciseSelection, template, groupContext, retryCount + 1);
      }
      
      throw new Error(`Round organization failed after 3 attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const expectedTotal = blueprint.metadata.totalExercisesPerClient;
      const actualTotal = clientSelection ? 
        clientSelection.preAssigned.length + clientSelection.selected.length : 0;
      
      if (actualTotal !== expectedTotal) {
        throw new Error(
          `Client ${client.user_id} has ${actualTotal} exercises, expected ${expectedTotal}`
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
          console.warn(
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
        console.warn(
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
}