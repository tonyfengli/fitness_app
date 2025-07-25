import { db } from "@acme/db/client";
import { exercises, BusinessExercise } from "@acme/db/schema";
import { eq, and, ilike, sql } from "@acme/db";
import { createLogger } from "../utils/logger";
import { HybridExerciseMatcherService } from "./hybridExerciseMatcherService";
import { sessionTestDataLogger } from "../utils/sessionTestDataLogger";

const logger = createLogger("ExerciseValidationService");

export interface ExerciseMatch {
  userInput: string;
  matchedExercises: Array<{
    id: string;
    name: string;
  }>;
  confidence: "exercise_type" | "pattern" | "llm_match" | "no_match";
  matchMethod?: "exercise_type" | "pattern" | "llm";
  llmReasoning?: string;
  systemPrompt?: string;
  model?: string;
  parseTimeMs?: number;
}

export class ExerciseValidationService {
  private static hybridMatcher = new HybridExerciseMatcherService();
  
  /**
   * Validate and match exercise names from user input to actual exercises in the database
   */
  static async validateExercises(
    userInputExercises: string[] | undefined | null,
    businessId: string,
    intent: "avoid" | "include" = "avoid",
    sessionId?: string
  ): Promise<{
    validatedExercises: string[];
    matches: ExerciseMatch[];
    hasUnrecognized: boolean;
    model?: string;
    parseTimeMs?: number;
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

    // Get all business exercises - only fetch the fields we need
    const businessExercises = await db
      .select({
        id: exercises.id,
        name: exercises.name,
        exerciseType: exercises.exerciseType,
        primaryMuscle: exercises.primaryMuscle,
        equipment: exercises.equipment,
        movementPattern: exercises.movementPattern,
        complexityLevel: exercises.complexityLevel,
      })
      .from(exercises)
      .innerJoin(BusinessExercise, eq(exercises.id, BusinessExercise.exerciseId))
      .where(eq(BusinessExercise.businessId, businessId));

    // Use hybrid matcher for all exercise phrases in parallel
    const matchPromises = userInputExercises.map(async (userInput) => {
      try {
        const matchResult = await ExerciseValidationService.hybridMatcher.matchExercises(
          userInput,
          businessExercises,
          intent
        );
        
        logger.info("Hybrid matcher result", {
          userInput,
          matchMethod: matchResult.matchMethod,
          matchCount: matchResult.matchedExercises.length,
          matchedNames: matchResult.matchedExerciseNames,
          parseTimeMs: matchResult.parseTimeMs
        });
        
        // Log exercise matcher call if session logging is enabled
        if (sessionId && sessionTestDataLogger.isEnabled()) {
          const matcherCall = {
            userPhrase: userInput,
            intent,
            matchMethod: matchResult.matchMethod as "exercise_type" | "pattern" | "llm",
            matchedExercises: matchResult.matchedExerciseNames,
            parseTimeMs: matchResult.parseTimeMs || 0
          };
          
          // If LLM was used, include the LLM details
          if (matchResult.matchMethod === 'llm' && matchResult.systemPrompt) {
            (matcherCall as any).llmFallback = {
              systemPrompt: matchResult.systemPrompt,
              rawResponse: matchResult.llmResponse || matchResult.reasoning,
              reasoning: matchResult.reasoning || ''
            };
            
            // Also log as a separate LLM call
            sessionTestDataLogger.logLLMCall(sessionId, {
              type: 'exercise_matching',
              model: matchResult.model || 'gpt-4o-mini',
              systemPrompt: matchResult.systemPrompt,
              userInput: userInput,
              rawResponse: matchResult.llmResponse || matchResult.reasoning,
              parseTimeMs: matchResult.parseTimeMs || 0
            });
          }
          
          sessionTestDataLogger.logExerciseMatcherCall(sessionId, matcherCall);
        }
        
        return {
          userInput,
          matchedExercises: matchResult.matchedExercises,
          confidence: matchResult.matchedExercises.length > 0 ? (matchResult.matchMethod === "llm" ? "llm_match" : matchResult.matchMethod) : "no_match",
          matchMethod: matchResult.matchMethod,
          llmReasoning: matchResult.reasoning,
          systemPrompt: matchResult.systemPrompt,
          model: matchResult.model,
          parseTimeMs: matchResult.parseTimeMs,
          matchedExerciseNames: matchResult.matchedExerciseNames
        };
      } catch (error) {
        logger.error("Exercise matching failed for input", { userInput, error });
        return {
          userInput,
          matchedExercises: [],
          confidence: "no_match" as const,
          matchedExerciseNames: []
        };
      }
    });
    
    // Wait for all matches to complete in parallel
    const matchResults = await Promise.all(matchPromises);
    
    // Process results
    matchResults.forEach(result => {
      matches.push({
        userInput: result.userInput,
        matchedExercises: result.matchedExercises,
        confidence: result.confidence as "exercise_type" | "pattern" | "llm_match" | "no_match",
        matchMethod: result.matchMethod,
        llmReasoning: result.llmReasoning,
        parseTimeMs: result.parseTimeMs
      });
      
      // Add all matched exercise names
      validatedExercises.push(...result.matchedExerciseNames);
    });

    const hasUnrecognized = matches.some(m => m.confidence === "no_match");

    logger.info("Exercise validation complete", {
      inputCount: userInputExercises.length,
      validatedCount: validatedExercises.length,
      hasUnrecognized,
    });

    // Aggregate metadata from all matches
    const totalParseTime = matches.reduce((sum, match) => sum + (match.parseTimeMs || 0), 0);
    const model = matches.find(m => m.model)?.model;

    return {
      validatedExercises,
      matches,
      hasUnrecognized,
      model,
      parseTimeMs: totalParseTime
    };
  }

  /**
   * [DEPRECATED - Kept for reference]
   * Find the best match for a user input exercise name using fuzzy matching
   */
  private static async findBestMatchFuzzy(
    userInput: string,
    businessExercises: Array<{ id: string; name: string }>,
    businessId: string
  ): Promise<any> {
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

    // Initialize the matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [];
      matrix[i]![0] = i;
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0]![j] = j;
    }

    // Fill the matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // substitution
            matrix[i]![j - 1]! + 1, // insertion
            matrix[i - 1]![j]! + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length]![str1.length]!;
  }
}