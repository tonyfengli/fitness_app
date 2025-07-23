import type { GroupContext } from "../types/groupContext";
import type { GroupWorkoutBlueprint } from "../types/groupBlueprint";
import type { ScoredExercise } from "../types/scoredExercise";
import type { Exercise } from "../types/exercise";
import { filterExercises } from "../core/filtering/filterExercises";
import { scoreAndSortExercises } from "../core/scoring/scoreExercises";
import { TemplateProcessor } from "../core/templates/TemplateProcessor";
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
    
    console.log(`✅ Template loaded with ${template.blocks.length} blocks`);
    
    // Phase 3: Create blueprint using new TemplateProcessor
    console.log('🔄 Starting Phase 3: Template organization...');
    const phase3StartTime = Date.now();
    
    try {
      const processor = new TemplateProcessor(template);
      const blueprint = processor.processForGroup(clientScoredExercises);
      
      const phase3Time = Date.now() - phase3StartTime;
      console.log(`✅ Phase 3 complete in ${phase3Time}ms`);
      console.log(`📊 Blueprint created with ${blueprint.blocks.length} blocks`);
      
      // Log warnings if any
      if (blueprint.validationWarnings && blueprint.validationWarnings.length > 0) {
        console.warn('⚠️ Blueprint validation warnings:');
        blueprint.validationWarnings.forEach(warning => {
          console.warn(`  - ${warning}`);
          groupWorkoutTestDataLogger?.addWarning(groupContext.sessionId, warning);
        });
      }
      
      // Log Phase 3 data to test data logger
      if (groupWorkoutTestDataLogger && groupContext.sessionId) {
        // Create slot allocation details
        const slotAllocationDetails = blueprint.blocks.map(block => ({
          blockId: block.blockId,
          blockConfig: {
            maxExercises: block.slots.total,
            functionTags: block.blockConfig.functionTags,
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
          null, // No cohesion analysis for now
          slotAllocationDetails
        );
      }
      
      groupWorkoutTestDataLogger?.updateTiming(groupContext.sessionId, 'phase3', phase3Time);
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ Total group workout generation time: ${totalTime}ms`);
      
      return blueprint;
      
    } catch (phase3Error) {
      console.error('❌ Error in Phase 3:', phase3Error);
      groupWorkoutTestDataLogger?.addError(
        groupContext.sessionId,
        `Phase 3 error: ${phase3Error instanceof Error ? phase3Error.message : 'Unknown error'}`
      );
      throw phase3Error;
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