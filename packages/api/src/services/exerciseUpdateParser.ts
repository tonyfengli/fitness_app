import type {
  ExerciseUpdateIntent,
  IExerciseUpdateParser,
} from "./interfaces/IExerciseUpdateParser";
import { createLogger } from "../utils/logger";
import { ExerciseValidationService } from "./exerciseValidationService";

const logger = createLogger("ExerciseUpdateParser");

export class ExerciseUpdateParser implements IExerciseUpdateParser {
  // Pattern matching for update intent
  private static readonly INTENT_PATTERNS = {
    add: /\b(add|include|also|plus|and|with|let's do|lets do|want to do|wanna do|try|focus on)\b/i,
    remove:
      /\b(remove|skip|no|avoid|without|stop|don't|dont|exclude|delete)\b/i,
    replace: /\b(instead|replace|switch to|change to)\b/i,
  };

  // Special patterns that need context
  private static readonly CONTEXT_PATTERNS = {
    negativeWant: /\b(don't|dont|do not)\s+want/i,
    actuallyPattern: /\b(actually|wait|no)\b.*\b(instead|rather|change)\b/i,
  };

  /**
   * Parse exercise update from message
   * Uses ExerciseValidationService for intelligent exercise matching
   */
  async parseExerciseUpdate(
    message: string,
    businessId?: string,
  ): Promise<ExerciseUpdateIntent> {
    try {
      // Determine intent first
      const intent = this.determineIntent(message);

      if (intent === "unknown") {
        return {
          action: "unknown",
          exercises: [],
          rawInput: message,
        };
      }

      // Extract potential exercise mentions
      const exerciseMentions = this.extractPotentialExercises(message);

      if (exerciseMentions.length === 0) {
        // Even with intent, no exercises found
        return {
          action: intent,
          exercises: [],
          rawInput: message,
        };
      }

      // Validate exercises using the validation service
      const validatedExercises: string[] = [];
      const allMatches: any[] = [];

      logger.debug("Validating exercise mentions", {
        mentions: exerciseMentions,
        intent,
      });

      // Validate all mentions together to preserve the validation result
      const validation = await ExerciseValidationService.validateExercises(
        exerciseMentions,
        businessId || "default",
        intent === "add" ? "include" : "avoid",
      );

      return {
        action: intent,
        exercises: [...new Set(validation.validatedExercises)], // Remove duplicates
        rawInput: message,
        validationResult: validation, // Include the full validation result
      };
    } catch (error) {
      logger.error("Failed to parse exercise update", error);
      return {
        action: "unknown",
        exercises: [],
        rawInput: message,
      };
    }
  }

  /**
   * Determine the intent of the update (add or remove)
   */
  private determineIntent(message: string): "add" | "remove" | "unknown" {
    // Check for special context patterns first
    if (ExerciseUpdateParser.CONTEXT_PATTERNS.negativeWant.test(message)) {
      return "remove";
    }

    const hasRemoveIntent =
      ExerciseUpdateParser.INTENT_PATTERNS.remove.test(message);
    const hasAddIntent = ExerciseUpdateParser.INTENT_PATTERNS.add.test(message);

    // If both intents present, prioritize remove (safer)
    if (hasRemoveIntent && hasAddIntent) {
      // Look for stronger signals
      const removeStrength = this.getIntentStrength(message, "remove");
      const addStrength = this.getIntentStrength(message, "add");

      return removeStrength > addStrength ? "remove" : "add";
    }

    if (hasRemoveIntent) return "remove";
    if (hasAddIntent) return "add";

    // Check for "want" after checking negative patterns
    if (/\bwant\b/i.test(message) && !hasRemoveIntent) {
      return "add";
    }

    // Check for common exercise request patterns
    if (/^let'?s\s+(do\s+)?/i.test(message)) {
      return "add";
    }

    // Check for update context - but don't assume it's always addition
    const hasUpdateContext = /\b(actually|instead|change|update)\b/i.test(
      message,
    );
    if (hasUpdateContext && !hasRemoveIntent && !hasAddIntent) {
      // Only default to 'add' if there's update context but no clear intent
      return "unknown";
    }

    return "unknown";
  }

  /**
   * Get the strength of an intent based on keyword proximity
   */
  private getIntentStrength(message: string, intent: "add" | "remove"): number {
    const pattern = ExerciseUpdateParser.INTENT_PATTERNS[intent];
    const matches = message.match(pattern);

    if (!matches) return 0;

    // Strong intent keywords
    const strongKeywords = {
      add: ["add", "include", "want"],
      remove: ["remove", "delete", "don't", "dont"],
    };

    const keyword = matches[0].toLowerCase();
    return strongKeywords[intent].includes(keyword) ? 2 : 1;
  }

  /**
   * Extract potential exercise mentions from message
   */
  private extractPotentialExercises(message: string): string[] {
    const mentions: string[] = [];

    // First, try to find exercise mentions after common patterns
    const afterPatterns = [
      /(?:add|include|skip|remove|avoid|do|try)\s+(?:some\s+)?(.+?)(?:\s*(?:to|from|for|please|today|now|thanks|$))/gi,
      /(?:let'?s\s+do|want\s+to\s+do)\s+(.+?)(?:\s*(?:today|now|please|thanks|$))/gi,
      /(?:don'?t|dont)\s+want\s+(?:to\s+do\s+)?(.+?)(?:\s*(?:anymore|today|now|please|thanks|$))/gi,
    ];

    for (const pattern of afterPatterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const exercisePart = match[1]?.trim();
        if (exercisePart && !mentions.includes(exercisePart)) {
          mentions.push(exercisePart);
        }
      }
    }

    // If no matches from patterns, fall back to segment-based extraction
    if (mentions.length === 0) {
      // Split message into segments
      const segments = message.split(/[,;.!?]|\b(?:and|or|also|plus)\b/i);

      for (const segment of segments) {
        // Clean up segment
        const cleaned = segment.trim().toLowerCase();
        if (!cleaned) continue;

        // Remove intent words to isolate exercise names
        let exercisePart = cleaned;

        // Remove intent keywords but preserve the exercise name
        exercisePart = exercisePart
          .replace(/^(actually\s+)?/i, "")
          .replace(
            /^(i\s+)?(don'?t|dont|do\s+not)\s+want\s+(to\s+)?(do\s+)?/i,
            "",
          )
          .replace(
            /^(i\s+)?(want\s+to\s+|wanna\s+|let'?s\s+do\s+|let'?s\s+)/i,
            "",
          )
          .replace(
            /^(add|include|skip|remove|avoid|without|stop|exclude|delete)\s+/i,
            "",
          )
          .replace(/^(some|the|that|those|these|any)\s+/i, "")
          .replace(/\s+(anymore|instead|rather|today|now|please|thanks)$/i, "")
          .replace(/,?\s+(remove|delete|skip)\s+that$/i, "")
          .trim();

        if (exercisePart && exercisePart.length > 2) {
          // Don't add duplicates
          if (
            !mentions.some(
              (m) => m.toLowerCase() === exercisePart.toLowerCase(),
            )
          ) {
            mentions.push(exercisePart);
            logger.debug("Extracted exercise mention", {
              original: segment,
              cleaned: exercisePart,
            });
          }
        }
      }
    }

    return mentions;
  }
}

// Export singleton instance
export const exerciseUpdateParser = new ExerciseUpdateParser();
