import type { ScoredExercise } from "../../types/scoredExercise";
import type { TemplateHandler, OrganizedExercises } from "./types";
import type { PenalizedExercise, BlockConfig, MuscleConstraints } from "./types/blockConfig";
import { BLOCK_CONFIGS } from "./types/blockConfig";
import { DeterministicSelection, RandomizedSelection } from "./strategies/SelectionStrategy";
import type { SelectionStrategy } from "./strategies/SelectionStrategy";
import { BlockDebugger, logBlock, logBlockTransformation } from "../../utils/blockDebugger";

export class WorkoutTemplateHandler implements TemplateHandler {
  private isFullBody: boolean;
  private deterministic = new DeterministicSelection();
  private randomized = new RandomizedSelection();

  constructor(isFullBody = false) {
    this.isFullBody = isFullBody;
  }

  organize(exercises: ScoredExercise[]): OrganizedExercises {
    console.log('🏗️ WorkoutTemplateHandler organizing exercises into blocks');
    
    // Log input state
    logBlock('WorkoutTemplateHandler.organize - Input', {
      totalExercises: exercises.length,
      isFullBody: this.isFullBody,
      exercisesByFunctionTag: this.groupExercisesByFunctionTag(exercises)
    });
    
    // Add muscle constraints to blocks if full body mode
    const configs = this.getBlockConfigs();
    logBlock('Block Configurations', {
      blockA: { name: configs.A.name, maxExercises: configs.A.maxExercises },
      blockB: { name: configs.B.name, maxExercises: configs.B.maxExercises },
      blockC: { name: configs.C.name, maxExercises: configs.C.maxExercises },
      blockD: { name: configs.D.name, maxExercises: configs.D.maxExercises }
    });
    
    // Get Block A selections
    const blockA = this.selectExercisesForBlock(exercises, configs.A, new Set());
    logBlockTransformation('Block A Selection', 
      { candidateCount: exercises.filter(e => e.functionTags?.includes('primary_strength')).length },
      { selectedCount: blockA.length, exercises: blockA.map(e => ({ name: e.name, score: e.score })) }
    );
    
    // Get Block B selections with penalties for Block A exercises
    const blockAIds = new Set(blockA.map(ex => ex.id));
    const blockB = this.selectExercisesForBlock(exercises, configs.B, blockAIds);
    logBlockTransformation('Block B Selection',
      { candidateCount: exercises.filter(e => e.functionTags?.includes('secondary_strength')).length, penalizedFromBlockA: blockAIds.size },
      { selectedCount: blockB.length, exercises: blockB.map(e => ({ name: e.name, score: e.score })) }
    );
    
    // Get Block C selections with penalties for Block B exercises
    const blockBIds = new Set(blockB.map(ex => ex.id));
    const blockC = this.selectExercisesForBlock(exercises, configs.C, blockBIds);
    logBlockTransformation('Block C Selection',
      { candidateCount: exercises.filter(e => e.functionTags?.includes('accessory')).length, penalizedFromBlockB: blockBIds.size },
      { selectedCount: blockC.length, exercises: blockC.map(e => ({ name: e.name, score: e.score })) }
    );
    
    // Get Block D selections (no penalties)
    const blockD = this.selectExercisesForBlock(exercises, configs.D, new Set());
    logBlockTransformation('Block D Selection',
      { candidateCount: exercises.filter(e => e.functionTags?.includes('core') || e.functionTags?.includes('capacity')).length },
      { selectedCount: blockD.length, exercises: blockD.map(e => ({ name: e.name, score: e.score })) }
    );
    
    this.logFinalSummary(blockA.length, blockB.length, blockC.length, blockD.length);
    
    const result = { blockA, blockB, blockC, blockD };
    
    // Validate final structure
    const validation = BlockDebugger.validateBlockStructure(result, ['blockA', 'blockB', 'blockC', 'blockD']);
    if (!validation.valid) {
      console.error('❌ Block structure validation failed:', validation.issues);
    }
    
    logBlock('WorkoutTemplateHandler.organize - Final Output', {
      blockA: blockA.length,
      blockB: blockB.length,
      blockC: blockC.length,
      blockD: blockD.length,
      totalExercises: blockA.length + blockB.length + blockC.length + blockD.length
    });
    
    return result;
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
      penaltiesApplied: candidates.filter(c => 'appliedPenalty' in c && c.appliedPenalty > 0).length,
      topCandidates: candidates.slice(0, 5).map(c => ({ 
        name: c.name, 
        score: c.score,
        originalScore: 'originalScore' in c ? c.originalScore : c.score,
        penalty: 'appliedPenalty' in c ? c.appliedPenalty : 0
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
    const selected = strategy.select(candidates, config, this.isFullBody);
    
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
}