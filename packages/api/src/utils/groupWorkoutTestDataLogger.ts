import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from './logger';
import type { 
  GroupContext, 
  GroupScoredExercise, 
  GroupWorkoutBlueprint,
  ClientContext,
  GroupBlockBlueprint,
} from '@acme/ai';
import type { ScoredExercise, Exercise } from '@acme/ai';

const logger = createLogger('GroupWorkoutTestDataLogger');

/**
 * Essential exercise data for debugging
 */
interface EssentialExercise {
  id: string;
  name: string;
  score: number;
  // Key fields for debugging
  movementPattern?: string;
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  loadedJoints?: string[];
  functionTags?: string[];
  // Scoring adjustments
  scoreBreakdown?: {
    baseScore: number;
    muscleTargetBonus: number;
    muscleLessenPenalty: number;
    intensityAdjustment: number;
    includeBoost: number;
    foundationalBoost: number;
  };
}

/**
 * Essential group exercise data
 */
interface EssentialGroupExercise extends EssentialExercise {
  groupScore: number;
  clientsSharing: string[];
  clientScores: {
    clientId: string;
    clientName: string;
    individualScore: number;
  }[];
}

/**
 * Client preferences and filtering results
 */
interface ClientDebugData {
  clientId: string;
  clientName: string;
  preferences: {
    intensity: string;
    muscleTargets: string[];
    muscleLessens: string[];
    includeExercises: string[];
    avoidExercises: string[];
    avoidJoints: string[];
  };
  filtering: {
    totalExercises: number;
    afterStrengthFilter: number;
    afterSkillFilter: number;
    afterJointFilter: number;
    afterAvoidFilter: number;
    finalCount: number;
  };
  scoring: {
    topExercises: EssentialExercise[]; // Top 10
    includedExercises: EssentialExercise[];
    scoreDistribution: {
      range: string;
      count: number;
    }[];
  };
}

/**
 * Block-level debug data
 */
interface BlockDebugData {
  blockId: string;
  blockName: string;
  config: {
    functionTags: string[];
    maxExercises: number;
    movementPatternFilter?: {
      include?: string[];
      exclude?: string[];
    };
  };
  slots: {
    total: number;
    targetShared: number;
    actualSharedAvailable: number;
    individualPerClient: number;
  };
  sharedCandidates: {
    total: number;
    topExercises: EssentialGroupExercise[]; // Top 10
  };
  individualCandidates: {
    clientId: string;
    clientName: string;
    exerciseCount: number;
    allExercises: EssentialExercise[]; // All candidates for this client
  }[];
}

/**
 * Main logger class - splits data into focused files
 */
export class GroupWorkoutTestDataLogger {
  private enabled: boolean = true;
  private sessionData = new Map<string, any>();
  
  constructor() {
    this.enabled = process.env.NODE_ENV !== 'production';
  }
  
  async isEnabled(): Promise<boolean> {
    return this.enabled;
  }
  
  /**
   * Initialize a new session
   */
  initSession(sessionId: string, groupContext: GroupContext) {
    if (!this.enabled) return;
    
    this.sessionData.set(sessionId, {
      sessionId,
      timestamp: new Date().toISOString(),
      groupContext: this.extractGroupContext(groupContext),
      phases: {},
      timing: {},
      errors: [],
      warnings: []
    });
  }
  
  /**
   * Extract essential group context data
   */
  private extractGroupContext(context: GroupContext) {
    return {
      sessionId: context.sessionId,
      businessId: context.businessId,
      templateType: context.templateType,
      clients: context.clients.map(c => ({
        id: c.user_id,
        name: c.name,
        strengthCapacity: c.strength_capacity,
        skillCapacity: c.skill_capacity,
        intensity: c.intensity,
        primaryGoal: c.primary_goal
      }))
    };
  }
  
  /**
   * Log Phase 1 & 2: Individual client processing
   */
  logClientProcessing(
    sessionId: string,
    clientId: string,
    filtering: any,
    scoring: ScoredExercise[]
  ) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) return;
    
    const client = session.groupContext.clients.find((c: any) => c.id === clientId);
    if (!client) return;
    
    if (!session.phases.clients) {
      session.phases.clients = [];
    }
    
    // Extract essential exercise data
    const essentialExercises = scoring.map(ex => this.extractEssentialExercise(ex));
    
    session.phases.clients.push({
      clientId,
      clientName: client.name,
      preferences: {
        intensity: client.intensity,
        muscleTargets: filtering.muscleTarget || [],
        muscleLessens: filtering.muscleLessen || [],
        includeExercises: filtering.includeExercises || [],
        avoidExercises: filtering.avoidExercises || [],
        avoidJoints: filtering.avoidJoints || []
      },
      filtering: filtering.stats || {},
      scoring: {
        topExercises: essentialExercises.slice(0, 10),
        includedExercises: essentialExercises.filter(ex => 
          filtering.includeExercises?.includes(ex.name)
        ),
        scoreDistribution: this.calculateScoreDistribution(essentialExercises)
      }
    } as ClientDebugData);
  }
  
  /**
   * Extract essential exercise fields
   */
  private extractEssentialExercise(exercise: ScoredExercise): EssentialExercise {
    return {
      id: exercise.id,
      name: exercise.name,
      score: exercise.score,
      movementPattern: exercise.movementPattern,
      primaryMuscle: exercise.primaryMuscle,
      secondaryMuscles: exercise.secondaryMuscles,
      loadedJoints: exercise.loadedJoints,
      functionTags: exercise.functionTags,
      scoreBreakdown: exercise.scoreBreakdown
    };
  }
  
  /**
   * Log Phase 2.5: Group merge scoring (simplified)
   */
  logGroupExercisePools(
    sessionId: string,
    groupExercisePools: { [blockId: string]: GroupScoredExercise[] }
  ) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) return;
    
    if (!session.phases.groupPools) {
      session.phases.groupPools = {};
    }
    
    // Store simplified group exercise pools
    for (const [blockId, exercises] of Object.entries(groupExercisePools)) {
      session.phases.groupPools[blockId] = {
        total: exercises.length,
        sharedByAll: exercises.filter(ex => 
          ex.clientsSharing.length === session.groupContext.clients.length
        ).length,
        sharedBy2Plus: exercises.filter(ex => ex.clientsSharing.length >= 2).length,
        topShared: exercises
          .filter(ex => ex.clientsSharing.length >= 2)
          .slice(0, 10)
          .map(ex => this.extractEssentialGroupExercise(ex, session))
      };
    }
  }
  
  /**
   * Log Phase 3: Template organization and blueprint
   */
  logBlueprint(
    sessionId: string,
    blueprint: GroupWorkoutBlueprint,
    cohesionAnalysis: any, // Ignored - will be removed
    slotAllocationDetails: any[]
  ) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) return;
    
    session.phases.blueprint = {
      blocks: blueprint.blocks.map(block => this.extractBlockDebugData(block, session)),
      validationWarnings: blueprint.validationWarnings || []
    };
  }
  
  /**
   * Extract block debug data
   */
  private extractBlockDebugData(block: GroupBlockBlueprint, session: any): BlockDebugData {
    return {
      blockId: block.blockId,
      blockName: block.blockConfig.name,
      config: {
        functionTags: block.blockConfig.functionTags,
        maxExercises: block.blockConfig.maxExercises,
        movementPatternFilter: block.blockConfig.movementPatternFilter
      },
      slots: block.slots,
      sharedCandidates: {
        total: block.sharedCandidates.exercises.length,
        topExercises: block.sharedCandidates.exercises
          .slice(0, 10)
          .map(ex => this.extractEssentialGroupExercise(ex, session))
      },
      individualCandidates: Object.entries(block.individualCandidates).map(
        ([clientId, data]) => {
          const client = session.groupContext.clients.find((c: any) => c.id === clientId);
          return {
            clientId,
            clientName: client?.name || clientId,
            exerciseCount: data.exercises.length,
            allExercises: data.exercises.map(ex => this.extractEssentialExercise(ex)),
            totalFilteredCount: data.allFilteredExercises?.length || data.exercises.length
          };
        }
      )
    };
  }
  
  /**
   * Extract essential group exercise data
   */
  private extractEssentialGroupExercise(exercise: GroupScoredExercise, session: any): EssentialGroupExercise {
    return {
      ...this.extractEssentialExercise(exercise),
      groupScore: exercise.groupScore,
      clientsSharing: exercise.clientsSharing,
      clientScores: exercise.clientScores.map(cs => ({
        clientId: cs.clientId,
        clientName: session.groupContext.clients.find((c: any) => c.id === cs.clientId)?.name || cs.clientId,
        individualScore: cs.individualScore
      }))
    };
  }
  
  /**
   * Calculate score distribution
   */
  private calculateScoreDistribution(exercises: EssentialExercise[]) {
    const ranges = [
      { range: '0-2', count: 0 },
      { range: '2-4', count: 0 },
      { range: '4-6', count: 0 },
      { range: '6-8', count: 0 },
      { range: '8-10', count: 0 }
    ];
    
    exercises.forEach(ex => {
      if (ex.score < 2) ranges[0].count++;
      else if (ex.score < 4) ranges[1].count++;
      else if (ex.score < 6) ranges[2].count++;
      else if (ex.score < 8) ranges[3].count++;
      else ranges[4].count++;
    });
    
    return ranges.filter(r => r.count > 0);
  }
  
  /**
   * Add timing information
   */
  updateTiming(sessionId: string, phase: string, durationMs: number) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) return;
    
    session.timing[phase] = durationMs;
  }
  
  /**
   * Add warning
   */
  addWarning(sessionId: string, warning: string) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) return;
    
    session.warnings.push(warning);
  }
  
  /**
   * Add error
   */
  addError(sessionId: string, error: string) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) return;
    
    session.errors.push(error);
  }
  
  /**
   * Save session data to multiple focused files
   */
  async saveGroupWorkoutData(sessionId: string): Promise<void> {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) {
      logger.warn(`No session data found for ${sessionId}`);
      return;
    }
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseDir = path.join(process.cwd(), 'session-test-data', 'group-workouts', sessionId);
      
      // Create directory
      await fs.mkdir(baseDir, { recursive: true });
      
      // Save different aspects to separate files
      
      // 1. Overview file - quick summary
      await this.saveFile(
        path.join(baseDir, `1-overview.json`),
        {
          sessionId,
          timestamp: session.timestamp,
          templateType: session.groupContext.templateType,
          groupSize: session.groupContext.clients.length,
          clients: session.groupContext.clients.map((c: any) => ({
            id: c.id,
            name: c.name,
            capacity: `${c.strengthCapacity}/${c.skillCapacity}`
          })),
          timing: session.timing,
          warnings: session.warnings,
          errors: session.errors,
          summary: {
            totalBlocks: session.phases.blueprint?.blocks.length || 0,
            totalSharedExercises: session.phases.blueprint?.blocks.reduce((sum: number, b: any) => 
              sum + b.sharedCandidates.topExercises.length, 0
            ) || 0
          }
        }
      );
      
      // 2. Client processing data
      if (session.phases.clients) {
        await this.saveFile(
          path.join(baseDir, `2-clients.json`),
          session.phases.clients
        );
      }
      
      // 3. Group pools data
      if (session.phases.groupPools) {
        await this.saveFile(
          path.join(baseDir, `3-group-pools.json`),
          session.phases.groupPools
        );
      }
      
      // 4. Blueprint data
      if (session.phases.blueprint) {
        await this.saveFile(
          path.join(baseDir, `4-blueprint.json`),
          session.phases.blueprint
        );
      }
      
      // 5. Also save combined "latest" file for quick access
      const latestDir = path.join(process.cwd(), 'session-test-data', 'group-workouts');
      await this.saveFile(
        path.join(latestDir, 'latest.json'),
        {
          overview: {
            sessionId,
            timestamp: session.timestamp,
            templateType: session.groupContext.templateType,
            files: [
              `${sessionId}/1-overview.json`,
              `${sessionId}/2-clients.json`,
              `${sessionId}/3-group-pools.json`,
              `${sessionId}/4-blueprint.json`
            ]
          },
          quickView: {
            clients: session.groupContext.clients.map((c: any) => c.name),
            timing: session.timing,
            warnings: session.warnings.length,
            errors: session.errors.length
          }
        }
      );
      
      logger.info(`Group workout data saved to ${baseDir}`);
      
      // Clear session data from memory
      this.sessionData.delete(sessionId);
      
    } catch (error) {
      logger.error('Failed to save group workout data:', error);
    }
  }
  
  /**
   * Helper to save JSON file
   */
  private async saveFile(filepath: string, data: any) {
    await fs.writeFile(
      filepath,
      JSON.stringify(data, null, 2),
      'utf-8'
    );
  }
  
  // Legacy methods for compatibility (simplified implementations)
  
  logPhase1Client(sessionId: string, clientId: string, data: any) {
    // Map to new method
    this.logClientProcessing(sessionId, clientId, data.filters, data.scored || []);
  }
  
  logPhase2Client(sessionId: string, clientId: string, data: any) {
    // Already handled in logClientProcessing
  }
  
  buildStructuredBlockData(blueprint: GroupWorkoutBlueprint, session: any) {
    // Legacy method - not needed anymore
    return [];
  }
}

// Export singleton instance
export const groupWorkoutTestDataLogger = new GroupWorkoutTestDataLogger();