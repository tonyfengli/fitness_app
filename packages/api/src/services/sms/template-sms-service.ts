import { db } from "@acme/db/client";
import { TrainingSession } from "@acme/db/schema";
import { eq } from "@acme/db";
import { getWorkoutTemplate, type SMSConfig } from "@acme/ai";
import { createLogger } from "../../utils/logger";

const logger = createLogger("TemplateSMSService");

export interface TemplateSMSContext {
  templateType: string | null;
  templateConfig: any;
  userName?: string;
  sessionName?: string;
}

export class TemplateSMSService {
  /**
   * Get SMS configuration for a session
   */
  static async getSMSConfigForSession(sessionId: string): Promise<SMSConfig | null> {
    try {
      const [session] = await db
        .select({
          templateType: TrainingSession.templateType,
          templateConfig: TrainingSession.templateConfig
        })
        .from(TrainingSession)
        .where(eq(TrainingSession.id, sessionId))
        .limit(1);

      if (!session) {
        logger.warn("Session not found", { sessionId });
        return null;
      }

      // Get template based on type
      const templateType = session.templateType || 'full_body_bmf';
      const template = getWorkoutTemplate(templateType);

      logger.info("Getting SMS config for session", {
        sessionId,
        templateType: session.templateType,
        defaultedTo: templateType,
        templateFound: !!template,
        hasSmsConfig: !!template?.smsConfig,
        templateName: template?.name
      });

      if (!template?.smsConfig) {
        logger.info("No SMS config for template", { templateType });
        return null;
      }

      return template.smsConfig;
    } catch (error) {
      logger.error("Error getting SMS config", { sessionId, error });
      return null;
    }
  }

  /**
   * Get check-in response based on template
   */
  static getCheckInResponse(smsConfig: SMSConfig | null, userName?: string): string {
    if (!smsConfig) {
      // Default fallback
      return `Hello ${userName || 'there'}! You're checked in for the session. Welcome!`;
    }

    // Replace placeholders if needed
    let response = smsConfig.checkInResponse;
    if (userName) {
      response = response.replace('{name}', userName);
    }

    return response;
  }

  /**
   * Get preference prompt based on template
   */
  static getPreferencePrompt(smsConfig: SMSConfig | null, userName?: string): string {
    if (!smsConfig) {
      // Default fallback
      const name = userName || "there";
      return `You're checked in, ${name}! What's your priority for today's session? Examples: "abs" or "stability work."`;
    }

    let prompt = smsConfig.preferencePrompt;
    if (userName) {
      prompt = prompt.replace('{name}', userName);
    }

    return prompt;
  }

  /**
   * Get follow-up prompts based on template and missing fields
   */
  static getFollowUpPrompts(
    smsConfig: SMSConfig | null, 
    fieldsToAsk: string[]
  ): Record<string, string> {
    if (!smsConfig) {
      // Default fallback prompts
      return {
        sessionGoal: "What's your training focus today - strength, endurance, or stability?",
        muscleTargets: "Any specific muscle groups or areas you want to work on?",
        intensity: "How are you feeling today - ready for high intensity, moderate, or taking it easy?",
        avoidance: "Any areas we should be careful with or exercises to avoid?"
      };
    }

    const prompts: Record<string, string> = {};
    
    for (const field of fieldsToAsk) {
      if (field === 'avoidJoints' || field === 'avoidExercises') {
        // Map both to the combined 'avoidance' prompt
        prompts[field] = smsConfig.followUpPrompts.avoidance || "Any areas we should avoid?";
      } else {
        const promptKey = field as keyof typeof smsConfig.followUpPrompts;
        prompts[field] = smsConfig.followUpPrompts[promptKey] || `Tell me about ${field}`;
      }
    }

    return prompts;
  }

  /**
   * Get confirmation message based on template
   */
  static getConfirmationMessage(smsConfig: SMSConfig | null): string {
    if (!smsConfig) {
      // Default fallback
      return "Perfect! I've got all your preferences. Your workout will be tailored to how you're feeling today. See you in the gym!";
    }

    return smsConfig.confirmationMessage;
  }

  /**
   * Get priority fields for a template
   */
  static getPriorityFields(smsConfig: SMSConfig | null): string[] {
    if (!smsConfig) {
      // Default priority
      return ['sessionGoal', 'muscleTargets', 'intensity'];
    }

    return smsConfig.priorityFields;
  }

  /**
   * Determine which fields to ask about based on template priority
   */
  static determineFieldsToAsk(
    smsConfig: SMSConfig | null,
    existingPreferences: any,
    maxFields: number = 2
  ): string[] {
    const priorityFields = this.getPriorityFields(smsConfig);
    const fieldsToAsk: string[] = [];

    // Check priority fields first
    for (const field of priorityFields) {
      if (fieldsToAsk.length >= maxFields) break;

      const hasValue = this.checkFieldHasValue(existingPreferences, field);
      if (!hasValue) {
        fieldsToAsk.push(field);
      }
    }

    // If we still need more fields, check non-priority fields
    const allFields = ['sessionGoal', 'muscleTargets', 'intensity', 'avoidJoints', 'avoidExercises'];
    for (const field of allFields) {
      if (fieldsToAsk.length >= maxFields) break;
      if (priorityFields.includes(field)) continue; // Already checked

      const hasValue = this.checkFieldHasValue(existingPreferences, field);
      if (!hasValue) {
        fieldsToAsk.push(field);
      }
    }

    return fieldsToAsk;
  }

  /**
   * Check if a field has a value in preferences
   */
  private static checkFieldHasValue(preferences: any, field: string): boolean {
    switch (field) {
      case 'sessionGoal':
        return !!preferences.sessionGoal;
      case 'muscleTargets':
        return !!(preferences.muscleTargets?.length);
      case 'intensity':
        return !!preferences.intensity;
      case 'avoidJoints':
        return !!(preferences.avoidJoints?.length);
      case 'avoidExercises':
        return !!(preferences.avoidExercises?.length);
      default:
        return false;
    }
  }

  /**
   * Generate a natural follow-up question based on template
   */
  static generateTemplateFollowUp(
    smsConfig: SMSConfig | null,
    fieldsToAsk: string[],
    existingPreferences: any
  ): string {
    if (fieldsToAsk.length === 0) {
      return this.getConfirmationMessage(smsConfig);
    }

    const prompts = this.getFollowUpPrompts(smsConfig, fieldsToAsk);
    
    // If we have template-specific prompts, use those
    if (smsConfig && fieldsToAsk.length === 1) {
      return prompts[fieldsToAsk[0]!] || "Tell me more about your preferences.";
    }

    // For multiple fields, combine them naturally
    if (fieldsToAsk.length === 2) {
      const prompt1 = prompts[fieldsToAsk[0]!];
      const prompt2 = prompts[fieldsToAsk[1]!];
      
      // Combine the two prompts
      return `${prompt1} Also, ${prompt2?.toLowerCase() || 'tell me more'}`;
    }

    // Fallback for more than 2 fields
    return "Tell me more about your workout preferences for today.";
  }
}