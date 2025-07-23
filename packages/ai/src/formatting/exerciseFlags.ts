import type { ScoredExercise } from "../types/scoredExercise";
import type { OrganizedExercises } from "../core/templates/types";
// DynamicOrganizedExercises removed - template organization simplified
import { BlockDebugger, logBlock, logBlockTransformation } from "../utils/blockDebugger";

export interface ExerciseWithUIFlags extends ScoredExercise {
  isSelected: boolean;
  isSelectedBlockA: boolean;
  isSelectedBlockB: boolean;
  isSelectedBlockC: boolean;
  isSelectedBlockD: boolean;
  blockBPenalty: number;
  blockCPenalty: number;
  // Dynamic block support
  selectedBlocks: string[];
  blockPenalties: Record<string, number>;
}

/**
 * Add presentation-specific flags to exercises for UI display (dynamic version)
 * Supports any block structure, not just A/B/C/D
 */
export function addPresentationFlagsDynamic(
  exercises: ScoredExercise[],
  organizedExercises: Record<string, ScoredExercise[]> | null
): ExerciseWithUIFlags[] {
  logBlock('addPresentationFlagsDynamic - Start', {
    totalExercises: exercises.length,
    hasOrganizedExercises: !!organizedExercises,
    blockCount: organizedExercises ? Object.keys(organizedExercises).length : 0
  });
  
  if (!organizedExercises) {
    // Return exercises with empty dynamic flags
    return exercises.map(exercise => ({
      ...exercise,
      isSelected: false,
      isSelectedBlockA: false,
      isSelectedBlockB: false,
      isSelectedBlockC: false,
      isSelectedBlockD: false,
      blockBPenalty: 0,
      blockCPenalty: 0,
      selectedBlocks: [],
      blockPenalties: {}
    }));
  }

  // Create a map of exercise ID to selected blocks
  const exerciseToBlocks = new Map<string, string[]>();
  const blockPenaltyMap = new Map<string, Map<string, number>>();
  
  // Process each block
  Object.entries(organizedExercises).forEach(([blockId, blockExercises]) => {
    blockExercises.forEach((exercise: ScoredExercise, index: number) => {
      const currentBlocks = exerciseToBlocks.get(exercise.id) || [];
      currentBlocks.push(blockId);
      exerciseToBlocks.set(exercise.id, currentBlocks);
      
      // Calculate penalties (if exercise appears in multiple blocks)
      if (currentBlocks.length > 1) {
        const penalties = blockPenaltyMap.get(exercise.id) || new Map();
        penalties.set(blockId, 2.0);
        blockPenaltyMap.set(exercise.id, penalties);
      }
    });
  });
  
  // Mark exercises with flags
  return exercises.map(exercise => {
    const selectedBlocks = exerciseToBlocks.get(exercise.id) || [];
    const penalties = blockPenaltyMap.get(exercise.id) || new Map();
    
    // For backward compatibility, set legacy flags
    const isSelectedBlockA = selectedBlocks.includes('A');
    const isSelectedBlockB = selectedBlocks.includes('B');
    const isSelectedBlockC = selectedBlocks.includes('C');
    const isSelectedBlockD = selectedBlocks.includes('D');
    
    return {
      ...exercise,
      isSelected: selectedBlocks.length > 0,
      isSelectedBlockA,
      isSelectedBlockB,
      isSelectedBlockC,
      isSelectedBlockD,
      blockBPenalty: isSelectedBlockA ? 2.0 : 0,
      blockCPenalty: isSelectedBlockB ? 2.0 : 0,
      selectedBlocks,
      blockPenalties: Object.fromEntries(penalties)
    };
  });
}

/**
 * Add presentation-specific flags to exercises for UI display (legacy version)
 * This keeps UI concerns separate from business logic
 */
export function addPresentationFlags(
  exercises: ScoredExercise[],
  organizedExercises: OrganizedExercises | null
): ExerciseWithUIFlags[] {
  logBlock('addPresentationFlags - Start', {
    totalExercises: exercises.length,
    hasOrganizedExercises: !!organizedExercises,
    organizedCounts: organizedExercises ? {
      blockA: organizedExercises.blockA.length,
      blockB: organizedExercises.blockB.length,
      blockC: organizedExercises.blockC.length,
      blockD: organizedExercises.blockD.length
    } : null
  });
  
  if (!organizedExercises) {
    logBlock('addPresentationFlags - No Template', {
      reason: 'No organized exercises provided',
      returningDefaultFlags: true
    });
    
    // If no template organization, return exercises without UI flags
    return exercises.map(exercise => ({
      ...exercise,
      isSelected: false,
      isSelectedBlockA: false,
      isSelectedBlockB: false,
      isSelectedBlockC: false,
      isSelectedBlockD: false,
      blockBPenalty: 0,
      blockCPenalty: 0,
      selectedBlocks: [],
      blockPenalties: {}
    }));
  }

  // Create sets of IDs for selected exercises in each block
  const selectedBlockA = new Set(organizedExercises.blockA.map(ex => ex.id));
  const selectedBlockB = new Set(organizedExercises.blockB.map(ex => ex.id));
  const selectedBlockC = new Set(organizedExercises.blockC.map(ex => ex.id));
  const selectedBlockD = new Set(organizedExercises.blockD.map(ex => ex.id));
  
  logBlock('Block ID Sets Created', {
    blockA: { count: selectedBlockA.size, ids: Array.from(selectedBlockA).slice(0, 3).concat(selectedBlockA.size > 3 ? ['...'] : []) },
    blockB: { count: selectedBlockB.size, ids: Array.from(selectedBlockB).slice(0, 3).concat(selectedBlockB.size > 3 ? ['...'] : []) },
    blockC: { count: selectedBlockC.size, ids: Array.from(selectedBlockC).slice(0, 3).concat(selectedBlockC.size > 3 ? ['...'] : []) },
    blockD: { count: selectedBlockD.size, ids: Array.from(selectedBlockD).slice(0, 3).concat(selectedBlockD.size > 3 ? ['...'] : []) }
  });
  
  // Mark exercises with UI-specific flags
  const exercisesWithFlags = exercises.map(exercise => {
    const tags = exercise.functionTags ?? [];
    
    // Check if this exercise is selected for specific blocks
    const isSelectedBlockA = tags.includes('primary_strength') && selectedBlockA.has(exercise.id);
    const isSelectedBlockB = tags.includes('secondary_strength') && selectedBlockB.has(exercise.id);
    const isSelectedBlockC = tags.includes('accessory') && selectedBlockC.has(exercise.id);
    const isSelectedBlockD = (tags.includes('core') || tags.includes('capacity')) && selectedBlockD.has(exercise.id);
    
    if (isSelectedBlockA || isSelectedBlockB || isSelectedBlockC || isSelectedBlockD) {
      logBlock('Exercise Flagged', {
        name: exercise.name,
        id: exercise.id,
        functionTags: tags,
        flags: { isSelectedBlockA, isSelectedBlockB, isSelectedBlockC, isSelectedBlockD }
      });
    }
    
    return {
      ...exercise,
      isSelected: isSelectedBlockA || isSelectedBlockB || isSelectedBlockC || isSelectedBlockD,
      isSelectedBlockA,
      isSelectedBlockB,
      isSelectedBlockC,
      isSelectedBlockD,
      blockBPenalty: isSelectedBlockA ? 2.0 : 0,
      blockCPenalty: isSelectedBlockB ? 2.0 : 0,
      selectedBlocks: [],
      blockPenalties: {}
    };
  });

  // Debug logging
  const blockACount = exercisesWithFlags.filter(ex => ex.isSelectedBlockA).length;
  const blockBCount = exercisesWithFlags.filter(ex => ex.isSelectedBlockB).length;
  const blockCCount = exercisesWithFlags.filter(ex => ex.isSelectedBlockC).length;
  const blockDCount = exercisesWithFlags.filter(ex => ex.isSelectedBlockD).length;
  
  console.log(`📊 Selected flags set:`);
  console.log(`   - isSelectedBlockA: ${blockACount} exercises marked`);
  console.log(`   - isSelectedBlockB: ${blockBCount} exercises marked`);
  console.log(`   - isSelectedBlockC: ${blockCCount} exercises marked`);
  console.log(`   - isSelectedBlockD: ${blockDCount} exercises marked`);
  
  logBlockTransformation('addPresentationFlags - Complete',
    {
      exercisesIn: exercises.length,
      organizedBlocks: {
        blockA: organizedExercises.blockA.length,
        blockB: organizedExercises.blockB.length,
        blockC: organizedExercises.blockC.length,
        blockD: organizedExercises.blockD.length
      }
    },
    {
      exercisesOut: exercisesWithFlags.length,
      flaggedCounts: {
        blockA: blockACount,
        blockB: blockBCount,
        blockC: blockCCount,
        blockD: blockDCount,
        anyBlock: exercisesWithFlags.filter(ex => ex.isSelected).length
      }
    }
  );
  
  return exercisesWithFlags;
}

/**
 * Smart wrapper that handles both legacy and dynamic organized exercises
 */
export function addPresentationFlagsAuto(
  exercises: ScoredExercise[],
  organizedExercises: OrganizedExercises | Record<string, ScoredExercise[]> | null
): ExerciseWithUIFlags[] {
  // Check if it's legacy format (has blockA, blockB, etc.)
  if (organizedExercises && 'blockA' in organizedExercises) {
    return addPresentationFlags(exercises, organizedExercises as OrganizedExercises);
  }
  
  // Otherwise treat as dynamic format
  return addPresentationFlagsDynamic(exercises, organizedExercises as Record<string, ScoredExercise[]> | null);
}