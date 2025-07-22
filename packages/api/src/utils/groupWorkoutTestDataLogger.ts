import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from './logger';
import type { 
  GroupContext, 
  GroupScoredExercise, 
  GroupWorkoutBlueprint,
  ClientContext,
  GroupCohesionSettings,
  ClientGroupSettings,
  ClientCohesionTracking,
  GroupBlockBlueprint,
  SubGroupPossibility
} from '@acme/ai';
import type { ScoredExercise, Exercise } from '@acme/ai';

const logger = createLogger('GroupWorkoutTestDataLogger');

export interface GroupWorkoutTestData {
  sessionId: string;
  timestamp: string;
  groupSize: number;
  
  // Phase A: Individual Processing
  phaseA: {
    clients: ClientProcessingData[];
    timingMs: number;
  };
  
  // Phase 2.5: Group Merge Scoring
  phase2_5: {
    blockScoringData: BlockScoringData[];
    groupExercisePools: {
      [blockId: string]: GroupScoredExerciseData[];
    };
    timingMs: number;
  };
  
  // Phase B: Blueprint Generation
  phaseB: {
    blueprint: GroupWorkoutBlueprint;
    cohesionAnalysis: CohesionAnalysisData;
    slotAllocationDetails: SlotAllocationData[];
    timingMs: number;
    // NEW: Structured block data for easy querying
    blocks: StructuredBlockData[];
  };
  
  // Overall Summary
  summary: GroupWorkoutSummary;
  
  // Context and Settings
  groupContext: GroupContext;
  warnings?: string[];
  errors?: string[];
}

// NEW: Structured block data for efficient querying
interface StructuredBlockData {
  blockId: string;
  blockName: string;
  slotAllocation: {
    totalSlots: number;
    targetShared: number;
    availableShared: number;
    individualPerClient: number;
  };
  sharedExercises: {
    exerciseId: string;
    exerciseName: string;
    groupScore: number;
    cohesionBonus: number;
    clientsSharing: string[];
  }[];
  individualExercises: {
    [clientId: string]: {
      clientName: string;
      exercises: {
        exerciseId: string;
        exerciseName: string;
        individualScore: number;
        scoreBreakdown?: any;
        isSelected: boolean;
        rank: number; // Position in the list (1-based)
      }[];
      totalCount: number;
    };
  };
}

interface ClientProcessingData {
  clientId: string;
  clientName: string;
  preferences: {
    intensity: string;
    sessionGoal: string;
    muscleTargets: string[];
    muscleLessens: string[];
    includeExercises: string[];
    avoidExercises: string[];
    avoidJoints: string[];
  };
  
  // Phase 1 Results
  phase1: {
    totalExercises: number;
    filteredCount: number;
    excludedReasons: {
      strength: number;
      skill: number;
      jointRestrictions: number;
      avoidExercises: number;
    };
    timingMs: number;
  };
  
  // Phase 2 Results
  phase2: {
    scoredCount: number;
    scoreDistribution: {
      range: string; // e.g., "0-2", "2-4", etc.
      count: number;
    }[];
    topExercises: {
      id: string;
      name: string;
      score: number;
      scoreBreakdown?: {
        base: number;
        includeExerciseBoost: number;
        muscleTargetBonus: number;
        muscleLessenPenalty: number;
        intensityAdjustment: number;
      };
    }[];
    timingMs: number;
  };
}

interface BlockScoringData {
  blockId: string;
  blockName: string;
  
  // Input stats
  totalUniqueExercises: number;
  exercisesPerClient: {
    clientId: string;
    count: number;
  }[];
  
  // Overlap analysis
  overlapAnalysis: {
    sharedByAllClients: string[];
    sharedBy2Plus: string[];
    uniqueToOneClient: string[];
  };
  
  // Cohesion calculations
  cohesionBonuses: {
    exerciseId: string;
    exerciseName: string;
    clientsSharing: string[];
    averageScore: number;
    cohesionBonus: number;
    finalGroupScore: number;
  }[];
  
  // Quality metrics
  qualityMetrics: {
    highQualityShared: number; // exercises with 2+ clients and score > threshold
    mediumQualityShared: number;
    lowQualityShared: number;
  };
}

interface GroupScoredExerciseData extends GroupScoredExercise {
  // Additional debug data
  scoringDetails: {
    individualScores: {
      clientId: string;
      individualScore: number;
      hasExercise: boolean;
    }[];
    averageCalculation: string; // e.g., "(5.5 + 6.0) / 2 = 5.75"
    cohesionCalculation: string; // e.g., "(3 - 1) * 0.5 = 1.0"
  };
}

interface CohesionAnalysisData {
  clientTargets: {
    clientId: string;
    clientName: string;
    cohesionRatio: number;
    totalExercisesNeeded: number;
    targetSharedExercises: number;
  }[];
  
  blockProgress: {
    blockId: string;
    sharedExercisesAssigned: number;
    clientProgress: {
      clientId: string;
      sharedSoFar: number;
      remainingNeeded: number;
      status: 'on_track' | 'needs_more' | 'satisfied' | 'over';
    }[];
  }[];
  
  finalStatus: {
    clientId: string;
    satisfied: boolean;
    actualSharedRatio: number;
    targetSharedRatio: number;
  }[];
}

interface SlotAllocationData {
  blockId: string;
  blockConfig: {
    maxExercises: number;
    functionTags: string[];
    constraints?: any;
  };
  
  allocation: {
    totalSlots: number;
    targetSharedSlots: number;
    actualSharedAvailable: number;
    finalSharedSlots: number;
    individualSlotsPerClient: number;
  };
  
  candidateStats: {
    sharedCandidatesCount: number;
    sharedCandidatesQuality: {
      excellent: number; // 3+ clients
      good: number;      // 2 clients
    };
    individualCandidatesPerClient: {
      clientId: string;
      count: number;
    }[];
  };
  
  subGroupAnalysis: {
    possibleSubGroups: SubGroupPossibility[];
    equipmentGroups?: {
      equipment: string;
      clientIds: string[];
    }[];
  };
}

interface GroupWorkoutSummary {
  totalClients: number;
  templateType: string;
  
  // Phase metrics
  totalProcessingTimeMs: number;
  phaseBreakdown: {
    phase1_2_parallel: number;
    phase2_5_merge: number;
    phaseB_blueprint: number;
  };
  
  // Exercise metrics
  totalUniqueExercisesAcrossClients: number;
  sharedExerciseOpportunities: {
    sharedByAll: number;
    sharedBy75Percent: number;
    sharedBy50Percent: number;
  };
  
  // Cohesion metrics
  cohesionSatisfaction: {
    fullyMet: number;
    partiallyMet: number;
    notMet: number;
  };
  averageCohesionRatio: number;
  
  // Quality metrics
  blueprintQuality: {
    blocksWithSufficientShared: number;
    blocksWithInsufficientShared: number;
    averageSharedQuality: number; // 1-5 scale based on client overlap
  };
  
  // Warnings and issues
  warningCount: number;
  errorCount: number;
}

class GroupWorkoutTestDataLogger {
  private sessionData: Map<string, GroupWorkoutTestData> = new Map();
  private enabled: boolean = process.env.GROUP_WORKOUT_TEST_DATA_ENABLED === 'true' || true;
  
  enable() {
    this.enabled = true;
    logger.info('Group workout test data logging enabled');
  }
  
  disable() {
    this.enabled = false;
    logger.info('Group workout test data logging disabled');
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
  
  // Initialize a new group workout session
  initGroupSession(sessionId: string, groupContext: GroupContext): GroupWorkoutTestData {
    if (!this.enabled) return {} as GroupWorkoutTestData;
    
    const testData: GroupWorkoutTestData = {
      sessionId,
      timestamp: new Date().toISOString(),
      groupSize: groupContext.clients.length,
      
      phaseA: {
        clients: [],
        timingMs: 0
      },
      
      phase2_5: {
        blockScoringData: [],
        groupExercisePools: {},
        timingMs: 0
      },
      
      phaseB: {
        blueprint: {} as GroupWorkoutBlueprint,
        cohesionAnalysis: {
          clientTargets: [],
          blockProgress: [],
          finalStatus: []
        },
        slotAllocationDetails: [],
        timingMs: 0,
        blocks: []
      },
      
      summary: {
        totalClients: groupContext.clients.length,
        templateType: groupContext.templateType || 'standard',
        totalProcessingTimeMs: 0,
        phaseBreakdown: {
          phase1_2_parallel: 0,
          phase2_5_merge: 0,
          phaseB_blueprint: 0
        },
        totalUniqueExercisesAcrossClients: 0,
        sharedExerciseOpportunities: {
          sharedByAll: 0,
          sharedBy75Percent: 0,
          sharedBy50Percent: 0
        },
        cohesionSatisfaction: {
          fullyMet: 0,
          partiallyMet: 0,
          notMet: 0
        },
        averageCohesionRatio: 0,
        blueprintQuality: {
          blocksWithSufficientShared: 0,
          blocksWithInsufficientShared: 0,
          averageSharedQuality: 0
        },
        warningCount: 0,
        errorCount: 0
      },
      
      groupContext,
      warnings: [],
      errors: []
    };
    
    this.sessionData.set(sessionId, testData);
    logger.info('Initialized group workout test data', { sessionId, groupSize: groupContext.clients.length });
    
    return testData;
  }
  
  // Log Phase 1 & 2 results for a client
  logClientProcessing(
    sessionId: string, 
    clientId: string,
    clientName: string,
    preferences: any,
    phase1Results: any,
    phase2Results: any
  ) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) return;
    
    const clientData: ClientProcessingData = {
      clientId,
      clientName,
      preferences: {
        intensity: preferences.intensity || 'moderate',
        sessionGoal: preferences.sessionGoal || 'strength',
        muscleTargets: preferences.muscleTargets || [],
        muscleLessens: preferences.muscleLessens || [],
        includeExercises: preferences.includeExercises || [],
        avoidExercises: preferences.avoidExercises || [],
        avoidJoints: preferences.avoidJoints || []
      },
      phase1: {
        totalExercises: phase1Results.totalExercises || 0,
        filteredCount: phase1Results.filteredCount || 0,
        excludedReasons: phase1Results.excludedReasons || {
          strength: 0,
          skill: 0,
          jointRestrictions: 0,
          avoidExercises: 0
        },
        timingMs: phase1Results.timingMs || 0
      },
      phase2: {
        scoredCount: phase2Results.scoredCount || 0,
        scoreDistribution: phase2Results.scoreDistribution || [],
        topExercises: phase2Results.topExercises || [],
        timingMs: phase2Results.timingMs || 0
      }
    };
    
    session.phaseA.clients.push(clientData);
  }
  
  // Log Phase 2.5 block scoring data
  logBlockScoring(
    sessionId: string,
    scoringData: BlockScoringData
  ) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) return;
    
    session.phase2_5.blockScoringData.push(scoringData);
  }
  
  // Log Phase 2.5 group exercise pools
  logGroupExercisePools(
    sessionId: string,
    groupExercisePools: { [blockId: string]: GroupScoredExercise[] }
  ) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) return;
    
    // Convert to enhanced data with scoring details
    for (const [blockId, exercises] of Object.entries(groupExercisePools)) {
      session.phase2_5.groupExercisePools[blockId] = exercises.map(ex => ({
        ...ex,
        scoringDetails: {
          individualScores: ex.clientScores,
          averageCalculation: this.formatAverageCalculation(ex.clientScores),
          cohesionCalculation: `(${ex.clientsSharing.length} - 1) * 0.5 = ${ex.cohesionBonus}`
        }
      }));
    }
  }
  
  // Log Phase B blueprint and analysis
  logBlueprint(
    sessionId: string,
    blueprint: GroupWorkoutBlueprint,
    cohesionAnalysis: CohesionAnalysisData,
    slotAllocationDetails: SlotAllocationData[]
  ) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) return;
    
    session.phaseB.blueprint = blueprint;
    session.phaseB.cohesionAnalysis = cohesionAnalysis;
    session.phaseB.slotAllocationDetails = slotAllocationDetails;
    
    // NEW: Build structured block data
    session.phaseB.blocks = this.buildStructuredBlockData(blueprint, session);
  }
  
  // NEW: Build structured block data for easier querying
  private buildStructuredBlockData(
    blueprint: GroupWorkoutBlueprint, 
    session: GroupWorkoutTestData
  ): StructuredBlockData[] {
    const structuredBlocks: StructuredBlockData[] = [];
    
    // Get client name map
    const clientNameMap = new Map<string, string>();
    session.phaseA.clients.forEach(client => {
      clientNameMap.set(client.clientId, client.clientName);
    });
    
    for (const block of blueprint.blocks) {
      const structuredBlock: StructuredBlockData = {
        blockId: block.blockId,
        blockName: `Block ${block.blockId}`,
        slotAllocation: {
          totalSlots: block.slots.total,
          targetShared: block.slots.targetShared,
          availableShared: block.slots.actualSharedAvailable,
          individualPerClient: block.slots.individualPerClient
        },
        sharedExercises: [],
        individualExercises: {}
      };
      
      // Add shared exercises
      if (block.sharedCandidates?.exercises) {
        structuredBlock.sharedExercises = block.sharedCandidates.exercises.map((ex: any) => ({
          exerciseId: ex.id,
          exerciseName: ex.name,
          groupScore: ex.groupScore,
          cohesionBonus: ex.cohesionBonus,
          clientsSharing: ex.clientsSharing
        }));
      }
      
      // Add individual exercises for each client
      if (block.individualCandidates) {
        for (const [clientId, candidateData] of Object.entries(block.individualCandidates)) {
          structuredBlock.individualExercises[clientId] = {
            clientName: clientNameMap.get(clientId) || 'Unknown',
            exercises: candidateData.exercises.map((ex: any, index: number) => ({
              exerciseId: ex.id,
              exerciseName: ex.name,
              individualScore: ex.score,
              scoreBreakdown: ex.scoreBreakdown,
              isSelected: ex.isSelected || false,
              rank: index + 1
            })),
            totalCount: candidateData.exercises.length
          };
        }
      }
      
      structuredBlocks.push(structuredBlock);
    }
    
    return structuredBlocks;
  }
  
  // Update timing information
  updateTiming(sessionId: string, phase: string, timingMs: number) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) return;
    
    switch (phase) {
      case 'phase1_2':
        session.phaseA.timingMs = timingMs;
        session.summary.phaseBreakdown.phase1_2_parallel = timingMs;
        break;
      case 'phase2_5':
        session.phase2_5.timingMs = timingMs;
        session.summary.phaseBreakdown.phase2_5_merge = timingMs;
        break;
      case 'phaseB':
        session.phaseB.timingMs = timingMs;
        session.summary.phaseBreakdown.phaseB_blueprint = timingMs;
        break;
    }
    
    session.summary.totalProcessingTimeMs = 
      session.summary.phaseBreakdown.phase1_2_parallel +
      session.summary.phaseBreakdown.phase2_5_merge +
      session.summary.phaseBreakdown.phaseB_blueprint;
  }
  
  // Calculate and update summary statistics
  calculateSummaryStats(sessionId: string) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) return;
    
    // Calculate unique exercises across all clients
    const allExercises = new Set<string>();
    const exerciseClientMap = new Map<string, Set<string>>();
    
    for (const client of session.phaseA.clients) {
      for (const exercise of client.phase2.topExercises) {
        allExercises.add(exercise.id);
        if (!exerciseClientMap.has(exercise.id)) {
          exerciseClientMap.set(exercise.id, new Set());
        }
        exerciseClientMap.get(exercise.id)!.add(client.clientId);
      }
    }
    
    session.summary.totalUniqueExercisesAcrossClients = allExercises.size;
    
    // Calculate shared exercise opportunities
    const totalClients = session.groupSize;
    let sharedByAll = 0;
    let sharedBy75 = 0;
    let sharedBy50 = 0;
    
    for (const [_, clientSet] of exerciseClientMap) {
      const shareRatio = clientSet.size / totalClients;
      if (shareRatio === 1) sharedByAll++;
      if (shareRatio >= 0.75) sharedBy75++;
      if (shareRatio >= 0.5) sharedBy50++;
    }
    
    session.summary.sharedExerciseOpportunities = {
      sharedByAll,
      sharedBy75Percent: sharedBy75,
      sharedBy50Percent: sharedBy50
    };
    
    // Calculate cohesion satisfaction
    if (session.phaseB.cohesionAnalysis.finalStatus.length > 0) {
      let fullyMet = 0;
      let partiallyMet = 0;
      let notMet = 0;
      let totalRatio = 0;
      
      for (const status of session.phaseB.cohesionAnalysis.finalStatus) {
        totalRatio += status.actualSharedRatio;
        
        const satisfaction = status.actualSharedRatio / status.targetSharedRatio;
        if (satisfaction >= 0.95) fullyMet++;
        else if (satisfaction >= 0.7) partiallyMet++;
        else notMet++;
      }
      
      session.summary.cohesionSatisfaction = { fullyMet, partiallyMet, notMet };
      session.summary.averageCohesionRatio = totalRatio / session.phaseB.cohesionAnalysis.finalStatus.length;
    }
    
    // Calculate blueprint quality
    let sufficientBlocks = 0;
    let insufficientBlocks = 0;
    let totalQuality = 0;
    
    for (const block of session.phaseB.slotAllocationDetails) {
      const hasEnoughShared = block.allocation.finalSharedSlots >= block.allocation.targetSharedSlots * 0.8;
      if (hasEnoughShared) sufficientBlocks++;
      else insufficientBlocks++;
      
      // Quality score based on candidate availability
      const qualityScore = Math.min(5, 
        (block.candidateStats.sharedCandidatesQuality.excellent * 2 + 
         block.candidateStats.sharedCandidatesQuality.good) / 
        Math.max(1, block.allocation.targetSharedSlots)
      );
      totalQuality += qualityScore;
    }
    
    session.summary.blueprintQuality = {
      blocksWithSufficientShared: sufficientBlocks,
      blocksWithInsufficientShared: insufficientBlocks,
      averageSharedQuality: totalQuality / Math.max(1, session.phaseB.slotAllocationDetails.length)
    };
    
    // Update warning/error counts
    session.summary.warningCount = session.warnings?.length || 0;
    session.summary.errorCount = session.errors?.length || 0;
  }
  
  // Add warning
  addWarning(sessionId: string, warning: string) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) return;
    
    session.warnings = session.warnings || [];
    session.warnings.push(warning);
    session.summary.warningCount++;
  }
  
  // Add error
  addError(sessionId: string, error: string) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) return;
    
    session.errors = session.errors || [];
    session.errors.push(error);
    session.summary.errorCount++;
  }
  
  // Save session data to file
  async saveGroupWorkoutData(sessionId: string) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) {
      logger.warn('Group workout session not found for saving', { sessionId });
      return;
    }
    
    // Calculate final statistics
    this.calculateSummaryStats(sessionId);
    
    try {
      // Create directory if it doesn't exist
      const dirPath = path.join(process.cwd(), 'session-test-data', 'group-workouts');
      await fs.mkdir(dirPath, { recursive: true });
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `group_${sessionId}_${timestamp}.json`;
      const filepath = path.join(dirPath, filename);
      
      // Write the file
      await fs.writeFile(
        filepath,
        JSON.stringify(session, null, 2),
        'utf-8'
      );
      
      logger.info('Group workout test data saved', { 
        sessionId, 
        filepath,
        summary: session.summary 
      });
      
      // Also save a "latest" file for easy access
      const latestPath = path.join(dirPath, 'latest-group-workout.json');
      await fs.writeFile(
        latestPath,
        JSON.stringify(session, null, 2),
        'utf-8'
      );
      
      // Clear session data from memory
      this.sessionData.delete(sessionId);
      
    } catch (error) {
      logger.error('Failed to save group workout test data', { sessionId, error });
    }
  }
  
  // Helper to format average calculation string
  private formatAverageCalculation(clientScores: any[]): string {
    const scores = clientScores
      .filter(cs => cs.hasExercise)
      .map(cs => cs.individualScore);
    
    if (scores.length === 0) return "No scores";
    if (scores.length === 1) return `${scores[0]}`;
    
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = sum / scores.length;
    
    return `(${scores.join(' + ')}) / ${scores.length} = ${avg.toFixed(2)}`;
  }
  
  // Get current session data (for debugging)
  getGroupSessionData(sessionId: string): GroupWorkoutTestData | undefined {
    return this.sessionData.get(sessionId);
  }
  
  // Clear session data
  clearGroupSession(sessionId: string) {
    this.sessionData.delete(sessionId);
  }
}

export const groupWorkoutTestDataLogger = new GroupWorkoutTestDataLogger();