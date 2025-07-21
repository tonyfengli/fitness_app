import { db } from "@acme/db/client";
import { conversationState } from "@acme/db/schema";
import { eq, and, desc, sql } from "@acme/db";
import { createLogger } from "../utils/logger";

const logger = createLogger("ConversationStateService");

export interface ExerciseOption {
  id: string;
  name: string;
}

export class ConversationStateService {
  /**
   * Create a new conversation state for exercise disambiguation
   */
  static async createExerciseDisambiguation(
    userId: string,
    trainingSessionId: string,
    businessId: string,
    userInput: string,
    options: ExerciseOption[]
  ): Promise<string> {
    try {
      logger.info("Creating exercise disambiguation state", {
        userId,
        trainingSessionId,
        userInput,
        optionCount: options.length
      });

      const result = await db
        .insert(conversationState)
        .values({
          userId,
          trainingSessionId,
          businessId,
          conversationType: "include_exercise",
          currentStep: "awaiting_selection",
          state: {
            userInput,
            options,
            metadata: {
              createdAt: new Date().toISOString()
            }
          }
        })
        .returning();

      return result[0]?.id || '';
    } catch (error) {
      logger.error("Error creating conversation state", error);
      throw error;
    }
  }

  /**
   * Check if user has a pending disambiguation
   */
  static async getPendingDisambiguation(
    userId: string,
    trainingSessionId: string
  ): Promise<{
    id: string;
    userInput: string;
    options: ExerciseOption[];
    state: any;
  } | null> {
    try {
      const [pending] = await db
        .select()
        .from(conversationState)
        .where(
          and(
            eq(conversationState.userId, userId),
            eq(conversationState.trainingSessionId, trainingSessionId),
            eq(conversationState.conversationType, "include_exercise"),
            eq(conversationState.currentStep, "awaiting_selection")
          )
        )
        .orderBy(desc(conversationState.createdAt))
        .limit(1);

      if (!pending) {
        return null;
      }

      const state = pending.state as any;
      return {
        id: pending.id,
        userInput: state.userInput,
        options: state.options || [],
        state: pending.state
      };
    } catch (error) {
      logger.error("Error getting pending disambiguation", error);
      return null;
    }
  }

  /**
   * Process user's selection from disambiguation options
   */
  static async processSelection(
    conversationId: string,
    selectedIndices: number[]
  ): Promise<ExerciseOption[]> {
    try {
      const [conversation] = await db
        .select()
        .from(conversationState)
        .where(eq(conversationState.id, conversationId))
        .limit(1);

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      const state = conversation.state as any;
      const options = state.options || [];
      
      // Get selected exercises based on indices (1-based from user input)
      const selectedExercises = selectedIndices
        .map(idx => options[idx - 1])
        .filter(Boolean);

      // Update conversation state to completed
      await db
        .update(conversationState)
        .set({
          currentStep: "completed",
          state: {
            ...state,
            selections: selectedExercises.map((ex: ExerciseOption) => ex.name),
            completedAt: new Date().toISOString()
          },
          updatedAt: new Date()
        })
        .where(eq(conversationState.id, conversationId));

      logger.info("Processed selection", {
        conversationId,
        selectedCount: selectedExercises.length
      });

      return selectedExercises;
    } catch (error) {
      logger.error("Error processing selection", error);
      throw error;
    }
  }

  /**
   * Update the clarification attempts count for a disambiguation
   */
  static async updateDisambiguationAttempts(
    stateId: string,
    attempts: number
  ): Promise<void> {
    try {
      await db
        .update(conversationState)
        .set({
          state: sql`
            jsonb_set(
              jsonb_set(
                ${conversationState.state},
                '{metadata}',
                COALESCE(${conversationState.state}->'metadata', '{}')::jsonb,
                true
              ),
              '{metadata,clarificationAttempts}',
              ${attempts}::jsonb
            )
          `,
          updatedAt: new Date()
        })
        .where(eq(conversationState.id, stateId));
        
      logger.info("Updated clarification attempts", { stateId, attempts });
    } catch (error) {
      logger.error("Error updating clarification attempts", error);
      throw error;
    }
  }

  /**
   * Clean up old conversation states (for maintenance)
   */
  static async cleanupOldStates(daysOld: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await db
        .delete(conversationState)
        .where(
          and(
            eq(conversationState.currentStep, "completed"),
            // Note: We'd need to add a less than operator for timestamp comparison
            // This is pseudo-code for the concept
          )
        );

      logger.info("Cleaned up old conversation states");
      return 0; // Return count when implemented
    } catch (error) {
      logger.error("Error cleaning up old states", error);
      return 0;
    }
  }
}