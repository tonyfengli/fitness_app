import type { SessionVolume, Exercise } from './types';
import { SET_RANGE_MATRIX } from './constants';

// Helper function to calculate session volume - matches the logic from trainer-dashboard
export function calculateSessionVolume(
  exercises: Exercise[], 
  intensity: string, 
  strengthLevel: string = 'moderate'
): SessionVolume {
  // Get ranges from matrix
  const [minSets, maxSets] = SET_RANGE_MATRIX[strengthLevel]?.[intensity] || [19, 22]; // Default to moderate/moderate

  // Generate reasoning
  const parts: string[] = [];
  
  // Strength level reasoning
  if (strengthLevel === 'very_low' || strengthLevel === 'low') {
    parts.push("Lower strength capacity requires conservative volume");
  } else if (strengthLevel === 'high') {
    parts.push("Higher strength capacity allows for increased training volume");
  }
  
  // Intensity reasoning
  if (intensity === 'high') {
    parts.push("Higher intensity increases total work capacity");
  } else if (intensity === 'low') {
    parts.push("Lower intensity with controlled volume");
  }
  
  parts.push(`Total: ${minSets}-${maxSets} sets for optimal training stimulus`);
  
  const reasoning = parts.join(". ");

  return { minSets, maxSets, reasoning };
}

// Helper to find option label
export function getOptionLabel(
  value: string, 
  options: { value: string; label: string }[]
): string {
  return options.find(o => o.value === value)?.label || value;
}

// Helper to check if exercise is selected for a block
export function isExerciseSelectedForBlock(
  exercise: Exercise,
  blockId: string
): boolean {
  switch (blockId) {
    case 'A': return exercise.isSelectedBlockA || false;
    case 'B': return exercise.isSelectedBlockB || false;
    case 'C': return exercise.isSelectedBlockC || false;
    case 'D': return exercise.isSelectedBlockD || false;
    default: return false;
  }
}

// Helper to filter exercises by function tags
export function filterExercisesByFunctionTags(
  exercises: Exercise[],
  functionTags: string[]
): Exercise[] {
  return exercises.filter(ex => 
    functionTags.some(tag => ex.functionTags?.includes(tag))
  );
}

// Helper to sort exercises by score
export function sortExercisesByScore(exercises: Exercise[]): Exercise[] {
  return [...exercises].sort((a, b) => (b.score || 0) - (a.score || 0));
}