import type { GroupContext, GroupScoredExercise } from "../../types/groupContext";
import type { 
  GroupWorkoutBlueprint, 
  GroupBlockBlueprint, 
  ClientCohesionTracking,
  SubGroupPossibility 
} from "../../types/groupBlueprint";
import type { WorkoutTemplate } from "../../types/workoutTemplate";
import type { ScoredExercise } from "../scoring/types";
import type { BlockConfig } from "./types/dynamicBlockTypes";
import { WorkoutTemplateHandler } from "./WorkoutTemplateHandler";
import { getWorkoutTemplate } from "./config/defaultTemplates";

/**
 * Handles template organization for group workouts
 * Creates blueprints with shared/individual slot allocation
 */
export class GroupWorkoutTemplateHandler {
  private template: WorkoutTemplate;
  private groupContext: GroupContext;
  private blockConfigs: BlockConfig[];
  private individualHandlers: Map<string, WorkoutTemplateHandler>;
  private cohesionTracking: Map<string, ClientCohesionTracking>;
  
  constructor(groupContext: GroupContext, template: WorkoutTemplate) {
    this.groupContext = groupContext;
    this.template = template;
    
    // Get block configurations
    const templateConfig = getWorkoutTemplate(template.id);
    if (!templateConfig) {
      throw new Error(`Template ${template.id} not found`);
    }
    this.blockConfigs = templateConfig.blocks;
    
    // Create individual handlers for each client (for individual exercise selection)
    this.individualHandlers = new Map();
    for (const client of groupContext.clients) {
      this.individualHandlers.set(
        client.user_id,
        new WorkoutTemplateHandler(template)
      );
    }
    
    // Initialize cohesion tracking
    this.cohesionTracking = this.initializeCohesionTracking();
  }
  
  /**
   * Initialize cohesion tracking for all clients
   */
  private initializeCohesionTracking(): Map<string, ClientCohesionTracking> {
    const tracking = new Map<string, ClientCohesionTracking>();
    
    // Calculate total exercises in workout
    const totalExercises = this.blockConfigs.reduce(
      (sum, block) => sum + block.maxExercises, 
      0
    );
    
    // Calculate mandatory shared exercises (blocks with enforceShared)
    const mandatoryShared = this.blockConfigs
      .filter(block => {
        const blockSettings = this.groupContext.groupCohesionSettings.blockSettings[block.id];
        return blockSettings?.enforceShared;
      })
      .reduce((sum, block) => sum + block.maxExercises, 0);
    
    // Initialize tracking for each client
    for (const client of this.groupContext.clients) {
      const cohesionRatio = this.groupContext.clientGroupSettings[client.user_id]?.cohesionRatio || 0.5;
      
      // Apply ratio only to non-mandatory exercises
      const flexibleExercises = totalExercises - mandatoryShared;
      const targetFlexibleShared = Math.round(flexibleExercises * cohesionRatio);
      const targetTotal = targetFlexibleShared + mandatoryShared;
      
      tracking.set(client.user_id, {
        clientId: client.user_id,
        cohesionRatio,
        totalExercisesInWorkout: totalExercises,
        targetSharedExercises: targetTotal,
        currentSharedSlots: 0,
        remainingSharedNeeded: targetTotal,
        satisfactionStatus: 'on_track'
      });
    }
    
    return tracking;
  }
  
  /**
   * Update cohesion tracking after allocating shared slots
   */
  private updateCohesionTracking(sharedSlotsAllocated: number): void {
    for (const tracking of this.cohesionTracking.values()) {
      tracking.currentSharedSlots += sharedSlotsAllocated;
      tracking.remainingSharedNeeded = Math.max(0, 
        tracking.targetSharedExercises - tracking.currentSharedSlots
      );
      
      // Update satisfaction status
      const progress = tracking.currentSharedSlots / tracking.targetSharedExercises;
      if (progress >= 1) {
        tracking.satisfactionStatus = 'satisfied';
      } else if (progress > 1.1) {
        tracking.satisfactionStatus = 'over';
      } else if (tracking.remainingSharedNeeded > 0) {
        tracking.satisfactionStatus = 'needs_more';
      } else {
        tracking.satisfactionStatus = 'on_track';
      }
    }
  }
  
  /**
   * Calculate sub-group possibilities for shared exercises
   */
  private calculateSubGroupPossibilities(
    exercises: GroupScoredExercise[]
  ): SubGroupPossibility[] {
    const possibilities: SubGroupPossibility[] = [];
    
    for (const exercise of exercises) {
      // Only include exercises that meet minimum threshold
      if (exercise.clientsSharing.length >= 2) {
        possibilities.push({
          exerciseId: exercise.id,
          clientIds: exercise.clientsSharing,
          groupSize: exercise.clientsSharing.length
        });
      }
    }
    
    return possibilities;
  }
  
  /**
   * Create blueprint for a single block
   */
  private createBlockBlueprint(
    block: BlockConfig,
    groupPool: GroupScoredExercise[],
    clientExercises: Map<string, ScoredExercise[]>
  ): GroupBlockBlueprint {
    // Get block cohesion settings
    const blockSettings = this.groupContext.groupCohesionSettings.blockSettings[block.id] || {
      sharedRatio: this.groupContext.groupCohesionSettings.defaultSharedRatio,
      enforceShared: false
    };
    
    // Calculate target shared slots
    const targetShared = Math.floor(block.maxExercises * blockSettings.sharedRatio);
    
    // Find quality shared candidates (2+ clients)
    const sharedCandidates = groupPool.filter(ex => ex.clientsSharing.length >= 2);
    const actualSharedAvailable = Math.min(targetShared, sharedCandidates.length);
    
    // Calculate individual slots
    const individualPerClient = block.maxExercises - actualSharedAvailable;
    
    // Update cohesion tracking
    this.updateCohesionTracking(actualSharedAvailable);
    
    // Prepare individual candidates for each client
    const individualCandidates: { [clientId: string]: { exercises: ScoredExercise[]; slotsToFill: number } } = {};
    
    for (const [clientId, exercises] of clientExercises) {
      // Filter to only exercises matching this block's function tags
      const blockExercises = exercises.filter(ex => 
        block.functionTags.some(tag => ex.function_tags?.includes(tag))
      );
      
      individualCandidates[clientId] = {
        exercises: blockExercises,
        slotsToFill: individualPerClient
      };
    }
    
    // Create cohesion snapshot
    const cohesionSnapshot = Array.from(this.cohesionTracking.values());
    
    return {
      blockId: block.id,
      blockConfig: block,
      slots: {
        total: block.maxExercises,
        targetShared,
        actualSharedAvailable,
        individualPerClient
      },
      sharedCandidates: {
        exercises: sharedCandidates.slice(0, actualSharedAvailable * 2), // Give LLM options
        minClientsRequired: 2,
        subGroupPossibilities: this.calculateSubGroupPossibilities(sharedCandidates)
      },
      individualCandidates,
      cohesionSnapshot
    };
  }
  
  /**
   * Main method to create the group workout blueprint
   */
  public createBlueprint(
    clientScoredExercises: Map<string, ScoredExercise[]>
  ): GroupWorkoutBlueprint {
    const blocks: GroupBlockBlueprint[] = [];
    const warnings: string[] = [];
    
    // Process each block
    for (const block of this.blockConfigs) {
      // Get group pool for this block
      const groupPool = this.groupContext.groupExercisePools?.[block.id] || [];
      
      // Create blueprint for this block
      const blockBlueprint = this.createBlockBlueprint(
        block,
        groupPool,
        clientScoredExercises
      );
      
      blocks.push(blockBlueprint);
      
      // Add warnings if needed
      if (blockBlueprint.slots.actualSharedAvailable === 0 && 
          blockBlueprint.slots.targetShared > 0) {
        warnings.push(
          `${block.name}: No exercises available for sharing (target was ${blockBlueprint.slots.targetShared})`
        );
      }
    }
    
    // Final cohesion validation
    const finalTracking = Array.from(this.cohesionTracking.values());
    for (const tracking of finalTracking) {
      if (tracking.satisfactionStatus === 'needs_more' && tracking.remainingSharedNeeded > 2) {
        warnings.push(
          `Client ${tracking.clientId}: Only ${tracking.currentSharedSlots}/${tracking.targetSharedExercises} shared exercises allocated`
        );
      }
    }
    
    return {
      blocks,
      clientCohesionTracking: finalTracking,
      validationWarnings: warnings.length > 0 ? warnings : undefined
    };
  }
}