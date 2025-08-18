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
import { groupWorkoutTestDataLogger } from "../utils/groupWorkoutTestDataLogger";
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

    if (checkedInClients.length < 2) {
      throw new Error("Need at least 2 checked-in clients for group workout");
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

    // Initialize test data logging if needed
    if (options?.includeDiagnostics) {
      groupWorkoutTestDataLogger.initSession(sessionId, groupContext);
    }

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

    // Generate LLM workout assignments
    let llmResult = null;
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

      const generationResult = await this.generateWithLLM(
        blueprint,
        groupContext,
        exercisePool,
        sessionId,
        { phase1Only: options?.phase1Only },
      );

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

    // Save test data if diagnostics enabled
    if (options?.includeDiagnostics) {
      await groupWorkoutTestDataLogger.saveGroupWorkoutData(sessionId);
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

      // Otherwise, run both phases as normal
      const workoutPlan = await generator.generate(
        blueprint,
        groupContext,
        template,
        sessionId,
      );

      logger.info("Standard workout plan generated successfully", {
        sharedExercises: workoutPlan.exerciseSelection.sharedExercises.length,
        rounds: workoutPlan.roundOrganization.rounds.length,
      });

      // Return in format compatible with createWorkouts
      const result: any = {
        exerciseSelection: workoutPlan.exerciseSelection,
        roundOrganization: workoutPlan.roundOrganization,
        systemPrompt: "Two-phase generation - prompts in individual phases",
        userMessage: "Two-phase generation - see individual phases",
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

      const createdWorkouts = await tx
        .insert(Workout)
        .values(workoutRecords)
        .returning({ id: Workout.id, userId: Workout.userId });

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
        if (!workoutId) continue;

        // Process pre-assigned exercises
        for (const exercise of clientData.preAssigned || []) {
          const dbExercise = exercisePool.find(
            (e) =>
              e.id === exercise.exerciseId ||
              e.name.toLowerCase() === exercise.exerciseName.toLowerCase(),
          );

          if (dbExercise) {
            exerciseRecords.push({
              workoutId,
              exerciseId: dbExercise.id,
              orderIndex: TEMP_ORDER_INDEX,
              setsCompleted: 0,
              groupName: null,
              isShared: false,
              sharedWithClients: null,
              selectionSource: "pre_assigned",
            });
          }
        }

        // Process selected exercises
        for (const exercise of clientData.selected || []) {
          const dbExercise = exercisePool.find(
            (e) =>
              e.id === exercise.exerciseId ||
              e.name.toLowerCase() === exercise.exerciseName.toLowerCase(),
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
            });
          }
        }
      }

      // Also save shared exercises for each participating client
      for (const sharedExercise of exerciseSelection.sharedExercises || []) {
        const dbExercise = exercisePool.find(
          (e) =>
            e.id === sharedExercise.exerciseId ||
            e.name.toLowerCase() === sharedExercise.exerciseName.toLowerCase(),
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
              });
            }
          }
        }
      }

      // Batch insert exercise records
      if (exerciseRecords.length > 0) {
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

      // Create workout records for each client
      const workoutValues = groupContext.clients.map((client) => ({
        trainingSessionId: sessionId,
        userId: client.user_id,
        businessId: user.businessId,
        createdByTrainerId: user.id,
        notes: `BMF - ${new Date().toLocaleDateString()}`,
        workoutType: "full_body_bmf",
        totalPlannedSets: 99,
        llmOutput: {
          systemPrompt: generationResult.systemPrompt,
          userMessage: generationResult.userMessage,
          rawResponse: generationResult.llmOutput,
          parsedResponse: generationResult.llmAssignments,
          llmModel: "gpt-4o",
          timestamp: new Date().toISOString(),
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

      await tx.insert(WorkoutExercise).values(allExercises);

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
      // COMMENTED OUT FOR DEBUGGING - Skip saving to database
      // const workoutIds = await this.createWorkouts(
      //   sessionId,
      //   generationResult,
      //   groupContext,
      //   exercisePool
      // );
      const workoutIds: string[] = [];

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
    const allExercises = [];

    // Check if this is standard template result
    if (
      generationResult.exerciseSelection &&
      generationResult.roundOrganization
    ) {
      return this.createStandardExerciseRecords(
        tx,
        clientWorkouts,
        generationResult,
        groupContext,
        exercisePool,
      );
    }

    // BMF template processing
    const { deterministicAssignments, llmAssignments } = generationResult;

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
    const allExercises = [];
    const { exerciseSelection, roundOrganization } = generationResult;

    // Process each round
    for (const round of roundOrganization.rounds) {
      // Process each client's exercises in this round
      for (const client of groupContext.clients) {
        const workoutId = clientWorkouts.get(client.user_id);
        if (!workoutId) continue;

        const clientExercisesInRound = round.exercises[client.user_id] || [];

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
            allExercises.push({
              workoutId: workoutId,
              exerciseId: dbExercise.id,
              orderIndex: this.getRoundOrderIndex(round.id) + i,
              setsCompleted: exercise.sets || 3,
              groupName: round.name,
            });
          } else {
            logger.warn(`Exercise not found in pool: ${exercise.exerciseName}`);
          }
        }
      }
    }

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

    // Now run Phase 2 using StandardWorkoutGenerator
    const generator = new StandardWorkoutGenerator();

    try {
      // Use the private method through a workaround
      const roundOrganization = await (generator as any).organizeIntoRounds(
        exerciseSelection,
        template,
        groupContext,
      );

      logger.info("Phase 2 sequencing completed", {
        rounds: roundOrganization.rounds.length,
        totalDuration: roundOrganization.workoutSummary.totalDuration,
      });

      // Create workouts with the complete data
      const generationResult = {
        exerciseSelection,
        roundOrganization,
        systemPrompt: "Phase 2 only - see round organization",
        userMessage: "Organize exercises into rounds",
        llmOutput: JSON.stringify(roundOrganization),
      };

      const workoutIds = await this.createWorkouts(
        sessionId,
        generationResult,
        groupContext,
        exercisePool,
      );

      return {
        success: true,
        workoutIds,
        roundOrganization,
      };
    } catch (error) {
      logger.error("Error in Phase 2 sequencing:", error);
      throw new Error(
        `Phase 2 sequencing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
