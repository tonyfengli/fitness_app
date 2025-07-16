import type { ScoredExercise } from "../../types/scoredExercise";
import type { TemplateHandler, OrganizedExercises } from "./types";
import type { PenalizedExercise, BlockConfig, MuscleConstraints } from "./types/blockConfig";
import { BLOCK_CONFIGS } from "./types/blockConfig";
import { DeterministicSelection, RandomizedSelection } from "./strategies/SelectionStrategy";
import type { SelectionStrategy } from "./strategies/SelectionStrategy";
import { BlockDebugger, logBlock, logBlockTransformation } from "../../utils/blockDebugger";
import type { DynamicOrganizedExercises, WorkoutTemplate, DynamicBlockDefinition } from "./types/dynamicBlockTypes";
import { BlockAdapter } from "./adapters/BlockAdapter";
import { getDefaultWorkoutTemplate, FULL_BODY_TEMPLATE } from "./config/defaultTemplates";
import { selectWorkoutTemplate  } from "./config/templateSelector";
import type {TemplateSelectionCriteria} from "./config/templateSelector";

export class WorkoutTemplateHandler implements TemplateHandler {
  private isFullBody: boolean;
  private templateCriteria: TemplateSelectionCriteria;
  private deterministic = new DeterministicSelection();
  private randomized = new RandomizedSelection();
  private enableDebug: boolean;

  constructor(isFullBody = false, templateCriteria?: TemplateSelectionCriteria, enableDebug = false) {
    this.isFullBody = isFullBody;
    this.templateCriteria = templateCriteria || { isFullBody };
    this.enableDebug = enableDebug;
  }

  
  private getBlockConfigs() {
    // Add muscle constraints if in full body mode
    if (!this.isFullBody) {
      return BLOCK_CONFIGS;
    }
    
    // Create configs with muscle constraints for full body
    const muscleConstraints: MuscleConstraints = {
      minLowerBody: 2,
      minUpperBody: 2,
    };
    
    return {
      A: {
        ...BLOCK_CONFIGS.A,
        constraints: {
          ...BLOCK_CONFIGS.A.constraints,
          muscles: muscleConstraints,
        },
      },
      B: {
        ...BLOCK_CONFIGS.B,
        constraints: {
          ...BLOCK_CONFIGS.B.constraints,
          muscles: muscleConstraints,
        },
      },
      C: {
        ...BLOCK_CONFIGS.C,
        constraints: {
          ...BLOCK_CONFIGS.C.constraints,
          muscles: muscleConstraints,
        },
      },
      D: BLOCK_CONFIGS.D, // Block D doesn't use muscle constraints
    };
  }
  
  private selectExercisesForBlock(
    exercises: ScoredExercise[],
    config: BlockConfig,
    previousSelections: Set<string>
  ): ScoredExercise[] {
    logBlock(`selectExercisesForBlock - ${config.name} Start`, {
      blockName: config.name,
      functionTag: config.functionTag,
      maxExercises: config.maxExercises,
      previousSelectionsCount: previousSelections.size,
      totalExercisesProvided: exercises.length
    });
    
    // Prepare candidates
    const candidates = this.prepareCandidates(exercises, config, previousSelections);
    
    logBlock(`Candidates Prepared - ${config.name}`, {
      candidatesCount: candidates.length,
      penaltiesApplied: candidates.filter(c => 'appliedPenalty' in c && (c as any).appliedPenalty > 0).length,
      topCandidates: candidates.slice(0, 5).map(c => ({ 
        name: c.name, 
        score: c.score,
        originalScore: 'originalScore' in c ? (c as any).originalScore : c.score,
        penalty: 'appliedPenalty' in c ? (c as any).appliedPenalty : 0
      }))
    });
    
    if (candidates.length === 0) {
      console.log(`⚠️ No candidates found for ${config.name}`);
      logBlock(`No Candidates - ${config.name}`, { reason: 'No exercises with required function tags' });
      return [];
    }
    
    // Select strategy
    const strategy = this.getSelectionStrategy(config);
    logBlock(`Strategy Selected - ${config.name}`, {
      strategyType: config.selectionStrategy,
      constraints: config.constraints
    });
    
    // Apply strategy
    const selected = strategy.select(candidates, config, this.isFullBody, this.enableDebug);
    
    logBlockTransformation(`Strategy Application - ${config.name}`,
      { candidatesIn: candidates.length, strategy: config.selectionStrategy },
      { selectedOut: selected.length, exercises: selected.map(e => ({ name: e.name, score: e.score })) }
    );
    
    // Safety check
    if (selected.length > config.maxExercises) {
      console.warn(
        `⚠️ WARNING: Selected ${selected.length} exercises for ${config.name}, ` +
        `limiting to ${config.maxExercises}`
      );
      const limited = selected.slice(0, config.maxExercises);
      logBlock(`Safety Limit Applied - ${config.name}`, {
        selectedCount: selected.length,
        limitedTo: config.maxExercises,
        removed: selected.slice(config.maxExercises).map(e => e.name)
      });
      return limited;
    }
    
    console.log(`📌 Final selection for ${config.name}: ${selected.length} exercises`);
    selected.forEach((ex, idx) => {
      console.log(`   ${idx + 1}. ${ex.name} (${ex.score})`);
    });
    
    return selected;
  }
  
  private prepareCandidates(
    exercises: ScoredExercise[],
    config: BlockConfig,
    previousSelections: Set<string>
  ): PenalizedExercise[] {
    // Filter by function tag(s)
    let candidates: PenalizedExercise[];
    
    if (config.functionTag === 'core_capacity') {
      // Special handling for Block D
      candidates = exercises.filter(exercise => 
        exercise.functionTags && 
        (exercise.functionTags.includes('core') || exercise.functionTags.includes('capacity'))
      );
    } else {
      // Regular function tag filtering
      candidates = exercises.filter(exercise => 
        exercise.functionTags?.includes(config.functionTag)
      );
    }
    
    // Apply penalties for previously selected exercises
    if (config.penaltyForReuse > 0 && previousSelections.size > 0) {
      candidates = candidates.map(exercise => {
        if (previousSelections.has(exercise.id)) {
          console.log(
            `📉 Applying -${config.penaltyForReuse} penalty to ${exercise.name} ` +
            `for ${config.name} (already selected in previous block)`
          );
          
          return {
            ...exercise,
            score: Math.max(0, exercise.score - config.penaltyForReuse),
            originalScore: exercise.score,
            appliedPenalty: config.penaltyForReuse,
          };
        }
        return exercise;
      });
    }
    
    return candidates;
  }
  
  private getSelectionStrategy(config: BlockConfig): SelectionStrategy {
    return config.selectionStrategy === 'deterministic' 
      ? this.deterministic 
      : this.randomized;
  }
  
  private logFinalSummary(
    blockACount: number,
    blockBCount: number,
    blockCCount: number,
    blockDCount: number
  ): void {
    console.log(`
🎯 Workout Template Summary:
   Block A (Primary Strength): ${blockACount} exercises
   Block B (Secondary Strength): ${blockBCount} exercises
   Block C (Accessory): ${blockCCount} exercises
   Block D (Core & Capacity): ${blockDCount} exercises
   Total: ${blockACount + blockBCount + blockCCount + blockDCount} exercises
   Mode: ${this.isFullBody ? 'Full Body' : 'Regular'}
    `);
  }
  
  private groupExercisesByFunctionTag(exercises: ScoredExercise[]): Record<string, number> {
    const groups: Record<string, number> = {};
    
    exercises.forEach(exercise => {
      if (exercise.functionTags) {
        exercise.functionTags.forEach(tag => {
          groups[tag] = (groups[tag] || 0) + 1;
        });
      }
    });
    
    return groups;
  }

  /**
   * New dynamic organization method - uses flexible block system internally
   */
  private organizeDynamic(exercises: ScoredExercise[]): DynamicOrganizedExercises {
    logBlock('WorkoutTemplateHandler.organizeDynamic - Start', {
      totalExercises: exercises.length,
      isFullBody: this.isFullBody
    });

    // Select appropriate template using criteria
    const template = selectWorkoutTemplate(this.templateCriteria);
    
    logBlock('Template Selected', {
      templateId: template.id,
      templateName: template.name,
      blockCount: template.blocks.length
    });

    // Process blocks according to template
    const blocks: Record<string, ScoredExercise[]> = {};
    const previousSelections = new Set<string>();

    for (const blockDef of template.blocks) {
      logBlock(`Processing Block ${blockDef.id}`, {
        blockName: blockDef.name,
        functionTags: blockDef.functionTags,
        maxExercises: blockDef.maxExercises
      });

      // Filter exercises by function tags
      const candidates = this.getCandidatesForBlock(exercises, blockDef, previousSelections);
      
      // Select strategy
      const strategy = blockDef.selectionStrategy === 'deterministic' 
        ? this.deterministic 
        : this.randomized;

      // Convert to old BlockConfig format for compatibility with existing strategies
      const blockConfig: BlockConfig = {
        name: blockDef.name,
        functionTag: blockDef.functionTags[0] || '', // Use first tag for now
        maxExercises: blockDef.maxExercises,
        constraints: blockDef.constraints || {
          movements: {
            requireSquatHinge: false,
            requirePush: false,
            requirePull: false,
            requireLunge: false
          }
        },
        selectionStrategy: blockDef.selectionStrategy,
        penaltyForReuse: blockDef.penaltyForReuse || 0
      };

      // Apply strategy
      const selected = strategy.select(candidates, blockConfig, this.isFullBody);
      blocks[blockDef.id] = selected;

      // Update previous selections for penalty application
      if (blockDef.penaltyForReuse && blockDef.penaltyForReuse > 0) {
        selected.forEach(ex => previousSelections.add(ex.id));
      }

      logBlock(`Block ${blockDef.id} Complete`, {
        candidatesCount: candidates.length,
        selectedCount: selected.length,
        exercises: selected.map(e => ({ name: e.name, score: e.score }))
      });
    }

    // Create dynamic result
    const result: DynamicOrganizedExercises = {
      blocks,
      metadata: {
        template,
        timestamp: new Date().toISOString(),
        totalExercises: Object.values(blocks).reduce((sum, block) => sum + block.length, 0)
      }
    };

    logBlock('WorkoutTemplateHandler.organizeDynamic - Complete', {
      totalBlocks: Object.keys(blocks).length,
      totalExercises: result.metadata.totalExercises,
      blockSummary: Object.entries(blocks).map(([id, exercises]) => ({
        blockId: id,
        count: exercises.length
      }))
    });

    return result;
  }

  /**
   * Get candidates for a dynamic block
   */
  private getCandidatesForBlock(
    exercises: ScoredExercise[],
    blockDef: DynamicBlockDefinition,
    previousSelections: Set<string>
  ): PenalizedExercise[] {
    // Filter by function tags
    let candidates = exercises.filter(exercise => {
      if (!exercise.functionTags) return false;
      
      // Check if exercise has any of the required function tags
      return blockDef.functionTags.some(tag => 
        exercise.functionTags!.includes(tag)
      );
    });

    // Apply penalties for previously selected exercises
    if (blockDef.penaltyForReuse && blockDef.penaltyForReuse > 0 && previousSelections.size > 0) {
      candidates = candidates.map(exercise => {
        if (previousSelections.has(exercise.id)) {
          logBlock(`Applying penalty to ${exercise.name}`, {
            blockId: blockDef.id,
            penalty: blockDef.penaltyForReuse,
            originalScore: exercise.score
          });
          
          return {
            ...exercise,
            score: Math.max(0, exercise.score - blockDef.penaltyForReuse!),
            originalScore: exercise.score,
            appliedPenalty: blockDef.penaltyForReuse!
          };
        }
        return exercise;
      });
    }

    return candidates;
  }

  /**
   * Public organize method - now uses dynamic system internally
   * but returns legacy format for backward compatibility
   */
  organize(exercises: ScoredExercise[]): OrganizedExercises {
    console.log('🏗️ WorkoutTemplateHandler organizing exercises into blocks');
    
    // Log input state
    logBlock('WorkoutTemplateHandler.organize - Input', {
      totalExercises: exercises.length,
      isFullBody: this.isFullBody,
      exercisesByFunctionTag: this.groupExercisesByFunctionTag(exercises)
    });

    // Use new dynamic system internally
    const dynamicResult = this.organizeDynamic(exercises);
    
    // Convert to legacy format for backward compatibility
    const legacyResult = BlockAdapter.toLegacyFormat(dynamicResult);
    
    // Validate final structure
    const validation = BlockDebugger.validateBlockStructure(legacyResult, ['blockA', 'blockB', 'blockC', 'blockD']);
    if (!validation.valid) {
      console.error('❌ Block structure validation failed:', validation.issues);
    }

    this.logFinalSummary(
      legacyResult.blockA.length,
      legacyResult.blockB.length,
      legacyResult.blockC.length,
      legacyResult.blockD.length
    );

    return legacyResult;
  }
}