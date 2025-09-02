import type { AnyGroupWorkoutBlueprint } from "../types";
import type { Exercise } from "../types/exercise";
import type { GroupWorkoutBlueprint } from "../types/groupBlueprint";
import type { GroupContext } from "../types/groupContext";
import type { ScoredExercise } from "../types/scoredExercise";
import type { StandardGroupWorkoutBlueprint } from "../types/standardBlueprint";
import { filterExercises } from "../core/filtering/filterExercises";
import { scoreAndSortExercises } from "../core/scoring/scoreExercises";
import { getWorkoutTemplate } from "../core/templates/config/defaultTemplates";
import { TemplateProcessor } from "../core/templates/TemplateProcessor";
import { WorkoutType } from "../types/clientTypes";
import { isStandardBlueprint } from "../types/standardBlueprint";

/**
 * Generates a group workout blueprint from pre-scored exercises
 * This is the main entry point for group workout generation
 */
export async function generateGroupWorkoutBlueprint(
  groupContext: GroupContext,
  exercises: Exercise[],
  preScoredExercises?: Map<string, ScoredExercise[]>,
): Promise<AnyGroupWorkoutBlueprint> {
  const startTime = Date.now();

  // Removed generateGroupWorkoutBlueprint call log

  try {
    // Use provided exercises
    const exercisePool = exercises;

    // Phase 1 & 2: Filter and score for each client (in parallel)
    let clientScoredExercises = new Map<string, ScoredExercise[]>();

    if (preScoredExercises) {
      // Use pre-scored exercises if provided
      // Using pre-scored exercises
      clientScoredExercises = preScoredExercises;

      // Log exercise counts per client
      for (const [clientId, exercises] of preScoredExercises) {
        // Client exercise count
      }
    } else {
      // Processing exercises for each client

      // Process all clients in parallel
      const clientResults = await Promise.all(
        groupContext.clients.map(async (client) => {
          try {
            // Phase 1: Filter exercises for this client
            // Filtering for client
            const filtered = (await filterExercises({
              exercises: exercisePool,
              clientContext: client,
              includeScoring: false,
            })) as Exercise[];
            // Client exercises filtered

            // Phase 2: Score exercises for this client
            const scored = await scoreAndSortExercises(filtered, {
              intensity: client.intensity,
              muscleTarget: client.muscle_target || [],
              muscleLessen: client.muscle_lessen || [],
              includeExercises: client.exercise_requests?.include,
              templateType: client.templateType,
            }); // scoreBreakdown now always included
            // Client scoring complete

            return { clientId: client.user_id, scored };
          } catch (error) {
            console.error(
              `❌ Error processing client ${client.user_id}:`,
              error,
            );
            // Error logging removed
            throw error;
          }
        }),
      );

      // Store results in maps
      for (const result of clientResults) {
        clientScoredExercises.set(result.clientId, result.scored);
      }
    }

    // Get template configuration
    const templateId = groupContext.templateType || "full_body_bmf";
    // Loading template
    const template = getWorkoutTemplate(templateId);

    if (!template) {
      const error = `Template ${templateId} not found`;
      console.error("❌", error);
      // Error logging removed
      throw new Error(error);
    }

    // Template loaded

    // Phase 3: Create blueprint using new TemplateProcessor
    // Starting Phase 3: Template organization
    const phase3StartTime = Date.now();

    try {
      const processor = new TemplateProcessor(template);

      // Check if this is a standard template (two-phase LLM)
      let blueprint: AnyGroupWorkoutBlueprint;
      if (template.metadata?.llmStrategy === "two-phase") {
        // Using standard template processor

        // Prepare favorites map from client contexts
        const favoritesByClient = new Map<string, string[]>();
        for (const client of groupContext.clients) {
          if (
            client.favoriteExerciseIds &&
            client.favoriteExerciseIds.length > 0
          ) {
            favoritesByClient.set(client.user_id, client.favoriteExerciseIds);
            // Client has favorite exercises
          }
        }

        blueprint = processor.processForStandardGroup(
          clientScoredExercises,
          groupContext,
          favoritesByClient,
        );

        // Apply bucketing for clients with Full Body workout types
        if (isStandardBlueprint(blueprint)) {
          const { applyFullBodyBucketing } = await import(
            "../workout-generation/bucketing/fullBodyBucketing"
          );

          for (const [clientId, pool] of Object.entries(
            blueprint.clientExercisePools,
          )) {
            const client = groupContext.clients.find(
              (c) => c.user_id === clientId,
            );
            if (!client) continue;

            // Check if this client has a full body workout type
            if (
              client.workoutType === WorkoutType.FULL_BODY_WITH_FINISHER ||
              client.workoutType === WorkoutType.FULL_BODY_WITHOUT_FINISHER
            ) {
              // Applying workout bucketing

              // Get favorite IDs for this client
              const clientFavoriteIds = favoritesByClient.get(clientId) || [];

              // Apply bucketing to select from available candidates using client's workout type
              const bucketingResult = applyFullBodyBucketing(
                pool.availableCandidates,
                pool.preAssigned,
                client,
                client.workoutType as WorkoutType,
                clientFavoriteIds,
              );

              // Store bucketed selection
              pool.bucketedSelection = bucketingResult;

              // Selected additional exercises
            } else {
              // Client has non-full body workout type
              // TODO: Handle other workout types (targeted, etc.)
            }
          }
        }
      } else {
        // Using BMF template processor
        blueprint = processor.processForGroup(clientScoredExercises);
      }

      const phase3Time = Date.now() - phase3StartTime;
      // Phase 3 complete

      // Log based on blueprint type
      if ("blocks" in blueprint) {
        // Blueprint created
      } else {
        const clientCount = Object.keys(blueprint.clientExercisePools).length;
        // Standard blueprint created
        // Shared exercises count
      }

      // Log warnings if any
      if (
        blueprint.validationWarnings &&
        blueprint.validationWarnings.length > 0
      ) {
        console.warn("⚠️ Blueprint validation warnings:");
        blueprint.validationWarnings.forEach((warning) => {
          console.warn(`  - ${warning}`);
          // Warning logging removed
        });
      }

      // Phase 3 logging removed

      // Timing logging removed

      const totalTime = Date.now() - startTime;
      // Total group workout generation complete

      return blueprint;
    } catch (phase3Error) {
      console.error("❌ Error in Phase 3:", phase3Error);
      // Error logging removed
      throw phase3Error;
    }
  } catch (error) {
    console.error("❌ Fatal error in generateGroupWorkoutBlueprint:", error);

    // Log the error stack trace for debugging
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }

    // Error data saving removed

    throw error;
  }
}
