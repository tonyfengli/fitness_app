import { db } from "@acme/db/client";
import { exercises, BusinessExercise } from "@acme/db/schema";
import { eq, and, ilike, sql } from "@acme/db";
import { createLogger } from "../utils/logger";

const logger = createLogger("ExerciseValidationService");

export interface ExerciseMatch {
  userInput: string;
  matchedExercise?: {
    id: string;
    name: string;
  };
  confidence: "exact" | "fuzzy" | "no_match";
}

export class ExerciseValidationService {
  /**
   * Validate and match exercise names from user input to actual exercises in the database
   */
  static async validateExercises(
    userInputExercises: string[] | undefined | null,
    businessId: string
  ): Promise<{
    validatedExercises: string[];
    matches: ExerciseMatch[];
    hasUnrecognized: boolean;
  }> {
    logger.info("Starting exercise validation", {
      userInputExercises,
      businessId
    });

    if (!userInputExercises || userInputExercises.length === 0) {
      return {
        validatedExercises: [],
        matches: [],
        hasUnrecognized: false,
      };
    }

    const matches: ExerciseMatch[] = [];
    const validatedExercises: string[] = [];

    // Get all business exercises for fuzzy matching
    const businessExercises = await db
      .select({
        id: exercises.id,
        name: exercises.name,
      })
      .from(exercises)
      .innerJoin(BusinessExercise, eq(exercises.id, BusinessExercise.exerciseId))
      .where(eq(BusinessExercise.businessId, businessId));

    for (const userInput of userInputExercises) {
      const match = await this.findBestMatch(userInput, businessExercises, businessId);
      matches.push(match);
      
      logger.info("Exercise match result", {
        userInput,
        match
      });
      
      if (match.matchedExercise) {
        validatedExercises.push(match.matchedExercise.name);
      }
    }

    const hasUnrecognized = matches.some(m => m.confidence === "no_match");

    logger.info("Exercise validation complete", {
      inputCount: userInputExercises.length,
      validatedCount: validatedExercises.length,
      hasUnrecognized,
    });

    return {
      validatedExercises,
      matches,
      hasUnrecognized,
    };
  }

  /**
   * Find the best match for a user input exercise name
   */
  private static async findBestMatch(
    userInput: string,
    businessExercises: Array<{ id: string; name: string }>,
    businessId: string
  ): Promise<ExerciseMatch> {
    const normalizedInput = this.normalizeExerciseName(userInput);

    // 1. Try exact match (case-insensitive)
    const exactMatch = businessExercises.find(
      ex => this.normalizeExerciseName(ex.name) === normalizedInput
    );

    if (exactMatch) {
      return {
        userInput,
        matchedExercise: exactMatch,
        confidence: "exact",
      };
    }

    // 2. Try database ILIKE search for partial matches
    const partialMatches = await db
      .select({
        id: exercises.id,
        name: exercises.name,
      })
      .from(exercises)
      .innerJoin(BusinessExercise, eq(exercises.id, BusinessExercise.exerciseId))
      .where(
        and(
          eq(BusinessExercise.businessId, businessId),
          ilike(exercises.name, `%${normalizedInput}%`)
        )
      )
      .limit(5);

    // Score partial matches based on similarity
    if (partialMatches.length > 0) {
      const bestPartialMatch = this.getBestFuzzyMatch(normalizedInput, partialMatches);
      if (bestPartialMatch) {
        return {
          userInput,
          matchedExercise: bestPartialMatch,
          confidence: "fuzzy",
        };
      }
    }

    // 3. Try fuzzy matching with all exercises
    const bestFuzzyMatch = this.getBestFuzzyMatch(normalizedInput, businessExercises);
    if (bestFuzzyMatch && this.calculateSimilarity(normalizedInput, bestFuzzyMatch.name) > 0.6) {
      return {
        userInput,
        matchedExercise: bestFuzzyMatch,
        confidence: "fuzzy",
      };
    }

    // No match found
    return {
      userInput,
      confidence: "no_match",
    };
  }

  /**
   * Normalize exercise name for comparison
   */
  private static normalizeExerciseName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      // Remove common variations
      .replace(/\s*\([^)]*\)/g, '') // Remove parentheses content
      .replace(/^(the|a|an)\s+/i, '') // Remove articles
      .replace(/\s+/g, ' ') // Normalize whitespace
      // Remove intensity modifiers that users might add
      .replace(/^(heavy|light|medium|hard|easy)\s+/i, '')
      .replace(/\s+(heavy|light|medium|hard|easy)$/i, '')
      // Common exercise name variations
      .replace(/^db\s+/i, 'dumbbell ')
      .replace(/^bb\s+/i, 'barbell ')
      .replace(/\s+press$/i, ' press')
      .replace(/\s+row$/i, ' row')
      .replace(/\s+curl$/i, ' curl')
      // Plural to singular
      .replace(/squats?$/i, 'squat')
      .replace(/deadlifts?$/i, 'deadlift')
      .replace(/lunges?$/i, 'lunge')
      .replace(/presses$/i, 'press')
      .replace(/rows$/i, 'row')
      .replace(/curls$/i, 'curl');
  }

  /**
   * Get the best fuzzy match from a list of exercises
   */
  private static getBestFuzzyMatch(
    searchTerm: string,
    exercises: Array<{ id: string; name: string }>
  ): { id: string; name: string } | null {
    let bestMatch: { id: string; name: string } | null = null;
    let bestScore = 0;

    for (const exercise of exercises) {
      const score = this.calculateSimilarity(searchTerm, exercise.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = exercise;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate similarity score between two strings
   * Uses a combination of techniques for better matching
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const normalized1 = this.normalizeExerciseName(str1);
    const normalized2 = this.normalizeExerciseName(str2);

    // If one string contains the other, high score
    if (normalized2.includes(normalized1) || normalized1.includes(normalized2)) {
      return 0.8;
    }

    // Token-based matching
    const tokens1 = normalized1.split(' ');
    const tokens2 = normalized2.split(' ');
    
    let matchingTokens = 0;
    for (const token1 of tokens1) {
      if (tokens2.some(token2 => token2.includes(token1) || token1.includes(token2))) {
        matchingTokens++;
      }
    }

    const tokenScore = matchingTokens / Math.max(tokens1.length, tokens2.length);

    // Levenshtein distance for overall similarity
    const levenshteinScore = 1 - (this.levenshteinDistance(normalized1, normalized2) / Math.max(normalized1.length, normalized2.length));

    // Combine scores
    return (tokenScore * 0.7) + (levenshteinScore * 0.3);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}