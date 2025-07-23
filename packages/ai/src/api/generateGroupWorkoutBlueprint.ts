import type { GroupContext } from "../types/groupContext";
import type { GroupWorkoutBlueprint } from "../types/groupBlueprint";
import type { ScoredExercise } from "../types/scoredExercise";
import type { Exercise } from "../types/exercise";
import { filterExercises } from "../core/filtering/filterExercises";
import { scoreAndSortExercises } from "../core/scoring/scoreExercises";
import { performGroupMergeScoring } from "../core/group-scoring/mergeScores";
import { GroupWorkoutTemplateHandler } from "../core/templates/GroupWorkoutTemplateHandler";
import { getWorkoutTemplate } from "../core/templates/config/defaultTemplates";

/**
 * Generates a group workout blueprint from pre-scored exercises
 * This is the main entry point for group workout generation
 */
export async function generateGroupWorkoutBlueprint(
  groupContext: GroupContext,
  exercises: Exercise[],
  preScoredExercises?: Map<string, ScoredExercise[]>
): Promise<GroupWorkoutBlueprint> {
  const startTime = Date.now();
  
  console.log('🎯 generateGroupWorkoutBlueprint called with:', {
    clientCount: groupContext.clients.length,
    exerciseCount: exercises.length,
    templateType: groupContext.templateType,
    usingPreScored: !!preScoredExercises,
    clientIds: groupContext.clients.map(c => c.user_id)
  });
  
  // Import logger for comprehensive error tracking
  let groupWorkoutTestDataLogger: any;
  try {
    const loggerModule = await import('../../../api/src/utils/groupWorkoutTestDataLogger');
    groupWorkoutTestDataLogger = loggerModule.groupWorkoutTestDataLogger;
  } catch (error) {
    console.warn('⚠️ Group workout test data logger not available:', error);
  }
  
  try {
    // Use provided exercises
    const exercisePool = exercises;
    
    // Phase 1 & 2: Filter and score for each client (in parallel)
    let clientScoredExercises = new Map<string, ScoredExercise[]>();
    const clientExercisesByBlock = new Map<string, { [blockId: string]: ScoredExercise[] }>();
    
    if (preScoredExercises) {
      // Use pre-scored exercises if provided
      console.log('✅ Using pre-scored exercises for', preScoredExercises.size, 'clients');
      clientScoredExercises = preScoredExercises;
      
      // Log exercise counts per client
      for (const [clientId, exercises] of preScoredExercises) {
        console.log(`  Client ${clientId}: ${exercises.length} exercises`);
      }
    } else {
      console.log('🔄 Processing exercises for each client...');
      
      // Process all clients in parallel
      const clientResults = await Promise.all(
        groupContext.clients.map(async (client) => {
          try {
            // Phase 1: Filter exercises for this client
            console.log(`  Filtering for client ${client.user_id}...`);
            const filtered = await filterExercises({
              exercises: exercisePool,
              clientContext: client,
              includeScoring: false
            }) as Exercise[];
            console.log(`  ✅ Client ${client.user_id}: ${filtered.length} exercises after filtering`);
            
            // Phase 2: Score exercises for this client
            const scored = await scoreAndSortExercises(filtered, {
              intensity: client.intensity,
              muscleTarget: client.muscle_target || [],
              muscleLessen: client.muscle_lessen || [],
              includeExercises: client.exercise_requests?.include
            }); // scoreBreakdown now always included
            console.log(`  ✅ Client ${client.user_id}: Scoring complete`);
            
            return { clientId: client.user_id, scored };
          } catch (error) {
            console.error(`❌ Error processing client ${client.user_id}:`, error);
            groupWorkoutTestDataLogger?.addError(
              groupContext.sessionId,
              `Phase 1/2 error for client ${client.user_id}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            throw error;
          }
        })
      );
      
      // Store results in maps
      for (const result of clientResults) {
        clientScoredExercises.set(result.clientId, result.scored);
      }
    }
    
    // Get template configuration
    const templateId = groupContext.templateType || 'workout';
    console.log(`📋 Loading template: ${templateId}`);
    const template = getWorkoutTemplate(templateId);
    
    if (!template) {
      const error = `Template ${templateId} not found`;
      console.error('❌', error);
      groupWorkoutTestDataLogger?.addError(groupContext.sessionId, error);
      throw new Error(error);
    }
    
    // Get block configs from the template
    const blockConfigs = template.blocks;
    console.log(`✅ Template loaded with ${blockConfigs.length} blocks`);
    
    // Organize exercises by block for Phase 2.5
    console.log('🔄 Organizing exercises by block...');
    for (const [clientId, exercises] of clientScoredExercises) {
      const byBlock: { [blockId: string]: ScoredExercise[] } = {};
      
      // Debug: Check first exercise's function tags
      if (exercises.length > 0) {
        const firstEx = exercises[0];
        if (firstEx) {
          console.log(`  Debug - First exercise for client ${clientId}:`, {
            name: firstEx.name,
            functionTags: firstEx.functionTags,
            hasFunctionTags: !!firstEx.functionTags,
            functionTagsType: typeof firstEx.functionTags
          });
        }
      }
      
      for (const block of blockConfigs) {
        console.log(`  Block ${block.id} requires tags:`, block.functionTags);
        if (block.movementPatternFilter) {
          console.log(`  Block ${block.id} movement pattern filter:`, block.movementPatternFilter);
        }
        
        // Filter exercises by block function tags AND movement patterns
        byBlock[block.id] = exercises.filter(ex => {
          // First check function tags
          if (!ex.functionTags || !Array.isArray(ex.functionTags)) {
            return false;
          }
          if (!block.functionTags.some(tag => ex.functionTags?.includes(tag))) {
            return false;
          }
          
          // Then check movement pattern filter if specified
          if (block.movementPatternFilter) {
            const { include, exclude } = block.movementPatternFilter;
            
            if (!ex.movementPattern) {
              return false; // No movement pattern = can't match filter
            }
            
            // If include list is specified, exercise must have one of these patterns
            if (include && include.length > 0) {
              if (!include.includes(ex.movementPattern)) {
                return false;
              }
            }
            
            // If exclude list is specified, exercise must not have any of these patterns
            if (exclude && exclude.length > 0) {
              if (exclude.includes(ex.movementPattern)) {
                return false;
              }
            }
          }
          
          return true;
        });
        
        console.log(`  Client ${clientId}, Block ${block.id}: ${byBlock[block.id]?.length || 0} exercises after all filters`);
      }
      
      clientExercisesByBlock.set(clientId, byBlock);
    }
    
    // Phase 2.5: Group merge scoring
    console.log('🔄 Starting Phase 2.5: Group merge scoring...');
    const phase25StartTime = Date.now();
    
    try {
      const updatedContext = performGroupMergeScoring(
        groupContext,
        blockConfigs,
        clientExercisesByBlock
      );
      
      const phase25Time = Date.now() - phase25StartTime;
      console.log(`✅ Phase 2.5 complete in ${phase25Time}ms`);
      
      // Log Phase 2.5 results
      if (updatedContext.groupExercisePools) {
        for (const [blockId, pool] of Object.entries(updatedContext.groupExercisePools)) {
          console.log(`  Block ${blockId}: ${pool.length} exercises in group pool`);
          
          // Log top shared exercises
          const topShared = pool
            .filter(ex => ex.clientsSharing.length > 1)
            .slice(0, 3);
          
          if (topShared.length > 0) {
            console.log(`    Top shared exercises:`);
            topShared.forEach(ex => {
              console.log(`      - ${ex.name}: shared by ${ex.clientsSharing.length} clients (score: ${ex.groupScore.toFixed(2)})`);
            });
          } else {
            console.log(`    ⚠️ No shared exercises in this block`);
            groupWorkoutTestDataLogger?.addWarning(
              groupContext.sessionId,
              `Block ${blockId}: No shared exercises available`
            );
          }
        }
      }
      
      groupWorkoutTestDataLogger?.updateTiming(groupContext.sessionId, 'phase2_5', phase25Time);
      groupWorkoutTestDataLogger?.logGroupExercisePools(
        groupContext.sessionId,
        updatedContext.groupExercisePools || {}
      );
      
      // Phase 4: Create blueprint
      console.log('🔄 Starting Phase B: Blueprint creation...');
      const phaseBStartTime = Date.now();
      
      const handler = new GroupWorkoutTemplateHandler(updatedContext, template);
      const blueprint = handler.createBlueprint(clientScoredExercises);
      
      const phaseBTime = Date.now() - phaseBStartTime;
      console.log(`✅ Phase B complete in ${phaseBTime}ms`);
      console.log(`📊 Blueprint created with ${blueprint.blocks.length} blocks`);
      
      // Log warnings if any
      if (blueprint.validationWarnings && blueprint.validationWarnings.length > 0) {
        console.warn('⚠️ Blueprint validation warnings:');
        blueprint.validationWarnings.forEach(warning => {
          console.warn(`  - ${warning}`);
          groupWorkoutTestDataLogger?.addWarning(groupContext.sessionId, warning);
        });
      }
      
      // Log Phase B data to test data logger
      if (groupWorkoutTestDataLogger && groupContext.sessionId) {
        // Create cohesion analysis data
        const cohesionAnalysis: any = {
          clientTargets: blueprint.clientCohesionTracking?.map(tracking => ({
            clientId: tracking.clientId,
            clientName: updatedContext.clients.find(c => c.user_id === tracking.clientId)?.name || tracking.clientId,
            cohesionRatio: tracking.cohesionRatio,
            totalExercisesNeeded: tracking.totalExercisesInWorkout,
            targetSharedExercises: tracking.targetSharedExercises
          })) || [],
          blockProgress: [],
          finalStatus: blueprint.clientCohesionTracking?.map(tracking => ({
            clientId: tracking.clientId,
            satisfied: tracking.satisfactionStatus === 'satisfied',
            actualSharedRatio: tracking.currentSharedSlots / tracking.totalExercisesInWorkout,
            targetSharedRatio: tracking.cohesionRatio
          })) || []
        };
        
        // Create slot allocation details
        const slotAllocationDetails = blueprint.blocks.map(block => ({
          blockId: block.blockId,
          blockConfig: {
            maxExercises: block.slots.total,
            functionTags: [], // Would need to get from block config
            constraints: {}
          },
          allocation: {
            totalSlots: block.slots.total,
            targetSharedSlots: block.slots.targetShared,
            actualSharedAvailable: block.slots.actualSharedAvailable,
            finalSharedSlots: block.slots.actualSharedAvailable,
            individualSlotsPerClient: block.slots.individualPerClient
          },
          candidateStats: {
            sharedCandidatesCount: block.sharedCandidates?.exercises?.length || 0,
            sharedCandidatesQuality: {
              excellent: 0,
              good: 0,
              acceptable: 0
            },
            individualCandidatesPerClient: {}
          },
          selectionStrategy: 'balanced'
        }));
        
        groupWorkoutTestDataLogger.logBlueprint(
          groupContext.sessionId,
          blueprint,
          cohesionAnalysis,
          slotAllocationDetails
        );
      }
      
      groupWorkoutTestDataLogger?.updateTiming(groupContext.sessionId, 'phaseB', phaseBTime);
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ Total group workout generation time: ${totalTime}ms`);
      
      return blueprint;
      
    } catch (phase25Error) {
      console.error('❌ Error in Phase 2.5:', phase25Error);
      groupWorkoutTestDataLogger?.addError(
        groupContext.sessionId,
        `Phase 2.5 error: ${phase25Error instanceof Error ? phase25Error.message : 'Unknown error'}`
      );
      throw phase25Error;
    }
    
  } catch (error) {
    console.error('❌ Fatal error in generateGroupWorkoutBlueprint:', error);
    
    // Log the error stack trace for debugging
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    // Try to save whatever data we have
    groupWorkoutTestDataLogger?.saveGroupWorkoutData(groupContext.sessionId).catch((saveError: any) => {
      console.error('Failed to save error data:', saveError);
    });
    
    throw error;
  }
}