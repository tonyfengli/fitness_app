import type { ClientContext } from "../../types/clientContext";
import type {
  GroupBlockBlueprint,
  GroupWorkoutBlueprint,
} from "../../types/groupBlueprint";
import type {
  GroupContext,
  GroupScoredExercise,
} from "../../types/groupContext";
import type { ScoredExercise } from "../../types/scoredExercise";
import type {
  ClientExercisePool,
  PreAssignedExercise,
  StandardGroupWorkoutBlueprint,
} from "../../types/standardBlueprint";
import type {
  BlockDefinition,
  WorkoutTemplate,
} from "./types/dynamicBlockTypes";
import { WorkoutType } from "../../types/clientTypes";
import {
  getPreAssignmentTieInfo,
  processPreAssignments,
} from "../../workout-generation/strategies/workoutTypeStrategies";
import { SCORING_CONFIG } from "../scoring/scoringConfig";
import { PreAssignmentService } from "./preAssignmentService";
import { mapMuscleToConsolidated } from "../../constants/muscleMapping";

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
    exercises: ScoredExercise[],
  ): Record<string, ScoredExercise[]> {
    throw new Error("Individual workout processing not implemented yet");
  }

  /**
   * Process exercises for multiple clients (group workout)
   */
  processForGroup(
    clientExercises: Map<string, ScoredExercise[]>,
  ): GroupWorkoutBlueprint {
    // Removed debug log
    //   template: this.template.id,
    //   clientCount: clientExercises.size,
    //   blocks: this.template.blocks.map(b => ({ id: b.id, name: b.name }))
    // });

    const blocks: GroupBlockBlueprint[] = [];

    // Track used exercises per client to prevent repetition
    const usedExercisesByClient = new Map<string, Set<string>>();

    // Process each block in the template
    for (const blockDef of this.template.blocks) {
      // Create a filtered version of client exercises that excludes already-used exercises
      const availableClientExercises = new Map<string, ScoredExercise[]>();

      for (const [clientId, exercises] of clientExercises) {
        const clientUsed =
          usedExercisesByClient.get(clientId) || new Set<string>();

        // Filter out already used exercises before any block processing
        const availableExercises = exercises.filter(
          (ex) => !clientUsed.has(ex.id),
        );
        availableClientExercises.set(clientId, availableExercises);

        // Removed verbose per-client availability logging
      }

      // Process the block with available exercises only
      const blockBlueprint = this.processBlock(
        blockDef,
        availableClientExercises,
      );
      blocks.push(blockBlueprint);

      // For deterministic blocks with single selection, track which exercises were selected
      // These are guaranteed to be in the final workout
      if (
        blockDef.selectionStrategy === "deterministic" &&
        (blockDef.candidateCount || 1) === 1
      ) {
        for (const [clientId, candidateData] of Object.entries(
          blockBlueprint.individualCandidates,
        )) {
          const clientUsed =
            usedExercisesByClient.get(clientId) || new Set<string>();

          // Take the top exercise (we know candidateCount is 1)
          const topExercise = candidateData.exercises[0];

          if (topExercise) {
            clientUsed.add(topExercise.id);
            // Marked exercise as used for deterministic selection
            usedExercisesByClient.set(clientId, clientUsed);
          }
        }
      }
    }

    return {
      blocks,
      validationWarnings: this.validateBlueprint(blocks),
    };
  }

  /**
   * Process a single block
   */
  private processBlock(
    blockDef: BlockDefinition,
    clientExercises: Map<string, ScoredExercise[]>,
  ): GroupBlockBlueprint {
    // Removed debug log

    // Step 1: Filter exercises for this block for each client
    const blockFilteredExercises = new Map<string, ScoredExercise[]>();

    for (const [clientId, exercises] of clientExercises) {
      const filtered = this.filterExercisesForBlock(
        exercises,
        blockDef,
        clientId,
      );
      blockFilteredExercises.set(clientId, filtered);

      // Removed verbose per-client block filtering results
    }

    // Step 2: Find shared exercises (appear for 2+ clients)
    // Circuit MVP: Skip shared candidate detection for circuit templates
    const sharedCandidates = this.template.id === 'circuit' 
      ? [] 
      : this.findSharedExercises(blockFilteredExercises);

    // Step 3: Prepare individual candidates
    const individualCandidates = this.prepareIndividualCandidates(
      blockFilteredExercises,
      blockDef.maxExercises,
      blockDef.candidateCount,
    );

    // Step 4: Calculate slot allocation
    const slots = this.calculateSlots(
      blockDef.maxExercises,
      sharedCandidates.length,
    );

    return {
      blockId: blockDef.id,
      blockConfig: blockDef,
      slots,
      sharedCandidates: {
        exercises: sharedCandidates,
        minClientsRequired: 2,
        subGroupPossibilities: [], // Simplified - no subgroups for now
      },
      individualCandidates,
    };
  }

  /**
   * Filter exercises for a specific block based on its requirements
   * Block constraints are enforced on ALL exercises, including client includes
   */
  private filterExercisesForBlock(
    exercises: ScoredExercise[],
    blockDef: BlockDefinition,
    clientId: string,
  ): ScoredExercise[] {
    return exercises.filter((exercise) => {
      // Note: Client includes no longer bypass block filters
      // They must meet block requirements to appear in that block

      // Step 1: Check function tags (skip if no tags specified)
      if (blockDef.functionTags && blockDef.functionTags.length > 0) {
        if (
          !exercise.functionTags?.some((tag) =>
            blockDef.functionTags.includes(tag),
          )
        ) {
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
          if (
            !exercise.equipment ||
            !exercise.equipment.some((e) => required.includes(e))
          ) {
            return false;
          }
        }

        if (forbidden && forbidden.length > 0) {
          if (
            exercise.equipment &&
            exercise.equipment.some((e) => forbidden.includes(e))
          ) {
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
  private isClientIncludedExercise(
    exercise: ScoredExercise,
    clientId: string,
  ): boolean {
    // Check if the exercise has an include boost in its score breakdown
    if (
      exercise.scoreBreakdown &&
      "includeExerciseBoost" in exercise.scoreBreakdown
    ) {
      return exercise.scoreBreakdown.includeExerciseBoost > 0;
    }
    // Legacy check for older data format
    if (exercise.scoreBreakdown && "includeBoost" in exercise.scoreBreakdown) {
      const breakdown = exercise.scoreBreakdown as Record<string, number>;
      return (breakdown.includeBoost ?? 0) > 0;
    }
    return false;
  }

  /**
   * Find exercises that appear for multiple clients
   */
  private findSharedExercises(
    clientExercises: Map<string, ScoredExercise[]>,
  ): GroupScoredExercise[] {
    const exerciseClientMap = new Map<string, Set<string>>();
    const exerciseMap = new Map<string, ScoredExercise>();
    const exerciseScoreMap = new Map<string, Map<string, number>>();

    // Build map of exercise ID to client IDs
    // Use different thresholds based on exercise type
    for (const [clientId, exercises] of clientExercises) {
      for (const exercise of exercises) {
        // Determine threshold based on exercise type
        const isCoreOrFinisher =
          exercise.functionTags?.some(
            (tag) => tag === "core" || tag === "capacity",
          ) ?? false;
        const threshold = isCoreOrFinisher
          ? SCORING_CONFIG.SHARED_EXERCISE_CORE_FINISHER_MIN_SCORE
          : SCORING_CONFIG.SHARED_EXERCISE_MIN_SCORE;

        // Skip exercises that score below the appropriate threshold
        if (exercise.score < threshold) {
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
        // Use stored scores from the map (we know they're all >= 6.5)
        let totalScore = 0;
        const scoreMap = exerciseScoreMap.get(exerciseId)!;
        const clientScores = clientsArray.map((clientId: string) => {
          const score =
            scoreMap.get(clientId) ?? SCORING_CONFIG.SHARED_EXERCISE_MIN_SCORE;
          totalScore += score;

          return {
            clientId,
            individualScore: score,
            hasExercise: true,
          };
        });

        sharedExercises.push({
          ...exercise,
          groupScore: totalScore / clientsArray.length,
          clientScores,
          clientsSharing: clientsArray,
        });
      }
    }

    // Sort by number of clients sharing (descending), then by group score
    sharedExercises.sort((a, b) => {
      const clientDiff = b.clientsSharing.length - a.clientsSharing.length;
      if (clientDiff !== 0) return clientDiff;
      return b.groupScore - a.groupScore;
    });

    // Keep essential shared exercise summary
    // Found ${sharedExercises.length} shared exercises for block
    // Removed verbose top shared exercise logging

    return sharedExercises;
  }

  /**
   * Prepare individual exercise candidates for each client
   */
  private prepareIndividualCandidates(
    clientExercises: Map<string, ScoredExercise[]>,
    maxExercises: number,
    candidateCount?: number,
  ): Record<
    string,
    {
      exercises: ScoredExercise[];
      slotsToFill: number;
      allFilteredExercises?: ScoredExercise[];
    }
  > {
    const candidates: Record<
      string,
      {
        exercises: ScoredExercise[];
        slotsToFill: number;
        allFilteredExercises?: ScoredExercise[];
      }
    > = {};
    // Use candidateCount if specified, otherwise default to maxExercises
    const numCandidates = candidateCount ?? maxExercises;

    for (const [clientId, exercises] of clientExercises) {
      candidates[clientId] = {
        exercises: exercises.slice(0, numCandidates), // Limit to candidateCount
        slotsToFill: maxExercises, // Will be adjusted based on shared selections
        allFilteredExercises: exercises, // Include all exercises that passed the block filter
      };
    }

    return candidates;
  }

  /**
   * Calculate slot allocation for a block
   */
  private calculateSlots(
    maxExercises: number,
    sharedCandidatesCount: number,
  ): GroupBlockBlueprint["slots"] {
    // Simple allocation: Try to use 30-50% for shared if available
    const targetSharedRatio = 0.4;
    const targetShared = Math.floor(maxExercises * targetSharedRatio);
    const actualSharedAvailable = Math.min(targetShared, sharedCandidatesCount);
    const individualPerClient = maxExercises - actualSharedAvailable;

    return {
      total: maxExercises,
      targetShared,
      actualSharedAvailable,
      individualPerClient,
    };
  }

  /**
   * Validate the blueprint and generate warnings
   */
  private validateBlueprint(blocks: GroupBlockBlueprint[]): string[] {
    const warnings: string[] = [];

    for (const block of blocks) {
      // Check if block has enough exercises
      const hasEnoughShared =
        block.slots.actualSharedAvailable >= block.slots.targetShared * 0.5;
      if (!hasEnoughShared && block.slots.targetShared > 0) {
        warnings.push(
          `Block ${block.blockId}: Only ${block.slots.actualSharedAvailable} shared exercises available (target: ${block.slots.targetShared})`,
        );
      }

      // Check if any client has too few individual exercises
      for (const [clientId, data] of Object.entries(
        block.individualCandidates,
      )) {
        if (data.exercises.length < data.slotsToFill) {
          warnings.push(
            `Block ${block.blockId}: Client ${clientId} only has ${data.exercises.length} exercises (needs ${data.slotsToFill})`,
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
    favoritesByClient?: Map<string, string[]>,
  ): StandardGroupWorkoutBlueprint {
    // Keep essential standard group processing summary
    // Processing standard template: ${this.template.id} for ${clientExercises.size} clients

    // Step 1: First determine Exercise #1 selections for constraint calculation
    const exercise1Selections = new Map<string, { exercise: ScoredExercise; workoutType: WorkoutType }>();
    
    if (groupContext && favoritesByClient) {
      // Pre-calculate Exercise #1 for each client (highest favorite)
      for (const [clientId, exercises] of clientExercises) {
        const client = groupContext.clients.find((c) => c.user_id === clientId);
        if (!client) continue;
        
        const favoriteIds = favoritesByClient.get(clientId) || [];
        const favorites = exercises
          .filter((ex) => favoriteIds.includes(ex.id))
          .sort((a, b) => b.score - a.score);
          
        if (favorites.length > 0) {
          const tied = favorites.filter((ex) => ex.score === favorites[0]!.score);
          const selected = tied[Math.floor(Math.random() * tied.length)];
          
          if (selected) {
            exercise1Selections.set(clientId, {
              exercise: selected,
              workoutType: (client.workoutType || WorkoutType.FULL_BODY_WITHOUT_FINISHER) as WorkoutType,
            });
          }
        }
      }
    }

    // Step 2: Calculate shared exercise pool with constraints applied
    const sharedExercisePool = this.findAllSharedExercises(clientExercises, groupContext, exercise1Selections);

    // Step 3: Determine pre-assigned exercises
    const preAssignedByClient = new Map<string, PreAssignedExercise[]>();

    // Use new shared logic for all workout types (handles both Full Body and Targeted)
    const hasValidWorkoutTypes = groupContext?.clients.every(
      (client) =>
        client.workoutType === WorkoutType.FULL_BODY_WITH_FINISHER ||
        client.workoutType === WorkoutType.FULL_BODY_WITHOUT_FINISHER ||
        client.workoutType === WorkoutType.FULL_BODY_WITHOUT_FINISHER_WITH_CORE ||
        client.workoutType === WorkoutType.TARGETED_WITH_FINISHER ||
        client.workoutType === WorkoutType.TARGETED_WITHOUT_FINISHER ||
        client.workoutType === WorkoutType.TARGETED_WITHOUT_FINISHER_WITH_CORE ||
        client.workoutType === WorkoutType.TARGETED_WITH_FINISHER_WITH_CORE,
    );

    if (groupContext && favoritesByClient && hasValidWorkoutTypes) {
      // Use new shared exercise logic for both full body and targeted workouts
      const clientsData = new Map<
        string,
        {
          context: ClientContext;
          exercises: ScoredExercise[];
          favoriteIds: string[];
        }
      >();

      for (const [clientId, exercises] of clientExercises) {
        const client = groupContext.clients.find((c) => c.user_id === clientId);
        if (!client) continue;

        const favoriteIds = favoritesByClient.get(clientId) || [];
        clientsData.set(clientId, {
          context: client,
          exercises,
          favoriteIds,
        });
      }

      // Process with new shared logic (this will handle mixed finisher preferences)
      const results =
        PreAssignmentService.processFullBodyPreAssignmentsWithShared(
          clientsData,
          sharedExercisePool,
          null, // Don't pass a single workout type - let it use per-client types
        );

      // Copy results to preAssignedByClient
      for (const [clientId, preAssigned] of results) {
        preAssignedByClient.set(clientId, preAssigned);
      }
    } else {
      // Use original logic for non-full body workouts or mixed workout types
      for (const [clientId, exercises] of clientExercises) {
        const client = groupContext?.clients.find(
          (c) => c.user_id === clientId,
        );
        if (!client) continue;

        // Get include and favorite IDs
        const includeNames = client.exercise_requests?.include || [];
        const includeIds = exercises
          .filter((ex) => includeNames.includes(ex.name))
          .map((ex) => ex.id);
        const favoriteIds = favoritesByClient?.get(clientId) || [];

        // Use original strategy-based pre-assignment with client's workout type
        // Default to FULL_BODY_WITHOUT_FINISHER if workoutType is not specified
        const workoutType = client.workoutType || WorkoutType.FULL_BODY_WITHOUT_FINISHER;
        const selectedExercises = processPreAssignments(
          exercises,
          client,
          workoutType as WorkoutType,
          includeIds,
          favoriteIds,
        );

        // Get tie information from the pre-assignment process
        const tieInfo = getPreAssignmentTieInfo();

        // Convert to PreAssignedExercise format with source tracking
        const preAssigned: PreAssignedExercise[] = selectedExercises.map(
          (exercise) => {
            // Determine source based on what matched
            let source = "Round1"; // Default
            if (includeIds.includes(exercise.id)) {
              source = "Include";
            } else if (favoriteIds.includes(exercise.id)) {
              source = "Favorite";
            } else if (exercise.functionTags?.includes("capacity")) {
              source = "Constraint";
            }

            // Get tie count if this exercise was selected via tie-breaking
            const tiedCount = tieInfo?.get(exercise.id);

            return {
              exercise,
              source,
              tiedCount,
            };
          },
        );

        preAssignedByClient.set(clientId, preAssigned);
      }
    }

    // Step 3: Create available exercise pools (excluding pre-assigned)
    const clientPools = new Map<string, ScoredExercise[]>();

    for (const [clientId, exercises] of clientExercises) {
      const preAssigned = preAssignedByClient.get(clientId) || [];
      const preAssignedIds = new Set(preAssigned.map((p) => p.exercise.id));

      // Filter out pre-assigned exercises
      const availableExercises = exercises.filter(
        (ex) => !preAssignedIds.has(ex.id),
      );
      clientPools.set(clientId, availableExercises);

      // Removed verbose per-client pool logging
    }

    // Step 4: Build the standard blueprint
    const clientExercisePools: Record<string, ClientExercisePool> = {};
    const totalExercisesPerClient =
      this.template.metadata?.totalExercisesPerClient || 8;
    const preAssignedCount = this.template.metadata?.preAssignedCount || 2;

    for (const [clientId, exercises] of clientPools) {
      const preAssigned = preAssignedByClient.get(clientId) || [];

      clientExercisePools[clientId] = {
        preAssigned,
        availableCandidates: exercises,
        totalExercisesNeeded: totalExercisesPerClient,
        additionalNeeded: totalExercisesPerClient - preAssigned.length,
      };
    }

    return {
      clientExercisePools,
      sharedExercisePool,
      metadata: {
        templateType: this.template.id,
        // workoutFlow removed - Phase 2 will handle round organization
        totalExercisesPerClient,
        preAssignedCount,
      },
      validationWarnings: this.validateStandardBlueprint(
        clientExercisePools,
        sharedExercisePool,
      ),
    };
  }

  /**
   * Extract pre-assigned exercises from deterministic blocks
   * @deprecated - Now using PreAssignmentService with includes/favorites logic
   */
  private extractPreAssignedExercises(
    clientExercises: Map<string, ScoredExercise[]>,
  ): Map<string, PreAssignedExercise[]> {
    const preAssignedByClient = new Map<string, PreAssignedExercise[]>();

    // Only process deterministic blocks with candidateCount = 1
    const deterministicBlocks = this.template.blocks.filter(
      (block) =>
        block.selectionStrategy === "deterministic" &&
        (block.candidateCount || 1) === 1,
    );

    for (const blockDef of deterministicBlocks) {
      for (const [clientId, exercises] of clientExercises) {
        // Filter exercises for this block
        const filtered = this.filterExercisesForBlock(
          exercises,
          blockDef,
          clientId,
        );

        if (filtered.length > 0) {
          // Take the top exercise
          const topExercise = filtered[0];
          if (topExercise) {
            const preAssigned = preAssignedByClient.get(clientId) || [];
            preAssigned.push({
              exercise: topExercise,
              source: blockDef.metadata?.round || blockDef.id,
            });
            preAssignedByClient.set(clientId, preAssigned);

            // Pre-assigned exercise for deterministic block
          }
        }
      }
    }

    return preAssignedByClient;
  }

  /**
   * Find ALL shared exercises across the entire exercise pool
   * Not limited to specific blocks - for standard template
   * Now applies Exercise #2 constraints if provided
   */
  private findAllSharedExercises(
    clientPools: Map<string, ScoredExercise[]>,
    groupContext?: GroupContext,
    exercise1Selections?: Map<string, { exercise: ScoredExercise; workoutType: WorkoutType }>,
  ): GroupScoredExercise[] {
    const exerciseClientMap = new Map<string, Set<string>>();
    const exerciseMap = new Map<string, ScoredExercise>();
    const exerciseScoreMap = new Map<string, Map<string, number>>();

    // Build map of exercise ID to client IDs
    for (const [clientId, exercises] of clientPools) {
      for (const exercise of exercises) {
        // Determine threshold based on exercise type
        const isCoreOrFinisher =
          exercise.functionTags?.some(
            (tag) => tag === "core" || tag === "capacity",
          ) ?? false;
        const threshold = isCoreOrFinisher
          ? SCORING_CONFIG.SHARED_EXERCISE_CORE_FINISHER_MIN_SCORE
          : SCORING_CONFIG.SHARED_EXERCISE_MIN_SCORE;

        // Only include if score meets the appropriate threshold
        if (exercise.score < threshold) {
          continue;
        }

        // Apply Exercise #2 constraints if we have the necessary context
        if (groupContext && exercise1Selections) {
          const client = groupContext.clients.find(c => c.user_id === clientId);
          const exercise1Data = exercise1Selections.get(clientId);
          
          if (client && exercise1Data) {
            const isTargeted = exercise1Data.workoutType.includes("targeted");
            const exerciseMuscle = exercise.primaryMuscle ? 
              mapMuscleToConsolidated(exercise.primaryMuscle) : null;
            
            if (exerciseMuscle) {
              // Skip if this is Exercise #1 for this client
              if (exercise.id === exercise1Data.exercise.id) {
                continue;
              }
              
              if (isTargeted) {
                // Targeted: primary muscle must be in muscle targets
                const targetMuscles = client.muscle_target?.map(m => mapMuscleToConsolidated(m)) || [];
                if (!targetMuscles.includes(exerciseMuscle)) {
                  continue;
                }
              } else {
                // Full Body: primary muscle cannot be same as Exercise #1
                const exercise1Muscle = exercise1Data.exercise.primaryMuscle ? 
                  mapMuscleToConsolidated(exercise1Data.exercise.primaryMuscle) : null;
                if (exercise1Muscle && exerciseMuscle === exercise1Muscle) {
                  continue;
                }
              }
            }
          }
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
        const clientScores = clientsArray.map((clientId: string) => {
          const score =
            scoreMap.get(clientId) ?? SCORING_CONFIG.SHARED_EXERCISE_MIN_SCORE;
          totalScore += score;

          return {
            clientId,
            individualScore: score,
            hasExercise: true,
          };
        });

        sharedExercises.push({
          ...exercise,
          groupScore: totalScore / clientsArray.length,
          clientScores,
          clientsSharing: clientsArray,
        });
      }
    }

    // Sort by number of clients sharing (descending), then by group score
    sharedExercises.sort((a, b) => {
      const clientDiff = b.clientsSharing.length - a.clientsSharing.length;
      if (clientDiff !== 0) return clientDiff;
      return b.groupScore - a.groupScore;
    });

    // Keep essential shared pool summary
    // Found ${sharedExercises.length} shared exercises in pool
    // Removed verbose top shared exercise details

    return sharedExercises;
  }

  /**
   * Validate standard blueprint and generate warnings
   */
  private validateStandardBlueprint(
    clientPools: Record<string, ClientExercisePool>,
    sharedExercises: GroupScoredExercise[],
  ): string[] {
    const warnings: string[] = [];

    // Check if we have enough exercises for each client
    for (const [clientId, pool] of Object.entries(clientPools)) {
      const totalAvailable =
        pool.preAssigned.length + pool.availableCandidates.length;
      if (totalAvailable < pool.totalExercisesNeeded) {
        warnings.push(
          `Client ${clientId}: Only ${totalAvailable} exercises available (needs ${pool.totalExercisesNeeded})`,
        );
      }
    }

    // Check if we have any shared exercises
    if (sharedExercises.length === 0) {
      warnings.push(
        "No shared exercises found - all clients will have individual workouts",
      );
    }

    // Check if pre-assigned exercises are properly set
    const clientCount = Object.keys(clientPools).length;
    const expectedPreAssigned = this.template.metadata?.preAssignedCount || 0;

    // Only warn if we expect pre-assigned exercises but don't have them
    if (expectedPreAssigned > 0) {
      for (const [clientId, pool] of Object.entries(clientPools)) {
        if (pool.preAssigned.length !== expectedPreAssigned) {
          warnings.push(
            `Client ${clientId}: ${pool.preAssigned.length} pre-assigned exercises (expected ${expectedPreAssigned})`,
          );
        }
      }
    }

    return warnings;
  }
}
