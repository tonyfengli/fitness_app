import { db } from "@acme/db/client";
import { eq, and } from "@acme/db";
import { 
  TrainingSession, 
  UserTrainingSession, 
  WorkoutPreferences,
  Workout,
  WorkoutExercise,
  exercises,
  user as userTable
} from "@acme/db/schema";
import { 
  generateGroupWorkoutBlueprint,
  type GroupContext,
  type ClientContext,
  type GroupWorkoutBlueprint,
  type Exercise,
  createLLM,
  WorkoutPromptBuilder
} from "@acme/ai";
import { WorkoutBlueprintService } from "./workout-blueprint-service";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { groupWorkoutTestDataLogger } from "../utils/groupWorkoutTestDataLogger";
import { createLogger } from "../utils/logger";
import type { SessionUser } from "../types/auth";

const logger = createLogger("WorkoutGenerationService");

export interface GenerateBlueprintOptions {
  useCache?: boolean;
  includeDiagnostics?: boolean;
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
  constructor(private ctx: WorkoutGenerationContext) {}

  /**
   * Generate blueprint only - for visualization and testing
   */
  async generateBlueprint(sessionId: string, options?: GenerateBlueprintOptions) {
    const user = this.ctx.session?.user;
    
    logger.info("Starting blueprint generation", { sessionId, userId: user.id });

    // Get session details
    const session = await this.ctx.db.query.TrainingSession.findFirst({
      where: and(
        eq(TrainingSession.id, sessionId),
        eq(TrainingSession.businessId, user.businessId)
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
          eq(UserTrainingSession.status, 'checked_in')
        )
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
          .where(and(
            eq(WorkoutPreferences.userId, client.userId),
            eq(WorkoutPreferences.trainingSessionId, sessionId)
          ))
          .limit(1);
          
        return { ...client, preferences };
      })
    );

    // Use WorkoutBlueprintService to prepare clients and generate blueprint
    const { clientContexts, preScoredExercises, exercisePool, groupContext } = 
      await WorkoutBlueprintService.prepareClientsForBlueprint(
        sessionId,
        user.businessId,
        user.id
      );

    // Initialize test data logging if needed
    if (options?.includeDiagnostics) {
      groupWorkoutTestDataLogger.initSession(sessionId, groupContext);
    }

    // Generate blueprint
    const blueprint = await generateGroupWorkoutBlueprint(
      groupContext, 
      exercisePool,
      preScoredExercises
    );

    logger.info("Blueprint generated successfully", {
      sessionId,
      blockCount: blueprint.blocks.length,
      warnings: blueprint.validationWarnings
    });

    // Save test data if diagnostics enabled
    if (options?.includeDiagnostics) {
      await groupWorkoutTestDataLogger.saveGroupWorkoutData(sessionId);
    }

    return {
      groupContext,
      blueprint,
      summary: {
        totalClients: clientContexts.length,
        totalBlocks: blueprint.blocks.length,
        cohesionWarnings: blueprint.validationWarnings || [],
      },
    };
  }

  /**
   * Generate workouts using LLM based on blueprint
   */
  async generateWithLLM(
    blueprint: GroupWorkoutBlueprint, 
    groupContext: GroupContext, 
    exercisePool: Exercise[],
    sessionId: string
  ) {
    logger.info("Starting LLM generation", { 
      blockCount: blueprint.blocks.length,
      clientCount: groupContext.clients.length 
    });

    // For BMF template, handle deterministic assignments
    if (groupContext.templateType === 'full_body_bmf') {
      return this.generateBMFWorkouts(blueprint, groupContext, exercisePool, sessionId);
    }

    // For other templates, use standard LLM generation
    throw new Error("Non-BMF templates not yet implemented");
  }

  /**
   * BMF-specific workout generation with deterministic assignments
   */
  private async generateBMFWorkouts(
    blueprint: GroupWorkoutBlueprint, 
    groupContext: GroupContext,
    exercisePool: Exercise[],
    sessionId: string
  ) {
    const round1Block = blueprint.blocks.find(b => b.blockId === 'Round1');
    const round2Block = blueprint.blocks.find(b => b.blockId === 'Round2');
    const round3Block = blueprint.blocks.find(b => b.blockId === 'Round3');
    const round4Block = blueprint.blocks.find(b => b.blockId === 'FinalRound');

    // Deterministic assignments for R1 and R2
    const round1Assignments = this.getDeterministicAssignments(round1Block, groupContext.clients);
    const round2Assignments = this.getDeterministicAssignments(round2Block, groupContext.clients);

    // Handle client exercise requests for R3/R4
    const clientRequestAssignments = this.processClientRequests(
      groupContext.clients,
      round3Block,
      round4Block
    );

    // Build prompt for LLM
    const promptBuilder = new WorkoutPromptBuilder({
      workoutType: 'group',
      groupConfig: {
        clients: groupContext.clients,
        blueprint: blueprint.blocks,
        deterministicAssignments: {
          Round1: round1Assignments,
          Round2: round2Assignments,
          ...clientRequestAssignments
        },
        equipment: this.getDefaultEquipment(),
        templateType: 'full_body_bmf'
      }
    });

    const systemPrompt = promptBuilder.build();
    const userMessage = "Generate the group workout assignments for rounds 3 and 4.";

    // Call LLM
    const llm = createLLM();
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage)
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
        ...clientRequestAssignments
      },
      llmAssignments: parsedResponse,
      systemPrompt,
      userMessage,
      llmOutput
      // Removed exercisePool to avoid Date serialization issues
    };
  }

  /**
   * Create workout records in the database
   */
  async createWorkouts(
    sessionId: string,
    generationResult: any,
    groupContext: GroupContext,
    exercisePool: Exercise[]
  ) {
    const user = this.ctx.session?.user;
    
    logger.info("Creating workout records", { sessionId });

    return await this.ctx.db.transaction(async (tx) => {
      // Skip storing blueprint summary - not needed

      // Create workout records for each client
      const workoutValues = groupContext.clients.map(client => ({
        trainingSessionId: sessionId,
        userId: client.user_id,
        businessId: user.businessId,
        createdByTrainerId: user.id,
        notes: `BMF - ${new Date().toLocaleDateString()}`,
        workoutType: 'full_body_bmf',
        totalPlannedSets: 99,
        llmOutput: {
          systemPrompt: generationResult.systemPrompt,
          userMessage: generationResult.userMessage,
          rawResponse: generationResult.llmOutput,
          parsedResponse: generationResult.llmAssignments,
          llmModel: 'gpt-4o',
          timestamp: new Date().toISOString()
        },
        context: 'group' as const,
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
        exercisePool
      );

      await tx.insert(WorkoutExercise).values(allExercises);

      return createdWorkouts.map(w => w.id);
    });
  }

  /**
   * Main orchestration method - generates blueprint and creates workouts
   */
  async generateAndCreateWorkouts(sessionId: string, options?: GenerateAndCreateOptions) {
    logger.info("Starting full workout generation", { sessionId, options });

    try {
      // Step 1: Generate blueprint (including exercise pool)
      const user = this.ctx.session?.user;
      
      const blueprintData = await WorkoutBlueprintService.prepareClientsForBlueprint(
        sessionId,
        user.businessId,
        user.id
      );
      
      const { clientContexts, preScoredExercises, exercisePool, groupContext } = blueprintData;

      const blueprint = await generateGroupWorkoutBlueprint(
        groupContext, 
        exercisePool,
        preScoredExercises
      );

      if (options?.dryRun) {
        logger.info("Dry run completed", { sessionId });
        return { 
          success: true, 
          blueprint, 
          dryRun: true 
        };
      }

      // Step 2: Generate with LLM
      const generationResult = await this.generateWithLLM(
        blueprint,
        groupContext,
        exercisePool,
        sessionId
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
        workoutCount: workoutIds.length 
      });

      // Ensure we're not returning any Date objects or complex types
      const result: any = { 
        success: true, 
        workoutIds, 
        // Don't include the full blueprint in the response to avoid serialization issues
        blueprintSummary: {
          blockCount: blueprint.blocks.length,
          warnings: blueprint.validationWarnings || []
        }
      };

      // Include debug information if requested
      if (options?.includeDiagnostics && generationResult.systemPrompt) {
        result.debug = {
          systemPrompt: generationResult.systemPrompt,
          userMessage: generationResult.userMessage,
          llmOutput: generationResult.llmOutput
        };
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
    
    return clients.map(client => {
      const exercises = block.individualCandidates[client.user_id]?.exercises || [];
      const topExercise = exercises[0];
      
      if (!topExercise) return null;
      
      return {
        clientId: client.user_id,
        clientName: client.name,
        exercise: topExercise.name,
        equipment: this.getEquipmentFromExercise(topExercise.name),
        roundAssigned: block.blockId,
        reason: 'top_scoring'
      };
    }).filter(Boolean);
  }

  private processClientRequests(
    clients: ClientContext[], 
    round3Block: any, 
    round4Block: any
  ) {
    const assignments: any = {};
    const usedExercisesPerClient = new Map<string, Set<string>>();

    // Process each client's exercise requests
    clients.forEach(client => {
      const usedExercises = usedExercisesPerClient.get(client.user_id) || new Set();
      const requestedExercises = client.exercise_requests?.include || [];
      
      requestedExercises.forEach(requestedName => {
        if (usedExercises.has(requestedName.toLowerCase())) return;
        
        // Try to find in Round 3
        const r3Exercises = round3Block?.individualCandidates[client.user_id]?.exercises || [];
        const r3Match = r3Exercises.find((ex: any) => 
          ex.name.toLowerCase() === requestedName.toLowerCase()
        );
        
        if (r3Match) {
          if (!assignments.Round3) assignments.Round3 = [];
          assignments.Round3.push({
            clientId: client.user_id,
            clientName: client.name,
            exercise: r3Match.name,
            equipment: this.getEquipmentFromExercise(r3Match.name),
            roundAssigned: 'Round3',
            reason: 'client_request'
          });
          usedExercises.add(r3Match.name.toLowerCase());
          return;
        }
        
        // Try Round 4
        const r4Exercises = round4Block?.individualCandidates[client.user_id]?.exercises || [];
        const r4Match = r4Exercises.find((ex: any) => 
          ex.name.toLowerCase() === requestedName.toLowerCase()
        );
        
        if (r4Match) {
          if (!assignments.FinalRound) assignments.FinalRound = [];
          assignments.FinalRound.push({
            clientId: client.user_id,
            clientName: client.name,
            exercise: r4Match.name,
            equipment: this.getEquipmentFromExercise(r4Match.name),
            roundAssigned: 'FinalRound',
            reason: 'client_request'
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
    exercisePool: Exercise[]
  ) {
    const allExercises = [];
    const { deterministicAssignments, llmAssignments } = generationResult;
    
    for (const client of groupContext.clients) {
      const workoutId = clientWorkouts.get(client.user_id);
      if (!workoutId) continue;
      
      const clientExercises = [];
      
      // Round 1 - Deterministic
      const r1Assignment = deterministicAssignments.Round1?.find((a: any) => a.clientId === client.user_id);
      if (r1Assignment) {
        const r1Exercise = exercisePool.find((ex: Exercise) => ex.name === r1Assignment.exercise);
        if (r1Exercise) {
          clientExercises.push({
            workoutId: workoutId,
            exerciseId: r1Exercise.id,
            orderIndex: 1,
            setsCompleted: 99,
            groupName: 'Round 1',
          });
        }
      }
      
      // Round 2 - Deterministic
      const r2Assignment = deterministicAssignments.Round2?.find((a: any) => a.clientId === client.user_id);
      if (r2Assignment) {
        const r2Exercise = exercisePool.find((ex: Exercise) => ex.name === r2Assignment.exercise);
        if (r2Exercise) {
          clientExercises.push({
            workoutId: workoutId,
            exerciseId: r2Exercise.id,
            orderIndex: 2,
            setsCompleted: 99,
            groupName: 'Round 2',
          });
        }
      }
      
      // Round 3 - Merge pre-assigned and LLM-assigned
      const clientR3Exercises = new Set<string>();
      
      // First add pre-assigned R3 exercises
      if (deterministicAssignments.Round3) {
        const preAssigned = deterministicAssignments.Round3.filter((a: any) => a.clientId === client.user_id);
        for (const assignment of preAssigned) {
          const exercise = exercisePool.find((ex: Exercise) => ex.name === assignment.exercise);
          if (exercise) {
            clientExercises.push({
              workoutId: workoutId,
              exerciseId: exercise.id,
              orderIndex: 3,
              setsCompleted: 99,
              groupName: 'Round 3',
              notes: `Pre-assigned: ${assignment.reason}`,
            });
            clientR3Exercises.add(exercise.name.toLowerCase());
          }
        }
      }
      
      // Then add LLM-assigned R3 exercises (skip if already pre-assigned)
      if (llmAssignments?.round3?.exercises) {
        for (const exercise of llmAssignments.round3.exercises) {
          if (exercise.type === 'individual' && exercise.client === client.name) {
            if (!clientR3Exercises.has((exercise.exercise || '').toLowerCase())) {
              const dbExercise = exercisePool.find((ex: Exercise) => 
                ex.name.toLowerCase() === (exercise.exercise || '').toLowerCase()
              );
              
              if (dbExercise) {
                clientExercises.push({
                  workoutId: workoutId,
                  exerciseId: dbExercise.id,
                  orderIndex: 3,
                  setsCompleted: 99,
                  groupName: 'Round 3',
                });
              }
            }
          } else if (exercise.type === 'shared' && exercise.clients?.includes(client.name)) {
            if (!clientR3Exercises.has((exercise.name || '').toLowerCase())) {
              const dbExercise = exercisePool.find((ex: Exercise) => 
                ex.name.toLowerCase() === (exercise.name || '').toLowerCase()
              );
              
              if (dbExercise) {
                clientExercises.push({
                  workoutId: workoutId,
                  exerciseId: dbExercise.id,
                  orderIndex: 3,
                  setsCompleted: 99,
                  groupName: 'Round 3',
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
        const preAssigned = deterministicAssignments.FinalRound.filter((a: any) => a.clientId === client.user_id);
        for (const assignment of preAssigned) {
          const exercise = exercisePool.find((ex: Exercise) => ex.name === assignment.exercise);
          if (exercise) {
            clientExercises.push({
              workoutId: workoutId,
              exerciseId: exercise.id,
              orderIndex: 4,
              setsCompleted: 99,
              groupName: 'Round 4',
              notes: `Pre-assigned: ${assignment.reason}`,
            });
            clientR4Exercises.add(exercise.name.toLowerCase());
          }
        }
      }
      
      // Then add LLM-assigned R4 exercises (skip if already pre-assigned)
      if (llmAssignments?.round4?.exercises) {
        for (const exercise of llmAssignments.round4.exercises) {
          if (exercise.type === 'individual' && exercise.client === client.name) {
            if (!clientR4Exercises.has((exercise.exercise || '').toLowerCase())) {
              const dbExercise = exercisePool.find((ex: Exercise) => 
                ex.name.toLowerCase() === (exercise.exercise || '').toLowerCase()
              );
              
              if (dbExercise) {
                clientExercises.push({
                  workoutId: workoutId,
                  exerciseId: dbExercise.id,
                  orderIndex: 4,
                  setsCompleted: 99,
                  groupName: 'Round 4',
                });
              }
            }
          } else if (exercise.type === 'shared' && exercise.clients?.includes(client.name)) {
            if (!clientR4Exercises.has((exercise.name || '').toLowerCase())) {
              const dbExercise = exercisePool.find((ex: Exercise) => 
                ex.name.toLowerCase() === (exercise.name || '').toLowerCase()
              );
              
              if (dbExercise) {
                clientExercises.push({
                  workoutId: workoutId,
                  exerciseId: dbExercise.id,
                  orderIndex: 4,
                  setsCompleted: 99,
                  groupName: 'Round 4',
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
    if (exerciseName.toLowerCase().includes('dumbbell')) return ['dumbbells'];
    if (exerciseName.toLowerCase().includes('barbell')) return ['barbell'];
    if (exerciseName.toLowerCase().includes('cable')) return ['cable_machine'];
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
      dumbbells: "unlimited"
    };
  }
}