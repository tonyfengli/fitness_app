/**
 * Orchestrates concurrent LLM calls for exercise selection
 * One call per client, using their bucketed candidates
 */

import type { ClientContext } from "../../types/clientContext";
import type { ScoredExercise } from "../../types/scoredExercise";
import type { PreAssignedExercise, ClientExercisePool } from "../../types/standardBlueprint";
import type { GroupScoredExercise } from "../../types/groupContext";
import { WorkoutType } from "../types/workoutTypes";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ClientExerciseSelectionPromptBuilder } from "./prompts/ClientExerciseSelectionPromptBuilder";
import { createLLM } from "../../config/llm";

export interface LLMSelectionInput {
  clientId: string;
  client: ClientContext;
  preAssigned: PreAssignedExercise[];
  bucketedCandidates: ScoredExercise[];  // The 13 from bucketing
  additionalCandidates: ScoredExercise[]; // 2 more to reach 15
}

export interface LLMSelectionResult {
  clientId: string;
  selectedExercises: Array<{
    exercise: ScoredExercise;
    reasoning: string;
    isShared: boolean;
    llmSelected: true;  // Track that LLM selected this
  }>;
  summary: {
    totalSelected: number;
    sharedExercises: number;
    muscleTargetsCovered: string[];
    movementPatterns: string[];
    overallReasoning: string;
  };
  debug?: {
    systemPrompt: string;
    llmResponse: string;
  };
}

export interface LLMSelectionConfig {
  workoutType: WorkoutType;
  sharedExercises: GroupScoredExercise[];
  groupContext: Array<{  // Simplified group info for prompts
    clientId: string;
    name: string;
    muscleTargets: string[];
  }>;
}

export class LLMExerciseSelector {
  private llm = createLLM();
  private captureDebugData: boolean = false;
  
  constructor(private config: LLMSelectionConfig) {}
  
  /**
   * Enable debug data capture
   */
  enableDebugCapture(): void {
    this.captureDebugData = true;
  }
  
  /**
   * Process all clients concurrently
   */
  async selectExercisesForAllClients(
    clientInputs: LLMSelectionInput[]
  ): Promise<Map<string, LLMSelectionResult>> {
    console.log(`🤖 Starting concurrent LLM exercise selection for ${clientInputs.length} clients`);
    
    // Create promises for concurrent execution
    const selectionPromises = clientInputs.map(input => 
      this.selectExercisesForClient(input)
        .catch(error => {
          console.error(`❌ LLM selection failed for client ${input.client.name}:`, error);
          // Return a fallback selection using top scored exercises
          return this.createFallbackSelection(input);
        })
    );
    
    // Execute all LLM calls concurrently
    const results = await Promise.all(selectionPromises);
    
    // Convert to map for easy lookup
    const resultMap = new Map<string, LLMSelectionResult>();
    results.forEach(result => {
      resultMap.set(result.clientId, result);
    });
    
    console.log(`✅ LLM exercise selection complete for all clients`);
    
    return resultMap;
  }
  
  /**
   * Select exercises for a single client
   */
  private async selectExercisesForClient(
    input: LLMSelectionInput
  ): Promise<LLMSelectionResult> {
    // Combine bucketed + additional candidates to get 15 total
    const allCandidates = [
      ...input.bucketedCandidates,
      ...input.additionalCandidates
    ];
    
    // Get other clients info for context (excluding current client)
    const otherClientsInfo = this.config.groupContext
      .filter(gc => gc.clientId !== input.clientId)
      .map(gc => ({
        name: gc.name,
        muscleTargets: gc.muscleTargets
      }));
    
    // Build the prompt
    const promptBuilder = new ClientExerciseSelectionPromptBuilder({
      client: input.client,
      workoutType: this.config.workoutType,
      preAssigned: input.preAssigned,
      candidates: allCandidates,
      sharedExercises: this.config.sharedExercises,
      otherClientsInfo
    });
    
    const prompt = promptBuilder.build();
    
    console.log(`📝 Calling LLM for ${input.client.name} with ${allCandidates.length} candidates`);
    
    // Log the system prompt for debugging
    console.log(`\n=== SYSTEM PROMPT FOR ${input.client.name.toUpperCase()} ===`);
    console.log(prompt);
    console.log(`=== END SYSTEM PROMPT ===\n`);
    
    try {
      // Call LLM
      const response = await this.llm.invoke([
        new SystemMessage(prompt),
        new HumanMessage("Please select the exercises according to the instructions above.")
      ]);
      const content = response.content.toString();
      
      // Log LLM response for debugging
      console.log(`\n=== LLM RESPONSE FOR ${input.client.name.toUpperCase()} ===`);
      console.log(content);
      console.log(`=== END LLM RESPONSE ===\n`);
      
      // Extract JSON from response
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }
      
      const parsed = JSON.parse(jsonMatch[1]);
      
      // Validate and transform response
      const result = this.validateAndTransformResponse(parsed, input, allCandidates);
      
      // Add debug data if enabled
      if (this.captureDebugData) {
        result.debug = {
          systemPrompt: prompt,
          llmResponse: content
        };
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ Error processing LLM response for ${input.client.name}:`, error);
      throw error;
    }
  }
  
  /**
   * Validate LLM response and transform to expected format
   */
  private validateAndTransformResponse(
    llmResponse: any,
    input: LLMSelectionInput,
    candidates: ScoredExercise[]
  ): LLMSelectionResult {
    // Create exercise lookup maps
    const exerciseMap = new Map(candidates.map(ex => [ex.id, ex]));
    const exerciseNameMap = new Map(candidates.map(ex => [ex.name, ex]));
    const sharedIds = new Set(this.config.sharedExercises.map(s => s.id));
    
    // Validate and transform selected exercises
    const selectedExercises = llmResponse.selectedExercises.map((selection: any) => {
      // Now we expect exerciseName as the primary identifier
      let exercise = exerciseNameMap.get(selection.exerciseName);
      
      // Fallback: check if they provided exerciseId instead (old format)
      if (!exercise && selection.exerciseId) {
        exercise = exerciseMap.get(selection.exerciseId);
        
        // Check if LLM swapped the fields
        if (!exercise && exerciseNameMap.has(selection.exerciseId)) {
          console.warn(`⚠️ LLM used name in exerciseId field: ${selection.exerciseId}`);
          exercise = exerciseNameMap.get(selection.exerciseId);
        }
      }
      
      if (!exercise) {
        throw new Error(`Exercise "${selection.exerciseName || selection.exerciseId}" not found in candidates`);
      }
      
      return {
        exercise,
        reasoning: selection.reasoning || 'No reasoning provided',
        isShared: selection.isShared || sharedIds.has(exercise.id),
        llmSelected: true as const
      };
    });
    
    // Extract summary
    const summary = {
      totalSelected: selectedExercises.length,
      sharedExercises: llmResponse.summary?.sharedExercises || 
        selectedExercises.filter((s: any) => s.isShared).length,
      muscleTargetsCovered: llmResponse.summary?.muscleTargetsCovered || [],
      movementPatterns: llmResponse.summary?.movementPatterns || [],
      overallReasoning: llmResponse.summary?.overallReasoning || 'No summary provided'
    };
    
    // Validate count
    const expectedCount = this.getExpectedExerciseCount(input.client.intensity || 'moderate');
    if (selectedExercises.length !== expectedCount) {
      console.warn(
        `⚠️ LLM selected ${selectedExercises.length} exercises for ${input.client.name}, ` +
        `expected ${expectedCount}. Using top ${expectedCount}.`
      );
      
      // Trim or pad as needed
      if (selectedExercises.length > expectedCount) {
        selectedExercises.length = expectedCount;
      }
    }
    
    return {
      clientId: input.clientId,
      selectedExercises,
      summary
    };
  }
  
  /**
   * Create fallback selection if LLM fails
   */
  private createFallbackSelection(input: LLMSelectionInput): LLMSelectionResult {
    console.log(`⚠️ Using fallback selection for ${input.client.name}`);
    
    const expectedCount = this.getExpectedExerciseCount(input.client.intensity || 'moderate');
    const allCandidates = [...input.bucketedCandidates, ...input.additionalCandidates];
    const sharedIds = new Set(this.config.sharedExercises.map(s => s.id));
    
    // Take top scored exercises
    const selectedExercises = allCandidates
      .slice(0, expectedCount)
      .map(exercise => ({
        exercise,
        reasoning: 'Fallback selection based on score',
        isShared: sharedIds.has(exercise.id),
        llmSelected: true as const
      }));
    
    // Build summary
    const movementPatterns = [...new Set(
      selectedExercises.map(s => s.exercise.movementPattern).filter(Boolean)
    )] as string[];
    
    const muscleTargets = [...new Set(
      selectedExercises.map(s => s.exercise.primaryMuscle).filter(Boolean)
    )] as string[];
    
    return {
      clientId: input.clientId,
      selectedExercises,
      summary: {
        totalSelected: selectedExercises.length,
        sharedExercises: selectedExercises.filter(s => s.isShared).length,
        muscleTargetsCovered: muscleTargets,
        movementPatterns,
        overallReasoning: 'Fallback selection used due to LLM error'
      }
    };
  }
  
  /**
   * Get expected exercise count based on intensity
   * This is the number of exercises to SELECT (not including pre-assigned)
   */
  private getExpectedExerciseCount(intensity: 'low' | 'moderate' | 'high' | 'intense'): number {
    switch (intensity) {
      case 'low':
        return 2;  // 4 total - 2 pre-assigned = 2 to select
      case 'moderate':
        return 3;  // 5 total - 2 pre-assigned = 3 to select
      case 'high':
        return 4;  // 6 total - 2 pre-assigned = 4 to select
      case 'intense':
        return 5;  // 7 total - 2 pre-assigned = 5 to select
      default:
        return 3;  // Default to moderate
    }
  }
}