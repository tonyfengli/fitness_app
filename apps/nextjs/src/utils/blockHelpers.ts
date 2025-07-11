/**
 * Helper functions for working with dynamic blocks
 */

export interface BlockInfo {
  id: string;
  name: string;
  exercises: any[];
  color: string;
  maxCount: number;
}

/**
 * Extract block information from filtered exercises
 * Handles both legacy (isSelectedBlockA) and dynamic formats
 */
export function extractBlockInfo(exercises: any[]): BlockInfo[] {
  // Check if we have legacy flags
  const hasLegacyFlags = exercises.some(ex => 
    'isSelectedBlockA' in ex || 'isSelectedBlockB' in ex || 'isSelectedBlockC' in ex || 'isSelectedBlockD' in ex
  );

  if (hasLegacyFlags) {
    // Legacy format - show all exercises that match the function tags
    return [
      {
        id: 'A',
        name: 'Block A - Primary Strength',
        exercises: exercises.filter(ex => ex.functionTags?.includes('primary_strength')),
        color: 'blue',
        maxCount: 5
      },
      {
        id: 'B',
        name: 'Block B - Secondary Strength',
        exercises: exercises.filter(ex => ex.functionTags?.includes('secondary_strength')),
        color: 'green',
        maxCount: 8
      },
      {
        id: 'C',
        name: 'Block C - Accessory',
        exercises: exercises.filter(ex => ex.functionTags?.includes('accessory')),
        color: 'purple',
        maxCount: 8
      },
      {
        id: 'D',
        name: 'Block D - Core & Capacity',
        exercises: exercises.filter(ex => (ex.functionTags?.includes('core') || ex.functionTags?.includes('capacity'))),
        color: 'orange',
        maxCount: 6
      }
    ];
  }

  // For dynamic format, we need to detect rounds
  // This is a placeholder - we'll need to update exerciseFlags.ts to support dynamic blocks
  const rounds: BlockInfo[] = [];
  
  // Check for Round flags (future implementation)
  for (let i = 1; i <= 9; i++) {
    const roundKey = `isRound${i}Selected`;
    const roundExercises = exercises.filter(ex => ex[roundKey]);
    if (roundExercises.length > 0) {
      rounds.push({
        id: `Round${i}`,
        name: `Round ${i}`,
        exercises: roundExercises,
        color: 'indigo',
        maxCount: 3
      });
    }
  }

  // If no blocks found at all, return the legacy structure as default
  // This ensures backward compatibility when no flags are present
  if (rounds.length === 0 && !hasLegacyFlags) {
    return [
      {
        id: 'A',
        name: 'Block A - Primary Strength',
        exercises: exercises.filter(ex => ex.functionTags?.includes('primary_strength')),
        color: 'blue',
        maxCount: 5
      },
      {
        id: 'B',
        name: 'Block B - Secondary Strength',
        exercises: exercises.filter(ex => ex.functionTags?.includes('secondary_strength')),
        color: 'green',
        maxCount: 8
      },
      {
        id: 'C',
        name: 'Block C - Accessory',
        exercises: exercises.filter(ex => ex.functionTags?.includes('accessory')),
        color: 'purple',
        maxCount: 8
      },
      {
        id: 'D',
        name: 'Block D - Core & Capacity',
        exercises: exercises.filter(ex => (ex.functionTags?.includes('core') || ex.functionTags?.includes('capacity'))),
        color: 'orange',
        maxCount: 6
      }
    ];
  }

  return rounds;
}

/**
 * Get color classes for a block
 */
export function getBlockColorClasses(color: string) {
  const colorMap = {
    blue: {
      container: 'bg-blue-50 border-blue-200',
      header: 'text-blue-800',
      selected: 'bg-blue-200 border-blue-400',
      score: 'text-blue-600',
      label: 'text-blue-700'
    },
    green: {
      container: 'bg-green-50 border-green-200',
      header: 'text-green-800',
      selected: 'bg-green-200 border-green-400',
      score: 'text-green-600',
      label: 'text-green-700'
    },
    purple: {
      container: 'bg-purple-50 border-purple-200',
      header: 'text-purple-800',
      selected: 'bg-purple-200 border-purple-400',
      score: 'text-purple-600',
      label: 'text-purple-700'
    },
    orange: {
      container: 'bg-orange-50 border-orange-200',
      header: 'text-orange-800',
      selected: 'bg-orange-200 border-orange-400',
      score: 'text-orange-600',
      label: 'text-orange-700'
    },
    indigo: {
      container: 'bg-indigo-50 border-indigo-200',
      header: 'text-indigo-800',
      selected: 'bg-indigo-200 border-indigo-400',
      score: 'text-indigo-600',
      label: 'text-indigo-700'
    }
  };

  return colorMap[color as keyof typeof colorMap] || colorMap.blue;
}