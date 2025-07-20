import OpenAI from "openai";
import { exercises } from "@acme/db/schema";
import { createLogger } from "../utils/logger";
import type { InferSelectModel } from "drizzle-orm";

const logger = createLogger("ExerciseMatchingLLMService");

type Exercise = InferSelectModel<typeof exercises>;

export interface MatchResult {
  matchedExerciseNames: string[];
  reasoning?: string;
  llmResponse?: any; // For debugging
  systemPrompt?: string; // The system prompt used
  model?: string; // The model used
  parseTimeMs?: number; // Time taken for LLM call
}

interface ReplacementSuggestion {
  exerciseName: string;
  reasoning: string;
  matchQuality: "exact" | "similar" | "alternative";
}

export type ReplacementReason = 
  | "too_hard" 
  | "too_easy" 
  | "avoid_exercise" 
  | "no_equipment" 
  | "injury_concern"
  | "other";

export class ExerciseMatchingLLMService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
    });
  }

  /**
   * Match user's exercise phrase to actual exercises in the database
   * Used for preference collection (e.g., "avoid heavy squats")
   */
  async matchUserIntent(
    userPhrase: string,
    availableExercises: Pick<Exercise, 'id' | 'name' | 'primaryMuscle' | 'equipment' | 'movementPattern' | 'complexityLevel'>[],
    intent: "avoid" | "include"
  ): Promise<MatchResult> {
    try {
      logger.info("Matching user intent", { userPhrase, intent, exerciseCount: availableExercises.length });

      const exerciseList = this.formatExerciseList(availableExercises);
      
      const systemPrompt = `You are an expert fitness trainer helping match user exercise preferences to actual exercises in a database.

Your task is to PRECISELY match what the user is referring to. Be conservative - only match exercises that clearly fit the user's description.

Available exercises:
${exerciseList}

CRITICAL MATCHING RULES:
1. Be SPECIFIC and CONSERVATIVE - only match exercises that clearly fit the description
2. User wants to ${intent} these exercises

EXERCISE MATCHING GUIDELINES:
- "heavy squats" = ONLY barbell squat variations (e.g., "Barbell Back Squat", "Barbell Front Squat")
- "squats" (unqualified) = ALL squat variations
- "light squats" = bodyweight and dumbbell squat variations
- "lunges" = lunge variations only, NOT squats
- "bench press" = bench press variations only
- "deadlifts" = deadlift variations only

EQUIPMENT QUALIFIERS:
- "heavy" → barbell exercises primarily
- "light" → bodyweight, band, or light dumbbell
- No qualifier → match the base movement pattern only

IMPORTANT: 
- Do NOT include similar but different exercises (e.g., don't include lunges when user says squats)
- Do NOT include all variations unless the user uses generic/unqualified terms
- When in doubt, match fewer exercises rather than more

EXAMPLES:
- "heavy squats" → Match only: Barbell Back Squat, Barbell Front Squat
- "no squats" → Match ALL squat variations
- "avoid lunges" → Match lunge variations ONLY, not squats
- "skip bench" → Match bench press variations only
- "no burpees" → Match only exercises with "burpee" in the name

Return a JSON object with:
{
  "matchedExerciseNames": ["exact exercise names from the list that clearly match"],
  "reasoning": "brief explanation of why these specific exercises were matched"
}`;

      const startTime = Date.now();
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `User wants to ${intent}: "${userPhrase}"` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 500,
      });
      const parseTimeMs = Date.now() - startTime;

      const response = completion.choices[0]?.message.content;
      if (!response) {
        throw new Error("No response from LLM");
      }

      const result: MatchResult = JSON.parse(response);
      result.llmResponse = response; // Store raw response for debugging
      result.systemPrompt = systemPrompt; // Store the system prompt used
      result.model = "gpt-4o-mini"; // Store the model used
      result.parseTimeMs = parseTimeMs; // Store the parse time
      
      logger.info("LLM matching complete", { 
        userPhrase, 
        matchCount: result.matchedExerciseNames.length,
        reasoning: result.reasoning 
      });

      // Validate that all returned exercises exist in our list
      const validExerciseNames = new Set(availableExercises.map(e => e.name));
      const validatedMatches = result.matchedExerciseNames.filter(name => 
        validExerciseNames.has(name)
      );

      if (validatedMatches.length !== result.matchedExerciseNames.length) {
        logger.warn("Some LLM matches were invalid", {
          returned: result.matchedExerciseNames,
          validated: validatedMatches
        });
      }

      result.matchedExerciseNames = validatedMatches;
      return result;
    } catch (error) {
      logger.error("Error in LLM exercise matching", error);
      return {
        matchedExerciseNames: [],
        reasoning: "Error during LLM matching"
      };
    }
  }

  /**
   * Find replacement exercises based on user's reason
   * This will be used for the future exercise swap feature
   */
  async findReplacements(
    exerciseToReplace: string,
    reason: ReplacementReason,
    availableExercises: Exercise[],
    userNote?: string
  ): Promise<ReplacementSuggestion[]> {
    try {
      logger.info("Finding replacements", { 
        exerciseToReplace, 
        reason, 
        userNote,
        exerciseCount: availableExercises.length 
      });

      const exerciseList = this.formatExerciseList(availableExercises);
      const originalExercise = availableExercises.find(e => e.name === exerciseToReplace);
      
      if (!originalExercise) {
        logger.warn("Original exercise not found", { exerciseToReplace });
        return [];
      }

      const reasonContext = this.getReasonContext(reason, userNote);

      const systemPrompt = `You are an expert fitness trainer helping find exercise replacements.

Original exercise to replace: ${exerciseToReplace}
Exercise details: 
- Primary muscle: ${originalExercise.primaryMuscle}
- Movement pattern: ${originalExercise.movementPattern}
- Equipment: ${originalExercise.equipment?.join(", ") || "none"}
- Complexity: ${originalExercise.complexityLevel}

Reason for replacement: ${reasonContext}

Available exercises:
${exerciseList}

REPLACEMENT GUIDELINES:
1. For "too_hard": Find easier variations with same movement pattern or primary muscle
2. For "too_easy": Find harder progressions that build on the same pattern
3. For "avoid_exercise": Find alternatives that work similar muscles but different movement
4. For "no_equipment": Find variations that match user's available equipment
5. For "injury_concern": Prioritize joint-friendly alternatives

Return 3-5 suggestions as JSON:
{
  "suggestions": [
    {
      "exerciseName": "exact name from list",
      "reasoning": "why this is a good replacement",
      "matchQuality": "exact|similar|alternative"
    }
  ]
}`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Find replacements for ${exerciseToReplace}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: 800,
      });

      const response = completion.choices[0]?.message.content;
      if (!response) {
        throw new Error("No response from LLM");
      }

      const result = JSON.parse(response);
      
      logger.info("Replacement suggestions generated", { 
        exerciseToReplace,
        suggestionCount: result.suggestions?.length || 0
      });

      return result.suggestions || [];
    } catch (error) {
      logger.error("Error finding replacements", error);
      return [];
    }
  }

  /**
   * Format exercise list for LLM context
   */
  private formatExerciseList(exercises: Pick<Exercise, 'name' | 'primaryMuscle' | 'equipment'>[]): string {
    return exercises
      .map(ex => `- ${ex.name} (${ex.primaryMuscle}, ${ex.equipment?.join("/") || "bodyweight"})`)
      .join("\n");
  }

  /**
   * Get context string for replacement reason
   */
  private getReasonContext(reason: ReplacementReason, userNote?: string): string {
    const contexts = {
      too_hard: "User finds this exercise too difficult or challenging",
      too_easy: "User wants a more challenging variation",
      avoid_exercise: "User wants to avoid this specific exercise",
      no_equipment: "User doesn't have the required equipment",
      injury_concern: "User has injury or pain concerns",
      other: "User has a specific reason"
    };

    let context = contexts[reason];
    if (userNote) {
      context += `. User note: "${userNote}"`;
    }
    return context;
  }
}