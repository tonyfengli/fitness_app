import OpenAI from "openai";

import type { SMSConfig } from "@acme/ai";

import type { PreferenceCollectionStep } from "../utils/preferenceStateManager";
import { createLogger } from "../utils/logger";
import { PreferenceStateManager } from "../utils/preferenceStateManager";
import { TemplateSMSService } from "./sms/template-sms-service";

const logger = createLogger("TargetedFollowupService");

// Lazy initialization to avoid errors in tests
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "test-key",
    });
  }
  return openai;
}

interface ParsedPreferences {
  intensity?: "low" | "moderate" | "high";
  muscleTargets?: string[];
  muscleLessens?: string[];
  includeExercises?: string[];
  avoidExercises?: string[];
  avoidJoints?: string[];
  sessionGoal?: "strength" | "stability" | null;
}

interface FollowupGenerationResult {
  followupQuestion: string;
  fieldsAsked: string[];
  promptUsed: string;
}

export class TargetedFollowupService {
  /**
   * Determines which fields to ask about based on priority and what's missing
   */
  private static determineFieldsToAsk(
    preferences: ParsedPreferences,
  ): string[] {
    const fieldsToAsk: string[] = [];

    // Priority 1: Always ask for sessionGoal if missing
    if (!preferences.sessionGoal) {
      fieldsToAsk.push("sessionGoal");
    }

    // If we already have 1 field, pick 1 more. If we have 0, pick 2.
    const additionalFieldsNeeded = fieldsToAsk.length === 0 ? 2 : 1;

    // Priority order for additional fields (excluding intensity which has default)
    const priorityFields = [
      {
        field: "muscleTargets",
        check: () => !preferences.muscleTargets?.length,
      },
      { field: "avoidJoints", check: () => !preferences.avoidJoints?.length },
      {
        field: "muscleLessens",
        check: () => !preferences.muscleLessens?.length,
      },
      {
        field: "includeExercises",
        check: () => !preferences.includeExercises?.length,
      },
      {
        field: "avoidExercises",
        check: () => !preferences.avoidExercises?.length,
      },
    ];

    // Add fields based on priority until we have enough
    for (const { field, check } of priorityFields) {
      if (
        fieldsToAsk.length <
        (fieldsToAsk.includes("sessionGoal") ? 2 : additionalFieldsNeeded)
      ) {
        if (check()) {
          fieldsToAsk.push(field);
        }
      }
    }

    return fieldsToAsk;
  }

  /**
   * Creates a prompt for the LLM to generate a coach-like follow-up question
   */
  private static createFollowupPrompt(
    fieldsToAsk: string[],
    existingPreferences: ParsedPreferences,
  ): string {
    const fieldDescriptions = {
      sessionGoal: "training focus (strength, endurance, or stability)",
      muscleTargets: "specific muscle groups or areas they want to work on",
      avoidJoints: "any joints they need to protect or be careful with",
      muscleLessens: "muscle groups they want to work less or avoid",
      includeExercises: "specific exercises they want to include",
      avoidExercises: "exercises they want to skip or avoid",
    };

    const fieldsText = fieldsToAsk
      .map(
        (field) => fieldDescriptions[field as keyof typeof fieldDescriptions],
      )
      .join(" and ");

    // Build context about what we already know
    const knownInfo: string[] = [];
    if (existingPreferences.intensity) {
      knownInfo.push(
        `planning a ${existingPreferences.intensity} intensity workout`,
      );
    }
    if (existingPreferences.includeExercises?.length) {
      knownInfo.push(
        `including ${existingPreferences.includeExercises.join(", ")}`,
      );
    }
    if (existingPreferences.avoidExercises?.length) {
      knownInfo.push(
        `avoiding ${existingPreferences.avoidExercises.join(", ")}`,
      );
    }

    const contextText =
      knownInfo.length > 0
        ? `\n\nContext: We're ${knownInfo.join(" and ")}.`
        : "";

    return `You are a friendly personal trainer having a conversation with a client who just checked in for their workout session.
${contextText}

Generate a natural, conversational follow-up question that asks about their ${fieldsText}.

Guidelines:
- Be warm and conversational, like a real trainer would speak
- Ask about the fields naturally in ONE question (don't list them separately)
- Keep it brief - one or two sentences max
- Don't use formal language or sound robotic
- Don't mention the field names directly, ask naturally
- Focus on helping them have a great workout

Examples of good questions:
- "Got it! What's your training focus today - strength, endurance, or stability? Also, any specific areas you want to work on?"
- "Perfect! Looking to build strength, work on stability, or improve endurance today? And anything we should be careful with?"
- "Sounds good! What are you hoping to accomplish today, and are there any areas we should focus on or avoid?"

Generate only the question, nothing else.`;
  }

  /**
   * Generates a targeted follow-up question based on missing preference fields
   * This is kept for backward compatibility but delegates to template service when possible
   */
  static async generateFollowup(
    currentState: PreferenceCollectionStep,
    preferences: ParsedPreferences,
    smsConfig?: SMSConfig | null,
  ): Promise<FollowupGenerationResult> {
    try {
      // If we have a template config, use it
      if (smsConfig) {
        const fieldsToAsk = TemplateSMSService.determineFieldsToAsk(
          smsConfig,
          preferences,
          2,
        );

        if (fieldsToAsk.length === 0) {
          return {
            followupQuestion:
              TemplateSMSService.getConfirmationMessage(smsConfig),
            fieldsAsked: [],
            promptUsed: "Template-based confirmation",
          };
        }

        const followupQuestion = TemplateSMSService.generateTemplateFollowUp(
          smsConfig,
          fieldsToAsk,
          preferences,
        );

        return {
          followupQuestion,
          fieldsAsked: fieldsToAsk,
          promptUsed: "Template-based follow-up",
        };
      }

      // Otherwise, use the original LLM-based approach
      const fieldsToAsk = this.determineFieldsToAsk(preferences);

      if (fieldsToAsk.length === 0) {
        return {
          followupQuestion:
            "Perfect! I've got all your preferences. Your workout will be tailored to how you're feeling today. See you in the gym!",
          fieldsAsked: [],
          promptUsed: "No fields needed - returning confirmation",
        };
      }

      const prompt = this.createFollowupPrompt(fieldsToAsk, preferences);

      const completion = await getOpenAIClient().chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      });

      const followupQuestion =
        completion.choices[0]?.message?.content?.trim() ||
        "What's your training focus today, and any specific areas you'd like to work on?";

      logger.info("Generated follow-up question", {
        fieldsAsked: fieldsToAsk,
        questionLength: followupQuestion.length,
        usedTemplate: false,
      });

      return {
        followupQuestion,
        fieldsAsked: fieldsToAsk,
        promptUsed: prompt,
      };
    } catch (error) {
      logger.error("Error generating follow-up question", error);

      return {
        followupQuestion:
          "What's your training focus today - strength, endurance, or stability? Also, any specific areas you want to work on?",
        fieldsAsked: ["sessionGoal", "muscleTargets"],
        promptUsed: "Error - using fallback",
      };
    }
  }

  /**
   * Generates the final response after follow-up is answered
   */
  static generateFinalResponse(): string {
    return "Great, thank you for that. If you have anything else to add, let me know.";
  }

  /**
   * Generates response for preference updates in active mode
   */
  static generateUpdateResponse(updatedFields: string[]): string {
    if (updatedFields.length === 0) {
      return "Got it. Let me know if you need any other changes.";
    }

    const fieldNames = {
      intensity: "intensity",
      sessionGoal: "training focus",
      muscleTargets: "target areas",
      muscleLessens: "areas to avoid",
      includeExercises: "exercise selections",
      avoidExercises: "exercises to skip",
      avoidJoints: "joint protection",
    };

    // Special responses for common updates
    if (updatedFields.length === 1) {
      switch (updatedFields[0]) {
        case "intensity":
          return "Got it, I've adjusted the intensity. Let me know if you need anything else changed.";
        case "sessionGoal":
          return "Perfect, I've updated your training focus. Anything else you'd like to adjust?";
        case "avoidExercises":
          return "No problem, I'll make sure to skip those. Let me know if there's anything else.";
        case "includeExercises":
          return "Great, I'll add those to your workout. Anything else you'd like to change?";
        case "avoidJoints":
          return "Noted - I'll be careful with those areas. Let me know if you need other adjustments.";
      }
    }

    // Multiple field updates
    const updates = updatedFields
      .map((field) => fieldNames[field as keyof typeof fieldNames] || field)
      .join(" and ");

    return `Updated your ${updates}. Let me know if you need any other changes.`;
  }
}
