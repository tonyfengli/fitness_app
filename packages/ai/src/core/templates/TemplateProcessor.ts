import type { ScoredExercise } from "../../types/scoredExercise";
import type { WorkoutTemplate, BlockDefinition } from "./types/dynamicBlockTypes";
import type { GroupWorkoutBlueprint, GroupBlockBlueprint } from "../../types/groupBlueprint";
import type { GroupScoredExercise, GroupContext } from "../../types/groupContext";
import type { StandardGroupWorkoutBlueprint, ClientExercisePool, PreAssignedExercise } from "../../types/standardBlueprint";
import { PreAssignmentService } from "./preAssignmentService";

/**
 * Simple, clean template processor for organizing exercises into blocks
 * Principles:
 * 1. Client preferences always override template requirements
 * 2. Templates are guidelines, not hard rules
 * 3. No cohesion complexity (for now)
 */
export class TemplateProcessor {
  constructor(private template: WorkoutTemplate) {}

  /**
   * Process exercises for a single client (individual workout)
   * Future use - not implemented yet
   */
  processForIndividual(
    exercises: ScoredExercise[]
  ): Record<string, ScoredExercise[]> {
    throw new Error("Individual workout processing not implemented yet");
  }

  /**
   * Process exercises for multiple clients (group workout)
   */
  processForGroup(
    clientExercises: Map<string, ScoredExercise[]>
  ): GroupWorkoutBlueprint {
    console.log('🎯 TemplateProcessor.processForGroup', {
      template: this.template.id,
      clientCount: clientExercises.size,
      blocks: this.template.blocks.map(b => ({ id: b.id, name: b.name }))
    });

    const blocks: GroupBlockBlueprint[] = [];
    
    // Track used exercises per client to prevent repetition
    const usedExercisesByClient = new Map<string, Set<string>>();

    // Process each block in the template
    for (const blockDef of this.template.blocks) {
      // Create a filtered version of client exercises that excludes already-used exercises
      const availableClientExercises = new Map<string, ScoredExercise[]>();
      
      for (const [clientId, exercises] of clientExercises) {
        const clientUsed = usedExercisesByClient.get(clientId) || new Set<string>();
        
        // Filter out already used exercises before any block processing
        const availableExercises = exercises.filter(ex => !clientUsed.has(ex.id));
        availableClientExercises.set(clientId, availableExercises);
        
        console.log(`  Client ${clientId}: ${availableExercises.length} exercises available (${clientUsed.size} already used)`);
      }
      
      // Process the block with available exercises only
      const blockBlueprint = this.processBlock(blockDef, availableClientExercises);
      blocks.push(blockBlueprint);
      
      // For deterministic blocks with single selection, track which exercises were selected
      // These are guaranteed to be in the final workout
      if (blockDef.selectionStrategy === 'deterministic' && (blockDef.candidateCount || 1) === 1) {
        for (const [clientId, candidateData] of Object.entries(blockBlueprint.individualCandidates)) {
          const clientUsed = usedExercisesByClient.get(clientId) || new Set<string>();
          
          // Take the top exercise (we know candidateCount is 1)
          const topExercise = candidateData.exercises[0];
          
          if (topExercise) {
            clientUsed.add(topExercise.id);
            console.log(`    Marking exercise "${topExercise.name}" as used for client ${clientId} (deterministic selection)`);
            usedExercisesByClient.set(clientId, clientUsed);
          }
        }
      }
    }

    return {
      blocks,
      validationWarnings: this.validateBlueprint(blocks)
    };
  }

  /**
   * Process a single block
   */
  private processBlock(
    blockDef: BlockDefinition,
    clientExercises: Map<string, ScoredExercise[]>
  ): GroupBlockBlueprint {
    console.log(`\n📦 Processing block ${blockDef.id} (${blockDef.name})`);

    // Step 1: Filter exercises for this block for each client
    const blockFilteredExercises = new Map<string, ScoredExercise[]>();
    
    for (const [clientId, exercises] of clientExercises) {
      const filtered = this.filterExercisesForBlock(exercises, blockDef, clientId);
      blockFilteredExercises.set(clientId, filtered);
      
      console.log(`  Client ${clientId}: ${filtered.length} exercises match block criteria`);
    }

    // Step 2: Find shared exercises (appear for 2+ clients)
    const sharedCandidates = this.findSharedExercises(blockFilteredExercises);
    
    // Step 3: Prepare individual candidates
    const individualCandidates = this.prepareIndividualCandidates(
      blockFilteredExercises,
      blockDef.maxExercises,
      blockDef.candidateCount
    );

    // Step 4: Calculate slot allocation
    const slots = this.calculateSlots(
      blockDef.maxExercises,
      sharedCandidates.length
    );

    return {
      blockId: blockDef.id,
      blockConfig: blockDef,
      slots,
      sharedCandidates: {
        exercises: sharedCandidates,
        minClientsRequired: 2,
        subGroupPossibilities: [] // Simplified - no subgroups for now
      },
      individualCandidates
    };
  }

  /**
   * Filter exercises for a specific block based on its requirements
   * Block constraints are enforced on ALL exercises, including client includes
   */
  private filterExercisesForBlock(
    exercises: ScoredExercise[],
    blockDef: BlockDefinition,
    clientId: string
  ): ScoredExercise[] {
    return exercises.filter(exercise => {
      // Note: Client includes no longer bypass block filters
      // They must meet block requirements to appear in that block
      
      // Step 1: Check function tags (skip if no tags specified)
      if (blockDef.functionTags && blockDef.functionTags.length > 0) {
        if (!exercise.functionTags?.some(tag => blockDef.functionTags.includes(tag))) {
          return false;
        }
      }

      // Step 2: Apply movement pattern filter (if specified)
      if (blockDef.movementPatternFilter) {
        const { include, exclude } = blockDef.movementPatternFilter;
        
        if (!exercise.movementPattern) {
          return false; // No pattern = can't match filter
        }

        if (include && include.length > 0) {
          if (!include.includes(exercise.movementPattern)) {
            return false;
          }
        }

        if (exclude && exclude.length > 0) {
          if (exclude.includes(exercise.movementPattern)) {
            return false;
          }
        }
      }

      // Step 3: Apply equipment filter (if specified)
      if (blockDef.equipmentFilter) {
        const { required, forbidden } = blockDef.equipmentFilter;
        
        if (required && required.length > 0) {
          if (!exercise.equipment || !exercise.equipment.some(e => required.includes(e))) {
            return false;
          }
        }

        if (forbidden && forbidden.length > 0) {
          if (exercise.equipment && exercise.equipment.some(e => forbidden.includes(e))) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Check if an exercise was explicitly included by the client
   * This would need to be implemented based on how client includes are tracked
   */
  private isClientIncludedExercise(exercise: ScoredExercise, clientId: string): boolean {
    // Check if the exercise has an include boost in its score breakdown
    if (exercise.scoreBreakdown && 'includeExerciseBoost' in exercise.scoreBreakdown) {
      return exercise.scoreBreakdown.includeExerciseBoost > 0;
    }
    // Legacy check for older data format
    if (exercise.scoreBreakdown && 'includeBoost' in exercise.scoreBreakdown) {
      const breakdown = exercise.scoreBreakdown as Record<string, number>;
      return (breakdown.includeBoost ?? 0) > 0;
    }
    return false;
  }

  /**
   * Find exercises that appear for multiple clients
   */
  private findSharedExercises(
    clientExercises: Map<string, ScoredExercise[]>
  ): GroupScoredExercise[] {
    const exerciseClientMap = new Map<string, Set<string>>();
    const exerciseMap = new Map<string, ScoredExercise>();
    const exerciseScoreMap = new Map<string, Map<string, number>>();

    // Build map of exercise ID to client IDs
    // Only include if the exercise scores >= 5.0 for the client
    for (const [clientId, exercises] of clientExercises) {
      for (const exercise of exercises) {
        // Skip exercises that score below base (5.0) for this client
        if (exercise.score < 5.0) {
          continue;
        }
        
        if (!exerciseClientMap.has(exercise.id)) {
          exerciseClientMap.set(exercise.id, new Set());
          exerciseMap.set(exercise.id, exercise);
          exerciseScoreMap.set(exercise.id, new Map());
        }
        exerciseClientMap.get(exercise.id)!.add(clientId);
        exerciseScoreMap.get(exercise.id)!.set(clientId, exercise.score);
      }
    }

    // Convert to GroupScoredExercise for exercises with 2+ clients
    const sharedExercises: GroupScoredExercise[] = [];
    
    for (const [exerciseId, clientIds] of exerciseClientMap) {
      if (clientIds.size >= 2) {
        const exercise = exerciseMap.get(exerciseId)!;
        const clientsArray = Array.from(clientIds);
        
        // Calculate group score (average of individual scores)
        // Use stored scores from the map (we know they're all >= 5.0)
        let totalScore = 0;
        const scoreMap = exerciseScoreMap.get(exerciseId)!;
        const clientScores = clientsArray.map(clientId => {
          const score = scoreMap.get(clientId) ?? 5;
          totalScore += score;
          
          return {
            clientId,
            individualScore: score,
            hasExercise: true
          };
        });

        sharedExercises.push({
          ...exercise,
          groupScore: totalScore / clientsArray.length,
          clientScores,
          clientsSharing: clientsArray
        });
      }
    }

    // Sort by number of clients sharing (descending), then by group score
    sharedExercises.sort((a, b) => {
      const clientDiff = b.clientsSharing.length - a.clientsSharing.length;
      if (clientDiff !== 0) return clientDiff;
      return b.groupScore - a.groupScore;
    });

    console.log(`  Found ${sharedExercises.length} shared exercises (2+ clients with score >= 5.0)`);
    if (sharedExercises.length > 0) {
      console.log(`  Top shared: ${sharedExercises[0]!.name} (${sharedExercises[0]!.clientsSharing.length} clients)`);
    }

    return sharedExercises;
  }

  /**
   * Prepare individual exercise candidates for each client
   */
  private prepareIndividualCandidates(
    clientExercises: Map<string, ScoredExercise[]>,
    maxExercises: number,
    candidateCount?: number
  ): Record<string, { exercises: ScoredExercise[]; slotsToFill: number; allFilteredExercises?: ScoredExercise[] }> {
    const candidates: Record<string, { exercises: ScoredExercise[]; slotsToFill: number; allFilteredExercises?: ScoredExercise[] }> = {};
    // Use candidateCount if specified, otherwise default to maxExercises
    const numCandidates = candidateCount ?? maxExercises;

    for (const [clientId, exercises] of clientExercises) {
      candidates[clientId] = {
        exercises: exercises.slice(0, numCandidates), // Limit to candidateCount
        slotsToFill: maxExercises, // Will be adjusted based on shared selections
        allFilteredExercises: exercises // Include all exercises that passed the block filter
      };
    }

    return candidates;
  }

  /**
   * Calculate slot allocation for a block
   */
  private calculateSlots(
    maxExercises: number,
    sharedCandidatesCount: number
  ): GroupBlockBlueprint['slots'] {
    // Simple allocation: Try to use 30-50% for shared if available
    const targetSharedRatio = 0.4;
    const targetShared = Math.floor(maxExercises * targetSharedRatio);
    const actualSharedAvailable = Math.min(targetShared, sharedCandidatesCount);
    const individualPerClient = maxExercises - actualSharedAvailable;

    return {
      total: maxExercises,
      targetShared,
      actualSharedAvailable,
      individualPerClient
    };
  }

  /**
   * Validate the blueprint and generate warnings
   */
  private validateBlueprint(blocks: GroupBlockBlueprint[]): string[] {
    const warnings: string[] = [];

    for (const block of blocks) {
      // Check if block has enough exercises
      const hasEnoughShared = block.slots.actualSharedAvailable >= block.slots.targetShared * 0.5;
      if (!hasEnoughShared && block.slots.targetShared > 0) {
        warnings.push(
          `Block ${block.blockId}: Only ${block.slots.actualSharedAvailable} shared exercises available (target: ${block.slots.targetShared})`
        );
      }

      // Check if any client has too few individual exercises
      for (const [clientId, data] of Object.entries(block.individualCandidates)) {
        if (data.exercises.length < data.slotsToFill) {
          warnings.push(
            `Block ${block.blockId}: Client ${clientId} only has ${data.exercises.length} exercises (needs ${data.slotsToFill})`
          );
        }
      }
    }

    return warnings;
  }

  /**
   * Process exercises for standard template (client-pooled approach)
   * Two-phase LLM strategy: exercise selection then round organization
   */
  processForStandardGroup(
    clientExercises: Map<string, ScoredExercise[]>,
    groupContext?: GroupContext,
    favoritesByClient?: Map<string, string[]>
  ): StandardGroupWorkoutBlueprint {
    console.log('🎯 TemplateProcessor.processForStandardGroup', {
      template: this.template.id,
      clientCount: clientExercises.size,
      totalExercisesPerClient: this.template.metadata?.totalExercisesPerClient || 8
    });

    // Step 1: Determine pre-assigned exercises using includes and favorites
    const preAssignedByClient = new Map<string, PreAssignedExercise[]>();
    
    // Only process pre-assignment for standard templates
    if (groupContext && favoritesByClient) {
      for (const [clientId, exercises] of clientExercises) {
        const client = groupContext.clients.find(c => c.user_id === clientId);
        if (!client) continue;
        
        const favoriteIds = favoritesByClient.get(clientId) || [];
        const preAssigned = PreAssignmentService.determinePreAssignedExercises(
          client,
          exercises,
          favoriteIds,
          groupContext.workoutType
        );
        
        preAssignedByClient.set(clientId, preAssigned);
      }
    }

    // Step 2: Create available exercise pools (excluding pre-assigned)
    const clientPools = new Map<string, ScoredExercise[]>();
    
    for (const [clientId, exercises] of clientExercises) {
      const preAssigned = preAssignedByClient.get(clientId) || [];
      const preAssignedIds = new Set(preAssigned.map(p => p.exercise.id));
      
      // Filter out pre-assigned exercises
      const availableExercises = exercises.filter(ex => !preAssignedIds.has(ex.id));
      clientPools.set(clientId, availableExercises);
      
      console.log(`  Client ${clientId}: ${availableExercises.length} available exercises (${preAssigned.length} pre-assigned)`);
    }

    // Step 3: Find ALL shared exercises across the entire pool
    const sharedExercisePool = this.findAllSharedExercises(clientPools);

    // Step 4: Build the standard blueprint
    const clientExercisePools: Record<string, ClientExercisePool> = {};
    const totalExercisesPerClient = this.template.metadata?.totalExercisesPerClient || 8;
    const preAssignedCount = this.template.metadata?.preAssignedCount || 2;

    for (const [clientId, exercises] of clientPools) {
      const preAssigned = preAssignedByClient.get(clientId) || [];
      
      clientExercisePools[clientId] = {
        preAssigned,
        availableCandidates: exercises,
        totalExercisesNeeded: totalExercisesPerClient,
        additionalNeeded: totalExercisesPerClient - preAssigned.length
      };
    }

    return {
      clientExercisePools,
      sharedExercisePool,
      metadata: {
        templateType: this.template.id,
        workoutFlow: this.template.metadata?.workoutFlow || 'strength-metabolic',
        totalExercisesPerClient,
        preAssignedCount
      },
      validationWarnings: this.validateStandardBlueprint(clientExercisePools, sharedExercisePool)
    };
  }

  /**
   * Extract pre-assigned exercises from deterministic blocks
   * @deprecated - Now using PreAssignmentService with includes/favorites logic
   */
  private extractPreAssignedExercises(
    clientExercises: Map<string, ScoredExercise[]>
  ): Map<string, PreAssignedExercise[]> {
    const preAssignedByClient = new Map<string, PreAssignedExercise[]>();

    // Only process deterministic blocks with candidateCount = 1
    const deterministicBlocks = this.template.blocks.filter(
      block => block.selectionStrategy === 'deterministic' && (block.candidateCount || 1) === 1
    );

    for (const blockDef of deterministicBlocks) {
      for (const [clientId, exercises] of clientExercises) {
        // Filter exercises for this block
        const filtered = this.filterExercisesForBlock(exercises, blockDef, clientId);
        
        if (filtered.length > 0) {
          // Take the top exercise
          const topExercise = filtered[0];
          if (topExercise) {
            const preAssigned = preAssignedByClient.get(clientId) || [];
            preAssigned.push({
              exercise: topExercise,
              source: blockDef.metadata?.round || blockDef.id
            });
            preAssignedByClient.set(clientId, preAssigned);
            
            console.log(`  Pre-assigned for ${clientId} in ${blockDef.id}: ${topExercise.name}`);
          }
        }
      }
    }

    return preAssignedByClient;
  }

  /**
   * Find ALL shared exercises across the entire exercise pool
   * Not limited to specific blocks - for standard template
   */
  private findAllSharedExercises(
    clientPools: Map<string, ScoredExercise[]>
  ): GroupScoredExercise[] {
    const exerciseClientMap = new Map<string, Set<string>>();
    const exerciseMap = new Map<string, ScoredExercise>();
    const exerciseScoreMap = new Map<string, Map<string, number>>();

    // Build map of exercise ID to client IDs
    for (const [clientId, exercises] of clientPools) {
      for (const exercise of exercises) {
        // Only include if score >= 5.0 (quality threshold)
        if (exercise.score < 5.0) {
          continue;
        }
        
        if (!exerciseClientMap.has(exercise.id)) {
          exerciseClientMap.set(exercise.id, new Set());
          exerciseMap.set(exercise.id, exercise);
          exerciseScoreMap.set(exercise.id, new Map());
        }
        exerciseClientMap.get(exercise.id)!.add(clientId);
        exerciseScoreMap.get(exercise.id)!.set(clientId, exercise.score);
      }
    }

    // Convert to GroupScoredExercise for exercises with 2+ clients
    const sharedExercises: GroupScoredExercise[] = [];
    
    for (const [exerciseId, clientIds] of exerciseClientMap) {
      if (clientIds.size >= 2) {
        const exercise = exerciseMap.get(exerciseId)!;
        const clientsArray = Array.from(clientIds);
        
        // Calculate group score
        let totalScore = 0;
        const scoreMap = exerciseScoreMap.get(exerciseId)!;
        const clientScores = clientsArray.map(clientId => {
          const score = scoreMap.get(clientId) ?? 5;
          totalScore += score;
          
          return {
            clientId,
            individualScore: score,
            hasExercise: true
          };
        });

        sharedExercises.push({
          ...exercise,
          groupScore: totalScore / clientsArray.length,
          clientScores,
          clientsSharing: clientsArray
        });
      }
    }

    // Sort by number of clients sharing (descending), then by group score
    sharedExercises.sort((a, b) => {
      const clientDiff = b.clientsSharing.length - a.clientsSharing.length;
      if (clientDiff !== 0) return clientDiff;
      return b.groupScore - a.groupScore;
    });

    console.log(`  Found ${sharedExercises.length} shared exercises across entire pool`);
    if (sharedExercises.length > 0) {
      console.log(`  Top shared: ${sharedExercises[0]!.name} (${sharedExercises[0]!.clientsSharing.length} clients, score: ${sharedExercises[0]!.groupScore.toFixed(1)})`);
    }

    return sharedExercises;
  }

  /**
   * Validate standard blueprint and generate warnings
   */
  private validateStandardBlueprint(
    clientPools: Record<string, ClientExercisePool>,
    sharedExercises: GroupScoredExercise[]
  ): string[] {
    const warnings: string[] = [];

    // Check if we have enough exercises for each client
    for (const [clientId, pool] of Object.entries(clientPools)) {
      const totalAvailable = pool.preAssigned.length + pool.availableCandidates.length;
      if (totalAvailable < pool.totalExercisesNeeded) {
        warnings.push(
          `Client ${clientId}: Only ${totalAvailable} exercises available (needs ${pool.totalExercisesNeeded})`
        );
      }
    }

    // Check if we have any shared exercises
    if (sharedExercises.length === 0) {
      warnings.push('No shared exercises found - all clients will have individual workouts');
    }

    // Check if pre-assigned exercises are properly set
    const clientCount = Object.keys(clientPools).length;
    const expectedPreAssigned = this.template.metadata?.preAssignedCount || 0;
    
    // Only warn if we expect pre-assigned exercises but don't have them
    if (expectedPreAssigned > 0) {
      for (const [clientId, pool] of Object.entries(clientPools)) {
        if (pool.preAssigned.length !== expectedPreAssigned) {
          warnings.push(
            `Client ${clientId}: ${pool.preAssigned.length} pre-assigned exercises (expected ${expectedPreAssigned})`
          );
        }
      }
    }

    return warnings;
  }
}