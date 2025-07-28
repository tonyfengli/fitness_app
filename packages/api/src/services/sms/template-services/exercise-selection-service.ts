import { db } from "@acme/db/client";
import { TrainingSession, exercises } from "@acme/db/schema";
import { eq } from "@acme/db";
import { createLogger } from "../../../utils/logger";

const logger = createLogger("ExerciseSelectionService");

interface DeterministicSelection {
  roundId: string;
  roundName: string;
  exerciseName: string;
  movementPattern: string;
}

export class ExerciseSelectionService {
  /**
   * Get preview of deterministic exercises for check-in message
   * This doesn't require full blueprint generation
   */
  static async getDeterministicPreview(
    templateType: string
  ): Promise<DeterministicSelection[]> {
    try {
      // For BMF template, we know Round1 is lower body and Round2 is pulling
      if (templateType === 'full_body_bmf') {
        // For now, return hardcoded examples to test the flow
        logger.info("Getting deterministic preview for BMF template");
        
        return [
          {
            roundId: 'Round1',
            roundName: 'Round 1',
            exerciseName: 'Barbell Back Squat',
            movementPattern: 'squat'
          },
          {
            roundId: 'Round2',
            roundName: 'Round 2',
            exerciseName: 'Pull-ups',
            movementPattern: 'vertical_pull'
          }
        ];
      }
      
      return [];
    } catch (error) {
      logger.error("Error getting deterministic preview", { error });
      return [];
    }
  }
  /**
   * Get deterministic exercise selections from session's workout blueprint
   */
  static async getDeterministicSelections(
    sessionId: string
  ): Promise<DeterministicSelection[]> {
    try {
      logger.info("Getting deterministic selections", { sessionId });
      
      // Get session with template config
      const [session] = await db
        .select({
          templateConfig: TrainingSession.templateConfig
        })
        .from(TrainingSession)
        .where(eq(TrainingSession.id, sessionId))
        .limit(1);

      if (!session?.templateConfig) {
        logger.warn("No template config found for session", { sessionId });
        return [];
      }

      const templateConfig = session.templateConfig as any;
      const blueprint = templateConfig?.blueprint;
      
      logger.info("Template config details", {
        sessionId,
        hasTemplateConfig: !!templateConfig,
        hasBlueprint: !!blueprint,
        hasBlueprintBlocks: !!blueprint?.blocks,
        blockCount: blueprint?.blocks?.length || 0
      });
      
      if (!blueprint?.blocks) {
        logger.warn("No blueprint blocks found", { sessionId });
        return [];
      }

      // Extract deterministic selections
      const selections: DeterministicSelection[] = [];
      
      for (const block of blueprint.blocks) {
        // Check if this block uses deterministic selection
        if (block.selectionStrategy === 'deterministic') {
          // For deterministic blocks, we need to look at the candidates
          // The top shared candidate or top individual candidate is the selection
          let topExercise = null;
          
          if (block.sharedCandidates?.length > 0) {
            topExercise = block.sharedCandidates[0];
          } else if (block.individualCandidates) {
            // Find the first client's top candidate
            const firstClientId = Object.keys(block.individualCandidates)[0];
            const firstClientCandidates = block.individualCandidates[firstClientId];
            if (firstClientCandidates?.exercises?.length > 0) {
              topExercise = firstClientCandidates.exercises[0];
            }
          }
          
          if (topExercise) {
            selections.push({
              roundId: block.blockId,
              roundName: block.name,
              exerciseName: topExercise.name,
              movementPattern: topExercise.movementPattern || 'general'
            });
          }
        }
      }

      logger.info("Deterministic selections found", {
        sessionId,
        selectionCount: selections.length,
        selections: selections.map(s => ({
          round: s.roundId,
          exercise: s.exerciseName,
          pattern: s.movementPattern
        }))
      });
      
      return selections;
    } catch (error) {
      logger.error("Error getting deterministic selections", error);
      return [];
    }
  }

  /**
   * Format deterministic selections for SMS message
   */
  static formatSelectionsForSMS(
    selections: DeterministicSelection[],
    clientName: string
  ): string {
    if (selections.length === 0) {
      return `You're checked in, ${clientName}! Ready to get after it today?`;
    }

    // For BMF template: Round 1 is lower body, Round 2 is pulling
    const round1 = selections.find(s => s.roundId === 'Round1');
    const round2 = selections.find(s => s.roundId === 'Round2');

    if (round1 && round2) {
      return `Your first set of exercises is on the TV—feel free to request any swaps. The rest of your workout will build based on your preferences and the group flow.`;
    }

    // Fallback for other templates or partial selections
    const exerciseList = selections
      .slice(0, 2) // Show max 2 exercises
      .map(s => s.exerciseName)
      .join(', then ');
    
    return `You're checked in, ${clientName}! Today's workout includes: ${exerciseList}. Sound good? Let me know if you'd like any adjustments.`;
  }

  /**
   * Get client name from user info
   */
  static formatClientName(userName: string | null): string {
    if (!userName) return "there";
    
    // Extract first name only
    const firstName = userName.split(' ')[0];
    return firstName || "there";
  }
}