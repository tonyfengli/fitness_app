import type { InferSelectModel } from "drizzle-orm";

import { exercises } from "@acme/db/schema";

import { createLogger } from "../utils/logger";
import { ExerciseMatchingLLMService } from "./exerciseMatchingLLMService";

const logger = createLogger("HybridExerciseMatcherService");

type Exercise = InferSelectModel<typeof exercises>;

export interface MatchResult {
  matchedExerciseNames: string[];
  matchedExercises: Array<{ id: string; name: string }>;
  matchMethod: "exercise_type" | "pattern" | "llm";
  reasoning?: string;
  systemPrompt?: string;
  model?: string;
  llmResponse?: any;
  parseTimeMs?: number;
}

export class HybridExerciseMatcherService {
  private llmService: ExerciseMatchingLLMService;

  constructor() {
    this.llmService = new ExerciseMatchingLLMService();
  }

  /**
   * Main entry point for matching exercise phrases to database exercises
   */
  async matchExercises(
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
    const startTime = Date.now();

    logger.info("Starting hybrid exercise matching", {
      userPhrase,
      intent,
      exerciseCount: availableExercises.length,
    });

    // 1. Try exercise type matching first
    const typeMatch = this.matchByExerciseType(userPhrase, availableExercises);
    if (typeMatch.matchedExercises.length > 0) {
      const parseTimeMs = Date.now() - startTime;
      logger.info("Matched by exercise type", {
        userPhrase,
        matchCount: typeMatch.matchedExercises.length,
        parseTimeMs,
      });
      return { ...typeMatch, parseTimeMs };
    }

    // 2. Try deterministic pattern matching
    const patternMatch = this.matchByPatterns(userPhrase, availableExercises);
    if (patternMatch.matchedExercises.length > 0) {
      const parseTimeMs = Date.now() - startTime;
      logger.info("Matched by pattern", {
        userPhrase,
        matchCount: patternMatch.matchedExercises.length,
        parseTimeMs,
      });
      return { ...patternMatch, parseTimeMs };
    }

    // 3. Fall back to LLM for fuzzy matching
    logger.info("Falling back to LLM matching", { userPhrase });
    const llmResult = await this.llmService.matchUserIntent(
      userPhrase,
      availableExercises,
      intent,
    );

    const matchedExercises = availableExercises
      .filter((ex) => llmResult.matchedExerciseNames.includes(ex.name))
      .map((ex) => ({ id: ex.id, name: ex.name }));

    const parseTimeMs = Date.now() - startTime;

    return {
      matchedExerciseNames: llmResult.matchedExerciseNames,
      matchedExercises,
      matchMethod: "llm",
      reasoning: llmResult.reasoning,
      systemPrompt: llmResult.systemPrompt,
      model: llmResult.model,
      llmResponse: llmResult.llmResponse,
      parseTimeMs: llmResult.parseTimeMs || parseTimeMs,
    };
  }

  /**
   * Match by exercise type with basic normalization
   */
  private matchByExerciseType(
    userPhrase: string,
    exercises: Pick<Exercise, "id" | "name" | "exerciseType">[],
  ): Omit<MatchResult, "parseTimeMs"> {
    const normalized = userPhrase.toLowerCase().trim();

    // Remove trailing 's' for simple plural handling
    const singular = normalized.replace(/s$/, "");

    // Direct mapping to exercise_type enum values
    const typeMap: Record<string, string> = {
      // Squat variations
      squat: "squat",
      squats: "squat",

      // Lunge variations
      lunge: "lunge",
      lunges: "lunge",

      // Bench press variations
      bench: "bench_press",
      "bench press": "bench_press",
      "bench presses": "bench_press",

      // Pull-up variations
      "pull-up": "pull_up",
      pullup: "pull_up",
      "pull up": "pull_up",
      pullups: "pull_up",
      "pull-ups": "pull_up",
      "pull ups": "pull_up",

      // Deadlift variations
      deadlift: "deadlift",
      deadlifts: "deadlift",

      // Row variations
      row: "row",
      rows: "row",

      // Press variations (non-bench)
      press: "press",
      presses: "press",

      // Other exercise types
      curl: "curl",
      curls: "curl",
      fly: "fly",
      flies: "fly",
      plank: "plank",
      planks: "plank",
      carry: "carry",
      carries: "carry",
      raise: "raise",
      raises: "raise",
      extension: "extension",
      extensions: "extension",
      "push-up": "push_up",
      pushup: "push_up",
      "push up": "push_up",
      pushups: "push_up",
      "push-ups": "push_up",
      "push ups": "push_up",
      dip: "dip",
      dips: "dip",
      shrug: "shrug",
      shrugs: "shrug",
      bridge: "bridge",
      bridges: "bridge",
      "step-up": "step_up",
      "step up": "step_up",
      stepup: "step_up",
      "step-ups": "step_up",
      "step ups": "step_up",
      stepups: "step_up",
      "calf raise": "calf_raise",
      "calf raises": "calf_raise",
      crunch: "crunch",
      crunches: "crunch",
      "leg raise": "leg_raise",
      "leg raises": "leg_raise",
      pulldown: "pulldown",
      pulldowns: "pulldown",
      pullover: "pullover",
      pullovers: "pullover",
      kickback: "kickback",
      kickbacks: "kickback",
      thruster: "thruster",
      thrusters: "thruster",
      swing: "swing",
      swings: "swing",
    };

    const exerciseType = typeMap[normalized] || typeMap[singular];

    if (!exerciseType) {
      return {
        matchedExerciseNames: [],
        matchedExercises: [],
        matchMethod: "exercise_type",
      };
    }

    const matched = exercises.filter((ex) => ex.exerciseType === exerciseType);

    return {
      matchedExerciseNames: matched.map((ex) => ex.name),
      matchedExercises: matched.map((ex) => ({ id: ex.id, name: ex.name })),
      matchMethod: "exercise_type",
      reasoning: `Matched all exercises with type: ${exerciseType}`,
    };
  }

  /**
   * Match by deterministic patterns
   */
  private matchByPatterns(
    userPhrase: string,
    exercises: Pick<
      Exercise,
      "id" | "name" | "exerciseType" | "equipment" | "movementPattern"
    >[],
  ): Omit<MatchResult, "parseTimeMs"> {
    const normalized = userPhrase.toLowerCase().trim();

    // Pattern 1: Modifier + Exercise Type
    const modifierPatterns = [
      {
        pattern: /^(heavy|barbell)\s+(squats?|deadlifts?|bench\s*press)$/,
        matcher: (ex: (typeof exercises)[0], match: RegExpMatchArray) => {
          const exerciseTypeMatch = this.getExerciseTypeFromPhrase(
            match[2] || "",
          );
          return (
            exerciseTypeMatch &&
            ex.exerciseType === exerciseTypeMatch &&
            ex.equipment?.includes("barbell")
          );
        },
        reasoning: "Matched heavy/barbell exercises",
      },
      {
        pattern: /^(light|dumbbell)\s+(squats?|press|presses|bench\s*press)$/,
        matcher: (ex: (typeof exercises)[0], match: RegExpMatchArray) => {
          const exerciseTypeMatch = this.getExerciseTypeFromPhrase(
            match[2] || "",
          );
          return (
            exerciseTypeMatch &&
            ex.exerciseType === exerciseTypeMatch &&
            ex.equipment?.includes("dumbbells")
          );
        },
        reasoning: "Matched light/dumbbell exercises",
      },
      {
        pattern: /^bodyweight\s+(.+)$/,
        matcher: (ex: (typeof exercises)[0], match: RegExpMatchArray) => {
          const exerciseTypeMatch = this.getExerciseTypeFromPhrase(
            match[1] || "",
          );
          return (
            exerciseTypeMatch &&
            ex.exerciseType === exerciseTypeMatch &&
            (!ex.equipment || ex.equipment.length === 0)
          );
        },
        reasoning: "Matched bodyweight exercises",
      },
    ];

    // Check modifier patterns
    for (const { pattern, matcher, reasoning } of modifierPatterns) {
      const match = normalized.match(pattern);
      if (match) {
        const matched = exercises.filter((ex) => matcher(ex, match));
        if (matched.length > 0) {
          return {
            matchedExerciseNames: matched.map((ex) => ex.name),
            matchedExercises: matched.map((ex) => ({
              id: ex.id,
              name: ex.name,
            })),
            matchMethod: "pattern",
            reasoning,
          };
        }
      }
    }

    // Pattern 2: Equipment-only queries
    if (
      normalized === "band work" ||
      normalized === "bands" ||
      normalized === "band exercises"
    ) {
      const matched = exercises.filter((ex) => ex.equipment?.includes("bands"));
      return {
        matchedExerciseNames: matched.map((ex) => ex.name),
        matchedExercises: matched.map((ex) => ({ id: ex.id, name: ex.name })),
        matchMethod: "pattern",
        reasoning: "Matched band exercises",
      };
    }

    if (normalized === "bodyweight" || normalized === "bodyweight exercises") {
      const matched = exercises.filter(
        (ex) => !ex.equipment || ex.equipment.length === 0,
      );
      return {
        matchedExerciseNames: matched.map((ex) => ex.name),
        matchedExercises: matched.map((ex) => ({ id: ex.id, name: ex.name })),
        matchMethod: "pattern",
        reasoning: "Matched bodyweight exercises",
      };
    }

    if (
      normalized === "dumbbells only" ||
      normalized === "only dumbbells" ||
      normalized === "dumbbell only"
    ) {
      const matched = exercises.filter(
        (ex) => ex.equipment?.length === 1 && ex.equipment[0] === "dumbbells",
      );
      return {
        matchedExerciseNames: matched.map((ex) => ex.name),
        matchedExercises: matched.map((ex) => ({ id: ex.id, name: ex.name })),
        matchMethod: "pattern",
        reasoning: "Matched dumbbell-only exercises",
      };
    }

    // Pattern 3: Movement patterns
    const movementPatterns: Record<string, string[]> = {
      pushing: ["horizontal_push", "vertical_push"],
      "push exercises": ["horizontal_push", "vertical_push"],
      pulling: ["horizontal_pull", "vertical_pull"],
      "pull exercises": ["horizontal_pull", "vertical_pull"],
      carries: ["carry"],
      "core work": ["core"],
      "core exercises": ["core"],
    };

    if (movementPatterns[normalized]) {
      const matched = exercises.filter(
        (ex) =>
          ex.movementPattern &&
          movementPatterns[normalized]?.includes(ex.movementPattern),
      );
      return {
        matchedExerciseNames: matched.map((ex) => ex.name),
        matchedExercises: matched.map((ex) => ({ id: ex.id, name: ex.name })),
        matchMethod: "pattern",
        reasoning: `Matched ${normalized}`,
      };
    }

    // No pattern matched
    return {
      matchedExerciseNames: [],
      matchedExercises: [],
      matchMethod: "pattern",
    };
  }

  /**
   * Helper to get exercise type from phrase variations
   */
  private getExerciseTypeFromPhrase(phrase: string): string | null {
    const normalized = phrase.toLowerCase().trim();

    // Handle variations
    if (normalized.includes("squat")) return "squat";
    if (normalized.includes("deadlift")) return "deadlift";
    if (normalized.includes("bench")) return "bench_press";
    if (normalized.includes("press")) return "press";

    return null;
  }
}
