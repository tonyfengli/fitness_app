import { db } from "@acme/db/client";
import { TrainingSession } from "@acme/db/schema";
import { eq } from "@acme/db";
import { getWorkoutTemplate } from "@acme/ai";
import { createLogger } from "../../utils/logger";
import { LinearFlowHandler } from "./flows/linear/linear-flow-handler";
import { StateMachineHandler } from "./flows/state-machine/state-machine-handler";
import { PreferenceHandler } from "./handlers/preference-handler";
import { WorkoutPreferenceService } from "../workoutPreferenceService";
import type { SMSResponse } from "./types";

const logger = createLogger("FlowRouter");

export class FlowRouter {
  /**
   * Route message to appropriate flow handler based on template configuration
   */
  static async route(
    phoneNumber: string,
    messageContent: string,
    messageSid: string,
    sessionId: string,
    preferenceCheck?: any
  ): Promise<SMSResponse> {
    try {
      // Get session template configuration
      const [session] = await db
        .select({
          templateType: TrainingSession.templateType,
          templateConfig: TrainingSession.templateConfig
        })
        .from(TrainingSession)
        .where(eq(TrainingSession.id, sessionId))
        .limit(1);

      if (!session?.templateType) {
        logger.warn("No template type for session, using legacy flow", { sessionId });
        return this.useLegacyFlow(phoneNumber, messageContent, messageSid, preferenceCheck);
      }

      // Get template definition
      const template = getWorkoutTemplate(session.templateType);
      if (!template) {
        logger.warn("Template not found, using legacy flow", { 
          sessionId, 
          templateType: session.templateType 
        });
        return this.useLegacyFlow(phoneNumber, messageContent, messageSid, preferenceCheck);
      }

      // Route based on flow type
      const flowType = template.smsFlowType || 'legacy';
      
      logger.info("Routing to flow handler", {
        sessionId,
        templateType: session.templateType,
        flowType
      });

      switch (flowType) {
        case 'linear':
          if (!template.smsLinearFlow) {
            logger.error("Linear flow configuration missing", { templateType: session.templateType });
            return this.useLegacyFlow(phoneNumber, messageContent, messageSid, preferenceCheck);
          }
          return await LinearFlowHandler.handle(
            phoneNumber,
            messageContent,
            messageSid,
            sessionId,
            template.smsLinearFlow
          );

        case 'stateMachine':
          if (!template.smsStateMachine) {
            logger.error("State machine configuration missing", { templateType: session.templateType });
            return this.useLegacyFlow(phoneNumber, messageContent, messageSid, preferenceCheck);
          }
          return await StateMachineHandler.handle(
            phoneNumber,
            messageContent,
            messageSid,
            sessionId,
            template.smsStateMachine
          );

        case 'legacy':
        default:
          return this.useLegacyFlow(phoneNumber, messageContent, messageSid, preferenceCheck);
      }
    } catch (error) {
      logger.error("Flow routing error", error);
      return this.useLegacyFlow(phoneNumber, messageContent, messageSid, preferenceCheck);
    }
  }

  /**
   * Use the existing 7-step legacy flow
   */
  private static async useLegacyFlow(
    phoneNumber: string,
    messageContent: string,
    messageSid: string,
    preferenceCheck?: any
  ): Promise<SMSResponse> {
    // If no preference check provided, get it
    if (!preferenceCheck) {
      preferenceCheck = await WorkoutPreferenceService.isAwaitingPreferences(phoneNumber);
    }

    // Use existing preference handler
    const handler = new PreferenceHandler();
    return await handler.handle(
      phoneNumber,
      messageContent,
      messageSid,
      preferenceCheck
    );
  }

  /**
   * Check if a session is using a new flow type
   */
  static async isUsingNewFlow(sessionId: string): Promise<boolean> {
    try {
      const [session] = await db
        .select({ templateType: TrainingSession.templateType })
        .from(TrainingSession)
        .where(eq(TrainingSession.id, sessionId))
        .limit(1);

      if (!session?.templateType) return false;

      const template = getWorkoutTemplate(session.templateType);
      if (!template) return false;

      return template.smsFlowType !== 'legacy' && template.smsFlowType !== undefined;
    } catch (error) {
      logger.error("Error checking flow type", error);
      return false;
    }
  }
}