import { createLogger } from "../utils/logger";
import { ConversationStateService } from "./conversationStateService";
import { ExerciseValidationService } from "./exerciseValidationService";

const logger = createLogger("ExerciseDisambiguationService");

export interface DisambiguationContext {
  type: "preference_initial" | "preference_update" | "workout_edit";
  sessionId?: string;
  workoutId?: string;
  userId: string;
  businessId: string;
}

export interface DisambiguationResult {
  needsDisambiguation: boolean;
  disambiguationMessage?: string;
  validatedExercises?: string[];
  ambiguousMatches?: any[];
  allOptions?: Array<{ id: string; name: string }>;
}

export interface ExerciseRequest {
  exercises: string[];
  intent: "include" | "avoid" | "replace";
}

export class ExerciseDisambiguationService {
  /**
   * Process exercise requests and check if disambiguation is needed
   */
  static async processExercises(
    exerciseRequest: ExerciseRequest,
    context: DisambiguationContext,
  ): Promise<DisambiguationResult> {
    try {
      const { exercises, intent } = exerciseRequest;

      if (!exercises || exercises.length === 0) {
        return {
          needsDisambiguation: false,
          validatedExercises: [],
        };
      }

      // Validate exercises using ExerciseValidationService
      const validationIntent = intent === "replace" ? "include" : intent;
      const validation = await ExerciseValidationService.validateExercises(
        exercises,
        context.businessId,
        validationIntent,
        context.sessionId,
      );

      // Check if any matches have multiple options
      const ambiguousMatches = validation.matches.filter(
        (match) => match.matchedExercises.length > 1,
      );

      if (ambiguousMatches.length > 0) {
        // Need disambiguation
        const allOptions = this.collectAllOptions(ambiguousMatches);
        const message = this.formatMessage(ambiguousMatches, context);

        return {
          needsDisambiguation: true,
          disambiguationMessage: message,
          ambiguousMatches,
          allOptions,
        };
      }

      // No disambiguation needed
      return {
        needsDisambiguation: false,
        validatedExercises: validation.validatedExercises,
      };
    } catch (error) {
      logger.error("Error processing exercises for disambiguation", error);
      throw error;
    }
  }

  /**
   * Format disambiguation message based on context
   */
  static formatMessage(
    ambiguousMatches: any[],
    context: DisambiguationContext,
  ): string {
    let message = "";

    // Context-specific intro
    switch (context.type) {
      case "preference_initial":
        message =
          "I found multiple exercises matching your request. Please select by number:\n\n";
        break;
      case "preference_update":
        message =
          "I found multiple exercises matching your request. Please select by number:\n\n";
        break;
      case "workout_edit":
        message =
          "I found multiple replacement options. Please select by number:\n\n";
        break;
    }

    // Build options list
    let optionNumber = 1;
    for (const match of ambiguousMatches) {
      message += `For "${match.userInput}":\n`;

      for (const exercise of match.matchedExercises) {
        message += `${optionNumber}. ${exercise.name}\n`;
        optionNumber++;
      }

      message += "\n";
    }

    message += "Reply with number(s) (e.g., '1' or '1,3')";

    return message;
  }

  /**
   * Save disambiguation state based on context
   */
  static async saveDisambiguationState(
    state: {
      ambiguousMatches: any[];
      allOptions: Array<{ id: string; name: string }>;
      originalIntent: string;
    },
    context: DisambiguationContext,
  ): Promise<void> {
    try {
      switch (context.type) {
        case "preference_initial":
        case "preference_update":
          // Save to conversation state for preferences
          await ConversationStateService.createExerciseDisambiguation(
            context.userId,
            context.sessionId!,
            context.businessId,
            state.ambiguousMatches.map((m) => m.userInput).join(", "),
            state.allOptions,
          );
          break;

        case "workout_edit":
          // TODO: Implement workout-specific state storage
          logger.info("Workout edit disambiguation state would be saved here", {
            workoutId: context.workoutId,
            state,
          });
          break;
      }
    } catch (error) {
      logger.error("Error saving disambiguation state", error);
      throw error;
    }
  }

  /**
   * Collect all exercise options from ambiguous matches
   */
  static collectAllOptions(
    ambiguousMatches: any[],
  ): Array<{ id: string; name: string }> {
    const allOptions: Array<{ id: string; name: string }> = [];

    for (const match of ambiguousMatches) {
      for (const exercise of match.matchedExercises) {
        allOptions.push({
          id: exercise.id,
          name: exercise.name,
        });
      }
    }

    return allOptions;
  }

  /**
   * Check if a validation result needs disambiguation
   */
  static checkNeedsDisambiguation(validationResult: any): boolean {
    return validationResult.matches.some(
      (match: any) => match.matchedExercises.length > 1,
    );
  }
}
