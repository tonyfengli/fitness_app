import type { InferSelectModel } from "drizzle-orm";
import OpenAI from "openai";

import { exercises } from "@acme/db/schema";

import { createLogger } from "../utils/logger";

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
      apiKey: process.env.OPENAI_API_KEY || "test-key",
    });
  }

  /**
   * Match user's exercise phrase to actual exercises in the database
   * Used for preference collection (e.g., "avoid heavy squats")
   */
  async matchUserIntent(
    userPhrase: string,
    availableExercises: Pick<
      Exercise,
      | "id"
      | "name"
      | "exerciseType"
      | "primaryMuscle"
      | "equipment"
      | "movementPattern"
      | "complexityLevel"
    >[],
    intent: "avoid" | "include",
  ): Promise<MatchResult> {
    try {
      logger.info("Matching user intent", {
        userPhrase,
        intent,
        exerciseCount: availableExercises.length,
      });

      const exerciseList = this.formatExerciseList(availableExercises);

      const systemPrompt = `You are an expert fitness trainer helping match user exercise preferences to actual exercises in a database.

TASK: Match the user's exercise request to exercises from the provided list using a SYSTEMATIC approach.

Available exercises (format: name | primary_muscle | movement_pattern | equipment):
${exerciseList}

MATCHING ALGORITHM:
1. Parse the user input to identify:
   - Base exercise type (squat, deadlift, press, row, etc.)
   - Equipment qualifier (heavy, light, barbell, dumbbell, etc.)
   - Any modifiers (variations, specific types)

2. Apply these matching rules IN ORDER:
   a) Check movement pattern field (2nd field) for primary matching
   b) Check exercise name for specific variations
   c) Apply equipment filters if specified

3. For "${intent}" intent:
${
  intent === "avoid"
    ? `   - Be CONSERVATIVE: Only match exercises that clearly fit
   - "squats" → ALL exercises with movement_pattern="squat"
   - "heavy squats" → ONLY barbell exercises with movement_pattern="squat"
   - "bench press" → exercises with "bench press" in name
   - Match should be restrictive to ensure user avoids all relevant exercises`
    : `   - Be INCLUSIVE: Return all possible variations for user choice
   - "squats" → ALL exercises with movement_pattern="squat"
   - "deadlifts" → ALL exercises with movement_pattern="hinge" AND "deadlift" in name
   - "presses" → exercises with "press" in name OR vertical_push/horizontal_push patterns
   - Give users options to choose from`
}

SYSTEMATIC MATCHING RULES:

For MOVEMENT-BASED requests (squats, lunges, deadlifts, etc.):
- Primary match: movement_pattern field
- Secondary match: exercise name contains the term
- Equipment filter: apply if specified

For NAME-BASED requests (bench press, pull-ups, etc.):
- Primary match: exercise name contains the specific term
- Equipment filter: apply if specified

MOVEMENT PATTERN DEFINITIONS:
- squat: squat variations (NOT lunges, step-ups)
- lunge: lunge variations (NOT squats)
- hinge: deadlifts, RDLs, good mornings, swings
- horizontal_push: bench press, push-ups
- vertical_push: overhead press, shoulder press
- horizontal_pull: rows
- vertical_pull: pull-ups, pulldowns
- carry: farmer's carry, suitcase carry
- core: planks, ab exercises

CRITICAL REQUIREMENTS:
1. You MUST scan the ENTIRE exercise list
2. Count exercises as you match them
3. Do NOT stop early - check every single exercise
4. Your response must include ALL matching exercises

VERIFICATION CHECKLIST:
Before returning results, verify:
□ Did I check every exercise in the list?
□ Did I apply movement pattern matching correctly?
□ Did I include all exercises that match the criteria?
□ Is my match count reasonable for this exercise type?

Return a JSON object:
{
  "matchedExerciseNames": ["list all matching exercise names here"],
  "reasoning": "explain your matching logic and confirm you checked all exercises",
  "matchCount": number,
  "verificationNotes": "confirm you scanned the entire list"
}`;

      const startTime = Date.now();
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `User wants to ${intent}: "${userPhrase}"` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1500, // Increased to handle larger exercise lists
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
        reasoning: result.reasoning,
      });

      // Validate that all returned exercises exist in our list
      const validExerciseNames = new Set(availableExercises.map((e) => e.name));
      const validatedMatches = result.matchedExerciseNames.filter((name) =>
        validExerciseNames.has(name),
      );

      if (validatedMatches.length !== result.matchedExerciseNames.length) {
        logger.warn("Some LLM matches were invalid", {
          returned: result.matchedExerciseNames,
          validated: validatedMatches,
        });
      }

      result.matchedExerciseNames = validatedMatches;
      return result;
    } catch (error) {
      logger.error("Error in LLM exercise matching", error);
      return {
        matchedExerciseNames: [],
        reasoning: "Error during LLM matching",
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
    userNote?: string,
  ): Promise<ReplacementSuggestion[]> {
    try {
      logger.info("Finding replacements", {
        exerciseToReplace,
        reason,
        userNote,
        exerciseCount: availableExercises.length,
      });

      const exerciseList = this.formatExerciseList(availableExercises);
      const originalExercise = availableExercises.find(
        (e) => e.name === exerciseToReplace,
      );

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
          {
            role: "user",
            content: `Find replacements for ${exerciseToReplace}`,
          },
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
        suggestionCount: result.suggestions?.length || 0,
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
  private formatExerciseList(
    exercises: Pick<
      Exercise,
      "name" | "primaryMuscle" | "equipment" | "movementPattern"
    >[],
  ): string {
    return exercises
      .map(
        (ex) =>
          `- ${ex.name} | ${ex.primaryMuscle} | ${ex.movementPattern || "unspecified"} | ${ex.equipment?.join("/") || "bodyweight"}`,
      )
      .join("\n");
  }

  /**
   * Get context string for replacement reason
   */
  private getReasonContext(
    reason: ReplacementReason,
    userNote?: string,
  ): string {
    const contexts = {
      too_hard: "User finds this exercise too difficult or challenging",
      too_easy: "User wants a more challenging variation",
      avoid_exercise: "User wants to avoid this specific exercise",
      no_equipment: "User doesn't have the required equipment",
      injury_concern: "User has injury or pain concerns",
      other: "User has a specific reason",
    };

    let context = contexts[reason];
    if (userNote) {
      context += `. User note: "${userNote}"`;
    }
    return context;
  }
}
