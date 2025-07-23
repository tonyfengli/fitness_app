/**
 * Builds prompts for group workout LLM calls
 */

import type { SharedSelectionInput, SharedExerciseSelection } from "./types/groupWorkout";
import type { GroupBlockBlueprint } from "../../types/groupBlueprint";
import type { ClientContext } from "../../types/clientContext";
import { buildSharedSelectionPrompt } from "./prompts/sharedSelectionPrompt";

export class GroupPromptBuilder {
  /**
   * Build the system prompt for shared exercise selection
   */
  static buildSharedSelectionSystemPrompt(): string {
    return buildSharedSelectionPrompt();
  }
  
  /**
   * Build the user message with the specific workout data
   */
  static buildSharedSelectionUserMessage(input: SharedSelectionInput): string {
    const sections: string[] = [];
    
    // 1. Client Information
    sections.push("## Client Information\n");
    input.clients.forEach(client => {
      sections.push(`**${client.name}** (ID: ${client.user_id})`);
      sections.push(`- Strength: ${client.strength_capacity}, Skill: ${client.skill_capacity}`);
      sections.push(`- Goal: ${client.primary_goal}, Intensity: ${client.intensity}`);
      if (client.muscle_target?.length) {
        sections.push(`- Target muscles: ${client.muscle_target.join(', ')}`);
      }
      sections.push("");
    });
    
    // 2. Cohesion Targets
    sections.push("## Cohesion Targets\n");
    sections.push(`Overall target: ${Math.round(input.cohesionTargets.overall * 100)}% of exercises should be shared\n`);
    sections.push("Per-client targets:");
    Object.entries(input.cohesionTargets.byClient).forEach(([clientId, target]) => {
      const client = input.clients.find(c => c.user_id === clientId);
      sections.push(`- ${client?.name || clientId}: ${Math.round(target * 100)}%`);
    });
    sections.push("");
    
    // 3. Shared Exercise Candidates by Block
    sections.push("## Shared Exercise Candidates\n");
    
    input.blocks.forEach(block => {
      sections.push(`### Block ${block.blockId}`);
      sections.push(`Available shared slots: ${block.slots.actualSharedAvailable}`);
      sections.push(`Target shared slots: ${block.slots.targetShared}\n`);
      
      if (!block.sharedCandidates?.exercises?.length) {
        sections.push("*No shared candidates available for this block*\n");
        return;
      }
      
      sections.push("Candidates (sorted by group score):");
      
      block.sharedCandidates.exercises.forEach((exercise, idx) => {
        sections.push(`\n${idx + 1}. **${exercise.name}** (ID: ${exercise.id})`);
        sections.push(`   Group Score: ${exercise.groupScore.toFixed(2)} (includes +${exercise.cohesionBonus.toFixed(2)} cohesion bonus)`);
        sections.push(`   Shared by: ${exercise.clientsSharing.length} clients`);
        
        // Show which clients can do this exercise and their scores
        sections.push("   Client scores:");
        exercise.clientScores
          .filter(cs => cs.hasExercise)
          .forEach(cs => {
            const client = input.clients.find(c => c.user_id === cs.clientId);
            sections.push(`   - ${client?.name || cs.clientId}: ${cs.individualScore.toFixed(2)}`);
          });
        
        // Add score breakdown if available
        if (exercise.scoreBreakdown) {
          const breakdown = exercise.scoreBreakdown;
          const adjustments: string[] = [];
          
          if (breakdown.muscleTargetBonus > 0) {
            adjustments.push(`target +${breakdown.muscleTargetBonus.toFixed(1)}`);
          }
          if (breakdown.muscleLessenPenalty < 0) {
            adjustments.push(`lessen ${breakdown.muscleLessenPenalty.toFixed(1)}`);
          }
          if (breakdown.intensityAdjustment !== 0) {
            adjustments.push(`intensity ${breakdown.intensityAdjustment > 0 ? '+' : ''}${breakdown.intensityAdjustment.toFixed(1)}`);
          }
          
          if (adjustments.length > 0) {
            sections.push(`   Adjustments: ${adjustments.join(', ')}`);
          }
        }
      });
      
      sections.push(""); // Empty line between blocks
    });
    
    // 4. Current Cohesion Status
    sections.push("## Current Cohesion Tracking\n");
    const firstBlock = input.blocks[0];
    if (firstBlock?.cohesionSnapshot) {
      firstBlock.cohesionSnapshot.forEach(tracking => {
        const client = input.clients.find(c => c.user_id === tracking.clientId);
        sections.push(`${client?.name || tracking.clientId}:`);
        sections.push(`- Needs ${tracking.targetSharedExercises} shared exercises total`);
        sections.push(`- Currently has ${tracking.currentSharedSlots} allocated`);
        sections.push(`- Status: ${tracking.satisfactionStatus}`);
        sections.push("");
      });
    }
    
    return sections.join('\n');
  }
  
  /**
   * Build prompts for individual client workouts
   */
  static buildIndividualWorkoutPrompts(
    client: ClientContext,
    sharedSelections: SharedExerciseSelection[],
    individualCandidates: any,
    setCountRange: { min: number; max: number }
  ): { systemPrompt: string; userMessage: string } {
    // TODO: Implement individual workout prompt builder
    // This will be similar to the existing workout prompt but with shared exercises pre-selected
    
    return {
      systemPrompt: "TODO: Individual workout system prompt",
      userMessage: "TODO: Individual workout user message"
    };
  }
}