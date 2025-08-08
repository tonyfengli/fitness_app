import { db } from "@acme/db/client";
import { WorkoutPreferences, UserTrainingSession, conversationState } from "@acme/db/schema";
import { eq, and } from "@acme/db";
import type { StateMachineFlow, StateMachineState } from "@acme/ai";
import { createLogger } from "../../../../utils/logger";
import { saveMessage } from "../../../messageService";
import { getUserByPhone } from "../../../checkInService";
import { parseWorkoutPreferences } from "@acme/ai";
import type { SMSResponse } from "../../types";

const logger = createLogger("StateMachineHandler");

interface StateMachineContext {
  currentState: string;
  collectedData: Record<string, any>;
  stateHistory: string[];
  startedAt: Date;
}

export class StateMachineHandler {
  /**
   * Handle incoming message for state machine flow
   */
  static async handle(
    phoneNumber: string,
    messageContent: string,
    messageSid: string,
    sessionId: string,
    stateMachine: StateMachineFlow
  ): Promise<SMSResponse> {
    try {
      // Get current context
      const context = await this.getContext(phoneNumber, sessionId);
      
      if (!context) {
        // Start new flow
        return await this.startFlow(phoneNumber, messageSid, sessionId, stateMachine);
      }

      // Get current state
      const currentState = stateMachine.states[context.currentState];
      if (!currentState) {
        logger.error("Invalid state", { currentState: context.currentState });
        return {
          success: false,
          message: "Sorry, something went wrong. Please try again.",
        };
      }

      // Check if we're in a final state
      if (stateMachine.finalStates.includes(context.currentState)) {
        return await this.completeFlow(phoneNumber, messageSid, sessionId, stateMachine, context);
      }

      // Process the message based on handler type
      const processResult = await this.processMessage(
        messageContent,
        currentState,
        context
      );

      // Update context with new data
      if (processResult.data) {
        Object.assign(context.collectedData, processResult.data);
      }

      // Determine next state
      const nextStateId = this.determineNextState(
        currentState,
        processResult.condition || 'default'
      );

      if (!nextStateId) {
        // No valid transition
        return {
          success: true,
          message: "I didn't understand that. " + currentState.prompt,
          metadata: { flowType: 'stateMachine', stateId: currentState.id }
        };
      }

      // Transition to next state
      context.currentState = nextStateId;
      context.stateHistory.push(nextStateId);
      await this.saveContext(phoneNumber, sessionId, context);

      // Get next state
      const nextState = stateMachine.states[nextStateId];
      
      // Check if next state is final
      if (stateMachine.finalStates.includes(nextStateId)) {
        return await this.completeFlow(phoneNumber, messageSid, sessionId, stateMachine, context);
      }

      if (!nextState) {
        throw new Error(`State ${nextStateId} not found in state machine`);
      }

      // Return next prompt
      return {
        success: true,
        message: this.formatPrompt(nextState, context),
        metadata: { 
          flowType: 'stateMachine', 
          stateId: nextStateId,
          previousState: currentState.id
        }
      };

    } catch (error) {
      logger.error("State machine handler error", error);
      return {
        success: false,
        message: "Sorry, something went wrong. Please try again.",
      };
    }
  }

  /**
   * Start a new state machine flow
   */
  private static async startFlow(
    phoneNumber: string,
    messageSid: string,
    sessionId: string,
    stateMachine: StateMachineFlow
  ): Promise<SMSResponse> {
    const initialState = stateMachine.states[stateMachine.initialState];
    if (!initialState) {
      return {
        success: false,
        message: "Configuration error. Please contact support.",
      };
    }

    // Initialize context
    const context: StateMachineContext = {
      currentState: stateMachine.initialState,
      collectedData: {},
      stateHistory: [stateMachine.initialState],
      startedAt: new Date()
    };

    await this.saveContext(phoneNumber, sessionId, context);

    return {
      success: true,
      message: this.formatPrompt(initialState, context),
      metadata: { 
        flowType: 'stateMachine', 
        stateId: stateMachine.initialState,
        isInitial: true
      }
    };
  }

  /**
   * Process message based on handler type
   */
  private static async processMessage(
    message: string,
    state: StateMachineState,
    context: StateMachineContext
  ): Promise<{ condition: string; data?: Record<string, any> }> {
    switch (state.handler) {
      case 'preference':
        // Use AI to parse preferences
        const parsed = await parseWorkoutPreferences(message);
        return {
          condition: this.determinePreferenceCondition(parsed),
          data: parsed
        };

      case 'disambiguation':
        // Handle number selection
        const numbers = message.match(/\d+/g);
        if (numbers && numbers.length > 0) {
          return {
            condition: 'selected',
            data: { selections: numbers.map(n => parseInt(n)) }
          };
        }
        return { condition: 'invalid' };

      case 'custom':
        // Custom logic based on state metadata
        return this.handleCustomState(message, state, context);

      default:
        // Simple text processing
        const lower = message.toLowerCase().trim();
        
        // Check for common conditions
        if (lower.includes('yes') || lower.includes('y')) {
          return { condition: 'yes', data: { response: message } };
        }
        if (lower.includes('no') || lower.includes('n')) {
          return { condition: 'no', data: { response: message } };
        }
        if (lower.includes('skip')) {
          return { condition: 'skip' };
        }
        if (lower.includes('help') || lower.includes('?')) {
          return { condition: 'help' };
        }
        
        // Default condition with raw response
        return { condition: 'default', data: { response: message } };
    }
  }

  /**
   * Determine condition based on parsed preferences
   */
  private static determinePreferenceCondition(parsed: any): string {
    if (parsed.intensity && !parsed.muscleTargets?.length) {
      return 'has_intensity';
    }
    if (parsed.muscleTargets?.length && !parsed.intensity) {
      return 'has_targets';
    }
    if (parsed.avoidExercises?.length || parsed.avoidJoints?.length) {
      return 'has_restrictions';
    }
    return 'default';
  }

  /**
   * Handle custom state logic
   */
  private static handleCustomState(
    message: string,
    state: StateMachineState,
    context: StateMachineContext
  ): { condition: string; data?: Record<string, any> } {
    // Example: injury assessment
    if (state.metadata?.type === 'injury_assessment') {
      const lower = message.toLowerCase();
      if (lower.includes('pain') || lower.includes('hurt')) {
        const intensity = this.extractPainLevel(message);
        return {
          condition: intensity > 5 ? 'high_pain' : 'low_pain',
          data: { painLevel: intensity, description: message }
        };
      }
    }

    // Example: movement selection
    if (state.metadata?.type === 'movement_selection') {
      const movements = ['squat', 'hinge', 'push', 'pull', 'lunge'];
      const found = movements.filter(m => message.toLowerCase().includes(m));
      if (found.length > 0) {
        return {
          condition: 'movements_selected',
          data: { selectedMovements: found }
        };
      }
    }

    return { condition: 'default', data: { response: message } };
  }

  /**
   * Extract pain level from message (1-10)
   */
  private static extractPainLevel(message: string): number {
    const match = message.match(/\b([1-9]|10)\b/);
    return match ? parseInt(match[1]!) : 5; // Default to 5 if not specified
  }

  /**
   * Determine next state based on conditions
   */
  private static determineNextState(
    currentState: StateMachineState,
    condition: string
  ): string | null {
    // Check specific condition first
    if (currentState.nextStates[condition]) {
      return currentState.nextStates[condition];
    }
    
    // Fall back to default
    if (currentState.nextStates['default']) {
      return currentState.nextStates['default'];
    }
    
    return null;
  }

  /**
   * Format prompt with context data
   */
  private static formatPrompt(
    state: StateMachineState,
    context: StateMachineContext
  ): string {
    let prompt = state.prompt;
    
    // Replace placeholders with context data
    Object.entries(context.collectedData).forEach(([key, value]) => {
      prompt = prompt.replace(`{${key}}`, String(value));
    });
    
    return prompt;
  }

  /**
   * Complete the state machine flow
   */
  private static async completeFlow(
    phoneNumber: string,
    messageSid: string,
    sessionId: string,
    stateMachine: StateMachineFlow,
    context: StateMachineContext
  ): Promise<SMSResponse> {
    try {
      // Get final state for confirmation message
      const finalState = stateMachine.states[context.currentState];
      
      // Map collected data to preferences
      const preferences = this.mapToPreferences(context.collectedData);
      
      // Save preferences
      const userInfo = await getUserByPhone(phoneNumber);
      if (userInfo) {
        await db.transaction(async (tx) => {
          // Save preferences
          await tx.insert(WorkoutPreferences)
            .values({
              userId: userInfo.userId,
              trainingSessionId: sessionId,
              businessId: userInfo.businessId,
              ...preferences,
              collectionMethod: 'sms'
            })
            .onConflictDoUpdate({
              target: [WorkoutPreferences.userId, WorkoutPreferences.trainingSessionId],
              set: {
                ...preferences,
                collectedAt: new Date()
              }
            });

          // Update user training session status
          await tx.update(UserTrainingSession)
            .set({ 
              preferenceCollectionStep: 'preferences_active'
            })
            .where(
              and(
                eq(UserTrainingSession.userId, userInfo.userId),
                eq(UserTrainingSession.trainingSessionId, sessionId)
              )
            );
        });
      }

      // Clear context
      await this.clearContext(phoneNumber, sessionId);

      return {
        success: true,
        message: finalState?.prompt || "Perfect! Your workout preferences have been saved.",
        metadata: { 
          flowType: 'stateMachine', 
          complete: true,
          finalState: context.currentState,
          stateHistory: context.stateHistory
        }
      };
    } catch (error) {
      logger.error("Error completing flow", error);
      return {
        success: false,
        message: "Sorry, couldn't save your preferences. Please try again.",
      };
    }
  }

  /**
   * Map collected data to workout preferences
   */
  private static mapToPreferences(collectedData: Record<string, any>): Record<string, any> {
    // Similar to linear flow, but can handle more complex mappings
    const preferences: any = {};

    // Direct mappings
    if (collectedData.intensity) preferences.intensity = collectedData.intensity;
    if (collectedData.sessionGoal) preferences.sessionGoal = collectedData.sessionGoal;
    if (collectedData.muscleTargets) preferences.muscleTargets = collectedData.muscleTargets;
    if (collectedData.avoidExercises) preferences.avoidExercises = collectedData.avoidExercises;
    if (collectedData.avoidJoints) preferences.avoidJoints = collectedData.avoidJoints;

    // Handle complex state machine data
    if (collectedData.selectedMovements) {
      preferences.muscleTargets = collectedData.selectedMovements;
    }
    if (collectedData.painLevel && collectedData.painLevel > 5) {
      preferences.intensity = 'low';
    }

    return preferences;
  }

  /**
   * Context management using conversation state
   */
  private static async getContext(
    phoneNumber: string,
    sessionId: string
  ): Promise<StateMachineContext | null> {
    const userInfo = await getUserByPhone(phoneNumber);
    if (!userInfo) return null;

    const [state] = await db
      .select()
      .from(conversationState)
      .where(
        and(
          eq(conversationState.userId, userInfo.userId),
          eq(conversationState.trainingSessionId, sessionId),
          eq(conversationState.conversationType, 'state_machine_flow')
        )
      )
      .limit(1);

    if (!state) return null;

    return state.state as StateMachineContext;
  }

  private static async saveContext(
    phoneNumber: string,
    sessionId: string,
    context: StateMachineContext
  ): Promise<void> {
    const userInfo = await getUserByPhone(phoneNumber);
    if (!userInfo) return;

    await db.insert(conversationState)
      .values({
        userId: userInfo.userId,
        trainingSessionId: sessionId,
        businessId: userInfo.businessId,
        conversationType: 'state_machine_flow',
        currentStep: context.currentState,
        state: context as any
      })
      .onConflictDoUpdate({
        target: [conversationState.userId, conversationState.trainingSessionId, conversationState.conversationType],
        set: {
          currentStep: context.currentState,
          state: context as any,
          updatedAt: new Date()
        }
      });
  }

  private static async clearContext(
    phoneNumber: string,
    sessionId: string
  ): Promise<void> {
    const userInfo = await getUserByPhone(phoneNumber);
    if (!userInfo) return;

    await db.delete(conversationState)
      .where(
        and(
          eq(conversationState.userId, userInfo.userId),
          eq(conversationState.trainingSessionId, sessionId),
          eq(conversationState.conversationType, 'state_machine_flow')
        )
      );
  }
}