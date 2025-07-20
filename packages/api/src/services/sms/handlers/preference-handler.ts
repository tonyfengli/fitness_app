import { parseWorkoutPreferences } from "@acme/ai";
import { saveMessage } from "../../messageService";
import { getUserByPhone } from "../../checkInService";
import { WorkoutPreferenceService } from "../../workoutPreferenceService";
import { ExerciseValidationService } from "../../exerciseValidationService";
import { ConversationStateService } from "../../conversationStateService";
import { createLogger } from "../../../utils/logger";
import { sessionTestDataLogger } from "../../../utils/sessionTestDataLogger";
import { SMSResponse } from "../types";

const logger = createLogger("PreferenceHandler");

export class PreferenceHandler {
  async handle(
    phoneNumber: string,
    messageContent: string,
    messageSid: string,
    preferenceCheck: any
  ): Promise<SMSResponse> {
    try {
      logger.info("Handling preference response", { 
        phoneNumber,
        userId: preferenceCheck.userId,
        trainingSessionId: preferenceCheck.trainingSessionId,
        currentStep: preferenceCheck.currentStep
      });

      // Initialize session test data logging
      if (sessionTestDataLogger.isEnabled()) {
        sessionTestDataLogger.initSession(preferenceCheck.trainingSessionId!, phoneNumber);
        
        // Log inbound message
        sessionTestDataLogger.logMessage(preferenceCheck.trainingSessionId!, {
          direction: 'inbound',
          content: messageContent,
          metadata: {
            messageSid,
            currentStep: preferenceCheck.currentStep
          }
        });
      }

      // Parse preferences with LLM
      const startTime = Date.now();
      const parsedPreferences = await parseWorkoutPreferences(messageContent);
      const parseTime = Date.now() - startTime;
      
      logger.info("Parsed preferences", { 
        userId: preferenceCheck.userId,
        preferences: parsedPreferences,
        parseTime
      });

      // Log LLM call for preference parsing
      if (sessionTestDataLogger.isEnabled()) {
        sessionTestDataLogger.logLLMCall(preferenceCheck.trainingSessionId!, {
          type: 'preference_parsing',
          model: 'gpt-4o-mini',
          systemPrompt: parsedPreferences.systemPromptUsed || 'Not available',
          userInput: messageContent,
          rawResponse: parsedPreferences.rawLLMResponse,
          parsedResponse: parsedPreferences,
          parseTimeMs: parseTime,
          error: parsedPreferences.debugInfo?.error ? JSON.stringify(parsedPreferences.debugInfo.error) : undefined
        });
      }

      // Save simple preferences immediately (fire-and-forget)
      WorkoutPreferenceService.saveSimplePreferences(
        preferenceCheck.userId!,
        preferenceCheck.trainingSessionId!,
        preferenceCheck.businessId!,
        parsedPreferences
      ).catch(error => {
        logger.error("Failed to save simple preferences (non-blocking)", error);
      });

      // Validate exercises if any were mentioned
      let validatedPreferences = { ...parsedPreferences };
      let exerciseValidationInfo: any = {};
      
      console.log("DEBUG: Checking for exercises", {
        avoidExercises: parsedPreferences.avoidExercises,
        includeExercises: parsedPreferences.includeExercises,
        hasAvoid: (parsedPreferences.avoidExercises?.length ?? 0) > 0,
        hasInclude: (parsedPreferences.includeExercises?.length ?? 0) > 0
      });
      
      if ((parsedPreferences.avoidExercises?.length ?? 0) > 0 || (parsedPreferences.includeExercises?.length ?? 0) > 0) {
        logger.info("Starting exercise validation", {
          avoidExercises: parsedPreferences.avoidExercises,
          includeExercises: parsedPreferences.includeExercises,
          businessId: preferenceCheck.businessId
        });

        try {
          // Validate avoid exercises
          if (parsedPreferences.avoidExercises?.length) {
            const avoidValidation = await ExerciseValidationService.validateExercises(
              parsedPreferences.avoidExercises,
              preferenceCheck.businessId!,
              "avoid",
              preferenceCheck.trainingSessionId
            );
            validatedPreferences.avoidExercises = avoidValidation.validatedExercises;
            exerciseValidationInfo.avoidExercises = avoidValidation;
            
            logger.info("Avoid exercises validation result", {
              input: parsedPreferences.avoidExercises,
              validated: avoidValidation.validatedExercises,
              matches: avoidValidation.matches
            });
          }

          // Validate include exercises
          if (parsedPreferences.includeExercises?.length) {
            const includeValidation = await ExerciseValidationService.validateExercises(
              parsedPreferences.includeExercises,
              preferenceCheck.businessId!,
              "include",
              preferenceCheck.trainingSessionId
            );
            
            // Check if any exercises need disambiguation
            const ambiguousMatches = includeValidation.matches.filter(
              match => match.matchedExercises.length > 1
            );
            
            if (ambiguousMatches.length > 0) {
              // Save any validated avoid exercises before handling disambiguation
              if (validatedPreferences.avoidExercises?.length) {
                await WorkoutPreferenceService.savePreferences(
                  preferenceCheck.userId!,
                  preferenceCheck.trainingSessionId!,
                  preferenceCheck.businessId!,
                  {
                    avoidExercises: validatedPreferences.avoidExercises
                  },
                  "initial_collected"
                );
                logger.info("Saved avoid exercises before disambiguation", {
                  userId: preferenceCheck.userId,
                  avoidExercises: validatedPreferences.avoidExercises
                });
              }
              
              // Handle disambiguation needed
              return this.handleDisambiguationNeeded(
                preferenceCheck,
                phoneNumber,
                messageSid,
                messageContent,
                ambiguousMatches,
                parsedPreferences,
                parseTime,
                exerciseValidationInfo
              );
            }
            
            validatedPreferences.includeExercises = includeValidation.validatedExercises;
            exerciseValidationInfo.includeExercises = includeValidation;
            
            logger.info("Include exercises validation result", {
              input: parsedPreferences.includeExercises,
              validated: includeValidation.validatedExercises,
              matches: includeValidation.matches
            });
          }
        } catch (error) {
          logger.error("Exercise validation error", error);
          // Continue with unvalidated exercises rather than failing
        }
      }

      // Determine next step and response
      const { nextStep, response } = this.determineNextStep(
        preferenceCheck.currentStep,
        validatedPreferences
      );

      // Save preferences
      logger.info("About to save preferences", {
        userId: preferenceCheck.userId,
        sessionId: preferenceCheck.trainingSessionId,
        validatedPreferences: {
          ...validatedPreferences,
          avoidExercisesCount: validatedPreferences.avoidExercises?.length || 0,
          includeExercisesCount: validatedPreferences.includeExercises?.length || 0
        }
      });
      
      await WorkoutPreferenceService.savePreferences(
        preferenceCheck.userId!,
        preferenceCheck.trainingSessionId!,
        preferenceCheck.businessId!,
        validatedPreferences,
        nextStep
      );

      // Save messages
      await this.saveMessages(
        phoneNumber,
        messageContent,
        response,
        messageSid,
        preferenceCheck,
        validatedPreferences,
        parseTime,
        nextStep,
        exerciseValidationInfo
      );

      // Log outbound message and save session data
      if (sessionTestDataLogger.isEnabled()) {
        sessionTestDataLogger.logMessage(preferenceCheck.trainingSessionId!, {
          direction: 'outbound',
          content: response,
          metadata: {
            nextStep,
            validatedPreferences
          }
        });
        
        // Save the complete session data
        await sessionTestDataLogger.saveSessionData(preferenceCheck.trainingSessionId!);
      }

      logger.info("Preference response complete", { 
        userId: preferenceCheck.userId,
        needsFollowUp: parsedPreferences.needsFollowUp,
        nextStep
      });

      return {
        success: true,
        message: response,
        metadata: {
          userId: preferenceCheck.userId,
          businessId: preferenceCheck.businessId,
          sessionId: preferenceCheck.trainingSessionId,
          nextStep,
          parseTime
        }
      };
    } catch (error) {
      logger.error("Preference handler error", error);
      throw error;
    }
  }

  private determineNextStep(currentStep: string, parsedPreferences: any) {
    let nextStep: "initial_collected" | "followup_collected" | "complete";
    let response: string;
    
    if (currentStep === "not_started") {
      // First response
      if (parsedPreferences.needsFollowUp) {
        nextStep = "initial_collected";
        response = "Thanks! Can you tell me more about what specific areas you'd like to focus on or avoid today?";
      } else {
        nextStep = "complete";
        response = "Perfect! I've got your preferences and will use them to build your workout. See you in the gym!";
      }
    } else {
      // Follow-up response (from initial_collected)
      nextStep = "complete";
      response = "Great! I've got all your preferences now. Your workout will be tailored to how you're feeling today. See you in the gym!";
    }

    return { nextStep, response };
  }

  private async handleDisambiguationNeeded(
    preferenceCheck: any,
    phoneNumber: string,
    messageSid: string,
    messageContent: string,
    ambiguousMatches: any[],
    parsedPreferences: any,
    parseTime: number,
    exerciseValidationInfo?: any
  ): Promise<SMSResponse> {
    try {
      const userInfo = await getUserByPhone(phoneNumber);
      if (!userInfo) {
        throw new Error("User not found");
      }

      // Build disambiguation message
      let disambiguationMessage = "I found multiple exercises matching your request. Please select by number:\n\n";
      let optionNumber = 1;
      const allOptions: Array<{ id: string; name: string }> = [];

      for (const match of ambiguousMatches) {
        disambiguationMessage += `For "${match.userInput}":\n`;
        
        // Show all exercise options
        for (const exercise of match.matchedExercises) {
          disambiguationMessage += `${optionNumber}. ${exercise.name}\n`;
          allOptions.push(exercise);
          optionNumber++;
        }
        
        disambiguationMessage += "\n";
      }

      disambiguationMessage += "Reply with number(s) (e.g., '1' or '1,3')";

      // Log disambiguation message if session logging is enabled
      if (sessionTestDataLogger.isEnabled()) {
        sessionTestDataLogger.logMessage(preferenceCheck.trainingSessionId!, {
          direction: 'outbound',
          content: disambiguationMessage,
          metadata: {
            type: 'disambiguation_request',
            ambiguousMatches,
            options: allOptions
          }
        });
        
        // Save session data up to this point
        await sessionTestDataLogger.saveSessionData(preferenceCheck.trainingSessionId!);
      }

      // Save conversation state
      await ConversationStateService.createExerciseDisambiguation(
        userInfo.userId,
        preferenceCheck.trainingSessionId!,
        preferenceCheck.businessId!,
        ambiguousMatches.map(m => m.userInput).join(", "),
        allOptions
      );

      // Save the messages
      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        direction: 'inbound',
        content: messageContent,
        phoneNumber,
        metadata: {
          type: 'preference_collection',
          requiresDisambiguation: true,
          twilioMessageSid: messageSid,
        },
        status: 'delivered',
      });

      // Build array of all LLM calls for disambiguation
      const llmCalls = [];
      
      // Add preference parsing LLM call
      llmCalls.push({
        type: 'preference_parsing',
        model: 'gpt-4o-mini',
        systemPrompt: parsedPreferences.systemPromptUsed || 'Not available',
        userInput: messageContent,
        rawResponse: parsedPreferences.rawLLMResponse || parsedPreferences,
        parsedResponse: parsedPreferences,
        parseTimeMs: parseTime
      });
      
      // Add exercise matching LLM calls
      const allMatches = [
        ...(exerciseValidationInfo.avoidExercises?.matches || []),
        ...(exerciseValidationInfo.includeExercises?.matches || [])
      ];
      
      allMatches.forEach((match: any) => {
        if (match.matchMethod === 'llm') {
          llmCalls.push({
            type: 'exercise_matching',
            model: match.model || 'gpt-4o-mini',
            systemPrompt: match.systemPrompt || 'Not available',
            userInput: match.userInput,
            rawResponse: match.llmReasoning || { reasoning: match.llmReasoning },
            matchedExercises: match.matchedExercises,
            parseTimeMs: match.parseTimeMs || 0
          });
        }
      });

      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        direction: 'outbound',
        content: disambiguationMessage,
        phoneNumber,
        metadata: {
          type: 'disambiguation_request',
          optionCount: allOptions.length,
          // Include llmCalls array for consistency
          llmCalls: llmCalls,
          // Keep llmParsing for backward compatibility
          llmParsing: {
            model: 'gpt-4o-mini',
            parseTimeMs: parseTime,
            inputLength: messageContent.length,
            parsedData: parsedPreferences,
            rawLLMResponse: parsedPreferences.rawLLMResponse || null,
            systemPrompt: parsedPreferences.systemPromptUsed || 'Not available',
            debugInfo: parsedPreferences.debugInfo || null,
            userInput: messageContent,
            extractedFields: {
              intensity: parsedPreferences.intensity || null,
              muscleTargets: parsedPreferences.muscleTargets || [],
              muscleLessens: parsedPreferences.muscleLessens || [],
              includeExercises: parsedPreferences.includeExercises || [],
              avoidExercises: parsedPreferences.avoidExercises || [],
              avoidJoints: parsedPreferences.avoidJoints || [],
              sessionGoal: parsedPreferences.sessionGoal || null,
              generalNotes: parsedPreferences.generalNotes || null,
              needsFollowUp: parsedPreferences.needsFollowUp || false,
            },
            exerciseValidation: {
              ...exerciseValidationInfo,
              ambiguousMatches: ambiguousMatches.map(match => ({
                userInput: match.userInput,
                matchedExercises: match.matchedExercises,
                confidence: match.confidence,
                matchMethod: match.matchMethod,
                model: match.model || 'gpt-4o-mini',
                parseTimeMs: match.parseTimeMs,
                llmReasoning: match.llmReasoning,
                systemPrompt: match.systemPrompt,
                matchCount: match.matchedExercises.length
              }))
            }
          },
          // Also store ambiguousMatches at top level
          ambiguousMatches: ambiguousMatches,
          exerciseValidation: exerciseValidationInfo
        },
        status: 'sent',
      });

      logger.info("Disambiguation required", {
        userId: userInfo.userId,
        ambiguousCount: ambiguousMatches.length,
        totalOptions: allOptions.length
      });

      return {
        success: true,
        message: disambiguationMessage,
        metadata: {
          userId: userInfo.userId,
          businessId: userInfo.businessId,
          requiresDisambiguation: true
        }
      };
    } catch (error) {
      logger.error("Error handling disambiguation", error);
      throw error;
    }
  }

  private async saveMessages(
    phoneNumber: string,
    inboundContent: string,
    outboundContent: string,
    messageSid: string,
    preferenceCheck: any,
    parsedPreferences: any,
    parseTime: number,
    nextStep: string,
    exerciseValidationInfo: any
  ): Promise<void> {
    try {
      const userInfo = await getUserByPhone(phoneNumber);
      
      if (!userInfo) {
        logger.warn("User not found for message saving", { phoneNumber });
        return;
      }

      // Save inbound preference message
      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        direction: 'inbound',
        content: inboundContent,
        phoneNumber,
        metadata: {
          type: 'preference_collection',
          step: preferenceCheck.currentStep,
          twilioMessageSid: messageSid,
        },
        status: 'delivered',
      });

      // Build array of all LLM calls
      const llmCalls = [];
      
      // First LLM call - preference parsing
      llmCalls.push({
        model: 'gpt-4o-mini',
        parseTimeMs: parseTime,
        inputLength: inboundContent.length,
        parsedData: parsedPreferences,
        rawLLMResponse: parsedPreferences.rawLLMResponse || null,
        systemPrompt: parsedPreferences.systemPromptUsed || 'Not available',
        debugInfo: parsedPreferences.debugInfo || null,
        extractedFields: {
          intensity: parsedPreferences.intensity || null,
          muscleTargets: parsedPreferences.muscleTargets || [],
          muscleLessens: parsedPreferences.muscleLessens || [],
          includeExercises: parsedPreferences.includeExercises || [],
          avoidExercises: parsedPreferences.avoidExercises || [],
          avoidJoints: parsedPreferences.avoidJoints || [],
          sessionGoal: parsedPreferences.sessionGoal || null,
          generalNotes: parsedPreferences.generalNotes || null,
          needsFollowUp: parsedPreferences.needsFollowUp || false,
        },
        userInput: inboundContent,
        confidenceIndicators: {
          hasIntensity: !!parsedPreferences.intensity,
          hasMuscleTargets: !!(parsedPreferences.muscleTargets?.length),
          hasRestrictions: !!(parsedPreferences.muscleLessens?.length || parsedPreferences.avoidJoints?.length),
          hasSpecificRequests: !!(parsedPreferences.includeExercises?.length || parsedPreferences.avoidExercises?.length),
          requiresFollowUp: parsedPreferences.needsFollowUp || false,
        }
      });
      
      // Add individual exercise matching LLM calls
      const allMatches = [
        ...(exerciseValidationInfo.avoidExercises?.matches || []),
        ...(exerciseValidationInfo.includeExercises?.matches || [])
      ];
      
      allMatches.forEach((match: any, index: number) => {
        if (match.matchMethod === 'llm' && match.llmReasoning) {
          llmCalls.push({
            model: 'gpt-4o-mini',
            parseTimeMs: match.parseTimeMs,
            exerciseMatch: {
              userInput: match.userInput,
              matchMethod: match.matchMethod,
              matchCount: match.matchedExercises?.length || 0,
              matches: match.matchedExercises?.map((ex: any) => ex.name) || [],
              reasoning: match.llmReasoning
            }
          });
        }
      });

      // Save outbound response with all LLM calls
      await saveMessage({
        userId: userInfo.userId,
        businessId: userInfo.businessId,
        direction: 'outbound',
        content: outboundContent,
        phoneNumber,
        metadata: {
          type: 'preference_collection_response',
          step: nextStep,
          // Primary LLM parsing (for backward compatibility)
          llmParsing: llmCalls[0],
          // All LLM calls as array
          llmCalls: llmCalls,
          // Exercise validation summary
          exerciseValidation: exerciseValidationInfo || null
        },
        status: 'sent',
      });
    } catch (error) {
      logger.error("Failed to save messages", error);
      // Don't throw - message saving shouldn't break the flow
    }
  }
}