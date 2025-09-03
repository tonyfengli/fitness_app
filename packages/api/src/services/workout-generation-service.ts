import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import type {
  AnyGroupWorkoutBlueprint,
  ClientContext,
  Exercise,
  GroupContext,
  GroupWorkoutBlueprint,
  StandardGroupWorkoutBlueprint,
} from "@acme/ai";
import {
  createLLM,
  generateGroupWorkoutBlueprint,
  getWorkoutTemplate,
  isBMFBlueprint,
  isStandardBlueprint,
  StandardWorkoutGenerator,
  WorkoutPromptBuilder,
} from "@acme/ai";
import { and, eq, or } from "@acme/db";
import { db } from "@acme/db/client";
import {
  exercises,
  TrainingSession,
  user as userTable,
  UserTrainingSession,
  Workout,
  WorkoutExercise,
  workoutExerciseSwaps,
  WorkoutPreferences,
} from "@acme/db/schema";

import type { SessionUser } from "../types/auth";
import { createLogger } from "../utils/logger";
import { WorkoutBlueprintService } from "./workout-blueprint-service";

const logger = createLogger("WorkoutGenerationService");

export interface GenerateBlueprintOptions {
  includeDiagnostics?: boolean;
  phase1Only?: boolean; // Stop after Phase 1 (for visualization)
}

export interface GenerateAndCreateOptions {
  skipBlueprintCache?: boolean;
  dryRun?: boolean;
  includeDiagnostics?: boolean;
}

export interface WorkoutGenerationContext {
  db: typeof db;
  session: { user: SessionUser };
}

export class WorkoutGenerationService {
  private debugMode: boolean = false;

  constructor(private ctx: WorkoutGenerationContext) {}

  /**
   * Generate blueprint and LLM assignments - for visualization
   */
  async generateBlueprint(
    sessionId: string,
    options?: GenerateBlueprintOptions,
  ) {
    // Capture process start time
    const processStartTime = new Date().toISOString();
    
    const user = this.ctx.session?.user;

    logger.info("Starting blueprint generation with LLM", {
      sessionId,
      userId: user.id,
    });

    // Get session details
    const session = await this.ctx.db.query.TrainingSession.findFirst({
      where: and(
        eq(TrainingSession.id, sessionId),
        eq(TrainingSession.businessId, user.businessId),
      ),
    });

    if (!session) {
      throw new Error("Session not found");
    }

    // Get checked-in clients with preferences
    const checkedInClients = await this.ctx.db
      .select({
        userId: userTable.id,
        userName: userTable.name,
        userEmail: userTable.email,
        checkedInAt: UserTrainingSession.checkedInAt,
      })
      .from(UserTrainingSession)
      .innerJoin(userTable, eq(UserTrainingSession.userId, userTable.id))
      .where(
        and(
          eq(UserTrainingSession.trainingSessionId, sessionId),
          or(
            eq(UserTrainingSession.status, "checked_in"),
            eq(UserTrainingSession.status, "ready"),
          ),
        ),
      );

    if (checkedInClients.length < 1) {
      throw new Error("Need at least 1 checked-in client for workout generation");
    }

    // Get preferences for each client
    const clientsWithPreferences = await Promise.all(
      checkedInClients.map(async (client) => {
        const [preferences] = await this.ctx.db
          .select()
          .from(WorkoutPreferences)
          .where(
            and(
              eq(WorkoutPreferences.userId, client.userId),
              eq(WorkoutPreferences.trainingSessionId, sessionId),
            ),
          )
          .limit(1);

        return { ...client, preferences };
      }),
    );

    // Use WorkoutBlueprintService to prepare clients and generate blueprint
    const { clientContexts, preScoredExercises, exercisePool, groupContext } =
      await WorkoutBlueprintService.prepareClientsForBlueprint(
        sessionId,
        user.businessId,
        user.id,
      );


    // Generate blueprint with bucketing
    const blueprint = await generateGroupWorkoutBlueprint(
      groupContext,
      exercisePool,
      preScoredExercises,
    );

    // Check blueprint type
    const isBMFBlueprint = "blocks" in blueprint;
    const isStandardBlueprint = "clientExercisePools" in blueprint;

    logger.info("Blueprint generated successfully", {
      sessionId,
      blueprintType: isBMFBlueprint ? "bmf" : "standard",
      blockCount: isBMFBlueprint ? (blueprint as any).blocks.length : 0,
      warnings: blueprint.validationWarnings,
    });

    // Check if workout exercises already exist for this session
    console.log('[WorkoutGenerationService.generateBlueprint] 🔍 Checking for existing workouts...');
    console.log('[WorkoutGenerationService.generateBlueprint] Session ID:', sessionId);
    console.log('[WorkoutGenerationService.generateBlueprint] Options:', options);
    
    const existingWorkoutsRaw = await this.ctx.db
      .select()
      .from(Workout)
      .where(eq(Workout.trainingSessionId, sessionId));
    
    console.log('[WorkoutGenerationService.generateBlueprint] Found existing workouts:', existingWorkoutsRaw.length);

    // For each workout, fetch its exercises with exercise details
    const existingWorkouts = await Promise.all(
      existingWorkoutsRaw.map(async (workout) => {
        const workoutExercises = await this.ctx.db
          .select({
            id: WorkoutExercise.id,
            exerciseId: WorkoutExercise.exerciseId,
            orderIndex: WorkoutExercise.orderIndex,
            groupName: WorkoutExercise.groupName,
            selectionSource: WorkoutExercise.selectionSource,
            template: WorkoutExercise.template,
            reasoning: WorkoutExercise.reasoning,
            exercise: exercises,
          })
          .from(WorkoutExercise)
          .innerJoin(exercises, eq(WorkoutExercise.exerciseId, exercises.id))
          .where(eq(WorkoutExercise.workoutId, workout.id))
          .orderBy(WorkoutExercise.orderIndex);

        return {
          ...workout,
          exercises: workoutExercises,
        };
      }),
    );

    // Generate LLM workout assignments
    let llmResult = null;
    
    // If we're in phase1Only mode and exercises already exist, skip LLM call
    if (options?.phase1Only && existingWorkouts.length > 0) {
      console.log('[WorkoutGenerationService.generateBlueprint] ⚠️ PHASE1 ONLY WITH EXISTING WORKOUTS');
      console.log('[WorkoutGenerationService.generateBlueprint] Will create MOCK LLM result from existing data');
      console.log('[WorkoutGenerationService.generateBlueprint] Existing workout IDs:', existingWorkoutsRaw.map(w => w.id));
      console.log('[WorkoutGenerationService.generateBlueprint] Total exercises found:', existingWorkouts.reduce((sum, w) => sum + w.exercises.length, 0));
      
      logger.info("Skipping Phase 1 LLM call - workout exercises already exist", {
        sessionId,
        workoutCount: existingWorkouts.length,
      });

      // Format existing exercises as LLM result
      llmResult = await this.formatExistingExercisesAsLLMResult(
        existingWorkouts,
        blueprint,
        groupContext,
        clientContexts,
      );
      
      console.log('[WorkoutGenerationService.generateBlueprint] Created mock LLM result:', {
        hasSystemPrompt: !!llmResult.systemPrompt,
        hasLlmOutput: !!llmResult.llmOutput,
        hasExerciseSelection: !!llmResult.exerciseSelection,
        hasDebug: !!(llmResult as any).debug,
        debugKeys: (llmResult as any).debug ? Object.keys((llmResult as any).debug) : []
      });
    } else {
      try {
        logger.info("Starting LLM generation");

      // Enable debug mode if diagnostics requested
      if (options?.includeDiagnostics) {
        this.debugMode = true;
        logger.info("Debug mode enabled for workout generation", {
          includeDiagnostics: options.includeDiagnostics,
          phase1Only: options.phase1Only,
        });
      } else {
        logger.info("Debug mode NOT enabled", {
          optionsProvided: !!options,
          includeDiagnostics: options?.includeDiagnostics,
        });
      }

      console.log('[WorkoutGenerationService.generateBlueprint] 🤖 Starting LLM generation...');
      console.log('[WorkoutGenerationService.generateBlueprint] Phase1Only:', options?.phase1Only);
      console.log('[WorkoutGenerationService.generateBlueprint] Include diagnostics:', options?.includeDiagnostics);
      
      const generationResult = await this.generateWithLLM(
        blueprint,
        groupContext,
        exercisePool,
        sessionId,
        { phase1Only: options?.phase1Only },
      );
      
      console.log('[WorkoutGenerationService.generateBlueprint] ✅ LLM generation complete:', {
        hasSystemPrompt: !!generationResult.systemPrompt,
        hasLlmOutput: !!generationResult.llmOutput,
        hasExerciseSelection: !!generationResult.exerciseSelection,
        hasDebug: !!generationResult.debug,
        debugKeys: generationResult.debug ? Object.keys(generationResult.debug) : []
      });

      // Structure the result properly
      llmResult = {
        systemPrompt: generationResult.systemPrompt,
        userMessage: generationResult.userMessage,
        llmOutput: generationResult.llmOutput,
        deterministicAssignments: generationResult.deterministicAssignments,
        llmAssignments:
          generationResult.llmAssignments || generationResult.roundOrganization,
        exerciseSelection: generationResult.exerciseSelection,
        metadata: generationResult.metadata,
      };

      // Include per-client debug data if available (from standard generator)
      if (generationResult.debug && options?.includeDiagnostics) {
        (llmResult as any).systemPromptsByClient =
          generationResult.debug.systemPromptsByClient;
        (llmResult as any).llmResponsesByClient =
          generationResult.debug.llmResponsesByClient;
      }

      // Include LLM timing data if available
      if (generationResult.exerciseSelection?.llmTimings) {
        (llmResult as any).llmTimings = generationResult.exerciseSelection.llmTimings;
      }

      logger.info("LLM generation completed successfully");

      // Save Phase 1 selections for standard templates
      if (isStandardBlueprint && generationResult.exerciseSelection) {
        await this.savePhase1Selections(
          sessionId,
          generationResult.exerciseSelection,
          groupContext,
          exercisePool,
        );
      }
      } catch (error) {
        logger.error("LLM generation failed", error);
        // Don't fail the whole request if LLM fails
        llmResult = {
          error: error instanceof Error ? error.message : "LLM generation failed",
          deterministicAssignments: null,
          llmAssignments: null,
        };
      }
    }


    // Prepare timing data if LLM timings are available
    let timings = undefined;
    if (llmResult && !('error' in llmResult) && (llmResult as any).llmTimings) {
      timings = {
        processStart: processStartTime,
        processEnd: new Date().toISOString(),
        llmCalls: (llmResult as any).llmTimings,
      };
    }

    return {
      groupContext,
      blueprint,
      llmResult,
      summary: {
        totalClients: clientContexts.length,
        totalBlocks: isBMFBlueprint ? (blueprint as any).blocks.length : 0,
        cohesionWarnings: blueprint.validationWarnings || [],
        llmGenerated: !!llmResult && !llmResult.error,
        selectionsStored:
          isStandardBlueprint && !!llmResult && !llmResult.error,
      },
      ...(timings && { timings }),
    };
  }

  /**
   * Generate workouts using LLM based on blueprint
   */
  async generateWithLLM(
    blueprint: AnyGroupWorkoutBlueprint,
    groupContext: GroupContext,
    exercisePool: Exercise[],
    sessionId: string,
    options?: { phase1Only?: boolean },
  ) {
    logger.info("Starting LLM generation", {
      templateType: groupContext.templateType,
      clientCount: groupContext.clients.length,
    });

    // Route based on blueprint type
    if (isStandardBlueprint(blueprint)) {
      // Standard template with two-phase LLM
      logger.info("Using standard workout generator (two-phase)");
      return this.generateStandardWorkouts(
        blueprint,
        groupContext,
        sessionId,
        options,
      );
    }

    // BMF template with single-phase LLM
    if (
      groupContext.templateType === "full_body_bmf" &&
      isBMFBlueprint(blueprint)
    ) {
      logger.info("Using BMF workout generator (single-phase)");
      return this.generateBMFWorkouts(blueprint, groupContext, sessionId);
    }

    // Circuit template with single-phase LLM
    if (groupContext.templateType === "circuit") {
      logger.info("Using Circuit workout generator (single-phase)", {
        phase1Only: options?.phase1Only,
        willGenerateExercises: true, // Circuit always generates exercises
      });
      return this.generateCircuitWorkouts(blueprint, groupContext, sessionId);
    }

    // Other templates not yet implemented
    throw new Error(
      `Template ${groupContext.templateType} not yet implemented`,
    );
  }

  /**
   * BMF-specific workout generation with deterministic assignments
   */
  private async generateBMFWorkouts(
    blueprint: GroupWorkoutBlueprint,
    groupContext: GroupContext,
    sessionId: string,
  ) {
    const round1Block = blueprint.blocks.find((b) => b.blockId === "Round1");
    const round2Block = blueprint.blocks.find((b) => b.blockId === "Round2");
    const round3Block = blueprint.blocks.find((b) => b.blockId === "Round3");
    const round4Block = blueprint.blocks.find(
      (b) => b.blockId === "FinalRound",
    );

    // Deterministic assignments for R1 and R2
    const round1Assignments = this.getDeterministicAssignments(
      round1Block,
      groupContext.clients,
    );
    const round2Assignments = this.getDeterministicAssignments(
      round2Block,
      groupContext.clients,
    );

    // Handle client exercise requests for R3/R4
    const clientRequestAssignments = this.processClientRequests(
      groupContext.clients,
      round3Block,
      round4Block,
    );

    // Build prompt for LLM
    const promptBuilder = new WorkoutPromptBuilder({
      workoutType: "group",
      groupConfig: {
        clients: groupContext.clients,
        blueprint: blueprint.blocks,
        deterministicAssignments: {
          Round1: round1Assignments,
          Round2: round2Assignments,
          ...clientRequestAssignments,
        },
        equipment: this.getDefaultEquipment(),
        templateType: "full_body_bmf",
      },
    });

    const systemPrompt = promptBuilder.build();
    const userMessage =
      "Generate the group workout assignments for rounds 3 and 4.";

    // Call LLM
    const llm = createLLM({
      modelName: "gpt-4",
      temperature: 0.5,
      maxTokens: 3000,
    });
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ]);

    const llmOutput = response.content.toString();

    // Parse response
    const jsonMatch = llmOutput.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch?.[1]) {
      throw new Error("Failed to parse LLM response");
    }

    const parsedResponse = JSON.parse(jsonMatch[1]);

    return {
      deterministicAssignments: {
        Round1: round1Assignments,
        Round2: round2Assignments,
        ...clientRequestAssignments,
      },
      llmAssignments: parsedResponse,
      systemPrompt,
      userMessage,
      llmOutput,
      // Removed exercisePool to avoid Date serialization issues
    };
  }

  /**
   * Circuit template workout generation with single-phase LLM
   */
  private async generateCircuitWorkouts(
    blueprint: GroupWorkoutBlueprint,
    groupContext: GroupContext,
    sessionId: string,
  ) {
    // Get circuit config from the training session
    const session = await this.ctx.db.query.TrainingSession.findFirst({
      where: eq(TrainingSession.id, sessionId),
    });

    let circuitConfig = undefined;
    if (
      session?.templateType === "circuit" &&
      session.templateConfig &&
      typeof session.templateConfig === "object" &&
      "type" in session.templateConfig &&
      session.templateConfig.type === "circuit"
    ) {
      circuitConfig = session.templateConfig;
    }

    // Build prompt for LLM
    const promptBuilder = new WorkoutPromptBuilder({
      workoutType: "group",
      groupConfig: {
        clients: groupContext.clients,
        blueprint: blueprint.blocks,
        equipment: this.getDefaultEquipment(),
        templateType: "circuit",
        circuitConfig, // Pass circuit configuration
      },
    });

    const systemPrompt = promptBuilder.build();
    const userMessage = "Generate the circuit workout with exercise assignments for all stations.";
    
    logger.info("Circuit workout generation prompt", {
      promptLength: systemPrompt.length,
      fullPrompt: systemPrompt,
    });

    // Call LLM
    const llm = createLLM({
      modelName: "gpt-4",
      temperature: 0.5,
      maxTokens: 2000,
    });
    
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ]);

    const llmOutput = response.content.toString();
    
    logger.info("Circuit LLM raw response", {
      llmOutputLength: llmOutput.length,
      first1000Chars: llmOutput.substring(0, 1000),
    });

    // Parse response - simple regex extraction
    const jsonMatch = llmOutput.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch?.[1]) {
      logger.error("Failed to extract JSON from LLM response", {
        llmOutputLength: llmOutput.length,
        first500Chars: llmOutput.substring(0, 500),
      });
      throw new Error("No JSON block found in LLM response");
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(jsonMatch[1]);
    } catch (parseError) {
      logger.error("Failed to parse JSON from LLM response", {
        error: (parseError as Error).message,
        extractedJson: jsonMatch[1].substring(0, 500),
      });
      throw new Error(`Failed to parse LLM JSON response: ${(parseError as Error).message}`);
    }
    
    // Get exercise ID mapping from the blueprint
    let exerciseIdMap: Record<string, any> = {};
    const exerciseBlock = blueprint.blocks.find(block => block.blockId === "circuit_exercises");
    if (exerciseBlock && "individualCandidates" in exerciseBlock) {
      // Get the ID map from any client (they all have the same exercises)
      const firstClientData = Object.values(exerciseBlock.individualCandidates)[0];
      if (firstClientData && typeof firstClientData === 'object' && 'exerciseIdMap' in firstClientData) {
        exerciseIdMap = (firstClientData as any).exerciseIdMap;
      }
    }
    
    // Transform minimal format to expected structure
    const normalizedResponse = {
      circuit: {
        rounds: parsedResponse.rounds.map((round: any) => ({
          round: round.r,
          exercises: round.ex.map((exerciseId: string, idx: number) => {
            // Map exercise ID back to exercise name
            const exercise = exerciseIdMap[exerciseId];
            if (!exercise) {
              logger.warn(`Exercise ID ${exerciseId} not found in mapping`, {
                exerciseId,
                availableIds: Object.keys(exerciseIdMap).slice(0, 10),
                round: round.r
              });
              
              // Try to find if it's an exercise name instead of ID (fallback for old format)
              const exerciseByName = Object.values(exerciseIdMap).find(
                (ex: any) => ex.name === exerciseId
              );
              
              if (exerciseByName) {
                logger.info("Found exercise by name instead of ID", {
                  input: exerciseId,
                  found: (exerciseByName as any).name
                });
                return {
                  position: idx + 1,
                  name: (exerciseByName as any).name,
                  movementPattern: (exerciseByName as any).movementPattern,
                  primaryMuscle: (exerciseByName as any).primaryMuscle
                };
              }
              
              return {
                position: idx + 1,
                name: exerciseId // Fallback to ID as name
              };
            }
            return {
              position: idx + 1,
              name: exercise.name,
              movementPattern: exercise.movementPattern,
              primaryMuscle: exercise.primaryMuscle
            };
          })
        })),
        notes: parsedResponse.notes
      }
    };

    logger.info("Circuit LLM response parsed", {
      roundsCount: normalizedResponse.circuit.rounds.length,
      firstRoundExercises: normalizedResponse.circuit.rounds[0]?.exercises.length || 0,
      hasExerciseIdMap: Object.keys(exerciseIdMap).length > 0,
      idMapSize: Object.keys(exerciseIdMap).length,
      sampleMapping: Object.entries(exerciseIdMap).slice(0, 3).map(([id, ex]) => ({
        id,
        name: (ex as any).name
      })),
      firstRoundMappedExercises: normalizedResponse.circuit.rounds[0]?.exercises.map((ex: any) => ({
        position: ex.position,
        name: ex.name,
        pattern: ex.movementPattern
      }))
    });

    return {
      systemPrompt,
      userMessage,
      llmOutput,
      llmAssignments: normalizedResponse,
      metadata: {
        templateType: "circuit",
        circuitConfig: circuitConfig || null,
      },
    };
  }

  /**
   * Standard template workout generation with two-phase LLM
   */
  private async generateStandardWorkouts(
    blueprint: StandardGroupWorkoutBlueprint,
    groupContext: GroupContext,
    sessionId: string,
    options?: { phase1Only?: boolean },
  ) {
    logger.info("Generating standard workouts with two-phase LLM", {
      phase1Only: options?.phase1Only || false,
    });

    // Get template
    const template = getWorkoutTemplate(
      groupContext.templateType || "standard",
    );
    if (!template) {
      throw new Error(`Template ${groupContext.templateType} not found`);
    }

    // Prepare favorites map from group context
    const favoritesByClient = new Map<string, string[]>();
    for (const client of groupContext.clients) {
      if (client.favoriteExerciseIds && client.favoriteExerciseIds.length > 0) {
        favoritesByClient.set(client.user_id, client.favoriteExerciseIds);
      }
    }

    // Initialize generator with favorites
    const generator = new StandardWorkoutGenerator(favoritesByClient);

    // Enable debug capture if we're in debug mode
    if (this.debugMode) {
      generator.enableDebugCapture();
    }

    try {
      // If phase1Only, we need to manually run just Phase 1
      if (options?.phase1Only) {
        logger.info("Running Phase 1 only (exercise selection)");

        // Access the private method through type casting
        const exerciseSelection = await (generator as any).selectExercises(
          blueprint,
          groupContext,
        );

        logger.info("Phase 1 exercise selection completed", {
          hasExerciseSelection: !!exerciseSelection,
          hasDebugData: !!(exerciseSelection as any).debugData,
          debugDataClients: (exerciseSelection as any).debugData
            ? Object.keys((exerciseSelection as any).debugData)
            : [],
        });

        // Return a partial result with only Phase 1 data
        const result: any = {
          exerciseSelection,
          roundOrganization: null, // No Phase 2
          systemPrompt: "Phase 1 only - exercise selection",
          userMessage: "Phase 1 only - see individual client selections",
          llmOutput: JSON.stringify({ exerciseSelection }, null, 2),
          metadata: {
            phase1Only: true,
            templateType: template.id,
            clientCount: groupContext.clients.length,
            timestamp: new Date().toISOString(),
          },
        };

        // Always include debug data for visualization
        const debugData = (exerciseSelection as any).debugData;
        if (debugData) {
          result.debug = {
            systemPromptsByClient: {},
            llmResponsesByClient: {},
          };

          logger.info("Phase 1 debug data available", {
            hasDebugData: true,
            clientIds: Object.keys(debugData),
            debugDataSample: Object.entries(debugData).map(
              ([clientId, data]: [string, any]) => ({
                clientId,
                hasSystemPrompt: !!data.systemPrompt,
                hasLlmResponse: !!data.llmResponse,
                systemPromptLength: data.systemPrompt?.length || 0,
                llmResponseLength: data.llmResponse?.length || 0,
              }),
            ),
          });

          for (const [clientId, data] of Object.entries(debugData)) {
            if ((data as any).systemPrompt) {
              result.debug.systemPromptsByClient[clientId] = (
                data as any
              ).systemPrompt;
            }
            if ((data as any).llmResponse) {
              result.debug.llmResponsesByClient[clientId] = (
                data as any
              ).llmResponse;
            }
          }
        } else {
          logger.info("No Phase 1 debug data found", {
            hasExerciseSelection: !!exerciseSelection,
            exerciseSelectionKeys: Object.keys(exerciseSelection),
          });
        }

        logger.info("Returning Phase 1 result", {
          hasDebug: !!result.debug,
          debugKeys: result.debug ? Object.keys(result.debug) : [],
          systemPromptsByClientCount: result.debug?.systemPromptsByClient
            ? Object.keys(result.debug.systemPromptsByClient).length
            : 0,
          llmResponsesByClientCount: result.debug?.llmResponsesByClient
            ? Object.keys(result.debug.llmResponsesByClient).length
            : 0,
        });

        return result;
      }

      // Run Phase 1 only for now (Phase 2 removed)
      const workoutPlan = await generator.generate(
        blueprint,
        groupContext,
        template,
        sessionId,
      );

      logger.info("Standard workout plan generated successfully", {
        sharedExercises: workoutPlan.exerciseSelection.sharedExercises.length,
        hasRoundOrganization: false, // Phase 2 removed
      });

      // Return in format compatible with createWorkouts
      const result: any = {
        exerciseSelection: workoutPlan.exerciseSelection,
        roundOrganization: null, // Phase 2 removed - will be built separately
        systemPrompt: "Phase 1 generation only - Phase 2 to be implemented",
        userMessage: "Phase 1 exercise selection",
        llmOutput: JSON.stringify(workoutPlan, null, 2),
        metadata: workoutPlan.metadata,
      };

      // Include per-client debug data if available
      if (workoutPlan.debug) {
        result.debug = workoutPlan.debug;
      }

      return result;
    } catch (error) {
      logger.error("Error generating standard workouts:", error);
      throw new Error(
        `Standard workout generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Save Phase 1 exercise selections to database
   */
  private async savePhase1Selections(
    sessionId: string,
    exerciseSelection: any,
    groupContext: GroupContext,
    exercisePool: Exercise[],
  ) {
    console.log('[WorkoutGenerationService.savePhase1Selections] 🔍 Starting Phase 1 save...');
    console.log('[WorkoutGenerationService.savePhase1Selections] Session ID:', sessionId);
    console.log('[WorkoutGenerationService.savePhase1Selections] Client count:', groupContext.clients.length);
    console.log('[WorkoutGenerationService.savePhase1Selections] Exercise selection structure:', {
      hasClientSelections: !!exerciseSelection.clientSelections,
      clientSelectionKeys: Object.keys(exerciseSelection.clientSelections || {}),
      hasSharedExercises: !!exerciseSelection.sharedExercises,
      sharedExerciseCount: exerciseSelection.sharedExercises?.length || 0
    });
    
    logger.info("Saving Phase 1 selections - creating draft workouts", {
      sessionId,
    });

    const user = this.ctx.session?.user;

    return await this.ctx.db.transaction(async (tx) => {
      // First check if draft workouts already exist for this session
      const existingWorkouts = await tx
        .select()
        .from(Workout)
        .where(
          and(
            eq(Workout.trainingSessionId, sessionId),
            eq(Workout.status, "draft"),
          ),
        );

      if (existingWorkouts.length > 0) {
        console.log('[WorkoutGenerationService.savePhase1Selections] ⚠️ Draft workouts already exist, skipping creation');
        console.log('[WorkoutGenerationService.savePhase1Selections] Existing workout count:', existingWorkouts.length);
        logger.info(
          `Draft workouts already exist for session ${sessionId}, skipping creation`,
        );
        return;
      }

      // Create draft workout for each client
      const workoutRecords = [];
      for (const client of groupContext.clients) {
        workoutRecords.push({
          trainingSessionId: sessionId,
          userId: client.user_id,
          businessId: user.businessId,
          createdByTrainerId: user.id,
          notes: "", // Blank as requested
          workoutType: "", // Blank as requested
          totalPlannedSets: 0, // Will be updated in Phase 2
          llmOutput: {
            phase1: exerciseSelection,
            timestamp: new Date().toISOString(),
          },
          context: "group" as const,
          status: "draft" as const,
        });
      }

      console.log('[WorkoutGenerationService.savePhase1Selections] 📦 Creating draft workouts...');
      console.log('[WorkoutGenerationService.savePhase1Selections] Records to create:', workoutRecords.length);
      
      const createdWorkouts = await tx
        .insert(Workout)
        .values(workoutRecords)
        .returning({ id: Workout.id, userId: Workout.userId });

      console.log('[WorkoutGenerationService.savePhase1Selections] ✅ Created draft workouts:', {
        count: createdWorkouts.length,
        workoutIds: createdWorkouts.map((w) => w.id),
        userIds: createdWorkouts.map((w) => w.userId)
      });
      
      logger.info(
        `[savePhase1Selections] Created ${createdWorkouts.length} draft workouts`,
        {
          sessionId,
          workoutIds: createdWorkouts.map((w) => w.id),
          userIds: createdWorkouts.map((w) => w.userId),
        },
      );

      // Map client IDs to workout IDs
      const clientWorkoutMap = new Map<string, string>();
      createdWorkouts.forEach((workout) => {
        clientWorkoutMap.set(workout.userId, workout.id);
      });

      // Create workout exercise records
      const exerciseRecords = [];
      // Use a fixed temporary order index - Phase 2 will assign proper values
      const TEMP_ORDER_INDEX = 999;

      // Process each client's selections
      for (const [clientId, clientSelection] of Object.entries(
        exerciseSelection.clientSelections,
      )) {
        const clientData = clientSelection as any;
        const workoutId = clientWorkoutMap.get(clientId);
        if (!workoutId || !clientData) continue;

        // Process pre-assigned exercises
        for (const exercise of clientData.preAssigned || []) {
          const dbExercise = exercisePool.find(
            (e) =>
              e.id === exercise.exerciseId ||
              (exercise.exerciseName && e.name.toLowerCase() === exercise.exerciseName.toLowerCase()),
          );

          if (dbExercise) {
            exerciseRecords.push({
              workoutId,
              exerciseId: dbExercise.id,
              orderIndex: TEMP_ORDER_INDEX,
              setsCompleted: 0,
              groupName: null,
              isShared: false,
              sharedWithClients: null as string[] | null,
              selectionSource: "pre_assigned",
              template: groupContext.templateType || "standard", // Add template field
            });
          }
        }

        // Process selected exercises
        for (const exercise of clientData.selected || []) {
          const dbExercise = exercisePool.find(
            (e) =>
              e.id === exercise.exerciseId ||
              (exercise.exerciseName && e.name.toLowerCase() === exercise.exerciseName.toLowerCase()),
          );

          if (dbExercise) {
            exerciseRecords.push({
              workoutId,
              exerciseId: dbExercise.id,
              orderIndex: TEMP_ORDER_INDEX,
              setsCompleted: 0,
              groupName: null,
              isShared: exercise.isShared || false,
              sharedWithClients: exercise.sharedWith || null,
              selectionSource: "llm_phase1",
              template: groupContext.templateType || "standard", // Add template field
            });
          }
        }
      }

      // Also save shared exercises for each participating client
      for (const sharedExercise of exerciseSelection.sharedExercises || []) {
        const dbExercise = exercisePool.find(
          (e) =>
            e.id === sharedExercise.exerciseId ||
            (sharedExercise.exerciseName && e.name.toLowerCase() === sharedExercise.exerciseName.toLowerCase()),
        );

        if (dbExercise) {
          // Add for each client that shares this exercise
          for (const clientId of sharedExercise.clientIds) {
            const workoutId = clientWorkoutMap.get(clientId);
            if (!workoutId) continue;

            // Check if we already have this exercise for this client
            const existingExercise = exerciseRecords.find(
              (e) =>
                e.workoutId === workoutId && e.exerciseId === dbExercise.id,
            );

            // If not already added, add it
            if (!existingExercise) {
              exerciseRecords.push({
                workoutId,
                exerciseId: dbExercise.id,
                orderIndex: TEMP_ORDER_INDEX,
                setsCompleted: 0,
                groupName: null,
                isShared: true,
                sharedWithClients: sharedExercise.clientIds,
                selectionSource: "llm_phase1",
                template: groupContext.templateType || "standard", // Add template field
              });
            }
          }
        }
      }

      // Batch insert exercise records
      if (exerciseRecords.length > 0) {
        console.log('[WorkoutGenerationService.savePhase1Selections] 🎯 PHASE 1: INSERTING WORKOUT EXERCISES', {
          totalCount: exerciseRecords.length,
          templateType: groupContext.templateType || "standard",
          templateTypes: exerciseRecords.reduce((acc: Record<string, number>, ex) => {
            const template = ex.template || 'NOT_SET';
            acc[template] = (acc[template] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          sampleExercise: exerciseRecords[0] ? {
            workoutId: exerciseRecords[0].workoutId,
            exerciseId: exerciseRecords[0].exerciseId,
            template: exerciseRecords[0].template,
            selectionSource: exerciseRecords[0].selectionSource
          } : null
        });
        
        await tx.insert(WorkoutExercise).values(exerciseRecords);
        logger.info(
          `Created ${exerciseRecords.length} workout exercises for ${createdWorkouts.length} draft workouts`,
          { sessionId },
        );
      }

      return {
        workoutIds: createdWorkouts.map((w) => w.id),
        clientWorkoutMap,
      };
    });
  }

  /**
   * Create workout records in the database
   */
  async createWorkouts(
    sessionId: string,
    generationResult: any,
    groupContext: GroupContext,
    exercisePool: Exercise[],
  ) {
    const user = this.ctx.session?.user;

    logger.info("Creating workout records", { sessionId });

    return await this.ctx.db.transaction(async (tx) => {
      // Skip storing blueprint summary - not needed

      // Determine workout type based on template
      const templateType = generationResult.metadata?.templateType || groupContext.templateType || "full_body_bmf";
      const workoutType = templateType === "circuit" ? "circuit" : "full_body_bmf";
      const workoutNotes = templateType === "circuit" 
        ? `Circuit Training - ${new Date().toLocaleDateString()}`
        : `BMF - ${new Date().toLocaleDateString()}`;

      // Create workout records for each client
      const workoutValues = groupContext.clients.map((client) => ({
        trainingSessionId: sessionId,
        userId: client.user_id,
        businessId: user.businessId,
        createdByTrainerId: user.id,
        notes: workoutNotes,
        workoutType: workoutType,
        totalPlannedSets: 99,
        llmOutput: {
          systemPrompt: generationResult.systemPrompt,
          userMessage: generationResult.userMessage,
          rawResponse: generationResult.llmOutput,
          parsedResponse: generationResult.llmAssignments,
          llmModel: "gpt-4o",
          timestamp: new Date().toISOString(),
          metadata: generationResult.metadata,
        },
        context: "group" as const,
      }));

      const createdWorkouts = await tx
        .insert(Workout)
        .values(workoutValues)
        .returning({ id: Workout.id }); // Only return the ID field

      // Map client IDs to workout IDs
      const clientWorkouts = new Map<string, string>();
      createdWorkouts.forEach((workout, index) => {
        const client = groupContext.clients[index];
        if (client) {
          clientWorkouts.set(client.user_id, workout.id);
        }
      });

      // Create exercise records
      const allExercises = await this.createExerciseRecords(
        tx,
        clientWorkouts,
        generationResult,
        groupContext,
        exercisePool,
      );

      logger.info("Exercise records created", {
        count: allExercises.length,
        hasExercises: allExercises.length > 0,
      });

      // Only insert if we have exercises
      if (allExercises.length > 0) {
        logger.info("🔴 INSERTING WORKOUT EXERCISES", {
          totalCount: allExercises.length,
          templateTypes: allExercises.reduce((acc: Record<string, number>, ex) => {
            const template = ex.template || 'NOT_SET';
            acc[template] = (acc[template] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          sampleExercise: allExercises[0] ? {
            hasTemplate: 'template' in allExercises[0],
            templateValue: allExercises[0].template,
            fields: Object.keys(allExercises[0])
          } : null
        });
        await tx.insert(WorkoutExercise).values(allExercises);
      } else {
        logger.error("No exercises to insert!");
        throw new Error("Failed to create exercise records - no exercises generated");
      }

      return createdWorkouts.map((w) => w.id);
    });
  }

  /**
   * Main orchestration method - generates blueprint and creates workouts
   */
  async generateAndCreateWorkouts(
    sessionId: string,
    options?: GenerateAndCreateOptions,
  ) {
    logger.info("Starting full workout generation", { sessionId, options });

    // Set debug mode if diagnostics requested
    if (options?.includeDiagnostics) {
      this.debugMode = true;
    }

    try {
      // Step 1: Generate blueprint (including exercise pool)
      const user = this.ctx.session?.user;

      const blueprintData =
        await WorkoutBlueprintService.prepareClientsForBlueprint(
          sessionId,
          user.businessId,
          user.id,
        );

      const { clientContexts, preScoredExercises, exercisePool, groupContext } =
        blueprintData;

      const blueprint = await generateGroupWorkoutBlueprint(
        groupContext,
        exercisePool,
        preScoredExercises,
      );

      if (options?.dryRun) {
        logger.info("Dry run completed", { sessionId });
        return {
          success: true,
          blueprint,
          dryRun: true,
        };
      }

      // Step 2: Generate with LLM
      const generationResult = await this.generateWithLLM(
        blueprint,
        groupContext,
        exercisePool,
        sessionId,
      );

      // Step 3: Create workouts
      const workoutIds = await this.createWorkouts(
        sessionId,
        generationResult,
        groupContext,
        exercisePool
      );

      logger.info("Workout generation completed", {
        sessionId,
        workoutCount: workoutIds.length,
      });

      // Check blueprint type
      const isBMFBlueprint = "blocks" in blueprint;

      // Ensure we're not returning any Date objects or complex types
      const result: any = {
        success: true,
        workoutIds,
        // Don't include the full blueprint in the response to avoid serialization issues
        blueprintSummary: {
          blueprintType: isBMFBlueprint ? "bmf" : "standard",
          blockCount: isBMFBlueprint ? (blueprint as any).blocks.length : 0,
          warnings: blueprint.validationWarnings || [],
        },
      };

      // Include debug information if requested
      if (options?.includeDiagnostics) {
        result.debug = {
          systemPrompt: generationResult.systemPrompt,
          userMessage: generationResult.userMessage,
          llmOutput: generationResult.llmOutput,
        };

        // Include per-client debug data if available (from standard generator)
        if (generationResult.debug) {
          result.debug.systemPromptsByClient =
            generationResult.debug.systemPromptsByClient;
          result.debug.llmResponsesByClient =
            generationResult.debug.llmResponsesByClient;
        }
      }

      return result;
    } catch (error) {
      logger.error("Error in workout generation", { sessionId, error });
      await this.cleanup(sessionId);
      throw error;
    }
  }

  /**
   * Cleanup on error
   */
  async cleanup(sessionId: string) {
    logger.info("Cleaning up failed generation", { sessionId });
    // TODO: Implement cleanup logic
  }

  // Helper methods
  private getDeterministicAssignments(block: any, clients: ClientContext[]) {
    if (!block) return [];

    return clients
      .map((client) => {
        const exercises =
          block.individualCandidates[client.user_id]?.exercises || [];
        const topExercise = exercises[0];

        if (!topExercise) return null;

        return {
          clientId: client.user_id,
          clientName: client.name,
          exercise: topExercise.name,
          equipment: this.getEquipmentFromExercise(topExercise.name),
          roundAssigned: block.blockId,
          reason: "top_scoring",
        };
      })
      .filter(Boolean);
  }

  private processClientRequests(
    clients: ClientContext[],
    round3Block: any,
    round4Block: any,
  ) {
    const assignments: any = {};
    const usedExercisesPerClient = new Map<string, Set<string>>();

    // Process each client's exercise requests
    clients.forEach((client) => {
      const usedExercises =
        usedExercisesPerClient.get(client.user_id) || new Set();
      const requestedExercises = client.exercise_requests?.include || [];

      requestedExercises.forEach((requestedName) => {
        if (usedExercises.has(requestedName.toLowerCase())) return;

        // Try to find in Round 3
        const r3Exercises =
          round3Block?.individualCandidates[client.user_id]?.exercises || [];
        const r3Match = r3Exercises.find(
          (ex: any) => ex.name.toLowerCase() === requestedName.toLowerCase(),
        );

        if (r3Match) {
          if (!assignments.Round3) assignments.Round3 = [];
          assignments.Round3.push({
            clientId: client.user_id,
            clientName: client.name,
            exercise: r3Match.name,
            equipment: this.getEquipmentFromExercise(r3Match.name),
            roundAssigned: "Round3",
            reason: "client_request",
          });
          usedExercises.add(r3Match.name.toLowerCase());
          return;
        }

        // Try Round 4
        const r4Exercises =
          round4Block?.individualCandidates[client.user_id]?.exercises || [];
        const r4Match = r4Exercises.find(
          (ex: any) => ex.name.toLowerCase() === requestedName.toLowerCase(),
        );

        if (r4Match) {
          if (!assignments.FinalRound) assignments.FinalRound = [];
          assignments.FinalRound.push({
            clientId: client.user_id,
            clientName: client.name,
            exercise: r4Match.name,
            equipment: this.getEquipmentFromExercise(r4Match.name),
            roundAssigned: "FinalRound",
            reason: "client_request",
          });
          usedExercises.add(r4Match.name.toLowerCase());
        }
      });

      usedExercisesPerClient.set(client.user_id, usedExercises);
    });

    return assignments;
  }

  private async createExerciseRecords(
    tx: any,
    clientWorkouts: Map<string, string>,
    generationResult: any,
    groupContext: GroupContext,
    exercisePool: Exercise[],
  ) {
    const allExercises: any[] = [];
    
    // Log what we're working with
    logger.info("createExerciseRecords called", {
      hasExerciseSelection: !!generationResult.exerciseSelection,
      hasRoundOrganization: !!generationResult.roundOrganization,
      metadataTemplateType: generationResult.metadata?.templateType,
      groupContextTemplateType: groupContext.templateType,
      hasDeterministicAssignments: !!generationResult.deterministicAssignments,
      hasLlmAssignments: !!generationResult.llmAssignments,
    });

    // Check if this is standard template result
    if (
      generationResult.exerciseSelection &&
      generationResult.roundOrganization
    ) {
      logger.info("🚀 ROUTING TO: createStandardExerciseRecords (has both selection and organization)");
      return this.createStandardExerciseRecords(
        tx,
        clientWorkouts,
        generationResult,
        groupContext,
        exercisePool,
      );
    }
    
    // Check if this is standard template with only Phase 1
    if (generationResult.exerciseSelection && !generationResult.roundOrganization) {
      logger.info("🚀 ROUTING TO: createStandardExerciseRecords (Phase 1 only)");
      return this.createStandardExerciseRecords(
        tx,
        clientWorkouts,
        generationResult,
        groupContext,
        exercisePool,
      );
    }

    // Check if this is circuit template result
    if (generationResult.metadata?.templateType === "circuit" || groupContext.templateType === "circuit") {
      logger.info("🚀 ROUTING TO: createCircuitExerciseRecords");
      return this.createCircuitExerciseRecords(
        tx,
        clientWorkouts,
        generationResult,
        groupContext,
        exercisePool,
      );
    }

    // BMF template processing
    logger.info("🚀 ROUTING TO: BMF template processing (default path)", {
      hasDeterministicAssignments: !!generationResult.deterministicAssignments,
      hasLlmAssignments: !!generationResult.llmAssignments,
      templateType: groupContext.templateType,
    });
    
    const { deterministicAssignments, llmAssignments } = generationResult;
    
    // If no deterministic assignments (shouldn't happen for BMF but let's be safe)
    if (!deterministicAssignments) {
      logger.warn("No deterministic assignments found for BMF template");
      return allExercises;
    }

    for (const client of groupContext.clients) {
      const workoutId = clientWorkouts.get(client.user_id);
      if (!workoutId) continue;

      const clientExercises = [];

      // Round 1 - Deterministic
      const r1Assignment = deterministicAssignments.Round1?.find(
        (a: any) => a.clientId === client.user_id,
      );
      if (r1Assignment) {
        const r1Exercise = exercisePool.find(
          (ex: Exercise) => ex.name === r1Assignment.exercise,
        );
        if (r1Exercise) {
          clientExercises.push({
            workoutId: workoutId,
            exerciseId: r1Exercise.id,
            orderIndex: 1,
            setsCompleted: 99,
            groupName: "Round 1",
            template: "full_body_bmf",
          });
        }
      }

      // Round 2 - Deterministic
      const r2Assignment = deterministicAssignments.Round2?.find(
        (a: any) => a.clientId === client.user_id,
      );
      if (r2Assignment) {
        const r2Exercise = exercisePool.find(
          (ex: Exercise) => ex.name === r2Assignment.exercise,
        );
        if (r2Exercise) {
          clientExercises.push({
            workoutId: workoutId,
            exerciseId: r2Exercise.id,
            orderIndex: 2,
            setsCompleted: 99,
            groupName: "Round 2",
            template: "full_body_bmf",
          });
        }
      }

      // Round 3 - Merge pre-assigned and LLM-assigned
      const clientR3Exercises = new Set<string>();

      // First add pre-assigned R3 exercises
      if (deterministicAssignments.Round3) {
        const preAssigned = deterministicAssignments.Round3.filter(
          (a: any) => a.clientId === client.user_id,
        );
        for (const assignment of preAssigned) {
          const exercise = exercisePool.find(
            (ex: Exercise) => ex.name === assignment.exercise,
          );
          if (exercise) {
            clientExercises.push({
              workoutId: workoutId,
              exerciseId: exercise.id,
              orderIndex: 3,
              setsCompleted: 99,
              groupName: "Round 3",
              notes: `Pre-assigned: ${assignment.reason}`,
              template: "full_body_bmf",
            });
            clientR3Exercises.add(exercise.name.toLowerCase());
          }
        }
      }

      // Then add LLM-assigned R3 exercises (skip if already pre-assigned)
      if (llmAssignments?.round3?.exercises) {
        for (const exercise of llmAssignments.round3.exercises) {
          if (
            exercise.type === "individual" &&
            exercise.client === client.name
          ) {
            if (
              !clientR3Exercises.has((exercise.exercise || "").toLowerCase())
            ) {
              const dbExercise = exercisePool.find(
                (ex: Exercise) =>
                  ex.name.toLowerCase() ===
                  (exercise.exercise || "").toLowerCase(),
              );

              if (dbExercise) {
                clientExercises.push({
                  workoutId: workoutId,
                  exerciseId: dbExercise.id,
                  orderIndex: 3,
                  setsCompleted: 99,
                  groupName: "Round 3",
                  template: "full_body_bmf",
                });
              }
            }
          } else if (
            exercise.type === "shared" &&
            exercise.clients?.includes(client.name)
          ) {
            if (!clientR3Exercises.has((exercise.name || "").toLowerCase())) {
              const dbExercise = exercisePool.find(
                (ex: Exercise) =>
                  ex.name.toLowerCase() === (exercise.name || "").toLowerCase(),
              );

              if (dbExercise) {
                clientExercises.push({
                  workoutId: workoutId,
                  exerciseId: dbExercise.id,
                  orderIndex: 3,
                  setsCompleted: 99,
                  groupName: "Round 3",
                  template: "full_body_bmf",
                });
              }
            }
          }
        }
      }

      // Round 4 - Merge pre-assigned and LLM-assigned
      const clientR4Exercises = new Set<string>();

      // First add pre-assigned R4 exercises
      if (deterministicAssignments.FinalRound) {
        const preAssigned = deterministicAssignments.FinalRound.filter(
          (a: any) => a.clientId === client.user_id,
        );
        for (const assignment of preAssigned) {
          const exercise = exercisePool.find(
            (ex: Exercise) => ex.name === assignment.exercise,
          );
          if (exercise) {
            clientExercises.push({
              workoutId: workoutId,
              exerciseId: exercise.id,
              orderIndex: 4,
              setsCompleted: 99,
              groupName: "Round 4",
              notes: `Pre-assigned: ${assignment.reason}`,
              template: "full_body_bmf",
            });
            clientR4Exercises.add(exercise.name.toLowerCase());
          }
        }
      }

      // Then add LLM-assigned R4 exercises (skip if already pre-assigned)
      if (llmAssignments?.round4?.exercises) {
        for (const exercise of llmAssignments.round4.exercises) {
          if (
            exercise.type === "individual" &&
            exercise.client === client.name
          ) {
            if (
              !clientR4Exercises.has((exercise.exercise || "").toLowerCase())
            ) {
              const dbExercise = exercisePool.find(
                (ex: Exercise) =>
                  ex.name.toLowerCase() ===
                  (exercise.exercise || "").toLowerCase(),
              );

              if (dbExercise) {
                clientExercises.push({
                  workoutId: workoutId,
                  exerciseId: dbExercise.id,
                  orderIndex: 4,
                  setsCompleted: 99,
                  groupName: "Round 4",
                  template: "full_body_bmf",
                });
              }
            }
          } else if (
            exercise.type === "shared" &&
            exercise.clients?.includes(client.name)
          ) {
            if (!clientR4Exercises.has((exercise.name || "").toLowerCase())) {
              const dbExercise = exercisePool.find(
                (ex: Exercise) =>
                  ex.name.toLowerCase() === (exercise.name || "").toLowerCase(),
              );

              if (dbExercise) {
                clientExercises.push({
                  workoutId: workoutId,
                  exerciseId: dbExercise.id,
                  orderIndex: 4,
                  setsCompleted: 99,
                  groupName: "Round 4",
                  template: "full_body_bmf",
                });
              }
            }
          }
        }
      }

      // Add to all exercises array
      allExercises.push(...clientExercises);
    }

    return allExercises;
  }

  private getEquipmentFromExercise(exerciseName: string): string[] {
    // Simplified - in reality would look up from exercise data
    if (exerciseName.toLowerCase().includes("dumbbell")) return ["dumbbells"];
    if (exerciseName.toLowerCase().includes("barbell")) return ["barbell"];
    if (exerciseName.toLowerCase().includes("cable")) return ["cable_machine"];
    return [];
  }

  private getDefaultEquipment() {
    return {
      barbells: 2,
      benches: 2,
      cable_machine: 1,
      row_machine: 1,
      ab_wheel: 1,
      bands: 3,
      bosu_ball: 1,
      kettlebells: 2,
      landmine: 1,
      swiss_ball: 1,
      deadlift_stations: 2,
      medicine_balls: 2,
      dumbbells: "unlimited",
    };
  }

  /**
   * Create exercise records for standard template workouts
   */
  private async createStandardExerciseRecords(
    tx: any,
    clientWorkouts: Map<string, string>,
    generationResult: any,
    groupContext: GroupContext,
    exercisePool: Exercise[],
  ) {
    const allExercises: any[] = [];
    const { exerciseSelection, roundOrganization } = generationResult;
    
    logger.info("🎯 createStandardExerciseRecords called", {
      hasExerciseSelection: !!exerciseSelection,
      hasRoundOrganization: !!roundOrganization,
      clientCount: groupContext.clients.length,
      templateType: groupContext.templateType,
    });

    // If no round organization (Phase 2 removed), create exercises from selection only
    if (!roundOrganization) {
      logger.info("No round organization - creating exercises from Phase 1 selection only");
      
      // Process each client's selected exercises
      for (const [clientId, clientSelection] of Object.entries(exerciseSelection.clientSelections)) {
        const workoutId = clientWorkouts.get(clientId);
        if (!workoutId) continue;

        const clientData = clientSelection as any;
        let orderIndex = 0;

        // Add pre-assigned exercises first
        logger.info(`🔵 Processing pre-assigned exercises for client ${clientId}`, {
          preAssignedCount: (clientData.preAssigned || []).length,
        });
        
        for (const exercise of clientData.preAssigned || []) {
          const dbExercise = exercisePool.find(
            (ex: Exercise) =>
              ex.id === exercise.exerciseId ||
              ex.name.toLowerCase() === exercise.exerciseName.toLowerCase(),
          );

          if (dbExercise) {
            const exerciseRecord = {
              workoutId: workoutId,
              exerciseId: dbExercise.id,
              orderIndex: orderIndex++,
              setsCompleted: 3,
              groupName: "Unorganized",
              selectionSource: exercise.source || "pre_assigned",
              template: "standard",
            };
            logger.info(`  ➡️ Adding pre-assigned exercise`, {
              exerciseName: dbExercise.name,
              template: exerciseRecord.template,
            });
            allExercises.push(exerciseRecord);
          }
        }

        // Add selected exercises
        logger.info(`🟢 Processing selected exercises for client ${clientId}`, {
          selectedCount: (clientData.selected || []).length,
        });
        
        for (const exercise of clientData.selected || []) {
          const dbExercise = exercisePool.find(
            (ex: Exercise) =>
              ex.id === exercise.exerciseId ||
              ex.name.toLowerCase() === exercise.exerciseName.toLowerCase(),
          );

          if (dbExercise) {
            const exerciseRecord = {
              workoutId: workoutId,
              exerciseId: dbExercise.id,
              orderIndex: orderIndex++,
              setsCompleted: 3,
              groupName: "Unorganized",
              isShared: exercise.isShared || false,
              sharedWithClients: exercise.sharedWith || null,
              selectionSource: "llm_phase1",
              template: "standard",
            };
            logger.info(`  ➡️ Adding selected exercise`, {
              exerciseName: dbExercise.name,
              template: exerciseRecord.template,
              isShared: exerciseRecord.isShared,
            });
            allExercises.push(exerciseRecord);
          }
        }
      }

      return allExercises;
    }

    // Original logic for when round organization exists
    logger.info("🟡 Processing round organization - Phase 2 present", {
      roundCount: roundOrganization.rounds?.length || 0,
    });
    
    // Process each round
    for (const round of roundOrganization.rounds) {
      logger.info(`📍 Processing round: ${round.name}`, {
        roundId: round.id,
        clientCount: Object.keys(round.exercises || {}).length,
      });
      
      // Process each client's exercises in this round
      for (const client of groupContext.clients) {
        const workoutId = clientWorkouts.get(client.user_id);
        if (!workoutId) continue;

        const clientExercisesInRound = round.exercises[client.user_id] || [];
        logger.info(`  👤 Client ${client.user_id} exercises in ${round.name}`, {
          exerciseCount: clientExercisesInRound.length,
        });

        // Add each exercise in the round
        for (let i = 0; i < clientExercisesInRound.length; i++) {
          const exercise = clientExercisesInRound[i];

          // Find the exercise in the pool
          const dbExercise = exercisePool.find(
            (ex: Exercise) =>
              ex.id === exercise.exerciseId ||
              ex.name.toLowerCase() === exercise.exerciseName.toLowerCase(),
          );

          if (dbExercise) {
            const exerciseRecord = {
              workoutId: workoutId,
              exerciseId: dbExercise.id,
              orderIndex: this.getRoundOrderIndex(round.id) + i,
              setsCompleted: exercise.sets || 3,
              groupName: round.name,
              template: "standard",
            };
            logger.info(`    ➡️ Adding round exercise`, {
              exerciseName: dbExercise.name,
              template: exerciseRecord.template,
              round: round.name,
            });
            allExercises.push(exerciseRecord);
          } else {
            logger.warn(`Exercise not found in pool: ${exercise.exerciseName}`);
          }
        }
      }
    }

    logger.info("✅ createStandardExerciseRecords completed", {
      totalExercises: allExercises.length,
      exercisesByTemplate: allExercises.reduce((acc, ex) => {
        acc[ex.template || 'undefined'] = (acc[ex.template || 'undefined'] || 0) + 1;
        return acc;
      }, {}),
    });
    
    return allExercises;
  }

  /**
   * Get order index based on round ID
   */
  private getRoundOrderIndex(roundId: string): number {
    const roundMap: Record<string, number> = {
      Round1: 1,
      Round2: 10,
      Round3: 20,
      Round4: 30,
      FinalRound: 30,
    };

    return roundMap[roundId] || 40;
  }

  /**
   * Generate Phase 2 sequencing based on saved selections
   * @deprecated Phase 2 is being reimplemented
   */
  async generatePhase2Sequencing(
    sessionId: string,
    selectionsByClient: Record<string, any[]>,
  ) {
    logger.info("Starting Phase 2 sequencing", { sessionId });

    // Get session and blueprint data
    const user = this.ctx.session?.user;
    const { clientContexts, preScoredExercises, exercisePool, groupContext } =
      await WorkoutBlueprintService.prepareClientsForBlueprint(
        sessionId,
        user.businessId,
        user.id,
      );

    // Get template
    const template = getWorkoutTemplate(
      groupContext.templateType || "standard",
    );
    if (!template) {
      throw new Error(`Template ${groupContext.templateType} not found`);
    }

    // Convert selections back to ExerciseSelection format
    const exerciseSelection: any = {
      clientSelections: {},
      sharedExercises: [],
      selectionReasoning: "Loaded from saved selections",
    };

    // Process each client's selections
    for (const [clientId, selections] of Object.entries(selectionsByClient)) {
      const client = groupContext.clients.find((c) => c.user_id === clientId);
      if (!client) continue;

      const clientSelection: any = {
        clientName: client.name,
        preAssigned: [],
        selected: [],
        totalExercises: selections.length,
      };

      // Convert selections to the expected format
      for (const sel of selections) {
        const exercise = exercisePool.find((ex) => ex.id === sel.exerciseId);
        if (!exercise) continue;

        const exerciseData = {
          exerciseId: sel.exerciseId,
          exerciseName: sel.exerciseName,
          movementPattern: exercise.movementPattern || "",
          primaryMuscle: exercise.primaryMuscle || "",
          score: (exercise as any).score || 5.0,
          isShared: sel.isShared,
          sharedWith: sel.sharedWithClients,
        };

        // For now, treat all as selected (not pre-assigned)
        clientSelection.selected.push(exerciseData);
      }

      exerciseSelection.clientSelections[clientId] = clientSelection;
    }

    // Rebuild shared exercises list
    const sharedExerciseMap = new Map<string, Set<string>>();
    for (const [clientId, selections] of Object.entries(selectionsByClient)) {
      for (const sel of selections) {
        if (sel.isShared && sel.sharedWithClients) {
          if (!sharedExerciseMap.has(sel.exerciseId)) {
            sharedExerciseMap.set(sel.exerciseId, new Set());
          }
          sel.sharedWithClients.forEach((id: string) =>
            sharedExerciseMap.get(sel.exerciseId)!.add(id),
          );
        }
      }
    }

    for (const [exerciseId, clientIds] of sharedExerciseMap) {
      const exercise = exercisePool.find((ex) => ex.id === exerciseId);
      if (exercise) {
        exerciseSelection.sharedExercises.push({
          exerciseId,
          exerciseName: exercise.name,
          clientIds: Array.from(clientIds),
          averageScore: (exercise as any).score || 5.0,
        });
      }
    }

    // Phase 2 has been removed and needs to be reimplemented
    throw new Error(
      "Phase 2 round organization has been removed and is being reimplemented. " +
      "Please use the new Phase 2 implementation once available."
    );
  }

  /**
   * Create circuit exercise records
   */
  private async createCircuitExerciseRecords(
    tx: any,
    clientWorkouts: Map<string, string>,
    generationResult: any,
    groupContext: GroupContext,
    exercisePool: Exercise[],
  ) {
    const allExercises: any[] = [];
    const { llmAssignments, metadata } = generationResult;
    
    // Check if repeat is enabled
    const repeatRounds = metadata?.circuitConfig?.config?.repeatRounds || 
                        metadata?.circuitConfig?.repeatRounds || 
                        false;
    
    logger.info("createCircuitExerciseRecords - checking data structure", {
      hasLlmAssignments: !!llmAssignments,
      llmAssignmentsKeys: llmAssignments ? Object.keys(llmAssignments) : [],
      hasCircuitKey: !!llmAssignments?.circuit,
      hasRoundsKey: !!llmAssignments?.circuit?.rounds,
      roundsCount: llmAssignments?.circuit?.rounds?.length || 0,
      repeatRounds,
    });
    
    // Circuit workouts have rounds with exercises
    const circuitRounds = llmAssignments?.circuit?.rounds || [];
    
    if (circuitRounds.length === 0) {
      logger.warn("No circuit rounds found in LLM assignments");
    }
    
    // Create exercise records for each client
    for (const client of groupContext.clients) {
      const workoutId = clientWorkouts.get(client.user_id);
      if (!workoutId) continue;
      
      let globalIndex = 1;
      
      // If repeat is enabled, we'll process rounds twice
      const iterations = repeatRounds ? 2 : 1;
      
      for (let iteration = 0; iteration < iterations; iteration++) {
        // Process each round
        circuitRounds.forEach((round: any) => {
          const roundNumber = round.round;
          const displayRoundNumber = repeatRounds && iteration === 1 
            ? roundNumber + circuitRounds.length 
            : roundNumber;
          
          // Process each exercise in the round
          round.exercises.forEach((circuitEx: any) => {
            const exercise = exercisePool.find(
              (ex: Exercise) => ex.name === circuitEx.name,
            );
            
            if (exercise) {
              allExercises.push({
                workoutId: workoutId,
                exerciseId: exercise.id,
                orderIndex: globalIndex++,
                setsCompleted: 0,
                groupName: `Round ${displayRoundNumber}`,
                // Circuit MVP: Only mark as shared if multiple clients
                isShared: groupContext.clients.length > 1,
                sharedWithClients: groupContext.clients.length > 1 
                  ? groupContext.clients
                      .filter(c => c.user_id !== client.user_id)
                      .map(c => c.user_id)
                  : [],
                template: "circuit",
                // Store additional circuit metadata
                metadata: {
                  round: displayRoundNumber,
                  position: circuitEx.position,
                  movementPattern: circuitEx.movementPattern,
                  transitionNote: circuitEx.transitionNote,
                  isRepeat: iteration > 0,
                  originalRound: roundNumber,
                }
              });
            } else {
              // Try normalized name matching as fallback
              const normalizedInputName = circuitEx.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              const fallbackExercise = exercisePool.find(
                (ex: Exercise) => {
                  const normalizedPoolName = ex.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                  // Also check if the input is a substring of the pool name (e.g., "Romanian Deadlift" matches "Romanian Deadlift (RDL)")
                  return normalizedPoolName === normalizedInputName || 
                         normalizedPoolName.includes(normalizedInputName) ||
                         normalizedInputName.includes(normalizedPoolName);
                }
              );
              
              if (fallbackExercise) {
                logger.info("Found exercise using normalized name matching", {
                  original: circuitEx.name,
                  normalized: normalizedInputName,
                  found: fallbackExercise.name
                });
                
                allExercises.push({
                  workoutId: workoutId,
                  exerciseId: fallbackExercise.id,
                  orderIndex: globalIndex++,
                  setsCompleted: 0,
                  groupName: `Round ${displayRoundNumber}`,
                  isShared: groupContext.clients.length > 1,
                  sharedWithClients: groupContext.clients.length > 1 
                    ? groupContext.clients
                        .filter(c => c.user_id !== client.user_id)
                        .map(c => c.user_id)
                    : [],
                  template: "circuit",
                  metadata: {
                    round: displayRoundNumber,
                    position: circuitEx.position,
                    movementPattern: circuitEx.movementPattern || fallbackExercise.movementPattern,
                    transitionNote: circuitEx.transitionNote,
                    isRepeat: iteration > 0,
                    originalRound: roundNumber,
                  }
                });
              } else {
                logger.warn("Exercise not found even with normalized matching", {
                  name: circuitEx.name,
                  normalized: normalizedInputName,
                  round: displayRoundNumber,
                  availableExercises: exercisePool.slice(0, 5).map(ex => ex.name)
                });
              }
            }
          });
        });
      }
    }
    
    return allExercises;
  }

  /**
   * Format existing workout exercises as LLM result for Phase 1 visualization
   */
  private async formatExistingExercisesAsLLMResult(
    existingWorkouts: any[],
    blueprint: AnyGroupWorkoutBlueprint,
    groupContext: GroupContext,
    clientContexts: ClientContext[],
  ): Promise<any> {
    console.log('[WorkoutGenerationService.formatExistingExercisesAsLLMResult] 🎭 Creating MOCK LLM result');
    console.log('[WorkoutGenerationService.formatExistingExercisesAsLLMResult] Existing workouts:', existingWorkouts.length);
    console.log('[WorkoutGenerationService.formatExistingExercisesAsLLMResult] Total exercises:', 
      existingWorkouts.reduce((sum, w) => sum + (w.exercises?.length || 0), 0)
    );
    
    logger.info("Formatting existing exercises as LLM result");

    // For standard blueprints, format the exercise selection
    if ("clientExercisePools" in blueprint) {
      const exerciseSelection: any = {
        selectedExercises: {},
        llmTimings: {},
      };

      // Group exercises by client
      for (const workout of existingWorkouts) {
        const clientId = workout.userId;
        const client = clientContexts.find(c => c.user_id === clientId);
        if (!client) continue;

        exerciseSelection.selectedExercises[clientId] = workout.exercises.map((we: any) => ({
          exercise: {
            id: we.exercise.id,
            name: we.exercise.name,
            equipment: we.exercise.equipment,
            movementPattern: we.exercise.movementPattern,
            primaryMuscle: we.exercise.primaryMuscle,
            secondaryMuscles: we.exercise.secondaryMuscles,
            modality: we.exercise.modality,
            functionTags: we.exercise.functionTags,
          },
          source: we.selectionSource || "existing",
          round: we.groupName || "Block A",
          template: we.template,
          reasoning: we.reasoning || "Loaded from existing workout",
          orderIndex: we.orderIndex,
        }));

        // Add mock timing data
        exerciseSelection.llmTimings[clientId] = {
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          durationMs: 0,
          fromCache: true,
        };
      }

      const result = {
        systemPrompt: "Loaded from existing workout exercises",
        userMessage: "Loaded from existing workout exercises",
        llmOutput: "Loaded from existing workout exercises",
        exerciseSelection,
        metadata: {
          loadedFromExisting: true,
          workoutCount: existingWorkouts.length,
          message: "Skipped Phase 1 LLM call - using existing workout exercises",
        },
        // Add empty debug structure to match real LLM result
        debug: {
          systemPromptsByClient: {},
          llmResponsesByClient: {}
        }
      };
      
      console.log('[WorkoutGenerationService.formatExistingExercisesAsLLMResult] ✅ Mock result created:', {
        hasSystemPrompt: !!result.systemPrompt,
        hasLlmOutput: !!result.llmOutput,
        hasExerciseSelection: !!result.exerciseSelection,
        hasDebug: !!result.debug,
        debugKeys: Object.keys(result.debug),
        selectedExerciseClients: Object.keys(exerciseSelection.selectedExercises)
      });
      
      return result;
    }

    // For BMF blueprints, return a simpler structure
    return {
      systemPrompt: "Loaded from existing workout exercises",
      userMessage: "Loaded from existing workout exercises",
      llmOutput: "Loaded from existing workout exercises",
      deterministicAssignments: null,
      llmAssignments: null,
      metadata: {
        loadedFromExisting: true,
        workoutCount: existingWorkouts.length,
      },
    };
  }
}
