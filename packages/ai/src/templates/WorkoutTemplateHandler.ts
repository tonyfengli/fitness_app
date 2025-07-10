import type { ScoredExercise } from "../types/scoredExercise";
import type { TemplateHandler, OrganizedExercises } from "./types";
import type { PenalizedExercise, BlockConfig, MuscleConstraints } from "./types/blockConfig";
import { BLOCK_CONFIGS } from "./types/blockConfig";
import { DeterministicSelection, RandomizedSelection } from "./strategies/SelectionStrategy";
import type { SelectionStrategy } from "./strategies/SelectionStrategy";

export class WorkoutTemplateHandler implements TemplateHandler {
  private isFullBody: boolean;
  private deterministic = new DeterministicSelection();
  private randomized = new RandomizedSelection();

  constructor(isFullBody = false) {
    this.isFullBody = isFullBody;
  }

  organize(exercises: ScoredExercise[]): OrganizedExercises {
    console.log('🏗️ WorkoutTemplateHandler organizing exercises into blocks');
    
    // Add muscle constraints to blocks if full body mode
    const configs = this.getBlockConfigs();
    
    // Get Block A selections
    const blockA = this.selectExercisesForBlock(exercises, configs.A, new Set());
    
    // Get Block B selections with penalties for Block A exercises
    const blockAIds = new Set(blockA.map(ex => ex.id));
    const blockB = this.selectExercisesForBlock(exercises, configs.B, blockAIds);
    
    // Get Block C selections with penalties for Block B exercises
    const blockBIds = new Set(blockB.map(ex => ex.id));
    const blockC = this.selectExercisesForBlock(exercises, configs.C, blockBIds);
    
    // Get Block D selections (no penalties)
    const blockD = this.selectExercisesForBlock(exercises, configs.D, new Set());
    
    this.logFinalSummary(blockA.length, blockB.length, blockC.length, blockD.length);
    
    return { blockA, blockB, blockC, blockD };
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
    // Prepare candidates
    const candidates = this.prepareCandidates(exercises, config, previousSelections);
    
    if (candidates.length === 0) {
      console.log(`⚠️ No candidates found for ${config.name}`);
      return [];
    }
    
    // Select strategy
    const strategy = this.getSelectionStrategy(config);
    
    // Apply strategy
    const selected = strategy.select(candidates, config, this.isFullBody);
    
    // Safety check
    if (selected.length > config.maxExercises) {
      console.warn(
        `⚠️ WARNING: Selected ${selected.length} exercises for ${config.name}, ` +
        `limiting to ${config.maxExercises}`
      );
      return selected.slice(0, config.maxExercises);
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
}