import type { ClientContext } from "../../types/clientContext";
import type { GroupScoredExercise } from "../../types/groupContext";
import type { ScoredExercise } from "../../types/scoredExercise";
import type { PreAssignedExercise } from "../../types/standardBlueprint";
import { WorkoutType } from "../../types/clientTypes";
import { categorizeSharedExercises } from "../../workout-generation/standard/sharedExerciseFilters";
import { mapMuscleToConsolidated, type ConsolidatedMuscle } from "../../constants/muscleMapping";

/**
 * Constraints for pre-assignment based on workout type
 */
interface PreAssignmentConstraints {
  requireLowerBody?: boolean;
  requireUpperBody?: boolean;
  maxPerMuscleGroup?: number;
  requiredMovementPatterns?: string[];
}

/**
 * Workout type specific constraints
 */
const WORKOUT_TYPE_CONSTRAINTS: Record<string, PreAssignmentConstraints> = {
  full_body: {
    requireLowerBody: true,
    requireUpperBody: true,
    maxPerMuscleGroup: 1,
  },
  full_body_with_finisher: {
    requireLowerBody: true,
    requireUpperBody: true,
    maxPerMuscleGroup: 1,
  },
};

/**
 * Body category types
 */
export type BodyCategory = "upper" | "lower" | "core_full";

/**
 * Service for deterministically pre-assigning exercises based on includes and favorites
 */
export class PreAssignmentService {
  /**
   * Check if an exercise targets lower body
   */
  private static isLowerBodyExercise(exercise: ScoredExercise): boolean {
    const lowerBodyPatterns = [
      "squat",
      "lunge",
      "hinge",
      "calf_raise",
      "leg_isolation",
    ];
    const lowerBodyMuscles = [
      "quads",
      "hamstrings",
      "glutes",
      "calves",
      "adductors",
      "abductors",
      "shins",
      "tibialis_anterior",
    ];

    return Boolean(
      (exercise.movementPattern &&
        lowerBodyPatterns.includes(exercise.movementPattern)) ||
        (exercise.primaryMuscle &&
          lowerBodyMuscles.includes(exercise.primaryMuscle)),
    );
  }

  /**
   * Check if an exercise targets upper body
   */
  private static isUpperBodyExercise(exercise: ScoredExercise): boolean {
    const upperBodyPatterns = [
      "horizontal_push",
      "horizontal_pull",
      "vertical_push",
      "vertical_pull",
      "shoulder_isolation",
      "arm_isolation",
      "bicep_isolation",
      "tricep_isolation",
    ];
    const upperBodyMuscles = [
      "chest",
      "upper_chest",
      "lower_chest",
      "back",
      "upper_back",
      "lower_back",
      "shoulders",
      "delts",
      "lats",
      "triceps",
      "biceps",
      "traps",
    ];

    return Boolean(
      (exercise.movementPattern &&
        upperBodyPatterns.includes(exercise.movementPattern)) ||
        (exercise.primaryMuscle &&
          upperBodyMuscles.includes(exercise.primaryMuscle)),
    );
  }

  /**
   * Get body category for an exercise
   */
  private static getBodyCategory(exercise: ScoredExercise): BodyCategory {
    const primaryMuscle = exercise.primaryMuscle?.toLowerCase() || "";
    const hasCapacityTag = exercise.functionTags?.includes("capacity") || false;

    // Core/Full body classification
    if (
      primaryMuscle === "core" ||
      primaryMuscle === "abs" ||
      primaryMuscle === "obliques" ||
      primaryMuscle === "lower_abs" ||
      primaryMuscle === "upper_abs" ||
      hasCapacityTag
    ) {
      return "core_full";
    }

    // Check if upper body
    if (this.isUpperBodyExercise(exercise)) return "upper";

    // Check if lower body
    if (this.isLowerBodyExercise(exercise)) return "lower";

    // Default to core/full if unclear
    return "core_full";
  }

  /**
   * Determine pre-assigned exercises for a client
   * Priority: 1) Include exercises, 2) Top-scored favorites
   *
   * @param clientContext Client preferences and context
   * @param scoredExercises All scored exercises for this client
   * @param favoriteExerciseIds List of exercise IDs marked as favorites
   * @param workoutType Optional workout type for applying constraints
   * @returns Array of pre-assigned exercises with source labels
   */
  static determinePreAssignedExercises(
    clientContext: ClientContext,
    scoredExercises: ScoredExercise[],
    favoriteExerciseIds: string[] = [],
    workoutType?: WorkoutType,
  ): PreAssignedExercise[] {
    // Check if we need to apply constraints
    const constraints = workoutType
      ? WORKOUT_TYPE_CONSTRAINTS[workoutType]
      : null;

    if (constraints) {
      return this.determineConstrainedPreAssignment(
        clientContext,
        scoredExercises,
        favoriteExerciseIds,
        constraints,
      );
    }

    // Otherwise use standard logic
    return this.determineStandardPreAssignment(
      clientContext,
      scoredExercises,
      favoriteExerciseIds,
    );
  }

  /**
   * Standard pre-assignment without constraints (original logic)
   */
  private static determineStandardPreAssignment(
    clientContext: ClientContext,
    scoredExercises: ScoredExercise[],
    favoriteExerciseIds: string[] = [],
  ): PreAssignedExercise[] {
    const preAssigned: PreAssignedExercise[] = [];
    const includeExercises = clientContext.exercise_requests?.include || [];

    // Step 1: Add all include exercises (if any)
    if (includeExercises.length > 0) {
      // Find the scored versions of include exercises
      const includeExerciseScored = scoredExercises.filter((ex) =>
        includeExercises.includes(ex.name),
      );

      // Add all includes as pre-assigned
      includeExerciseScored.forEach((exercise) => {
        preAssigned.push({
          exercise,
          source: "Include",
        });
      });

      // Added include exercises
    }

    // Step 2: If we need more pre-assigned (less than 2), add top favorites
    if (preAssigned.length < 2 && favoriteExerciseIds.length > 0) {
      // Get favorite exercises that aren't already pre-assigned
      const favoriteExercises = scoredExercises.filter(
        (ex) =>
          favoriteExerciseIds.includes(ex.id) &&
          !preAssigned.some((pa) => pa.exercise.id === ex.id),
      );

      // Sort by score (they already have favorite boost applied)
      favoriteExercises.sort((a, b) => b.score - a.score);

      // Take enough to reach 2 total pre-assigned
      const needed = 2 - preAssigned.length;
      const topFavoritesWithTieInfo = this.selectTopWithTieBreakingAndCount(
        favoriteExercises,
        needed,
      );

      topFavoritesWithTieInfo.forEach(({ exercise, tiedCount }) => {
        preAssigned.push({
          exercise,
          source: "Favorite",
          tiedCount,
        });
      });

      // Added favorite exercises
    }

    // Keep essential pre-assignment summary
    console.log(
      `[PreAssignment] ${clientContext.name}: ${preAssigned.length} exercises (${preAssigned.map((pa) => pa.source).join(", ")})`,
    );

    return preAssigned;
  }

  /**
   * Pre-assignment with constraints (for full body workouts)
   */
  private static determineConstrainedPreAssignment(
    clientContext: ClientContext,
    scoredExercises: ScoredExercise[],
    favoriteExerciseIds: string[] = [],
    constraints: PreAssignmentConstraints,
  ): PreAssignedExercise[] {
    const preAssigned: PreAssignedExercise[] = [];
    const includeExercises = clientContext.exercise_requests?.include || [];

    // Step 1: Process include exercises first
    if (includeExercises.length > 0) {
      const includeExerciseScored = scoredExercises.filter((ex) =>
        includeExercises.includes(ex.name),
      );

      // Add includes but check if we're meeting constraints
      includeExerciseScored.forEach((exercise) => {
        if (preAssigned.length < 2) {
          preAssigned.push({
            exercise,
            source: "Include",
          });
        }
      });

      // Added include exercises with constraints
    }

    // Check what constraints we still need to satisfy
    const hasLowerBody = preAssigned.some((pa) =>
      this.isLowerBodyExercise(pa.exercise),
    );
    const hasUpperBody = preAssigned.some((pa) =>
      this.isUpperBodyExercise(pa.exercise),
    );

    // Removed debug favorite score breakdown logging

    // Step 2: If we need to satisfy constraints and have room, do so
    if (preAssigned.length < 2) {
      const favoriteExercises = scoredExercises.filter(
        (ex) =>
          favoriteExerciseIds.includes(ex.id) &&
          !preAssigned.some((pa) => pa.exercise.id === ex.id),
      );

      // Sort favorites by score
      favoriteExercises.sort((a, b) => b.score - a.score);

      // If we need lower body and don't have it
      if (
        constraints.requireLowerBody &&
        !hasLowerBody &&
        preAssigned.length < 2
      ) {
        const lowerBodyFavorites = favoriteExercises.filter((ex) =>
          this.isLowerBodyExercise(ex),
        );

        if (lowerBodyFavorites.length > 0) {
          const selected = this.selectTopWithTieBreakingAndCount(
            lowerBodyFavorites,
            1,
          );
          if (selected.length > 0 && selected[0]) {
            preAssigned.push({
              exercise: selected[0].exercise,
              source: "Favorite",
              tiedCount: selected[0].tiedCount,
            });
            // Added lower body favorite
          }
        } else {
          // No favorite lower body, find best lower body from all exercises
          const allLowerBody = scoredExercises.filter(
            (ex) =>
              this.isLowerBodyExercise(ex) &&
              !preAssigned.some((pa) => pa.exercise.id === ex.id),
          );

          if (allLowerBody.length > 0) {
            const selected = this.selectTopWithTieBreakingAndCount(
              allLowerBody,
              1,
            );
            if (selected.length > 0 && selected[0]) {
              preAssigned.push({
                exercise: selected[0].exercise,
                source: "Constraint",
                tiedCount: selected[0].tiedCount,
              });
              // Added lower body for constraint
            }
          }
        }
      }

      // If we need upper body and don't have it
      if (
        constraints.requireUpperBody &&
        !hasUpperBody &&
        preAssigned.length < 2
      ) {
        const upperBodyFavorites = favoriteExercises.filter(
          (ex) =>
            this.isUpperBodyExercise(ex) &&
            !preAssigned.some((pa) => pa.exercise.id === ex.id),
        );

        if (upperBodyFavorites.length > 0) {
          const selected = this.selectTopWithTieBreakingAndCount(
            upperBodyFavorites,
            1,
          );
          if (selected.length > 0 && selected[0]) {
            preAssigned.push({
              exercise: selected[0].exercise,
              source: "Favorite",
              tiedCount: selected[0].tiedCount,
            });
            // Added upper body favorite
          }
        } else {
          // No favorite upper body, find best upper body from all exercises
          const allUpperBody = scoredExercises.filter(
            (ex) =>
              this.isUpperBodyExercise(ex) &&
              !preAssigned.some((pa) => pa.exercise.id === ex.id),
          );

          if (allUpperBody.length > 0) {
            const selected = this.selectTopWithTieBreakingAndCount(
              allUpperBody,
              1,
            );
            if (selected.length > 0 && selected[0]) {
              preAssigned.push({
                exercise: selected[0].exercise,
                source: "Constraint",
                tiedCount: selected[0].tiedCount,
              });
              // Added upper body for constraint
            }
          }
        }
      }

      // Step 3: Fill remaining slots with top favorites (if still under 2)
      if (preAssigned.length < 2) {
        const remainingFavorites = favoriteExercises.filter(
          (ex) => !preAssigned.some((pa) => pa.exercise.id === ex.id),
        );

        const needed = 2 - preAssigned.length;
        const selected = this.selectTopWithTieBreakingAndCount(
          remainingFavorites,
          needed,
        );

        selected.forEach(({ exercise, tiedCount }) => {
          preAssigned.push({
            exercise,
            source: "Favorite",
            tiedCount,
          });
        });

        // Added remaining favorite exercises
      }
    }

    // Keep essential constraint satisfaction summary
    const hasLower = preAssigned.some((pa) =>
      this.isLowerBodyExercise(pa.exercise),
    );
    const hasUpper = preAssigned.some((pa) =>
      this.isUpperBodyExercise(pa.exercise),
    );
    console.log(
      `[PreAssignment] ${clientContext.name}: ${preAssigned.length} exercises (L:${hasLower} U:${hasUpper})`,
    );
    // Removed detailed exercise-by-exercise logging

    return preAssigned;
  }

  /**
   * Select top N exercises with tie-breaking randomization and tie count tracking
   */
  private static selectTopWithTieBreakingAndCount(
    exercises: ScoredExercise[],
    count: number,
  ): Array<{ exercise: ScoredExercise; tiedCount: number }> {
    if (exercises.length === 0 || count <= 0) return [];
    if (exercises.length <= count) {
      return exercises.map((ex) => ({ exercise: ex, tiedCount: 1 }));
    }

    const selected: Array<{ exercise: ScoredExercise; tiedCount: number }> = [];
    const used = new Set<string>();

    while (selected.length < count && exercises.length > used.size) {
      // Find the highest score among unused exercises
      let highestScore = -Infinity;
      for (const ex of exercises) {
        if (!used.has(ex.id) && ex.score > highestScore) {
          highestScore = ex.score;
        }
      }

      // Get all exercises with the highest score
      const tied = exercises.filter(
        (ex) => !used.has(ex.id) && ex.score === highestScore,
      );

      if (tied.length === 0) break;

      const tiedCount = tied.length;

      // If we need more exercises than tied, take all tied
      const remaining = count - selected.length;
      if (tied.length <= remaining) {
        tied.forEach((ex) => {
          selected.push({ exercise: ex, tiedCount });
          used.add(ex.id);
        });
      } else {
        // Randomly select from tied exercises
        for (let i = 0; i < remaining; i++) {
          const availableTied = tied.filter((ex) => !used.has(ex.id));
          if (availableTied.length > 0) {
            const randomIndex = Math.floor(
              Math.random() * availableTied.length,
            );
            const randomEx = availableTied[randomIndex];
            if (randomEx) {
              selected.push({ exercise: randomEx, tiedCount });
              used.add(randomEx.id);
            }
          }
        }
      }
    }

    return selected;
  }

  /**
   * Get all combinations of a given size from an array
   */
  private static getCombinations<T>(arr: T[], size: number): T[][] {
    if (size === 0) return [[]];
    if (arr.length === 0) return [];

    const first = arr[0];
    const rest = arr.slice(1);

    if (first === undefined) return [];

    const withFirst = this.getCombinations(rest, size - 1).map((combo) => [
      first,
      ...combo,
    ]);
    const withoutFirst = this.getCombinations(rest, size);

    return [...withFirst, ...withoutFirst];
  }

  /**
   * Select top N exercises with tie-breaking randomization
   */
  private static selectTopWithTieBreaking(
    exercises: ScoredExercise[],
    count: number,
  ): ScoredExercise[] {
    if (exercises.length === 0 || count <= 0) return [];
    if (exercises.length <= count) return exercises;

    const selected: ScoredExercise[] = [];
    const used = new Set<string>();

    while (selected.length < count && exercises.length > used.size) {
      // Find the highest score among unused exercises
      let highestScore = -Infinity;
      for (const ex of exercises) {
        if (!used.has(ex.id) && ex.score > highestScore) {
          highestScore = ex.score;
        }
      }

      // Get all exercises with the highest score
      const tied = exercises.filter(
        (ex) => !used.has(ex.id) && ex.score === highestScore,
      );

      if (tied.length === 0) break;

      // If we need more exercises than tied, take all tied
      const remaining = count - selected.length;
      if (tied.length <= remaining) {
        tied.forEach((ex) => {
          selected.push(ex);
          used.add(ex.id);
        });
      } else {
        // Randomly select from tied exercises
        for (let i = 0; i < remaining; i++) {
          const availableTied = tied.filter((ex) => !used.has(ex.id));
          if (availableTied.length > 0) {
            const randomIndex = Math.floor(
              Math.random() * availableTied.length,
            );
            const randomEx = availableTied[randomIndex];
            if (randomEx) {
              selected.push(randomEx);
              used.add(randomEx.id);
            }
          }
        }
      }
    }

    return selected;
  }

  /**
   * Process pre-assignments for full body and targeted workouts with shared exercise logic
   * This handles Exercise #1 and #2 selection with the new muscle-based constraints
   */
  static processFullBodyPreAssignmentsWithShared(
    clientsData: Map<
      string,
      {
        context: ClientContext;
        exercises: ScoredExercise[];
        favoriteIds: string[];
      }
    >,
    sharedExercisePool: GroupScoredExercise[],
    workoutType?: WorkoutType | null,
  ): Map<string, PreAssignedExercise[]> {
    const result = new Map<string, PreAssignedExercise[]>();
    const allClientIds = Array.from(clientsData.keys());

    // Step 1: Each client selects Exercise #1 (highest favorite)
    const exercise1Selections = new Map<
      string,
      { 
        exercise: ScoredExercise; 
        muscleGroup: ConsolidatedMuscle | null;
        workoutType: WorkoutType;
        muscleTargets?: ConsolidatedMuscle[];
      }
    >();

    for (const [clientId, data] of clientsData) {
      const { context, exercises, favoriteIds } = data;

      // Get favorites sorted by score
      const favorites = exercises
        .filter((ex) => favoriteIds.includes(ex.id))
        .sort((a, b) => b.score - a.score);

      if (favorites.length > 0) {
        // Select highest with tie-breaking
        const tied = favorites.filter((ex) => ex.score === favorites[0]!.score);
        const selected = tied[Math.floor(Math.random() * tied.length)];

        if (selected) {
          // Map primary muscle to consolidated muscle group
          const muscleGroup = selected.primaryMuscle 
            ? mapMuscleToConsolidated(selected.primaryMuscle)
            : null;
          
          // Get client's muscle targets if targeted workout
          const clientWorkoutType = (context.workoutType || workoutType) as WorkoutType;
          const isTargeted = clientWorkoutType.includes("targeted");
          const muscleTargets = isTargeted && context.muscle_target
            ? context.muscle_target.map(m => mapMuscleToConsolidated(m))
            : undefined;

          exercise1Selections.set(clientId, {
            exercise: selected,
            muscleGroup,
            workoutType: clientWorkoutType,
            muscleTargets
          });

          result.set(clientId, [
            {
              exercise: selected,
              source: "favorite",
              tiedCount: tied.length > 1 ? tied.length : undefined,
            },
          ]);
        }
      } else {
        // No favorites available
        result.set(clientId, []);
      }
    }

    // Step 2: Select Exercise #2 from shared pool (globally coordinated)
    const categorized = categorizeSharedExercises(sharedExercisePool);
    const otherSharedExercises = categorized.other; // Only use "Other Shared", not Core & Finisher

    // Build constraints for each client based on workout type
    interface ClientConstraint {
      type: "exclude" | "include";
      muscles: ConsolidatedMuscle[];
      isTargeted: boolean;
    }
    
    const clientConstraints = new Map<string, ClientConstraint>();

    for (const [clientId, selection] of exercise1Selections) {
      const isTargeted = selection.workoutType.includes("targeted");
      
      if (isTargeted) {
        // Targeted: Exercise #2 must be one of their muscle targets AND not same muscle as Exercise #1
        const excludeMuscles = selection.muscleGroup ? [selection.muscleGroup] : [];
        const includeMuscles = selection.muscleTargets || [];
        
        // Filter out the Exercise #1 muscle from the include list
        const filteredIncludeMuscles = includeMuscles.filter(m => !excludeMuscles.includes(m));
        
        clientConstraints.set(clientId, {
          type: "include",
          muscles: filteredIncludeMuscles,
          isTargeted: true
        });
      } else {
        // Full Body: Exercise #2 cannot be the same muscle group as Exercise #1
        clientConstraints.set(clientId, {
          type: "exclude",
          muscles: selection.muscleGroup ? [selection.muscleGroup] : [],
          isTargeted: false
        });
      }
    }

    // Try cascading selection for shared Exercise #2
    let sharedExercise2: GroupScoredExercise | null = null;
    let participatingClients: string[] = [];
    let bestScore = -1;
    const SCORE_DIFFERENCE_THRESHOLD = 1.0; // Larger groups win unless score difference exceeds this

    console.log("[PreAssignment] Starting shared Exercise #2 selection");
    
    // Log constraints
    const constraintsSummary = Array.from(clientConstraints.entries()).map(([id, constraint]) => {
      const clientName = clientsData.get(id)?.context.name;
      const exercise1 = exercise1Selections.get(id);
      const exercise1Muscle = exercise1?.muscleGroup;
      
      if (constraint.type === "exclude") {
        return `${clientName}: exclude ${constraint.muscles.join(", ")}`;
      } else {
        // For targeted, show that we're excluding Exercise #1's muscle from options
        const muscleList = constraint.muscles.join(" or ");
        const excludeNote = exercise1Muscle ? ` (excluding ${exercise1Muscle} from Ex#1)` : "";
        return `${clientName}: must be ${muscleList}${excludeNote}`;
      }
    });
    console.log("[PreAssignment] Client constraints:", constraintsSummary.join(", "));

    // Helper function to check if an exercise satisfies all constraints for a subset of clients
    const satisfiesConstraints = (exercise: GroupScoredExercise, clientSubset: string[]): boolean => {
      const exerciseMuscle = exercise.primaryMuscle 
        ? mapMuscleToConsolidated(exercise.primaryMuscle)
        : null;
      
      if (!exerciseMuscle) return false;

      // Check if this exercise is already Exercise #1 for any client in the subset
      for (const clientId of clientSubset) {
        const exercise1 = exercise1Selections.get(clientId);
        if (exercise1 && exercise1.exercise.id === exercise.id) {
          return false; // Cannot select same exercise as Exercise #1
        }
      }

      for (const clientId of clientSubset) {
        const constraint = clientConstraints.get(clientId);
        if (!constraint) continue;

        if (constraint.type === "exclude") {
          // Full Body: muscle cannot be in exclusion list
          if (constraint.muscles.includes(exerciseMuscle)) {
            return false;
          }
        } else {
          // Targeted: muscle must be in inclusion list
          if (!constraint.muscles.includes(exerciseMuscle)) {
            return false;
          }
        }
      }
      
      return true;
    };

    // Sort clients: Full Body first, then Targeted (so targeted are removed first)
    const sortedClientIds = [...allClientIds].sort((a, b) => {
      const aIsTargeted = clientConstraints.get(a)?.isTargeted || false;
      const bIsTargeted = clientConstraints.get(b)?.isTargeted || false;
      return aIsTargeted === bIsTargeted ? 0 : aIsTargeted ? 1 : -1;
    });

    // Start with exercises shared by all clients, then cascade down
    for (let shareCount = allClientIds.length; shareCount >= 2; shareCount--) {
      // For partial sharing, we need to find valid client subsets
      if (shareCount < allClientIds.length) {
        // Generate combinations prioritizing removal of targeted clients
        const clientCombinations = this.getCombinations(
          sortedClientIds,
          shareCount,
        );

        for (const clientSubset of clientCombinations) {
          // Find exercises shared by this subset of clients
          const candidatesForSubset = otherSharedExercises
            .filter((ex) => {
              // Exercise must be available for all clients in subset
              return clientSubset.every((clientId) =>
                ex.clientsSharing.includes(clientId),
              );
            })
            .filter((ex) => satisfiesConstraints(ex, clientSubset))
            .sort((a, b) => b.groupScore - a.groupScore);

          if (candidatesForSubset.length > 0) {
            // Check if this is better than our current best
            const topCandidate = candidatesForSubset[0]!;
            
            // Prefer larger groups unless score difference is significant
            const scoreDifference = bestScore - topCandidate.groupScore;
            const isBetter = topCandidate.groupScore > bestScore || 
              (shareCount > participatingClients.length && scoreDifference < SCORE_DIFFERENCE_THRESHOLD);
            
            if (isBetter) {
              // Update our best option but don't break - keep searching
              const tied = candidatesForSubset.filter(
                (ex) => ex.groupScore === topCandidate.groupScore,
              );
              const selected = tied[Math.floor(Math.random() * tied.length)];
              if (selected) {
                sharedExercise2 = selected;
                participatingClients = clientSubset;
                bestScore = selected.groupScore;
                console.log(
                  `[PreAssignment] Found candidate ${shareCount}-way shared exercise: ${selected.name} (score: ${selected.groupScore}) for clients:`,
                  clientSubset
                    .map((id) => clientsData.get(id)?.context.name)
                    .join(", "),
                );
              }
            }
          }
        }
      } else {
        // All clients case
        const candidatesAtLevel = otherSharedExercises
          .filter((ex) => ex.clientsSharing.length >= shareCount)
          .filter((ex) => satisfiesConstraints(ex, allClientIds))
          .sort((a, b) => b.groupScore - a.groupScore);

        if (candidatesAtLevel.length > 0) {
          // Check if this is better than our current best
          const topCandidate = candidatesAtLevel[0]!;
          
          // Prefer larger groups unless score difference is significant
          const scoreDifference = bestScore - topCandidate.groupScore;
          const isBetter = topCandidate.groupScore > bestScore || 
            (shareCount > participatingClients.length && scoreDifference < SCORE_DIFFERENCE_THRESHOLD);
          
          if (isBetter) {
            // Select highest scoring with tie-breaking
            const tied = candidatesAtLevel.filter(
              (ex) => ex.groupScore === topCandidate.groupScore,
            );
            const selected = tied[Math.floor(Math.random() * tied.length)];
            if (selected) {
              sharedExercise2 = selected;
              participatingClients = allClientIds;
              bestScore = selected.groupScore;
              console.log(
                `[PreAssignment] Found candidate ${shareCount}-way shared exercise: ${selected.name} (score: ${selected.groupScore}) for all clients`
              );
            }
          }
        }
      }
    }

    // Step 3: Assign Exercise #2 to participating clients
    if (sharedExercise2) {
      console.log(
        `[PreAssignment] Selected OPTIMAL shared Exercise #2: ${sharedExercise2.name} (score: ${bestScore}) for ${participatingClients.length} clients:`,
        participatingClients.map((id) => clientsData.get(id)?.context.name).join(", ")
      );
      for (const clientId of participatingClients) {
        const currentPreAssigned = result.get(clientId) || [];
        const clientExercise = clientsData
          .get(clientId)
          ?.exercises.find((ex) => ex.id === sharedExercise2!.id);

        if (clientExercise) {
          currentPreAssigned.push({
            exercise: clientExercise,
            source: "shared_other",
            sharedWith: participatingClients,
          });
          result.set(clientId, currentPreAssigned);
        }
      }
    }

    // Step 4: Log any clients who couldn't participate in shared Exercise #2
    for (const [clientId, data] of clientsData) {
      const currentPreAssigned = result.get(clientId) || [];
      if (currentPreAssigned.length < 2) {
        console.log(
          `[PreAssignment] Client ${data.context.name} has no shared Exercise #2 - will only have 1 pre-assigned exercise`,
        );
      }
    }

    // Step 5: Exercise #3 - Finisher selection (only for clients with FULL_BODY_WITH_FINISHER)
    // Determine which clients need a finisher based on their individual workout types
    const finisherClientIds = allClientIds.filter((clientId) => {
      const clientData = clientsData.get(clientId);
      return (
        clientData?.context.workoutType ===
        (WorkoutType.FULL_BODY_WITH_FINISHER as string)
      );
    });

    if (finisherClientIds.length > 0) {
      // Get categorized shared exercises
      const categorized = categorizeSharedExercises(sharedExercisePool);
      const coreFinisherPool = categorized.coreAndFinisher;

      if (finisherClientIds.length === 1) {
        // Single client: select their highest scoring core/capacity exercise
        const clientId = finisherClientIds[0] || "";
        const currentPreAssigned = result.get(clientId) || [];
        const data = clientsData.get(clientId);

        if (data) {
          const usedIds = new Set(currentPreAssigned.map((p) => p.exercise.id));

          // Find highest scoring core/capacity exercise not already selected
          const coreCapacityCandidates = data.exercises
            .filter((ex) => !usedIds.has(ex.id))
            .filter((ex) =>
              ex.functionTags?.some(
                (tag) => tag === "core" || tag === "capacity",
              ),
            )
            .sort((a, b) => b.score - a.score);

          if (coreCapacityCandidates.length > 0) {
            // Select highest with tie-breaking
            const tied = coreCapacityCandidates.filter(
              (ex) => ex.score === coreCapacityCandidates[0]!.score,
            );
            const selected = tied[Math.floor(Math.random() * tied.length)];

            if (selected && clientId) {
              currentPreAssigned.push({
                exercise: selected,
                source: "finisher",
                tiedCount: tied.length > 1 ? tied.length : undefined,
              });
              result.set(clientId, currentPreAssigned);
            }
          }
        }
      } else if (finisherClientIds.length > 1) {
        // Multiple clients: try to find shared core/finisher exercise
        const eligibleShared = coreFinisherPool
          .filter((ex) => {
            // Must be shared by ALL finisher clients
            return finisherClientIds.every((clientId) =>
              ex.clientsSharing.includes(clientId),
            );
          })
          .filter((ex) => ex.groupScore >= 5.0) // Must meet threshold
          .filter((ex) => {
            // Not already selected by any client
            for (const clientId of finisherClientIds) {
              const preAssigned = result.get(clientId) || [];
              if (preAssigned.some((p) => p.exercise.id === ex.id)) {
                return false;
              }
            }
            return true;
          })
          .sort((a, b) => b.groupScore - a.groupScore);

        if (eligibleShared.length > 0) {
          // Select highest scoring shared exercise
          const tied = eligibleShared.filter(
            (ex) => ex.groupScore === eligibleShared[0]!.groupScore,
          );
          const selected = tied[Math.floor(Math.random() * tied.length)];

          if (selected) {
            // Add to all finisher clients
            for (const clientId of finisherClientIds) {
              const currentPreAssigned = result.get(clientId) || [];
              const clientExercise = clientsData
                .get(clientId)
                ?.exercises.find((ex) => ex.id === selected.id);

              if (clientExercise) {
                currentPreAssigned.push({
                  exercise: clientExercise,
                  source: "shared_core_finisher",
                  sharedWith: finisherClientIds.filter((id) => id !== clientId),
                  tiedCount: tied.length > 1 ? tied.length : undefined,
                });
                result.set(clientId, currentPreAssigned);
              }
            }
          }
        } else {
          // Fallback: Each client gets their own highest scoring core/capacity
          for (const clientId of finisherClientIds) {
            const currentPreAssigned = result.get(clientId) || [];
            const data = clientsData.get(clientId);

            if (data) {
              const usedIds = new Set(
                currentPreAssigned.map((p) => p.exercise.id),
              );

              const coreCapacityCandidates = data.exercises
                .filter((ex) => !usedIds.has(ex.id))
                .filter((ex) =>
                  ex.functionTags?.some(
                    (tag) => tag === "core" || tag === "capacity",
                  ),
                )
                .sort((a, b) => b.score - a.score);

              if (coreCapacityCandidates.length > 0) {
                const tied = coreCapacityCandidates.filter(
                  (ex) => ex.score === coreCapacityCandidates[0]!.score,
                );
                const selected = tied[Math.floor(Math.random() * tied.length)];

                if (selected) {
                  currentPreAssigned.push({
                    exercise: selected,
                    source: "finisher",
                    tiedCount: tied.length > 1 ? tied.length : undefined,
                  });
                  result.set(clientId, currentPreAssigned);
                }
              }
            }
          }
        }
      }
    }

    // Log results
    console.log("[PreAssignment] Full body with shared results:");
    for (const [clientId, preAssigned] of result) {
      const client = clientsData.get(clientId)?.context;
      console.log(`  ${client?.name}: ${preAssigned.length} exercises`);
      if (
        preAssigned[1]?.source === "shared_other" &&
        preAssigned[1]?.sharedWith
      ) {
        console.log(
          `    Shared with: ${preAssigned[1].sharedWith
            .map((id: string) => clientsData.get(id)?.context.name || id)
            .join(", ")}`,
        );
      }
      if (
        preAssigned[2]?.source === "shared_core_finisher" &&
        preAssigned[2]?.sharedWith
      ) {
        console.log(
          `    Finisher shared with: ${preAssigned[2].sharedWith
            .map((id: string) => clientsData.get(id)?.context.name || id)
            .join(", ")}`,
        );
      }
    }

    return result;
  }
}
