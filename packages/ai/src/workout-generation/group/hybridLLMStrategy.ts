/**
 * Orchestrates the hybrid LLM strategy for group workout generation
 */

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { 
  SharedSelectionInput, 
  SharedSelectionOutput,
  IndividualWorkoutOutput,
  GroupWorkout 
} from "./types/groupWorkout";
import type { GroupBlockBlueprint } from "../../types/groupBlueprint";
import type { ClientContext } from "../../types/clientContext";
import { GroupPromptBuilder } from "./groupPromptBuilder";
import { createLLM } from "../../config/llm";
import { extractJSON } from "./utils/jsonExtraction";

export class HybridLLMStrategy {
  private llm: ChatOpenAI;
  
  constructor() {
    this.llm = createLLM() as ChatOpenAI;
  }
  
  /**
   * Execute the complete hybrid strategy
   */
  async generateGroupWorkout(
    blocks: GroupBlockBlueprint[],
    clients: ClientContext[],
    cohesionSettings: any,
    sessionId: string
  ): Promise<GroupWorkout> {
    const startTime = Date.now();
    const timings = {
      sharedSelection: 0,
      individualSelections: {} as Record<string, number>,
      total: 0
    };
    
    console.log('🤖 Starting hybrid LLM strategy for group workout generation');
    console.log(`   Clients: ${clients.length}`);
    console.log(`   Blocks: ${blocks.length}`);
    
    try {
      // Step 1: Shared Exercise Selection
      console.log('\n📝 Step 1: Selecting shared exercises...');
      const sharedStartTime = Date.now();
      
      const sharedSelections = await this.selectSharedExercises({
        blocks,
        clients,
        cohesionTargets: this.calculateCohesionTargets(blocks, clients, cohesionSettings)
      });
      
      timings.sharedSelection = Date.now() - sharedStartTime;
      console.log(`✅ Shared selection complete in ${timings.sharedSelection}ms`);
      console.log(`   Total shared exercises selected: ${sharedSelections.selections.reduce((sum, s) => sum + s.exercises.length, 0)}`);
      
      // Step 2: Parallel Individual Workouts
      console.log('\n📝 Step 2: Generating individual workouts...');
      const individualWorkouts = await this.generateIndividualWorkouts(
        clients,
        sharedSelections,
        blocks,
        timings.individualSelections
      );
      
      console.log('✅ All individual workouts generated');
      
      // Step 3: Final Assembly
      console.log('\n📝 Step 3: Assembling final group workout...');
      timings.total = Date.now() - startTime;
      
      const groupWorkout: GroupWorkout = {
        sessionId,
        sharedSelections,
        clientWorkouts: individualWorkouts,
        metadata: {
          generatedAt: new Date(),
          totalClients: clients.length,
          averageCohesion: this.calculateAverageCohesion(sharedSelections),
          llmCallDuration: timings
        }
      };
      
      console.log(`✅ Group workout generation complete in ${timings.total}ms`);
      
      return groupWorkout;
      
    } catch (error) {
      console.error('❌ Error in hybrid LLM strategy:', error);
      throw error;
    }
  }
  
  /**
   * Step 1: Select shared exercises using LLM
   */
  private async selectSharedExercises(input: SharedSelectionInput): Promise<SharedSelectionOutput> {
    const systemPrompt = GroupPromptBuilder.buildSharedSelectionSystemPrompt();
    const userMessage = GroupPromptBuilder.buildSharedSelectionUserMessage(input);
    
    console.log('🔄 Calling LLM for shared exercise selection...');
    
    try {
      const response = await this.llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userMessage)
      ]);
      
      const content = response.content.toString();
      const result = extractJSON<SharedSelectionOutput>(content);
      
      if (!result || !result.selections) {
        throw new Error('Invalid response format from LLM');
      }
      
      // Validate the response
      this.validateSharedSelection(result, input);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error in shared exercise selection:', error);
      
      // Fallback: Return empty selections
      return {
        selections: [],
        cohesionAnalysis: {
          targetMet: false,
          totalSharedSlots: 0,
          targetSharedSlots: this.calculateTotalTargetSlots(input.blocks),
          byClient: {}
        },
        reasoning: 'Failed to generate shared selections due to error'
      };
    }
  }
  
  /**
   * Step 2: Generate individual workouts (can be parallelized)
   */
  private async generateIndividualWorkouts(
    clients: ClientContext[],
    sharedSelections: SharedSelectionOutput,
    blocks: GroupBlockBlueprint[],
    timings: Record<string, number>
  ): Promise<Record<string, IndividualWorkoutOutput>> {
    // For now, we'll process sequentially
    // TODO: Implement parallel processing with Promise.all
    
    const workouts: Record<string, IndividualWorkoutOutput> = {};
    
    for (const client of clients) {
      const clientStartTime = Date.now();
      console.log(`\n   Generating workout for ${client.name}...`);
      
      try {
        // TODO: Implement individual workout generation
        // For now, return a placeholder
        workouts[client.user_id] = {
          clientId: client.user_id,
          blocks: {},
          totalSets: 0,
          reasoning: 'TODO: Implement individual workout generation'
        };
        
        timings[client.user_id] = Date.now() - clientStartTime;
        console.log(`   ✅ ${client.name} workout generated in ${timings[client.user_id]}ms`);
        
      } catch (error) {
        console.error(`   ❌ Error generating workout for ${client.name}:`, error);
        timings[client.user_id] = Date.now() - clientStartTime;
        
        // Add fallback workout
        workouts[client.user_id] = {
          clientId: client.user_id,
          blocks: {},
          totalSets: 0,
          reasoning: 'Failed to generate workout due to error'
        };
      }
    }
    
    return workouts;
  }
  
  /**
   * Calculate cohesion targets from settings
   */
  private calculateCohesionTargets(
    blocks: GroupBlockBlueprint[],
    clients: ClientContext[],
    cohesionSettings: any
  ): { overall: number; byClient: Record<string, number> } {
    // Calculate overall target
    const overall = cohesionSettings.defaultSharedRatio || 0.5;
    
    // Calculate per-client targets
    const byClient: Record<string, number> = {};
    clients.forEach(client => {
      byClient[client.user_id] = cohesionSettings.clientSettings?.[client.user_id]?.cohesionRatio || overall;
    });
    
    return { overall, byClient };
  }
  
  /**
   * Calculate total target slots across all blocks
   */
  private calculateTotalTargetSlots(blocks: GroupBlockBlueprint[]): number {
    return blocks.reduce((sum, block) => sum + block.slots.targetShared, 0);
  }
  
  /**
   * Calculate average cohesion achieved
   */
  private calculateAverageCohesion(sharedSelections: SharedSelectionOutput): number {
    const { cohesionAnalysis } = sharedSelections;
    if (!cohesionAnalysis.byClient || Object.keys(cohesionAnalysis.byClient).length === 0) {
      return 0;
    }
    
    const percentages = Object.values(cohesionAnalysis.byClient).map(c => c.percentage);
    return percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
  }
  
  /**
   * Validate shared selection response
   */
  private validateSharedSelection(result: SharedSelectionOutput, input: SharedSelectionInput): void {
    // Validate that selected exercises exist in candidates
    for (const selection of result.selections) {
      const block = input.blocks.find(b => b.blockId === selection.blockId);
      if (!block) {
        throw new Error(`Invalid block ID in selection: ${selection.blockId}`);
      }
      
      for (const exercise of selection.exercises) {
        const candidate = block.sharedCandidates?.exercises?.find(e => e.id === exercise.exerciseId);
        if (!candidate) {
          console.warn(`Selected exercise not found in candidates: ${exercise.exerciseName} (${exercise.exerciseId})`);
        }
      }
    }
  }
}